'use client';

import { getSupabase } from './supabase';
import { accountReady, currentAccount } from './auth';
import type {
  ParticipantRow,
  SessionRow,
  SourceKind as DbSourceKind,
  StaffRole,
} from './db.types';
import type { SourceKind, StoryItem } from './domain';
import type { SessionState } from './store';

/**
 * 앱은 staffNote, DB 는 staff_note 를 쓴다. 둘을 여기 한 곳에서만 맞춘다 —
 * 문자열을 그대로 흘려보내면 enum 이 조용히 거부하고, 그 실패는 저장 실패로만
 * 보여서 원인을 찾기 어렵다.
 */
const SOURCE_KIND_TO_DB: Record<SourceKind, DbSourceKind> = {
  voice: 'voice',
  card: 'card',
  staffNote: 'staff_note',
  family: 'family',
};

/**
 * 서버 저장소.
 *
 * 앱은 기기 저장(localStorage)을 계속 쓴다. 서버는 그 위에 얹히는 사본이다.
 * 순서를 이렇게 잡은 이유는 현장 때문이다 — 주야간보호센터의 와이파이는
 * 자주 끊기고, 어르신 앞에서 한 시간 들은 이야기가 통신 오류로 사라지는 일은
 * 있어서는 안 된다. 그래서 화면은 항상 로컬을 보고, 서버 저장은 실패해도
 * 회기를 막지 않는다. 다만 실패를 조용히 삼키지 않고 결과를 돌려준다.
 */

export type SaveResult =
  | { ok: true; sessionId: string }
  | { ok: false; reason: string };

function tenant(): string | null {
  const a = currentAccount();
  return a.status === 'in' ? a.tenantId : null;
}

/** 서버에 쓸 수 있는 상태인가 (설정됨 + 로그인 + 소속 있음). */
export function canSync(): boolean {
  return Boolean(getSupabase()) && tenant() !== null;
}

/**
 * 같은 질문을 "확인이 끝난 뒤에" 한다.
 *
 * 쓰기 직전에는 이쪽을 쓴다. canSync() 는 지금 이 순간의 답이라, 앱이 막
 * 뜬 직후에는 아직 확인 중이라는 이유만으로 false 가 나온다.
 */
export async function readyToSync(): Promise<boolean> {
  if (!getSupabase()) return false;
  const a = await accountReady();
  return a.status === 'in';
}

/* --------------------------------------------------------- 어르신 */

export async function listParticipants(): Promise<ParticipantRow[]> {
  const sb = getSupabase();
  const t = tenant();
  if (!sb || !t) return [];
  const { data, error } = await sb
    .from('participants')
    .select('*')
    .eq('tenant_id', t)
    .order('display_name');
  if (error) return [];
  return data ?? [];
}

export async function createParticipant(
  displayName: string,
  opts: { honorific?: string; avatarKey?: string; internalNo?: string } = {},
): Promise<{ ok: boolean; id?: string; reason?: string }> {
  const sb = getSupabase();
  const t = tenant();
  if (!sb || !t) return { ok: false, reason: '로그인이 필요합니다.' };
  const { data, error } = await sb
    .from('participants')
    .insert({
      tenant_id: t,
      display_name: displayName,
      honorific: opts.honorific ?? null,
      avatar_key: opts.avatarKey ?? null,
      internal_no: opts.internalNo ?? null,
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, reason: '어르신을 등록하지 못했습니다.' };
  void audit('participant.create', `participant:${data.id}`);
  return { ok: true, id: data.id };
}

/* --------------------------------------------------------- 회기 저장 */

/**
 * 지금 회기를 서버에 반영한다.
 *
 * 같은 회기를 여러 번 저장해도 하나로 남아야 하므로, 로컬이 들고 있는
 * remoteSessionId 를 키로 쓴다. 없으면 만들고, 있으면 갱신한다.
 *
 * 이야기 항목은 지우고 다시 넣는다. 회기 하나의 항목은 많아야 수십 개라
 * 차이를 계산하는 복잡도가 이득보다 크고, 확정된 사실에는 출처가 반드시
 * 함께 들어가야 하는데(원칙 2) 그 짝을 한 번에 맞추는 편이 안전하다.
 */
export async function saveSession(s: SessionState): Promise<SaveResult> {
  const sb = getSupabase();
  const t = tenant();
  if (!sb || !t) return { ok: false, reason: '로그인이 필요합니다.' };
  if (!s.remoteParticipantId) {
    return { ok: false, reason: '어르신을 먼저 선택해 주세요.' };
  }

  const account = currentAccount();
  const facilitator =
    account.status === 'in' ? await membershipId(account.userId, t) : null;

  const row = {
    tenant_id: t,
    participant_id: s.remoteParticipantId,
    facilitator,
    topic: s.topic,
    status: s.logSaved ? ('done' as const) : ('running' as const),
    step: s.remoteStep,
    started_at: s.remoteStartedAt ?? new Date().toISOString(),
    ended_at: s.logSaved ? new Date().toISOString() : null,
  };

  let sessionId = s.remoteSessionId;
  if (sessionId) {
    const { error } = await sb.from('sessions').update(row).eq('id', sessionId);
    if (error) return { ok: false, reason: '회기를 저장하지 못했습니다.' };
  } else {
    const { data, error } = await sb.from('sessions').insert(row).select('id').single();
    if (error || !data) return { ok: false, reason: '회기를 만들지 못했습니다.' };
    sessionId = data.id;
  }

  const factsResult = await replaceFacts(sessionId, t, s, facilitator);
  if (!factsResult.ok) return factsResult;

  // 관찰 기록 — 본 행동만 남긴다 (원칙 7)
  await sb.from('observations').delete().eq('session_id', sessionId);
  if (s.reactions.length || s.reactionNote) {
    await sb.from('observations').insert({
      tenant_id: t,
      session_id: sessionId,
      reactions: s.reactions,
      note: s.reactionNote || null,
      recorder: facilitator,
    });
  }

  // 활동일지 — AI 초안은 복지사가 확정해야 최종 기록이 된다
  await sb.from('activity_logs').delete().eq('session_id', sessionId);
  if (s.logDraft) {
    await sb.from('activity_logs').insert({
      tenant_id: t,
      session_id: sessionId,
      draft: s.logDraft,
      next_topic: s.nextTopic || null,
      confirmed_by: s.logSaved ? facilitator : null,
      confirmed_at: s.logSaved ? new Date().toISOString() : null,
    });
  }

  void audit('session.save', `session:${sessionId}`);
  return { ok: true, sessionId };
}

async function replaceFacts(
  sessionId: string,
  t: string,
  s: SessionState,
  facilitator: string | null,
): Promise<SaveResult> {
  const sb = getSupabase()!;
  await sb.from('story_facts').delete().eq('session_id', sessionId);

  const keep = s.story.filter((i) => i.status !== 'excluded');
  if (!keep.length) return { ok: true, sessionId };

  /*
   * 세 번에 나눠 넣는다 — 넣고, 출처를 붙이고, 그다음에 확정으로 올린다.
   *
   * DB 는 "출처 없는 이야기는 확정할 수 없다"를 지연 제약 트리거로 지킨다.
   * 지연이라 함은 커밋 시점에 본다는 뜻인데, REST 는 요청 하나가 트랜잭션
   * 하나라서 사실과 출처를 같은 커밋에 담을 방법이 없다. 그대로 두면
   * 확정된 이야기가 있는 회기는 무슨 수를 써도 저장에 실패한다.
   *
   * 그래서 순서를 바꿨다. 규칙을 느슨하게 푼 것이 아니라, 트리거가 볼 때는
   * 이미 출처가 있게 만든 것이다.
   */
  const { data, error } = await sb
    .from('story_facts')
    .insert(
      keep.map((i: StoryItem) => ({
        tenant_id: t,
        session_id: sessionId,
        participant_id: s.remoteParticipantId!,
        text: i.text,
        status: 'unverified' as const,
        follow_up: i.followUp ?? null,
      })),
    )
    .select('id');

  if (error || !data) return { ok: false, reason: '이야기를 저장하지 못했습니다.' };

  const sources = data.flatMap((r, idx) => {
    const item = keep[idx];
    return (item.sources ?? []).map((src) => ({
      fact_id: r.id,
      kind: SOURCE_KIND_TO_DB[src.kind],
      at_sec: src.at ?? null,
      label: src.label,
    }));
  });
  if (sources.length) {
    const { error: srcErr } = await sb.from('fact_sources').insert(sources);
    if (srcErr) return { ok: false, reason: '이야기 출처를 저장하지 못했습니다.' };
  }

  // 확정된 사실에는 "누가 언제 확인했는지"가 있어야 한다 (원칙 1·3).
  const promote = data
    .map((r, idx) => ({ id: r.id, item: keep[idx] }))
    .filter(({ item }) => item.status === 'verified');

  // 출처 없는 확정은 앱에서 이미 막고 있지만(assertStoryIntegrity), 여기서
  // 한 번 더 걸러 낸다. 이 줄이 없으면 앱의 실수 하나가 회기 전체의 저장
  // 실패로 번진다.
  const grounded = promote.filter(({ item }) => (item.sources ?? []).length > 0);
  if (grounded.length) {
    const { error: vErr } = await sb
      .from('story_facts')
      .update({
        status: 'verified',
        decided_by: facilitator,
        decided_at: new Date().toISOString(),
      })
      .in(
        'id',
        grounded.map(({ id }) => id),
      );
    if (vErr) return { ok: false, reason: '이야기 확인 표시를 저장하지 못했습니다.' };
  }
  if (grounded.length !== promote.length) {
    return { ok: false, reason: '출처 없는 이야기가 있어 확인 표시를 남기지 못했습니다.' };
  }
  return { ok: true, sessionId };
}

async function membershipId(userId: string, t: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from('memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('tenant_id', t)
    .maybeSingle();
  return data?.id ?? null;
}

/* --------------------------------------------------------- 센터장 콘솔 */

export type CenterStats = {
  elders: number;
  sessionsThisMonth: number;
  sessionsDone: number;
  sessionsRunning: number;
  consentExpiring: number;
  staff: { role: StaffRole; count: number }[];
  recent: { id: string; topic: string; status: string; at: string }[];
};

/** 직원 한 사람이 실제로 무엇을 했는지 — 점수가 아니라 개수만 센다. */
export type StaffLoad = {
  membershipId: string;
  role: StaffRole;
  /** 이번 달 맡은 회기 수 */
  sessionsThisMonth: number;
  /** 아직 확정하지 않은 활동일지 */
  logsPending: number;
  /** 마지막으로 회기를 진행한 날 */
  lastActive: string | null;
};

/**
 * 곡을 몇 개 만들었고 요금이 얼마나 나갔는지.
 *
 * 실측값으로 계산한다 — 90초 곡 하나가 1,125크레딧이고, Starter 39,935
 * 크레딧이 $6 이므로 크레딧당 약 0.00015달러다. 전사·읽어주기·가사는
 * 곡에 비하면 없는 수준이라 따로 세지 않고 그렇게 적는다.
 *
 * 어림값이라는 것을 화면에서 감추지 않는다. 청구서가 아니라 가늠자다.
 */
export type CostEstimate = {
  songs: number;
  credits: number;
  krw: number;
  quotaLeft: number | null;
  quota: number | null;
};

const CREDITS_PER_SONG = 1125;
const USD_PER_CREDIT = 6 / 39_935;
const KRW_PER_USD = 1400;

/**
 * 콘솔이 쓰는 집계.
 *
 * 권한 표에 따르면 센터장은 원음성 "기본 미열람", 전사·스토리는 "진행상태"만
 * 본다. 그래서 여기서 이야기 본문이나 가사를 절대 가져오지 않는다 — 화면이
 * 실수로 보여줄 수 있는 것을 애초에 손에 쥐여 주지 않는다.
 */
export async function centerStats(): Promise<CenterStats | null> {
  const sb = getSupabase();
  const t = tenant();
  if (!sb || !t) return null;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);

  const [elders, month, done, running, expiring, staff, recent] = await Promise.all([
    sb.from('participants').select('id', { count: 'exact', head: true })
      .eq('tenant_id', t).eq('status', 'active'),
    sb.from('sessions').select('id', { count: 'exact', head: true })
      .eq('tenant_id', t).gte('created_at', monthStart.toISOString()),
    sb.from('sessions').select('id', { count: 'exact', head: true })
      .eq('tenant_id', t).eq('status', 'done'),
    sb.from('sessions').select('id', { count: 'exact', head: true })
      .eq('tenant_id', t).eq('status', 'running'),
    sb.from('consents').select('id', { count: 'exact', head: true })
      .eq('tenant_id', t).eq('state', 'granted').lte('expires_at', soon.toISOString()),
    sb.from('memberships').select('role').eq('tenant_id', t).eq('status', 'active'),
    sb.from('sessions').select('id, topic, status, created_at')
      .eq('tenant_id', t).order('created_at', { ascending: false }).limit(5),
  ]);

  const byRole = new Map<StaffRole, number>();
  for (const m of staff.data ?? []) {
    byRole.set(m.role, (byRole.get(m.role) ?? 0) + 1);
  }

  return {
    elders: elders.count ?? 0,
    sessionsThisMonth: month.count ?? 0,
    sessionsDone: done.count ?? 0,
    sessionsRunning: running.count ?? 0,
    consentExpiring: expiring.count ?? 0,
    staff: [...byRole.entries()].map(([role, count]) => ({ role, count })),
    recent: (recent.data ?? []).map((r: Pick<SessionRow, 'id' | 'topic' | 'status' | 'created_at'>) => ({
      id: r.id,
      topic: r.topic,
      status: r.status,
      at: r.created_at,
    })),
  };
}

/**
 * 직원별 업무량.
 *
 * 개수만 센다. 점수나 순위는 만들지 않는다 — 복지사를 줄 세우는 도구가 되면
 * 어르신께 쓸 시간을 기록 채우는 데 쓰게 된다(명세서의 직원 지표 제약).
 */
export async function staffLoads(): Promise<StaffLoad[]> {
  const sb = getSupabase();
  const t = tenant();
  if (!sb || !t) return [];

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [members, sessions, logs] = await Promise.all([
    sb.from('memberships').select('id, role').eq('tenant_id', t).eq('status', 'active'),
    sb.from('sessions').select('facilitator, created_at').eq('tenant_id', t),
    sb.from('activity_logs').select('session_id, confirmed_at').eq('tenant_id', t),
  ]);

  // 회기를 세션 id 로 이어 붙여야 "누구의 미확정 일지"인지 알 수 있다
  const sessionOwner = new Map<string, string | null>();
  const { data: allSessions } = await sb
    .from('sessions')
    .select('id, facilitator')
    .eq('tenant_id', t);
  for (const s of allSessions ?? []) sessionOwner.set(s.id, s.facilitator);

  const pendingBy = new Map<string, number>();
  for (const l of logs.data ?? []) {
    if (l.confirmed_at) continue;
    const owner = sessionOwner.get(l.session_id ?? '');
    if (!owner) continue;
    pendingBy.set(owner, (pendingBy.get(owner) ?? 0) + 1);
  }

  return (members.data ?? []).map((m) => {
    const mine = (sessions.data ?? []).filter((s) => s.facilitator === m.id);
    const thisMonth = mine.filter(
      (s) => new Date(s.created_at) >= monthStart,
    ).length;
    const last = mine
      .map((s) => s.created_at)
      .sort()
      .at(-1);
    return {
      membershipId: m.id,
      role: m.role,
      sessionsThisMonth: thisMonth,
      logsPending: pendingBy.get(m.id) ?? 0,
      lastActive: last ?? null,
    };
  });
}

/** 이번 달 곡 사용량과 어림 요금. */
export async function costEstimate(): Promise<CostEstimate | null> {
  const sb = getSupabase();
  const t = tenant();
  if (!sb || !t) return null;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [{ count }, quotaRes, tenantRes] = await Promise.all([
    sb
      .from('songs')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', t)
      .gte('created_at', monthStart.toISOString()),
    sb.rpc('song_quota_left'),
    sb.from('tenants').select('song_quota').eq('id', t).maybeSingle(),
  ]);

  const songs = count ?? 0;
  const credits = songs * CREDITS_PER_SONG;
  return {
    songs,
    credits,
    krw: Math.round(credits * USD_PER_CREDIT * KRW_PER_USD),
    quotaLeft: typeof quotaRes.data === 'number' ? quotaRes.data : null,
    quota: tenantRes.data?.song_quota ?? null,
  };
}

/* --------------------------------------------------------- 감사로그 */

/**
 * 권한·동의·승인·삭제는 흔적이 남아야 한다 (NFR-OPS-003).
 * 실패해도 본 작업을 막지 않는다 — 로그를 못 남긴다고 어르신 기록을
 * 못 저장하게 만들면 더 나쁜 결과가 된다.
 */
export async function audit(action: string, target?: string, reason?: string) {
  const sb = getSupabase();
  const a = currentAccount();
  if (!sb || a.status !== 'in') return;
  await sb.from('audit_log').insert({
    tenant_id: a.tenantId,
    actor: a.userId,
    action,
    target: target ?? null,
    reason: reason ?? null,
  });
}
