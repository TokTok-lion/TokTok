import { GoogleAuth } from 'google-auth-library';

/**
 * Google Cloud 공통 — 인증과 임시 저장.
 *
 * 서비스 계정 JSON 은 파일로 두지 않는다. Vercel 에는 파일 시스템이 없고,
 * 무엇보다 이 저장소는 공개다. 환경변수에 통째로 넣고 여기서만 읽는다.
 */

let auth: GoogleAuth | null = null;

function client(): GoogleAuth | null {
  const raw = process.env.GOOGLE_CREDENTIALS;
  if (!raw) return null;
  if (auth) return auth;
  try {
    const credentials = JSON.parse(raw) as { client_email: string; private_key: string };
    auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    return auth;
  } catch {
    console.error('GOOGLE_CREDENTIALS 를 읽지 못했습니다 (JSON 형식 확인)');
    return null;
  }
}

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CREDENTIALS);
}

export async function googleToken(): Promise<string | null> {
  const a = client();
  if (!a) return null;
  try {
    // getAccessToken 은 문자열을 돌려주지만 타입이 넓게 잡혀 있다.
    const token: unknown = await a.getAccessToken();
    if (typeof token === 'string') return token;
    if (token && typeof token === 'object' && 'token' in token) {
      const inner = (token as { token?: unknown }).token;
      return typeof inner === 'string' ? inner : null;
    }
    return null;
  } catch (e) {
    console.error('google token failed', e);
    return null;
  }
}

/* ------------------------------------------------------- 임시 저장소 */

/**
 * 1분 넘는 음성은 Cloud Storage 를 거쳐야 한다 (구글 문서 기준). 그래서
 * 어르신 목소리가 잠깐 남의 저장소에 놓인다.
 *
 * 그 잠깐을 최대한 짧게 만든다 — 전사가 끝나면 바로 지우고, 실패해도 지운다.
 * 버킷에는 수명 규칙(1일)을 따로 걸어서, 우리 코드가 죽어도 남지 않게 한다.
 * "지우는 코드를 넣었다"만으로는 부족하다. 그 코드가 안 돌 수도 있다.
 */
export const GCS_BUCKET = process.env.GOOGLE_STT_BUCKET ?? '';

export async function gcsUpload(
  objectName: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<string | null> {
  const token = await googleToken();
  if (!token || !GCS_BUCKET) return null;
  const url =
    `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(GCS_BUCKET)}/o` +
    `?uploadType=media&name=${encodeURIComponent(objectName)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
    body,
  });
  if (!res.ok) {
    console.error('gcs upload failed', res.status, await res.text().catch(() => ''));
    return null;
  }
  return `gs://${GCS_BUCKET}/${objectName}`;
}

/** 실패해도 조용히 넘어간다 — 지우기가 안 됐다고 전사 결과를 버릴 이유는 없다. */
export async function gcsDelete(objectName: string): Promise<void> {
  const token = await googleToken();
  if (!token || !GCS_BUCKET) return;
  try {
    await fetch(
      `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(GCS_BUCKET)}/o/${encodeURIComponent(objectName)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
    );
  } catch {
    // 수명 규칙이 대신 지운다
  }
}
