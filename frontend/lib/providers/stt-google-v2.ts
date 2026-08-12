import { fail, type Fail, type Job, type Segment, type SttProvider } from './types';
import { byTurn, type W } from './turns';
import {
  GCS_BUCKET,
  gcsDelete,
  gcsStat,
  gcsUpload,
  googleConfigured,
  googleProjectId,
  googleToken,
} from './google';

/**
 * 녹음을 글로 옮기기 (Google Cloud Speech-to-Text **v2** · Chirp 3).
 *
 * ── 왜 이 파일이 생겼나
 *
 * v1(stt-google.ts)에서 한국어 화자 분리가 **동작하지 않는다**는 것을 재서
 * 확인했다. diarizationConfig 를 켜고 요금도 나가고 있었지만, 결과는 늘
 * 화자표 하나였다. 코드가 정직하게 만들어져 있어서(못 가르면 라벨을 안 붙인다)
 * 틀린 라벨이 화면에 뜨지는 않았지만, 없다는 사실도 아무도 몰랐다.
 *
 * 같은 설정으로 언어만 바꿔 보니 갈렸다.
 *
 *     영어 (여/남)    화자표 1/2   ✅
 *     한국어 (여/남)  화자표 1     ❌
 *
 * 합성음 탓이 아니라 v1 의 한국어 지원 문제였다.
 *
 * ── 그래서 v2 · Chirp 3
 *
 * 지역·모델을 다 돌려 보고 찾았다. `eu` 지역의 chirp_3 만 한국어 화자 분리를
 * 준다. 3분짜리 대화(4턴 × 9회 = 36 전환)를 batchRecognize 로 태웠더니
 *
 *     화자표      1/2
 *     단어 시각   301/302 (첫 단어 0초는 필드가 생략된다)
 *     말차례 전환 36회 — 기대값과 정확히 일치
 *
 * 인식 자체도 낫다. v1 이 '차 벌금'으로 듣던 '첫 월급'을 제대로 알아듣는다.
 *
 * ── 지역 이야기
 *
 * `eu` 라는 것은 어르신 음성이 유럽으로 간다는 뜻이다. 한국 요양기관 서비스에서
 * 가벼운 문제가 아니라, 지역을 환경변수로 뺐다(GOOGLE_STT_REGION).
 * asia-southeast1 은 같은 모델에 403 이 온다 — 프로젝트에 아직 허용이 안 된
 * 것이라 요청하면 열릴 수 있다. 열리면 이 값만 바꾸면 된다.
 *
 * ── v1 을 지우지 않은 이유
 *
 * 돌아가고 있는 길이다. 새 길로 전부를 옮겨 놓고 삐끗하면 되던 것까지 멎는다.
 * 어느 쪽을 쓸지는 STT_PROVIDER 가 정한다(lib/providers/index.ts).
 */

const OBJ_PREFIX = 'stt/';

/** 화자 분리가 되는 지역. 서울에서도 되면 그때 바꾼다. */
const REGION = process.env.GOOGLE_STT_REGION || 'eu';
const MODEL = process.env.GOOGLE_STT_V2_MODEL || 'chirp_3';

const host = () => (REGION === 'global' ? 'speech.googleapis.com' : `${REGION}-speech.googleapis.com`);

/**
 * 이 형식을 받을 수 있는가.
 *
 * v2 는 컨테이너 머리말을 보고 스스로 푼다(autoDecodingConfig). v1 이 못 읽던
 * AAC(m4a·mp4·mov)도 여기서는 읽힌다 — 아이폰 음성 메모와 사파리 녹음이 그것이다.
 */
const ACCEPTED = /^audio\/(wav|x-wav|wave|mpeg|mp3|mp4|x-m4a|aac|flac|ogg|opus|webm|amr|amr-wb|3gpp)|^video\/(mp4|quicktime)/;

/** 작업 표에 지울 대상까지 담아 둔다 — 다음 요청에서도 치울 수 있어야 한다. */
const packJob = (op: string, object: string) => `${op}::${object}`;
function unpackJob(jobId: string) {
  const at = jobId.lastIndexOf('::');
  return at < 0
    ? { operation: jobId, object: '' }
    : { operation: jobId.slice(0, at), object: jobId.slice(at + 2) };
}

/** v2 는 시각을 "12.300s" 로 준다. */
function seconds(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v.replace('s', '')) || 0;
  return 0;
}

type V2Word = {
  word?: string;
  startOffset?: string;
  endOffset?: string;
  /** v2 는 문자열로 준다("0"·"1"). "0" 도 유효한 화자다. */
  speakerLabel?: string;
};

type V2Result = { alternatives?: { transcript?: string; words?: V2Word[] }[] };

/**
 * v2 응답을 화면의 줄로 바꾼다.
 *
 * 단어에 화자표가 붙어 있으면 말차례로 나눈다(turns.ts — v1 과 같은 규칙).
 * 안 붙어 있으면 업체가 준 문장을 그대로 쓴다. 갈라지지 않은 것을 한쪽으로
 * 몰아 붙이면 복지사 질문이 어르신 말씀으로 둔갑한다.
 */
function collect(results: V2Result[]): Segment[] {
  const words: W[] = [];
  for (const r of results) {
    for (const w of r.alternatives?.[0]?.words ?? []) {
      if (!w.word?.trim()) continue;
      const start = seconds(w.startOffset);
      const label = typeof w.speakerLabel === 'string' ? w.speakerLabel.trim() : '';
      words.push({
        text: w.word,
        start,
        // 끝 시각이 없으면 길이를 0 으로 둔다. 없는 값을 지어내지 않는다.
        end: w.endOffset === undefined ? start : Math.max(start, seconds(w.endOffset)),
        key: label === '' ? null : label,
      });
    }
  }

  if (words.length) {
    const turns = byTurn(words);
    if (turns) return turns;
  }

  // 화자가 안 갈렸다. 업체가 나눠 준 문장이 우리가 다시 이어 붙인 것보다 곱다.
  const out: Segment[] = [];
  for (const r of results) {
    const alt = r.alternatives?.[0];
    const text = (alt?.transcript ?? '').trim();
    if (!text) continue;
    const first = alt?.words?.find((w) => w.word);
    const at = first ? seconds(first.startOffset) : (out.at(-1)?.at ?? 0);
    out.push({ id: `seg-${out.length}`, text, at: Math.round(at) });
  }
  return out;
}

function notReady(): Fail | null {
  if (!googleConfigured()) {
    return fail('이 배포에는 전사 기능이 설정되어 있지 않습니다.', 503);
  }
  if (!GCS_BUCKET) {
    return fail('전사용 저장소(GOOGLE_STT_BUCKET)가 설정되지 않았습니다.', 503);
  }
  if (!googleProjectId()) {
    return fail('구글 자격증명에서 프로젝트를 읽지 못했습니다.', 503);
  }
  return null;
}

/** 올라와 있는 객체 하나로 전사를 건다. 두 입구가 여기서 만난다. */
/**
 * speakers 는 그 방에 있던 사람 수다 — 어르신 수 + 복지사 한 명.
 *
 * 둘 미만이면 갈릴 것이 없고, 너무 크게 잡으면 기침이나 옆방 소리를 사람으로
 * 센다. 여섯을 넘기지 않는다 — 그 위로는 분리 정확도가 급격히 떨어져서,
 * 갈랐다는 표시만 있고 실제로는 섞인 결과가 나온다.
 */
async function recognize(
  object: string,
  token: string,
  speakers = 2,
): Promise<Job<Segment[]>> {
  const speakerCount = Math.min(6, Math.max(2, Math.round(speakers)));
  const project = googleProjectId();
  const res = await fetch(
    `https://${host()}/v2/projects/${project}/locations/${REGION}/recognizers/_:batchRecognize`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          // 형식을 우리가 선언하지 않는다. v2 는 머리말을 보고 스스로 푼다 —
          // v1 에서 아이패드 녹음(AAC)을 WebM 이라고 속여 보내던 자리가 여기서
          // 사라진다.
          autoDecodingConfig: {},
          languageCodes: ['ko-KR'],
          model: MODEL,
          features: {
            enableWordTimeOffsets: true,
            enableAutomaticPunctuation: true,
            /*
             * 회기는 복지사가 묻고 어르신이 답하는 대화다. 갈라 놓지 않으면
             * 사실 추출 입력에 복지사 질문이 섞인다.
             *
             * 사람 수를 정확히 알려 준다. 열어 두면 옆방 소리나 기침을 한 사람
             * 더로 세고, 좁혀 두면 서로 다른 분들의 말씀이 한 사람으로 뭉친다.
             * 뭉치는 쪽이 더 나쁘다 — 그러면 "누가 한 말인가"가 무너진다.
             *
             * 1:1 회기는 예전과 같이 2·2 다.
             */
            diarizationConfig: {
              minSpeakerCount: speakerCount,
              maxSpeakerCount: speakerCount,
            },
          },
        },
        files: [{ uri: `gs://${GCS_BUCKET}/${object}` }],
        // 결과를 바로 받는다. 저장소에 또 쓰면 지울 것이 하나 더 늘고,
        // 그 하나가 어르신 말씀이 적힌 파일이다.
        recognitionOutputConfig: { inlineResponseConfig: {} },
      }),
    },
  );

  if (!res.ok) {
    await gcsDelete(object);
    const quota = res.status === 429;
    console.error('google stt v2 start failed', res.status, (await res.text().catch(() => '')).slice(0, 300));
    return fail(
      quota
        ? '이번 달 전사 한도를 다 썼어요. 복지사가 받아 적어 진행해 주세요.'
        : '전사하지 못했어요. 녹음은 그대로 남아 있습니다.',
      quota ? 429 : 502,
      { quota },
    );
  }

  const { name } = (await res.json()) as { name?: string };
  if (!name) {
    await gcsDelete(object);
    return fail('전사를 시작하지 못했어요.', 502);
  }
  return { ok: true, done: false, jobId: packJob(name, object) };
}

async function readOperation(operation: string): Promise<Job<Segment[]>> {
  // settled 를 안 붙인 실패 = "상태를 못 읽었다". 부르는 쪽이 이 차이로
  // 원음성을 지울지 말지를 가른다.
  const token = await googleToken();
  if (!token) return fail('구글 인증에 실패했어요.', 503);

  const res = await fetch(`https://${host()}/v2/${operation}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error('google stt v2 operation failed', res.status);
    return fail('전사 상태를 확인하지 못했어요.', 502);
  }

  const json = (await res.json()) as {
    done?: boolean;
    error?: { message?: string };
    response?: { results?: Record<string, { transcript?: { results?: V2Result[] }; error?: unknown }> };
  };

  if (json.error) {
    console.error('google stt v2 error', json.error.message);
    return fail('전사하지 못했어요. 녹음은 그대로 남아 있습니다.', 502, { settled: true });
  }
  if (!json.done) return { ok: true, done: false, jobId: operation };

  // 파일 하나만 보냈으므로 결과도 하나다. 열쇠는 gs:// 주소다.
  const file = Object.values(json.response?.results ?? {})[0];
  const segments = collect(file?.transcript?.results ?? []);
  if (!segments.length) {
    return fail(
      '말씀이 잡히지 않았어요. 마이크가 어르신 가까이 있었는지 확인해 주세요.',
      422,
      { settled: true },
    );
  }
  return { ok: true, done: true, value: segments };
}

export const googleSttV2: SttProvider = {
  name: 'google-v2',

  accepts: (contentType) => ACCEPTED.test((contentType || '').toLowerCase()),

  async start(file, _topic, speakers) {
    const bad = notReady();
    if (bad) return bad;

    const token = await googleToken();
    if (!token) return fail('구글 인증에 실패했어요.', 503);

    // 이름에 어르신 정보를 넣지 않는다. 잠깐 있다 사라질 파일이지만,
    // 그 잠깐 동안에도 파일 이름은 로그에 남는다.
    const object = `${OBJ_PREFIX}${crypto.randomUUID()}`;
    const uri = await gcsUpload(object, await file.arrayBuffer(), file.type || 'audio/webm');
    if (!uri) return fail('녹음을 전사 서버로 보내지 못했어요.', 502);

    return recognize(object, token, speakers);
  },

  async startUploaded(object, _contentType, _topic, speakers) {
    const bad = notReady();
    if (bad) return bad;

    // 우리가 연 세션으로 올라온 것만 받는다. 이름 규칙을 벗어난 값이 오면
    // 남의 객체를 가리키게 만들 수 있다.
    if (!object.startsWith(OBJ_PREFIX) || object.includes('..')) {
      return fail('잘못된 업로드입니다.', 400, { settled: true });
    }

    const token = await googleToken();
    if (!token) return fail('구글 인증에 실패했어요.', 503);

    // 브라우저가 "다 올렸어요"라고 말하는 것만 믿지 않는다.
    const stat = await gcsStat(object);
    if (!stat) return fail('올린 녹음을 찾지 못했어요. 다시 올려 주세요.', 404, { settled: true });

    return recognize(object, token, speakers);
  },

  async poll(jobId) {
    const { operation, object } = unpackJob(jobId);
    const out = await readOperation(operation);

    // 원음성은 '작업이 끝났을 때'만 지운다. 상태를 못 읽은 것(와이파이 순단)과
    // 업체가 실패로 끝낸 것은 다르다 — 앞의 경우에 지워 버리면 돌고 있는
    // 전사가 근거를 잃는다. 요금은 이미 나간 뒤다.
    const settledFail = out.ok === false && out.settled === true;
    if (('done' in out && out.done) || settledFail) {
      if (object) void gcsDelete(object);
    }
    if (out.ok === false && !settledFail) return { ...out, jobId };
    if (out.ok && !out.done) return { ok: true, done: false, jobId };
    return out;
  },
};
