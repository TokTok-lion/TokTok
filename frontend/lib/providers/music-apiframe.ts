import { fail, type Job, type MusicProvider, type MusicResult } from './types';

/**
 * 곡 만들기 (Suno — APIFRAME v2 경유).
 *
 * 소리는 Suno 가 낫다. 특히 한국어 보컬에서 차이가 크다. ElevenLabs Music 은
 * 59개 언어를 지원한다고 하지만 "원어민 수준"으로 밝힌 것은 11개뿐이고
 * 한국어는 거기 없다 — 들은 분들이 "기계음 같다"고 한 데는 이유가 있었다.
 *
 * 그런데 Suno 에는 공개 개발자 API 가 없다(2026년 7월 파트너 신청만 열림).
 * APIFRAME 은 그 사이를 메우는 제3자 서비스다. 스스로도 "Suno, Inc. 와
 * 제휴·승인·후원 관계가 아니다"라고 밝힌다.
 *
 * 그래서 이 파일은 그 회사의 문서화된 API 를 부르는 클라이언트일 뿐이다.
 * 여기서 약속할 수 있는 것은 "호출이 맞다"까지이고, 생성물의 권리 관계는
 * 그 회사가 하는 말을 근거로 삼는 수밖에 없다. 기관과 계약하기 전에
 * 확인해야 할 것이 하나 남아 있다는 뜻이다.
 *
 * v1 이 아니라 v2 다. 처음에 v1 문서를 보고 만들었다가 400 을 받았는데,
 * 그 응답이 친절하게도 이유를 적어 주었다 — "키가 afk_ 로 시작하면 v2 다".
 * 열쇠가 어느 판인지 코드가 알 수 없으니, 오류 본문을 로그에 남기는 것이
 * 유일한 실마리였다.
 */

const BASE = 'https://api.apiframe.ai/v2';

/**
 * 스타일 설명. 최대 1,000자까지 받는다.
 *
 * 어느 모델이든 약점은 보컬이라 부탁할 것도 같다 — 굴리지 말고, 한 글자에
 * 한 음, 또박또박. 듣는 분들은 고역 청력이 먼저 떨어지므로 자음이 살아야
 * 하고, 따라 부르실 수 있어야 하므로 음역이 좁아야 한다.
 */
const STYLE: Record<string, string> = {
  folkTrad:
    'korean traditional folk, minyo, warm and homely, acoustic, gentle pentatonic',
  folkBright: 'korean acoustic folk, bright, warm, acoustic guitar, easy singalong',
  ballad: 'korean ballad, tender, upright piano, small strings, slow, comforting',
  trot: 'korean trot, sentimental, nostalgic, electric organ, brushed drums',
};

const VOICE =
  'clear korean diction, one note per syllable, no melisma, no heavy vibrato, ' +
  'warm mid-range voice, simple singable melody within one octave, ' +
  'sparse arrangement, natural breaths, warm analog recording';

const AVOID = 'shouting, heavy autotune, edm, rap, distorted guitar';

type Track = { audioUrl?: string; duration?: number };
type JobRes = {
  status?: 'QUEUED' | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | string;
  result?: { tracks?: Track[] };
  error?: string;
};

function key(): string {
  return process.env.APIFRAME_API_KEY ?? '';
}

async function call(path: string, init: RequestInit): Promise<Response | null> {
  if (!key()) return null;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 30_000);
  try {
    return await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'X-API-Key': key(),
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      signal: ac.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 실패 이유를 버리지 않는다. 이게 없어서 400 하나에 한참을 썼다. */
async function shout(where: string, res: Response) {
  console.error(`apiframe ${where} failed`, res.status, await res.text().catch(() => ''));
}

function mapFail(status: number) {
  if (status === 401) {
    return fail('곡 만들기 열쇠가 올바르지 않아요. 관리자에게 알려 주세요.', 503);
  }
  if (status === 402) {
    return fail('곡 만들기 잔액이 부족해요. 가사는 그대로 남아 있습니다.', 402, {
      needsPaidPlan: true,
    });
  }
  if (status === 429) {
    return fail('이번 달 곡 만들기 한도를 다 썼어요.', 429, { quota: true });
  }
  return fail('곡을 만들지 못했어요. 가사는 그대로 남아 있습니다.', 502);
}

export const apiframeMusic: MusicProvider = {
  name: 'apiframe',

  async start(req) {
    if (!key()) {
      return fail('이 배포에는 곡 만들기가 설정되어 있지 않습니다.', 503);
    }

    const res = await call('/music/generate', {
      method: 'POST',
      body: JSON.stringify({
        // custom_mode 를 켜면 prompt 가 곧 가사다(최대 5,000자). 끄면
        // 500자짜리 설명으로 보고 그 이상은 400 으로 거절한다.
        prompt: req.lyrics,
        model: 'suno',
        sunoParams: {
          custom_mode: true,
          instrumental: false,
          model_version: process.env.APIFRAME_MODEL || 'V4_5PLUS',
          title: (req.title || '이름 없는 노래').slice(0, 80),
          style: `${STYLE[req.style] ?? STYLE.ballad}, ${VOICE}`.slice(0, 1000),
          negative_tags: AVOID,
          // 어르신 이야기를 담은 노래라 목소리는 차분한 쪽으로 둔다.
          vocal_gender: process.env.APIFRAME_VOCAL || 'f',
        },
      }),
    });

    if (!res) return fail('곡 만들기 서버에 연결하지 못했어요.', 503);
    if (!res.ok) {
      await shout('generate', res);
      return mapFail(res.status);
    }

    const { jobId } = (await res.json()) as { jobId?: string };
    if (!jobId) return fail('곡 만들기를 시작하지 못했어요.', 502);
    return { ok: true, done: false, jobId };
  },

  async poll(jobId) {
    const res = await call(`/jobs/${encodeURIComponent(jobId)}`, { method: 'GET' });
    if (!res) return fail('곡 만들기 서버에 연결하지 못했어요.', 503);
    if (!res.ok) {
      await shout('job', res);
      return mapFail(res.status);
    }

    const json = (await res.json()) as JobRes;
    if (json.status === 'FAILED' || json.error) {
      console.error('apiframe job failed', json.error ?? '');
      return fail('곡을 만들지 못했어요. 가사는 그대로 남아 있습니다.', 502);
    }

    // Suno 는 한 번에 두 곡을 낸다. 첫 번째를 쓴다.
    const track = json.result?.tracks?.find((t) => t.audioUrl);
    // 다 됐다는데 소리가 없으면 아직이다. 상태만 믿으면 빈 곡이 저장된다.
    if (json.status !== 'COMPLETED' || !track?.audioUrl) {
      return { ok: true, done: false, jobId };
    }

    const audio = await fetch(track.audioUrl);
    if (!audio.ok) return fail('만든 곡을 내려받지 못했어요.', 502);
    return {
      ok: true,
      done: true,
      value: {
        audio: await audio.arrayBuffer(),
        lengthMs: Math.round((track.duration ?? 0) * 1000),
      },
    };
  },
};
