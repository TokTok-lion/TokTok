import { fail, type Job, type MusicProvider, type MusicResult } from './types';

/**
 * 곡 만들기 (Suno — APIFRAME 경유).
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
 * 갈아 끼울 수 있게 해 둔 이유가 이런 상황 때문이다. 공식 파트너 API 가
 * 열리거나 이 경로가 막히면 파일 하나만 바꾸면 된다.
 */

const BASE = 'https://api.apiframe.pro';

/** 스타일 → 태그. 모델이 한국어 장르명을 정확히 못 알아듣는다. */
const STYLE_TAGS: Record<string, string> = {
  folkTrad: 'korean traditional folk, minyo, acoustic, warm, gentle, unhurried',
  folkBright: 'korean acoustic folk, bright, cheerful, acoustic guitar, singalong',
  ballad: 'korean ballad, tender, piano, strings, slow, comforting',
  trot: 'korean trot, sentimental, nostalgic, electric organ, brushed drums',
};

/**
 * 창법 지시.
 *
 * 어느 모델이든 약점은 보컬이고 부탁할 것도 같다 — 굴리지 말고, 한 글자에
 * 한 음, 또박또박. 듣는 분들은 고역 청력이 먼저 떨어지므로 자음이 살아야
 * 하고, 따라 부르실 수 있어야 하므로 음역이 좁아야 한다.
 */
const VOICE_TAGS =
  'clear korean diction, one note per syllable, no melisma, no heavy vibrato, ' +
  'warm mid-range voice, simple singable melody, sparse arrangement';

type Song = { audio_url?: string; song_id?: string };
type Fetched = {
  status?: 'processing' | 'finished' | 'failed' | string;
  percentage?: number;
  songs?: Song[];
  error?: string;
};

function key(): string {
  return process.env.APIFRAME_API_KEY ?? '';
}

async function call(path: string, body: unknown): Promise<Response | null> {
  if (!key()) return null;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 30_000);
  try {
    return await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { Authorization: key(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function badKey(status: number) {
  if (status === 401) {
    return fail('곡 만들기 열쇠가 올바르지 않아요. 관리자에게 알려 주세요.', 503);
  }
  return null;
}

export const apiframeMusic: MusicProvider = {
  name: 'apiframe',

  async start(req) {
    if (!key()) {
      return fail('이 배포에는 곡 만들기가 설정되어 있지 않습니다.', 503);
    }

    const res = await call('/suno-imagine', {
      // 가사 검수 화면에서 만든 그 가사가 그대로 노래가 된다.
      lyrics: req.lyrics,
      title: req.title || '이름 없는 노래',
      tags: `${STYLE_TAGS[req.style] ?? STYLE_TAGS.ballad}, ${VOICE_TAGS}`,
      make_instrumental: false,
      model: process.env.APIFRAME_MODEL || 'V4_5',
    });

    if (!res) return fail('곡 만들기 서버에 연결하지 못했어요.', 503);
    if (!res.ok) {
      console.error('apiframe imagine failed', res.status);
      const k = badKey(res.status);
      if (k) return k;
      if (res.status === 402) {
        return fail('곡 만들기 잔액이 부족해요. 가사는 그대로 남아 있습니다.', 402, {
          needsPaidPlan: true,
        });
      }
      const quota = res.status === 429;
      return fail(
        quota ? '이번 달 곡 만들기 한도를 다 썼어요.' : '곡을 만들지 못했어요.',
        quota ? 429 : 502,
        { quota },
      );
    }

    const { task_id } = (await res.json()) as { task_id?: string };
    if (!task_id) return fail('곡 만들기를 시작하지 못했어요.', 502);
    // 길이를 표에 실어 둔다. Suno 는 길이를 지정할 수 없어서 나온 곡을
    // 그대로 쓰는데, 기록에는 남겨야 한다.
    return { ok: true, done: false, jobId: `${task_id}::${req.lengthMs}` };
  },

  async poll(jobId) {
    const at = jobId.lastIndexOf('::');
    const taskId = at < 0 ? jobId : jobId.slice(0, at);
    const lengthMs = at < 0 ? 0 : Number(jobId.slice(at + 2)) || 0;

    const res = await call('/fetch', { task_id: taskId });
    if (!res) return fail('곡 만들기 서버에 연결하지 못했어요.', 503);
    if (!res.ok) {
      console.error('apiframe fetch failed', res.status);
      const k = badKey(res.status);
      if (k) return k;
      return fail('곡 상태를 확인하지 못했어요.', 502);
    }

    const json = (await res.json()) as Fetched;
    if (json.status === 'failed' || json.error) {
      return fail('곡을 만들지 못했어요. 가사는 그대로 남아 있습니다.', 502);
    }

    const url = json.songs?.find((s) => s.audio_url)?.audio_url;
    // 다 됐다는데 소리가 없으면 아직이다. 상태만 믿고 넘기면 빈 곡이 저장된다.
    if (json.status !== 'finished' || !url) {
      return { ok: true, done: false, jobId };
    }

    const audio = await fetch(url);
    if (!audio.ok) return fail('만든 곡을 내려받지 못했어요.', 502);
    return {
      ok: true,
      done: true,
      value: { audio: await audio.arrayBuffer(), lengthMs },
    };
  },
};
