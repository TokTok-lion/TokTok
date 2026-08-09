'use client';

import { getSupabase } from './supabase';
import { currentAccount } from './auth';
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

  const now = new Date().toISOString();
  const { data, error } = await sb
    .from('story_facts')
    .insert(
      keep.map((i: StoryItem) => ({
        tenant_id: t,
        session_id: sessionId,
        participant_id: s.remoteParticipantId!,
        text: i.text,
        status: i.status,
        follow_up: i.followUp ?? null,
        // 확정된 사실에는 "누가 언제 확인했는지"가 있어야 한다 (원칙 1·3).
        decided_by: i.status === 'verified' ? facilitator : null,
        decided_at: i.status === 'verified' ? now : null,
      })),
    )
    .select('id');

  if (error || !data) return { ok: false, reason: '이야기를 저장하지 못했습니다.' };

  // 출처. DB 트리거가 커밋 시점에 확인하므로 빠뜨리면 저장이 거부된다.
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
