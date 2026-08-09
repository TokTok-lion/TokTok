import {
  fail,
  toSegments,
  type Job,
  type Segment,
  type SttProvider,
} from './types';
import { GCS_BUCKET, gcsDelete, gcsUpload, googleToken, googleConfigured } from './google';

/**
 * 녹음을 글로 옮기기 (Google Cloud Speech-to-Text v1).
 *
 * 이 경로가 이 서비스에서 가장 민감하다 — 어르신 목소리가 기기를 떠난다.
 * 그래서 부르는 쪽에서 두 동의를 모두 확인한다 (C-01 녹음, C-02 외부 전송).
 *
 * 단어마다 시각을 함께 받는다(enableWordTimeOffsets). 이게 핵심이다. 그
 * 시각이 이야기 항목의 출처가 되고, 복지사가 "몇 분에 하신 말씀"을 손으로
 * 적지 않아도 출처 규칙이 지켜진다.
 *
 * 1분 넘는 음성은 Cloud Storage 를 거쳐야 한다. 회기 녹음은 5~30분이라
 * 예외 없이 그 길로 간다. 대신 전사가 끝나는 즉시 지운다.
 */

const OBJ_PREFIX = 'stt/';

/** 작업 표에 지울 대상까지 담아 둔다 — 다음 요청에서도 치울 수 있어야 한다. */
function packJob(operation: string, object: string): string {
  return `${operation}::${object}`;
}
function unpackJob(jobId: string): { operation: string; object: string } {
  const at = jobId.lastIndexOf('::');
  return at < 0
    ? { operation: jobId, object: '' }
    : { operation: jobId.slice(0, at), object: jobId.slice(at + 2) };
}

type Alt = {
  transcript?: string;
  words?: { word?: string; startTime?: string | number }[];
};

/** 구글은 시각을 "12.300s" 또는 { seconds, nanos } 로 준다. */
function seconds(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v.replace('s', '')) || 0;
  if (v && typeof v === 'object') {
    const o = v as { seconds?: string | number; nanos?: number };
    return Number(o.seconds ?? 0) + (o.nanos ?? 0) / 1e9;
  }
  return 0;
}

function collect(results: { alternatives?: Alt[] }[]): Segment[] {
  const words: { text: string; start: number }[] = [];
  const texts: string[] = [];
  for (const r of results) {
    const alt = r.alternatives?.[0];
    if (!alt) continue;
    if (alt.transcript) texts.push(alt.transcript.trim());
    for (const w of alt.words ?? []) {
      if (w.word) words.push({ text: w.word, start: seconds(w.startTime) });
    }
  }
  return toSegments(words, texts.join(' '));
}

async function readOperation(operation: string): Promise<Job<Segment[]>> {
  const token = await googleToken();
  if (!token) return fail('구글 인증에 실패했어요.', 503);

  const res = await fetch(`https://speech.googleapis.com/v1/operations/${operation}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error('google stt operation failed', res.status);
    return fail('전사 상태를 확인하지 못했어요.', 502);
  }

  const json = (await res.json()) as {
    done?: boolean;
    error?: { message?: string };
    response?: { results?: { alternatives?: Alt[] }[] };
  };

  if (json.error) {
    console.error('google stt error', json.error.message);
    return fail('전사하지 못했어요. 녹음은 그대로 남아 있습니다.', 502);
  }
  if (!json.done) return { ok: true, done: false, jobId: operation };

  const segments = collect(json.response?.results ?? []);
  if (!segments.length) {
    return fail(
      '말씀이 잡히지 않았어요. 마이크가 어르신 가까이 있었는지 확인해 주세요.',
      422,
    );
  }
  return { ok: true, done: true, value: segments };
}

export const googleStt: SttProvider = {
  name: 'google',

  async start(file) {
    if (!googleConfigured()) {
      return fail('이 배포에는 전사 기능이 설정되어 있지 않습니다.', 503);
    }
    if (!GCS_BUCKET) {
      return fail('전사용 저장소(GOOGLE_STT_BUCKET)가 설정되지 않았습니다.', 503);
    }

    const token = await googleToken();
    if (!token) return fail('구글 인증에 실패했어요.', 503);

    // 이름에 어르신 정보를 넣지 않는다. 잠깐 있다 사라질 파일이지만,
    // 그 잠깐 동안에도 파일 이름은 로그에 남는다.
    const object = `${OBJ_PREFIX}${crypto.randomUUID()}.webm`;
    const uri = await gcsUpload(object, await file.arrayBuffer(), file.type || 'audio/webm');
    if (!uri) return fail('녹음을 전사 서버로 보내지 못했어요.', 502);

    const res = await fetch(
      'https://speech.googleapis.com/v1/speech:longrunningrecognize',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            // MediaRecorder 가 내는 그대로. 다시 인코딩하지 않는다 —
            // 브라우저에서 30분짜리를 변환하면 태블릿이 못 견딘다.
            encoding: 'WEBM_OPUS',
            sampleRateHertz: 48000,
            languageCode: 'ko-KR',
            enableWordTimeOffsets: true,
            enableAutomaticPunctuation: true,
            // 긴 대화용 모델. 회상 인터뷰는 짧은 명령이 아니라 이야기다.
            model: 'latest_long',
          },
          audio: { uri },
        }),
      },
    );

    if (!res.ok) {
      await gcsDelete(object);
      const quota = res.status === 429;
      console.error('google stt start failed', res.status);
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
  },

  async poll(jobId) {
    const { operation, object } = unpackJob(jobId);
    const out = await readOperation(operation);
    // 끝났거나 실패했으면 원음성을 지운다. 남겨 둘 이유가 하나도 없다.
    if (('done' in out && out.done) || out.ok === false) {
      if (object) void gcsDelete(object);
    }
    // 아직 진행 중이면 지울 대상을 계속 들고 다닌다.
    if (out.ok && !out.done) return { ok: true, done: false, jobId };
    return out;
  },
};
