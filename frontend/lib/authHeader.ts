'use client';

import { getSupabase } from './supabase';

/**
 * 요금이 나가는 주소를 부를 때 붙이는 신분증.
 *
 * ── 왜 필요한가
 *
 * 시연 자리에 다른 분들이 함께 들어온다. 로그인 없이 둘러보기만 해도 화면은
 * 다 돌아가는데, 그 상태에서 「노래 만들기」를 누르면 우리 크레딧이 나갔다.
 * 곡 한 곡이 십일 크레딧이고, 기관 한도(song_quota)는 로그인한 계정에만
 * 걸린다 — 로그인 안 한 쪽에는 한도가 아예 없었다.
 *
 * 그래서 요금이 나가는 주소는 전부 로그인을 요구한다(lib/apiAuth 의
 * requireUser). 이 함수는 그 짝이다. 브라우저가 들고 있는 세션 토큰을
 * 실어 보낸다.
 *
 * ── 서버를 안 쓰는 배포
 *
 * 토큰이 없으면 빈 헤더다. 그런 배포에서는 라우트 쪽도 확인할 것이 없어
 * 그대로 통과한다 — 열쇠가 없는 곳을 잠그는 것은 문을 없애는 것이다.
 */
export async function authHeader(): Promise<Record<string, string>> {
  try {
    const sb = getSupabase();
    if (!sb) return {};
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/**
 * 이 배포가 계정을 쓰는데 지금 로그인이 안 되어 있는가.
 *
 * 누르기 전에 미리 본다. 서버가 막아 주기는 하지만, 어르신 앞에서 몇 초
 * 기다렸다가 "로그인이 필요합니다"를 보는 것과 처음부터 그렇게 적혀 있는
 * 것은 다른 일이다.
 */
export async function needsLogin(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const h = await authHeader();
  return !h.Authorization;
}
