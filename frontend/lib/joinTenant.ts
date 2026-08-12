'use client';

import { getSupabase } from './supabase';

/**
 * 기관에 합류한다. 갓 만든 계정에서도 되도록 몇 번 다시 시도한다.
 *
 * ── 왜 재시도가 필요한가
 *
 * 가입 직후에 이 오류를 만났다.
 *
 *     JWT issued at future
 *
 * 회원가입이 끝나자마자 그 토큰으로 곧장 부르기 때문이다. 토큰을 발급하는
 * 인증 서버와 그것을 검증하는 DB 쪽의 시계가 몇 밀리초만 어긋나도, 검증하는
 * 쪽에서 보면 "아직 발급되지 않은 토큰"이 된다.
 *
 * 잠깐 기다렸다 다시 부르면 통과한다. 사람이 겪기에는 '가입이 실패했다'로
 * 보이는 일이라 — 계정은 이미 만들어졌는데도 — 화면에 오류를 내밀기 전에
 * 우리가 먼저 몇 번 해 본다.
 *
 * 코드가 틀린 것 같은 오류는 다시 시도하지 않는다. 몇 초를 기다리게 해 놓고
 * 같은 답을 주는 것은 고장으로 읽힌다.
 */

/** 시계 어긋남처럼 잠깐 뒤에는 될 법한 오류인가. */
function transient(message: string): boolean {
  return /issued at future|JWSError|JWSInvalidSignature|jwt expired|clock/i.test(message);
}

export type JoinResult = { ok: true } | { ok: false; message: string; accountExists: boolean };

export async function joinTenant(code: string): Promise<JoinResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: '서버에 연결할 수 없어요.', accountExists: true };

  const waits = [0, 800, 1600, 2600];
  let last = '';

  for (const wait of waits) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    const { error } = await sb.rpc('join_tenant', { p_code: code.trim() });
    if (!error) return { ok: true };
    last = error.message ?? '';
    if (!transient(last)) {
      // 서버가 사람에게 할 말을 그대로 적어 보낸다(join_tenant 안의 raise).
      // 그렇지 않은 것은 우리 말로 바꾼다 — 'JWSError' 같은 글자를 복지사에게
      // 보여 줄 이유가 없다.
      const human = /코드|소속|로그인/.test(last)
        ? last
        : '기관에 합류하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
      return { ok: false, message: human, accountExists: true };
    }
  }

  return {
    ok: false,
    message: '서버 시계가 잠깐 어긋났어요. 잠시 뒤 「기관 코드 입력」에서 다시 해 주세요.',
    accountExists: true,
  };
}
