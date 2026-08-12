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

/**
 * 서비스 계정이 속한 프로젝트. v2 는 주소에 프로젝트와 지역이 들어가서
 * 필요하다(v1 은 필요 없었다).
 */
export function googleProjectId(): string | null {
  const raw = process.env.GOOGLE_CREDENTIALS;
  if (!raw) return null;
  try {
    const { project_id } = JSON.parse(raw) as { project_id?: string };
    return project_id ?? null;
  } catch {
    return null;
  }
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

/**
 * 브라우저가 저장소로 직접 올릴 수 있는 한 번짜리 주소를 연다.
 *
 * 왜 필요한가. 지금까지는 녹음이 우리 함수를 거쳐 갔는데, Vercel 함수의 요청
 * 본문 한도가 4.5MB 이고 그건 설정으로 못 올린다(인프라 수준 제약). 그래서
 * 4MB 에서 잘랐고, 그 위는 어르신이 한 시간을 이야기하셨든 413 이었다.
 *
 * 파일이 함수를 안 거치면 그 한도가 적용되지 않는다. 그래서 서버는 주소만
 * 열어 주고 바이트는 브라우저에서 GCS 로 바로 간다. 구글이 안내하는 방식
 * 그대로다(resumable upload session).
 *
 * 이 주소는 우리가 정한 이름의 객체 하나에만 쓸 수 있고, 며칠이면 만료된다.
 * 이름에 어르신 정보를 넣지 않는 규칙은 여기서도 같다 — 잠깐 있다 사라질
 * 파일이라도 그 이름은 로그에 남는다.
 *
 * 서명 URL 대신 이 방식을 쓰는 이유: 서명은 서비스 계정 개인키로 직접
 * 계산해야 하는데, 세션 주소는 이미 있는 토큰 한 번으로 열린다. 부품이
 * 적을수록 어르신 목소리가 지나가는 길이 짧다.
 */
export async function gcsResumableSession(
  objectName: string,
  contentType: string,
): Promise<string | null> {
  const token = await googleToken();
  if (!token || !GCS_BUCKET) return null;
  const url =
    `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(GCS_BUCKET)}/o` +
    `?uploadType=resumable&name=${encodeURIComponent(objectName)}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': contentType,
      },
      body: JSON.stringify({ name: objectName }),
    });
    if (!res.ok) {
      console.error('gcs resumable session failed', res.status);
      return null;
    }
    // 세션 주소는 본문이 아니라 Location 헤더로 온다.
    return res.headers.get('location');
  } catch (e) {
    console.error('gcs resumable session error', e);
    return null;
  }
}

/**
 * 올라왔다고 하는 객체가 실제로 있는지, 크기가 얼마인지 확인한다.
 *
 * 브라우저가 "다 올렸어요"라고 말하는 것만 믿고 전사를 시작하면, 올라가지
 * 않은 파일로 작업을 걸어 놓고 기다리게 된다. 요금이 나가는 자리이기도 하다.
 */
export async function gcsStat(objectName: string): Promise<{ size: number } | null> {
  const token = await googleToken();
  if (!token || !GCS_BUCKET) return null;
  try {
    const res = await fetch(
      `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(GCS_BUCKET)}/o/${encodeURIComponent(objectName)}?fields=size`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { size?: string };
    const size = Number(j.size ?? 0);
    return Number.isFinite(size) && size > 0 ? { size } : null;
  } catch {
    return null;
  }
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
