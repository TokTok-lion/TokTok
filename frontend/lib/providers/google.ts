import { createHash, createSign } from 'node:crypto';
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

/** 서명 문자열은 줄바꿈으로 잇는다. 소스에 직접 쓰면 편집기가 건드린다. */
const NL = String.fromCharCode(10);

/**
 * 브라우저가 곧바로 올릴 수 있는 서명된 주소 (V4 · PUT 한 번).
 *
 * ── 왜 재개형 세션을 버렸나
 *
 * 예전에는 서버가 재개형(resumable) 업로드 세션을 열어 그 주소를 브라우저에
 * 넘겼다. 그 주소로 PUT 하면 브라우저가 **아무 응답도 못 받는다** — 콘솔에
 * 오류 한 줄 없이 fetch 가 실패한다. 배포본에서 재서 확인한 것:
 *
 *     PUT storage.googleapis.com/<버킷>/<파일>      → 403 (서버까지 닿음)
 *     PUT <서버가 연 재개형 세션 주소>               → 아예 못 닿음
 *
 * 버킷 CORS 를 열어 준 뒤에도 뒤쪽만 막혀 있었다. 세션을 연 쪽(서버)과 쓰는
 * 쪽(브라우저)이 다르면 그 세션은 브라우저 것이 아니다.
 *
 * 그래서 서명만 서버가 하고 올리는 일은 브라우저가 한다. 서명된 주소는
 * "이 파일 이름으로, 이 시각까지만 쓸 수 있다"는 뜻이라 그 자체로 좁다.
 *
 * ── 왜 중요한가
 *
 * 이 길이 막혀 있으면 5분 넘는 인터뷰 녹음이 전사되지 않는다. 함수를 거치는
 * 길은 Vercel 본문 한도(4.5MB)에 걸리고, 그 한도는 설정으로 못 올린다.
 * 20분짜리 회기 녹음이 구글에 닿지도 못하는 셈이다.
 */
export async function gcsSignedPutUrl(
  objectName: string,
  expiresSeconds = 3600,
): Promise<string | null> {
  const raw = process.env.GOOGLE_CREDENTIALS;
  if (!raw || !GCS_BUCKET) return null;

  let email = '';
  let key = '';
  try {
    const c = JSON.parse(raw) as { client_email?: string; private_key?: string };
    email = c.client_email ?? '';
    // 환경변수에 줄바꿈이 역슬래시 n 두 글자로 들어가 있는 배포가 흔하다.
    key = (c.private_key ?? '').replace(/\\n/g, '\n');
  } catch {
    return null;
  }
  if (!email || !key) return null;

  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const day = stamp.slice(0, 8);
  const scope = `${day}/auto/storage/goog4_request`;

  /*
   * 서명하는 헤더는 host 하나뿐이다.
   *
   * 브라우저가 Content-Type 을 붙여 보내는데, 그걸 서명에 넣으면 브라우저가
   * 보내는 값과 한 글자라도 다를 때 403 이 된다(형식 문자열은 기기마다
   * 미묘하게 다르다). 서명하지 않은 헤더는 구글이 그냥 무시한다 — 우리는
   * 어차피 형식을 선언하지 않고 넘긴다(v2 는 머리말을 보고 스스로 푼다).
   */
  const query = new URLSearchParams({
    'X-Goog-Algorithm': 'GOOG4-RSA-SHA256',
    'X-Goog-Credential': `${email}/${scope}`,
    'X-Goog-Date': stamp,
    'X-Goog-Expires': String(expiresSeconds),
    'X-Goog-SignedHeaders': 'host',
  });
  // URLSearchParams 는 공백을 + 로 쓴다. 서명 규칙은 %20 이다.
  const canonicalQuery = query.toString().replace(/\+/g, '%20');

  const path = `/${GCS_BUCKET}/${objectName.split('/').map(encodeURIComponent).join('/')}`;
  const canonicalRequest = [
    'PUT',
    path,
    canonicalQuery,
    'host:storage.googleapis.com',
    '',
    'host',
    'UNSIGNED-PAYLOAD',
  ].join(NL);

  const toSign = [
    'GOOG4-RSA-SHA256',
    stamp,
    scope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join(NL);

  try {
    const signature = createSign('RSA-SHA256').update(toSign).sign(key, 'hex');
    return `https://storage.googleapis.com${path}?${canonicalQuery}&X-Goog-Signature=${signature}`;
  } catch (e) {
    console.error('gcs signed url failed', e);
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
