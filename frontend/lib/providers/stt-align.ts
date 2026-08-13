import type { HeardWord } from '../align';
import { fail, type Fail, type Job } from './types';
import {
  GCS_BUCKET,
  gcsDelete,
  googleConfigured,
  googleProjectId,
  googleToken,
} from './google';

/**
 * 만들어진 노래를 한 번 더 들어 본다 — 가사 줄을 곡에 맞추기 위해.
 *
 * ── 왜 전사와 따로 두나
 *
 * 하는 일이 다르다. 회기 전사는 **무슨 말씀을 하셨는지**를 받아 적는 일이고,
 * 여기는 **아는 가사가 몇 초에 불리는지**만 알면 된다. 그래서 화자 분리를
 * 끈다 — 노래에는 화자가 하나뿐이고, 켜 두면 돈과 시간만 더 든다.
 *
 * 그리고 돌아가고 있는 길을 건드리지 않으려는 뜻도 있다. 회기 전사는 어르신
 * 앞에서 멎으면 안 되는 길이라, 새로 만드는 쪽을 옆에 낸다
 * (stt-google-v2 가 v1 을 안 지운 것과 같은 이유).
 *
 * ── 노래는 잘 안 들린다
 *
 * 노래하는 목소리는 말하는 목소리보다 알아듣기 어렵다. 받아쓴 글자는 군데군데
 * 틀린다. 그래도 쓸 수 있는 이유는 우리가 **가사를 이미 알고 있기** 때문이다.
 * 맞히는 것이 아니라 맞추는 것이라, 틀린 글자는 정렬이 견딘다(lib/align).
 */

const OBJ_PREFIX = 'stt/';
const REGION = process.env.GOOGLE_STT_REGION || 'eu';
const MODEL = process.env.GOOGLE_STT_V2_MODEL || 'chirp_3';

const host = () =>
  REGION === 'global' ? 'speech.googleapis.com' : `${REGION}-speech.googleapis.com`;

const packJob = (op: string, object: string) => `${op}::${object}`;
function unpackJob(jobId: string) {
  const at = jobId.lastIndexOf('::');
  return at < 0
    ? { operation: jobId, object: '' }
    : { operation: jobId.slice(0, at), object: jobId.slice(at + 2) };
}

function seconds(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v.replace('s', '')) || 0;
  return 0;
}

type V2Word = { word?: string; startOffset?: string };
type V2Result = { alternatives?: { words?: V2Word[] }[] };

function collect(results: V2Result[]): HeardWord[] {
  const out: HeardWord[] = [];
  for (const r of results) {
    for (const w of r.alternatives?.[0]?.words ?? []) {
      const text = w.word?.trim();
      if (!text) continue;
      // 첫 낱말은 시각 필드가 생략된다(0초). 없으면 0으로 읽는 것이 맞다.
      out.push({ text, at: seconds(w.startOffset) });
    }
  }
  return out;
}

function notReady(): Fail | null {
  if (!googleConfigured()) return fail('이 배포에는 맞추기 기능이 설정되어 있지 않습니다.', 503);
  if (!GCS_BUCKET) return fail('저장소(GOOGLE_STT_BUCKET)가 설정되지 않았습니다.', 503);
  if (!googleProjectId()) return fail('구글 자격증명에서 프로젝트를 읽지 못했습니다.', 503);
  return null;
}

/** 저장소에 올라간 곡 하나로 맞추기를 건다. */
export async function startAlign(object: string): Promise<Job<HeardWord[]>> {
  const bad = notReady();
  if (bad) return bad;

  // 우리가 연 세션으로 올라온 것만 받는다(전사 쪽과 같은 규칙).
  if (!object.startsWith(OBJ_PREFIX) || object.includes('..')) {
    return fail('잘못된 업로드입니다.', 400, { settled: true });
  }

  const token = await googleToken();
  if (!token) return fail('구글 인증에 실패했어요.', 503);

  const res = await fetch(
    `https://${host()}/v2/projects/${googleProjectId()}/locations/${REGION}/recognizers/_:batchRecognize`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          autoDecodingConfig: {},
          languageCodes: ['ko-KR'],
          model: MODEL,
          features: {
            // 필요한 것은 이것 하나다 — 어느 소리가 몇 초에 났는가.
            enableWordTimeOffsets: true,
            // 문장부호는 견줄 때 어차피 지운다. 화자 분리는 노래에 뜻이 없다.
            enableAutomaticPunctuation: false,
          },
        },
        files: [{ uri: `gs://${GCS_BUCKET}/${object}` }],
        recognitionOutputConfig: { inlineResponseConfig: {} },
      }),
    },
  );

  if (!res.ok) {
    await gcsDelete(object);
    const quota = res.status === 429;
    console.error('align start failed', res.status, (await res.text().catch(() => '')).slice(0, 300));
    return fail(
      quota ? '이번 달 인식 한도를 다 썼어요.' : '노래를 맞추지 못했어요.',
      quota ? 429 : 502,
      { quota },
    );
  }

  const { name } = (await res.json()) as { name?: string };
  if (!name) {
    await gcsDelete(object);
    return fail('맞추기를 시작하지 못했어요.', 502);
  }
  return { ok: true, done: false, jobId: packJob(name, object) };
}

/** 끝났으면 낱말과 시각을, 아직이면 표를 돌려준다. */
export async function pollAlign(jobId: string): Promise<Job<HeardWord[]>> {
  const { operation, object } = unpackJob(jobId);
  const token = await googleToken();
  if (!token) return fail('구글 인증에 실패했어요.', 503);

  const res = await fetch(`https://${host()}/v2/${operation}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error('align poll failed', res.status);
    return fail('맞추기 상태를 확인하지 못했어요.', 502);
  }

  const json = (await res.json()) as {
    done?: boolean;
    error?: { message?: string };
    response?: { results?: Record<string, { transcript?: { results?: V2Result[] } }> };
  };

  if (json.error) {
    if (object) void gcsDelete(object);
    console.error('align error', json.error.message);
    return fail('노래를 맞추지 못했어요.', 502, { settled: true });
  }
  if (!json.done) return { ok: true, done: false, jobId };

  if (object) void gcsDelete(object);
  const file = Object.values(json.response?.results ?? {})[0];
  const words = collect(file?.transcript?.results ?? []);
  if (!words.length) {
    // 노래를 한 글자도 못 알아들었다. 오류가 아니라 '못 맞췄다'이다 —
    // 화면은 예전 어림으로 돌아가면 된다.
    return { ok: true, done: true, value: [] };
  }
  return { ok: true, done: true, value: words };
}
