import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase 클라이언트.
 *
 * 브라우저에서 쓰는 공개 키만 사용한다. service_role 키는 이 파일은 물론
 * 저장소 어디에도 두지 않는다 — 클라이언트 번들에 들어가는 순간 RLS가 무의미
 * 해지기 때문이다 (NFR-SEC-002).
 *
 * 이 키가 공개되어도 되는 이유는 키가 비밀이라서가 아니라 모든 테이블에 RLS가
 * 걸려 있기 때문이다 (NFR-SEC-001). RLS 없이 테이블을 만들면 이 키만으로
 * 어르신의 생애 기록 전체가 열린다.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** 환경변수가 갖춰졌는지. 없으면 앱은 지금처럼 기기 저장으로만 동작한다. */
export const isSupabaseConfigured = Boolean(url && anonKey);

let client: ReturnType<typeof createBrowserClient> | null = null;

/**
 * 설정이 없으면 null을 돌려준다. 아직 로컬 저장만으로 완결되는 화면들이 있어,
 * 연결이 없다고 앱이 죽어서는 안 된다.
 */
export function getSupabase() {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createBrowserClient(url!, anonKey!);
  }
  return client;
}
