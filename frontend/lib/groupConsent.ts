'use client';

import { hasConsent, type ConsentKind } from './domain';
import { readParticipantRecord } from './repo';
import { currentSession, sessionMembers } from './store';
import type { ElderIdentity } from './store';

/**
 * 참여하신 분 전원이 동의했는가 — 화면 밖에서 묻는 자리용.
 *
 * ── 왜 훅과 따로 있나
 *
 * 자료가 실제로 밖으로 나가는 곳은 화면이 아니라 lib 이다(transcribeJob 이
 * 녹음을 전사 업체로 보내고, useMusic 이 가사를 음악 업체로 보낸다). 거기서는
 * React 훅을 쓸 수 없다. 화면용은 useGroupConsents 가 따로 있고, 판단 규칙은
 * 두 곳이 같아야 한다.
 *
 * ── 왜 전원인가
 *
 * 그룹 회기의 녹음에는 그 방에 계신 분들 목소리가 전부 담기고, 전사에는 그
 * 말씀이 전부 적힌다. 기준 어르신 한 분만 보고 내보내면 나머지 분들의 음성과
 * 말씀이 동의 없이 외부 사업자에게 나간다. 화면상으로는 정상 동작과 구분되지
 * 않는다 — 그게 가장 나쁘다.
 *
 * ── 못 읽었을 때
 *
 * 허용으로 치지 않는다. 통신이 끊겼다는 이유로 어르신의 목소리가 나가서는
 * 안 된다.
 */

/**
 * 짧게 기억해 둔다.
 *
 * 전사·사실 추출·가사·곡이 잇달아 이 값을 묻는데, 그때마다 어르신 수만큼
 * 서버를 부르면 회기 한 번에 요청이 수십 번 나간다. 동의가 회기 도중에 바뀌는
 * 일은 드물지만 없지는 않아서(더보기에서 거둘 수 있다) 오래 붙들지는 않는다.
 */
const CACHE_MS = 30_000;
let cached: { at: number; key: string; missing: Record<string, ElderIdentity[]> } | null = null;

function cacheKey(): string {
  return sessionMembers()
    .map((m) => m.id)
    .join(',');
}

async function readMissing(kind: ConsentKind): Promise<ElderIdentity[]> {
  const s = currentSession();
  const members = sessionMembers(s);

  // 둘러보기 회기는 서버에 읽을 곳이 없다. 회기 상태의 값을 그대로 쓴다 —
  // 시연이 동의 확인 때문에 막히면 안 된다.
  if (!s.remoteParticipantId) {
    return hasConsent(s.elder.consents, kind) ? [] : members;
  }

  const out = await Promise.all(
    members.map(async (elder) => {
      const rec = await readParticipantRecord(elder.id).catch(() => null);
      // 못 읽은 분은 미동의로 본다.
      return rec && hasConsent(rec.consents, kind) ? null : elder;
    }),
  );
  return out.filter((x): x is ElderIdentity => x !== null);
}

/** 아직 동의하지 않으신 분들. 부르는 쪽이 이름을 대고 말할 수 있게. */
export async function membersMissing(kind: ConsentKind): Promise<ElderIdentity[]> {
  const key = cacheKey();
  const fresh = cached && cached.key === key && Date.now() - cached.at < CACHE_MS;
  if (!fresh) cached = { at: Date.now(), key, missing: {} };
  if (!cached!.missing[kind]) cached!.missing[kind] = await readMissing(kind);
  return cached!.missing[kind];
}

/** 참여하신 분 전원이 동의했는가. */
export async function everyoneConsented(kind: ConsentKind): Promise<boolean> {
  return (await membersMissing(kind)).length === 0;
}

/**
 * 동의가 바뀌었으니 다시 읽으라는 신호.
 *
 * 더보기에서 거두거나 회기 준비에서 받은 직후에 부른다. 안 부르면 최대
 * 30초 동안 옛 답이 나오는데, 그 30초에 녹음이 시작될 수 있다.
 */
export function forgetConsentCache(): void {
  cached = null;
}
