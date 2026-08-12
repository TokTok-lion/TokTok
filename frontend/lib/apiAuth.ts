import { createClient } from '@supabase/supabase-js';

/**
 * 라우트에 들어온 사람이 누구인지 확인한다.
 *
 * ── 왜 필요한가
 *
 * 전사 경로에는 인증이 없었다. 그중 /api/transcribe/upload 가 특히 나빴다 —
 * 누구든 그 주소를 부르면 저장소에 바이트를 쓸 수 있는 주소를 받아 갔고,
 * 크기 제한도 없었다. 버킷을 남의 저장소로 쓰거나, 이어서 전사를 걸어 그 달
 * 한도를 태울 수 있었다. 한도가 마르면 화면은 복지사에게 "받아 적어 진행해
 * 주세요"라고 말한다 — 회기가 그것 때문에 멈춘다.
 *
 * ── 어떻게 확인하나
 *
 * 브라우저가 들고 있는 Supabase 세션 토큰을 Authorization 으로 받아, 공개
 * 키로 물어본다. service_role 키는 쓰지 않는다 — 그 키는 저장소 어디에도
 * 두지 않는다는 규칙이 이 파일에도 그대로 적용된다.
 *
 * ── 서버를 안 쓰는 배포
 *
 * Supabase 설정이 없으면 통과시킨다. 그 배포는 계정이라는 개념 자체가 없고
 * (기기 저장으로만 도는 모드), 여기서 막으면 전사가 통째로 죽는다. 열쇠가
 * 없는 곳을 잠그는 것은 잠그는 것이 아니라 문을 없애는 것이다.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** 이 배포가 계정을 쓰는가. 아니면 확인할 것이 없다. */
export const authRequired = Boolean(url && anonKey);

export type AuthCheck = { ok: true; userId: string | null } | { ok: false; error: string };

export async function requireUser(req: Request): Promise<AuthCheck> {
  if (!authRequired) return { ok: true, userId: null };

  const header = req.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return { ok: false, error: '로그인이 필요합니다.' };

  try {
    // 요청마다 새로 만든다. 토큰이 섞이면 남의 회기로 판정될 수 있다.
    const sb = createClient(url!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user) return { ok: false, error: '로그인이 만료됐어요. 다시 로그인해 주세요.' };
    return { ok: true, userId: data.user.id };
  } catch {
    // 확인 자체를 못 했다. 통과시키면 잠근 의미가 없다.
    return { ok: false, error: '로그인 상태를 확인하지 못했어요.' };
  }
}
