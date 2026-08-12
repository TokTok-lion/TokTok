'use client';

import { getSupabase } from './supabase';
import { accountReady, currentAccount } from './auth';
import type {
  ConsentKind as DbConsentKind,
  ParticipantRow,
  SessionRow,
  SourceKind as DbSourceKind,
  StaffRole,
} from './db.types';
import { DEFAULT_CONSENTS } from './domain';
import type {
  ConsentKind,
  ConsentState,
  Consents,
  SourceKind,
  StoryItem,
} from './domain';
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

/** 되읽을 때 쓰는 반대 방향 표. 위 표에서 그대로 뒤집어 만들어 둘이 어긋나지 않게 한다. */
const DB_KIND_TO_SOURCE = Object.fromEntries(
  Object.entries(SOURCE_KIND_TO_DB).map(([app, db]) => [db, app as SourceKind]),
) as Record<DbSourceKind, SourceKind>;

/** 같은 이유로 동의 종류도 여기서만 맞춘다. 앱은 externalAi, DB 는 external_ai. */
const CONSENT_KIND_TO_DB: Record<ConsentKind, DbConsentKind> = {
  recording: 'recording',
  externalAi: 'external_ai',
  facilityPlay: 'facility_play',
  familyShare: 'family_share',
  promotion: 'promotion',
};

const CONSENT_KIND_FROM_DB: Record<DbConsentKind, ConsentKind> = {
  recording: 'recording',
  external_ai: 'externalAi',
  facility_play: 'facilityPlay',
  family_share: 'familyShare',
  promotion: 'promotion',
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

/** 이 어르신이 아직 기관 목록에 있는가. 지워졌으면 false. */
export async function participantExists(id: string): Promise<boolean> {
  const sb = getSupabase();
  const t = tenant();
  if (!sb || !t) return false;
  const { data } = await sb
    .from('participants')
    .select('id')
    .eq('tenant_id', t)
    .eq('id', id)
    .maybeSingle();
  return Boolean(data);
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

/**
 * 어르신의 이용 상태를 바꾼다 — 이용 중 · 일시중지 · 종료.
 *
 * ── 왜 없었나
 *
 * participants.status 칸도 있고 목록의 「이용 중/일시중지/종료」 거르개도 있는데,
 * 그 값을 **바꾸는 코드가 어디에도 없었다**. 그래서 등록한 모든 어르신이 영영
 * 이용 중이고, 나머지 두 거르개는 언제 눌러도 0명이었다. 화면만 있고 기능이
 * 없던 자리다.
 *
 * 실제로는 자주 일어나는 일이다 — 입원하시거나 한동안 안 나오시면 일시중지,
 * 퇴소하시면 종료. 목록이 스무 명을 넘어가면 이 구분이 없는 목록은 못 쓴다.
 *
 * ── 종료가 끝이 아니다
 *
 * 되돌릴 수 있어야 한다. 퇴소하셨다 다시 오시는 일이 있고, 잘못 눌렀을 수도
 * 있다. 되돌릴 수 없게 만들면 복지사가 무서워서 아무 상태도 안 바꾼다.
 *
 * 지우는 것이 아니라는 점이 중요하다. 종료는 목록에서 내리는 표시일 뿐,
 * 그 어르신의 이야기·곡·기록은 그대로 남는다.
 */
/** 이 어르신의 지금 이용 상태. 못 읽으면 null — 화면이 '모른다'로 그린다. */
export async function readParticipantStatus(
  participantId: string,
): Promise<'active' | 'paused' | 'ended' | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const account = await accountReady();
  const t = account.status === 'in' ? account.tenantId : null;
  if (!t) return null;
  const { data } = await sb
    .from('participants')
    .select('status')
    .eq('tenant_id', t)
    .eq('id', participantId)
    .maybeSingle();
  return data?.status ?? null;
}

export async function setParticipantStatus(
  participantId: string,
  status: 'active' | 'paused' | 'ended',
): Promise<{ ok: boolean; reason?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: '로그인이 필요합니다.' };
  const account = await accountReady();
  const t = account.status === 'in' ? account.tenantId : null;
  if (!t) return { ok: false, reason: '로그인이 필요합니다.' };

  const { error } = await sb
    .from('participants')
    .update({ status })
    .eq('tenant_id', t)
    .eq('id', participantId);
  if (error) return { ok: false, reason: '이용 상태를 바꾸지 못했습니다.' };

  // 누가 언제 내렸는지 남는다. 종료는 목록에서 사라지게 하는 결정이라,
  // 나중에 "누가 내렸느냐"를 물을 일이 생긴다.
  void audit(`participant.${status}`, `participant:${participantId}`);
  return { ok: true };
}

/* ------------------------------------------------- 어르신별 동의·선호 */

/** 어르신 한 분에게 붙는 값들. 기기가 아니라 사람에게 귀속된다. */
export type ParticipantRecord = {
  consents: Consents;
  communication: string[];
  musicPreferences: string[];
  avoidTopics: string[];
};

/**
 * 이 어르신의 동의와 선호를 서버에서 읽는다.
 *
 * 스키마에는 참가자별 consents 테이블이 처음부터 있었는데 앱이 한 번도 읽지
 * 않았다. 그래서 동의가 "이 어르신의 것"이 아니라 "이 기기의 현재 세션"에
 * 붙어 있었고, 어르신을 바꾸면 앞분의 granted 가 그대로 따라왔다. 동의한 적
 * 없는 분의 원음성이 외부로 나가는 길이었다.
 *
 * 읽지 못하면 null 이다. 부르는 쪽은 전부 unset 으로 두어야 한다 — 모르는 것은
 * 허용이 아니라 미동의다(hasConsent 가 unset 을 false 로 본다).
 */
export async function readParticipantRecord(
  participantId: string,
): Promise<ParticipantRecord | null> {
  const sb = getSupabase();
  const t = tenant();
  if (!sb || !t) return null;

  const [consentRes, participantRes] = await Promise.all([
    sb
      .from('consents')
      .select('*')
      .eq('tenant_id', t)
      .eq('participant_id', participantId),
    sb
      .from('participants')
      .select('*')
      .eq('tenant_id', t)
      .eq('id', participantId)
      .maybeSingle(),
  ]);
  // 동의를 못 읽었으면 선호만 채우고 넘어가지 않는다. 절반만 맞는 상태보다
  // "아직 모른다"가 안전하다.
  if (consentRes.error) return null;

  const consents: Consents = { ...DEFAULT_CONSENTS };
  const now = Date.now();
  for (const row of consentRes.data ?? []) {
    const kind = CONSENT_KIND_FROM_DB[row.kind];
    if (!kind) continue;
    // 기간이 지난 동의는 동의가 아니다. 목록 화면이 "동의 D-3"을 띄우면서
    // 만료된 granted 를 그대로 읽으면 그 경고는 장식이 된다.
    const expired =
      row.expires_at !== null && new Date(row.expires_at).getTime() <= now;
    consents[kind] = row.state === 'granted' && expired ? 'unset' : row.state;
  }

  const p = participantRes.data;
  return {
    consents,
    communication: p?.comm_prefs ?? [],
    musicPreferences: p?.music_prefs ?? [],
    avoidTopics: p?.avoid_topics ?? [],
  };
}

/**
 * 동의 한 건을 이 어르신 기록에 남긴다.
 *
 * /더보기의 스위치가 "이 기기"가 아니라 "이 어르신"의 동의가 되려면 여기까지
 * 와야 한다. 결과를 돌려주는 이유는 부르는 쪽이 방향에 따라 다르게 처리해야
 * 하기 때문이다 — 허용은 기록이 남아야 허용이고, 철회는 기록에 실패해도
 * 철회다.
 */
export async function writeConsent(
  participantId: string,
  kind: ConsentKind,
  state: ConsentState,
): Promise<{ ok: boolean; reason?: string }> {
  const sb = getSupabase();
  const t = tenant();
  if (!sb || !t) return { ok: false, reason: '로그인이 필요합니다.' };

  // (participant_id, kind) 가 유일키라 같은 항목을 여러 번 켰다 꺼도 행이
  // 늘지 않고 마지막 결정만 남는다.
  const { error } = await sb.from('consents').upsert(
    {
      tenant_id: t,
      participant_id: participantId,
      kind: CONSENT_KIND_TO_DB[kind],
      state,
      method: 'app',
      decided_at: new Date().toISOString(),
    },
    { onConflict: 'participant_id,kind' },
  );
  if (error) return { ok: false, reason: '동의 기록을 저장하지 못했습니다.' };

  // 동의 변경은 흔적이 남아야 한다 (NFR-OPS-003).
  void audit(`consent.${state}`, `participant:${participantId}`, kind);
  return { ok: true };
}

/* --------------------------------------------------------- 회기 저장 */

/**
 * 회기가 어디까지 왔는지만 서버에 남긴다.
 *
 * ── 왜 필요한가
 *
 * 서버에 회기를 쓰는 곳이 saveSession 하나뿐이었고, 그것은 활동일지의
 * 「저장하고 내보내기」에서만 불린다. 그래서 복지사가 회기를 시작해 인터뷰를
 * 하고 이야기를 정리하고 노래까지 만들어도, 마지막 버튼을 누르기 전에는
 * 기관 쪽에 **아무 흔적도 없었다**. 다른 복지사의 태블릿에서도, 센터장
 * 콘솔에서도 그 회기는 존재하지 않는다.
 *
 * 게다가 remoteStep 은 값을 넣는 코드가 아예 없어서 늘 1 이었다. 콘솔의
 * 진행상태가 모든 회기에 대해 1/9 로 보인다는 뜻이다 — 명세가 센터장에게
 * 주기로 한 정보가 그것 하나인데 그게 상수였다.
 *
 * 그래서 단계를 넘길 때마다 회기 행만 가볍게 맞춘다. 이야기·관찰·일지는
 * 건드리지 않는다 — 그것들은 사람이 확인하고 저장하는 것이고(원칙 3),
 * 여기서 함께 올리면 확인 전 초안이 기관 기록이 된다.
 *
 * 실패해도 조용히 지나간다. 어르신 앞에서 화면을 멈출 이유가 없고, 다음
 * 단계에서 다시 시도된다.
 */
export async function saveProgress(
  s: SessionState,
  step: number,
): Promise<{ sessionId: string; step: number } | null> {
  const sb = getSupabase();
  if (!sb || !s.remoteParticipantId) return null;

  /*
   * 로그인 확인이 끝나기를 기다린다.
   *
   * tenant() 는 currentAccount() 를 그 자리에서 읽는다. 다른 저장은 사람이
   * 버튼을 누를 때 도는 것이라 그때는 이미 확인이 끝나 있지만, 이 함수는
   * 화면이 뜨자마자 돈다 — 그 순간의 상태는 'loading' 이고, 그러면 소속이
   * 없는 것으로 읽혀 조용히 아무것도 안 하고 끝난다. 실제로 그렇게 한 번
   * 놓쳤다.
   */
  const account = await accountReady();
  const t = account.status === 'in' ? account.tenantId : null;
  if (!t) return null;
  const facilitator =
    account.status === 'in' ? await membershipId(account.userId, t) : null;

  const row = {
    tenant_id: t,
    participant_id: s.remoteParticipantId,
    facilitator,
    topic: s.topic,
    // 진행 중이라고만 말한다. 끝났다고 말할 수 있는 것은 활동일지를 저장한
    // saveSession 뿐이다.
    status: 'running' as const,
    step,
  };

  if (s.remoteSessionId) {
    // ended_at 과 status='done' 은 건드리지 않는다. 이미 마무리한 회기를
    // 뒤늦게 열어 봤다는 이유로 '진행 중'으로 되돌리면 콘솔이 거짓말을 한다.
    const { error } = await sb
      .from('sessions')
      .update(row)
      .eq('id', s.remoteSessionId)
      .neq('status', 'done');
    return error ? null : { sessionId: s.remoteSessionId, step };
  }

  const { data, error } = await sb
    .from('sessions')
    .insert({ ...row, started_at: s.remoteStartedAt ?? new Date().toISOString() })
    .select('id')
    .single();
  if (error || !data) return null;
  return { sessionId: data.id, step };
}

/* ----------------------------------------------------- 작업대 나누기 */

/**
 * 회기의 중간 산물을 기관 저장소에 올린다 — 전사·이야기·가사.
 *
 * ── 왜
 *
 * 어르신 목록도 동의도 곡도 기관 단위로 나뉘는데, 정작 그 회기의 알맹이는
 * 만든 태블릿 안에만 있었다. 복지사 A가 받은 이야기를 B가 이어받을 수 없고,
 * A의 태블릿이 고장 나면 그대로 사라진다. 어르신께 한 시간 들은 이야기다.
 *
 * ── 확인 전 초안을 올려도 되는가
 *
 * 된다. 다만 **상태를 그대로 지고 올라가야** 한다. story_facts 에는
 * unverified/verified 칸이 있고(원칙 3), transcripts 에는 confirmed 가,
 * lyrics 에는 approved_at 이 있다. 초안을 초안이라고 적어 올리는 것과, 초안을
 * 확정처럼 올리는 것은 전혀 다른 일이다 — 뒤엣것만 금지다.
 *
 * ── 실패해도 회기를 막지 않는다
 *
 * 어르신 앞에서 통신 때문에 멈추면 안 된다. 다만 조용히 실패하지도 않는다 —
 * 곡이 그렇게 한 번도 저장되지 않은 채 지나갔다(0006).
 */
export async function saveWorkbench(
  s: SessionState,
  sessionId: string,
): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const account = await accountReady();
  const t = account.status === 'in' ? account.tenantId : null;
  if (!t || !s.remoteParticipantId) return false;

  const facilitator =
    account.status === 'in' ? await membershipId(account.userId, t) : null;

  let ok = true;

  /*
   * 전사. 씨앗(예시) 줄은 빼고 올린다 — 둘러보기용으로 넣어 둔 문장이
   * 기관 기록에 어르신 말씀으로 앉으면 안 된다.
   */
  const lines = s.transcript.filter((l) => !l.example);
  if (lines.length) {
    const { error } = await sb.from('transcripts').upsert(
      {
        tenant_id: t,
        session_id: sessionId,
        lines,
        confirmed: s.transcriptConfirmed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'session_id' },
    );
    if (error) {
      syncWarn('전사', error.message);
      ok = false;
    }
  }

  // 가사. 승인 전이면 approved_at 을 비워 둔다 — 그 빈칸이 '아직 초안'이다.
  if (s.lyrics.length) {
    const { error } = await sb.from('lyrics').upsert(
      {
        tenant_id: t,
        session_id: sessionId,
        version: 1,
        sections: s.lyrics,
        approved_by: s.lyricsApproved ? facilitator : null,
        approved_at: s.lyricsApproved ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'session_id,version' },
    );
    if (error) {
      syncWarn('가사', error.message);
      ok = false;
    }
  }

  // 이야기는 이미 만들어 둔 길로 보낸다. 출처를 함께 넣는 규칙(원칙 2)이
  // 그 안에 있어서, 여기서 따로 쓰면 그 규칙이 두 벌이 된다.
  if (s.story.length) {
    const facts = await replaceFacts(sessionId, t, s, facilitator);
    if (!facts.ok) {
      syncWarn('이야기', facts.reason);
      ok = false;
    }
  }

  return ok;
}

/** 올리기가 실패하면 흔적을 남긴다. 조용한 실패가 곡에서 얼마나 오래 갔는지 봤다. */
function syncWarn(what: string, message: string): void {
  console.warn(`[똑똑] ${what}를 기관 기록에 올리지 못했어요: ${message}`);
}

/** 다른 태블릿에 열려 있는 회기. 이어받기 전에 무엇이 있는지 보여 준다. */
export type OpenSession = {
  sessionId: string;
  startedAt: string | null;
  step: number;
  /** 이 회기를 연 복지사의 memberships.id. 내가 연 것인지 가리는 데 쓴다. */
  facilitator: string | null;
  transcript: SessionState['transcript'];
  transcriptConfirmed: boolean;
  lyrics: SessionState['lyrics'];
  lyricsApproved: boolean;
  story: StoryItem[];
};

/**
 * 이 어르신에게 진행 중인 회기가 기관에 있는지 본다.
 *
 * 다른 태블릿에서 열어 둔 회기를 이어받는 길이다. 자동으로 덮어쓰지 않는다 —
 * 부르는 쪽(app/elder)이 사람에게 먼저 묻는다. 남이 하던 일을 말없이 가져오면,
 * 두 복지사가 같은 회기를 서로 모른 채 고치게 된다.
 *
 * 끝난 회기(status='done')는 가져오지 않는다. 그건 이어받을 일이 아니라 지난
 * 기록이고, 기록 화면이 따로 보여 준다.
 */
export async function findOpenSession(participantId: string): Promise<OpenSession | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const account = await accountReady();
  if (account.status !== 'in') return null;

  const { data: row } = await sb
    .from('sessions')
    .select('id, started_at, step, facilitator')
    .eq('participant_id', participantId)
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row) return null;

  const [tr, ly, facts] = await Promise.all([
    sb.from('transcripts').select('lines, confirmed').eq('session_id', row.id).maybeSingle(),
    sb
      .from('lyrics')
      .select('sections, approved_at')
      .eq('session_id', row.id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from('story_facts')
      .select('id, text, status, follow_up')
      .eq('session_id', row.id)
      .order('created_at'),
  ]);

  /*
   * 출처는 따로 읽어 붙인다. 한 번에 묶어 오는 편이 요청은 적지만, 그러려면
   * 두 표의 관계를 타입에 적어 둬야 하고 그 선언이 실제 외래키와 어긋나는
   * 순간 조용히 빈 배열이 된다 — 출처가 사라지면 사실이 통째로 버려진다.
   */
  const factRows = facts.data ?? [];
  const srcByFact = new Map<string, StoryItem['sources']>();
  if (factRows.length) {
    const { data: srcRows } = await sb
      .from('fact_sources')
      .select('fact_id, kind, at_sec, label')
      .in(
        'fact_id',
        factRows.map((f) => f.id),
      );
    for (const src of srcRows ?? []) {
      const list = srcByFact.get(src.fact_id) ?? [];
      list.push({
        kind: DB_KIND_TO_SOURCE[src.kind] ?? 'staffNote',
        at: src.at_sec ?? undefined,
        label: src.label,
      });
      srcByFact.set(src.fact_id, list);
    }
  }

  return {
    sessionId: row.id,
    startedAt: row.started_at,
    step: row.step,
    facilitator: row.facilitator,
    transcript: (tr.data?.lines as SessionState['transcript'] | undefined) ?? [],
    transcriptConfirmed: Boolean(tr.data?.confirmed),
    lyrics: (ly.data?.sections as SessionState['lyrics'] | undefined) ?? [],
    lyricsApproved: Boolean(ly.data?.approved_at),
    /*
     * 출처가 없는 사실은 버린다. 원칙 1 — 근거 없는 문장은 이야기가 아니고,
     * 가사로 넘어가면 어르신이 하지 않은 말이 노래가 된다. 서버 트리거가
     * 막고 있지만, 읽는 쪽에서도 한 번 더 본다.
     */
    story: factRows
      .map((f) => ({
        id: f.id,
        text: f.text,
        status: f.status === 'verified' ? ('verified' as const) : ('unverified' as const),
        followUp: f.follow_up ?? undefined,
        sources: srcByFact.get(f.id) ?? [],
      }))
      .filter((i) => i.sources.length > 0),
  };
}

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
    ended_at: s.logSaved ? new Date().toISOString() : null,
  };

  let sessionId = s.remoteSessionId;
  if (sessionId) {
    // started_at 은 갱신에서 뺀다. 회기 시작 시각은 저장 버튼을 누른 시각이
    // 아니다 — 저장할 때마다 시작이 뒤로 밀리면 소요시간이 계속 줄어든다.
    const { error } = await sb.from('sessions').update(row).eq('id', sessionId);
    if (error) return { ok: false, reason: '회기를 저장하지 못했습니다.' };
  } else {
    // 저장 버튼은 활동일지를 확정한 뒤에만 눌리므로, 여기서 시각을 찍으면
    // started_at 과 ended_at 이 같은 순간이 되어 모든 회기가 0분이 된다.
    // 어르신을 고른 시점(beginSession)에 남겨 둔 값을 쓴다.
    const { data, error } = await sb
      .from('sessions')
      .insert({
        ...row,
        started_at: s.remoteStartedAt ?? new Date().toISOString(),
      })
      .select('id')
      .single();
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
      // 다음 추천 주제는 아직 아무것도 계산하지 않는다. 실제 회기에서는
      // 비어 있고(store.beginSession), 비어 있으면 기록에도 넣지 않는다 —
      // 한 번도 계산된 적 없는 고정 문자열이 기관 활동일지에 'AI 추천'으로
      // 남는 것이 이 자리에서 벌어지던 일이다.
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
 * 곡값만 센다. 전사·읽어주기·가사는 곡에 비하면 없는 수준이다.
 *
 * 어림값이라는 것을 화면에서 감추지 않는다. 청구서가 아니라 가늠자다.
 */
export type CostEstimate = {
  songs: number;
  krw: number;
  quotaLeft: number | null;
  quota: number | null;
};

/**
 * 곡 하나에 드는 어림 요금.
 *
 * ── 업체를 바꾸면 이 숫자도 바뀐다. 실제로 바뀌었는데 안 고쳤다.
 *
 * 오래된 주석들이 "곡 하나가 1,125크레딧"이라고 적고 있었다. 그건 ElevenLabs
 * 때의 값이다. 지금은 APIFrame(Suno 경유)을 쓰고, 한 번 만들 때
 * **11크레딧**이 나간다. 크레딧당 $0.01 이므로 한 번에 $0.11 이다.
 *
 * 한 번에 트랙이 **두 개** 나오는데 앱은 첫 번째만 쓴다(music-apiframe).
 * 그러니 우리가 실제로 드리는 곡 하나의 값은 $0.11 — 1달러 1,400원으로 보면
 * 155원쯤이다. 두 번째 트랙을 쓰기 시작하면 곡당 절반이 된다.
 *
 * 낡은 숫자를 그냥 둔 값이 컸다. 그 숫자를 근거로 "곡이 비싸니 이건 하지
 * 말자"는 판단이 여러 번 내려졌다 — 실제로는 스무 배 넘게 비싸게 잡고 있었다.
 * 업체를 바꾸면 여기 한 줄과 위 설명을 반드시 함께 고칠 것.
 *
 * 환율과 세금이 남아 있으므로 화면에서는 "어림값"이라고 못 박는다.
 */
const KRW_PER_SONG = Number(process.env.NEXT_PUBLIC_KRW_PER_SONG) || 155;

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
  return {
    songs,
    krw: Math.round(songs * KRW_PER_SONG),
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
