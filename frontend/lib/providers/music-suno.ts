import { fail, type Job, type MusicProvider, type MusicResult } from './types';

/**
 * 곡 만들기 (Suno).
 *
 * Suno 는 아직 공개 개발자 API 가 없다. 2026년 7월에 파트너 프로그램 신청
 * 창구가 열렸지만 선별 단계다. 그래서 여기서 부르는 것은 공식 API 가 아니라,
 * 기관이 직접 띄운 중계 서버(gcui-art/suno-api 계열)다. 그 서버가 Suno 계정
 * 세션으로 대신 호출한다.
 *
 * 이 선택의 뜻은 분명히 적어 둔다 — 약관상 보장된 경로가 아니고, 계정이
 * 막히거나 엔드포인트가 바뀌면 그날로 멎는다. 저작권 상황도 정리되지 않았다
 * (2026년 8월 뮌헨 법원 GEMA 승소, Universal·Sony 소송 진행 중). 운영자가
 * 알고 고른 길이며, 공식 API 가 열리면 이 파일만 갈아 끼우면 된다.
 *
 * 중계 서버 주소는 반드시 감춰 둘 것. 열려 있으면 아무나 그 계정으로 곡을
 * 만든다.
 */

const STYLE_TAGS: Record<string, string> = {
  folkTrad: 'korean traditional folk, minyo, warm, acoustic, daegeum, gentle pentatonic',
  folkBright: 'korean acoustic folk, bright, cheerful, acoustic guitar, singalong',
  ballad: 'korean ballad, tender, upright piano, small strings, slow, comforting',
  trot: 'korean trot, sentimental, nostalgic, electric organ, brushed drums',
};

/**
 * 창법 지시. 이 모델의 약점도 보컬이라 같은 것을 부탁한다 —
 * 굴리지 말고, 한 글자에 한 음, 또박또박.
 */
const VOICE_TAGS =
  'clear korean diction, one note per syllable, no melisma, no heavy vibrato, ' +
  'warm mid-range voice, simple singable melody, sparse arrangement, no digital sheen';

type Clip = {
  id?: string;
  status?: string;
  audio_url?: string;
  duration?: number | string;
};

function base(): string {
  return (process.env.SUNO_API_URL ?? '').replace(/\/+$/, '');
}

async function call(path: string, init?: RequestInit): Promise<Response | null> {
  const url = base();
  if (!url) return null;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 30_000);
  try {
    return await fetch(`${url}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        // 중계 서버를 자물쇠 뒤에 두었다면 그 열쇠를 함께 보낸다.
        ...(process.env.SUNO_API_TOKEN
          ? { Authorization: `Bearer ${process.env.SUNO_API_TOKEN}` }
          : {}),
        ...(init?.headers ?? {}),
      },
      signal: ac.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 준비된 클립이 있으면 오디오를 받아 온다. */
async function harvest(clips: Clip[]): Promise<Job<MusicResult> | null> {
  const ready = clips.find(
    (c) => c.audio_url && (c.status === 'complete' || c.status === 'streaming'),
  );
  if (!ready?.audio_url) return null;

  const res = await fetch(ready.audio_url);
  if (!res.ok) return fail('만든 곡을 받아 오지 못했어요.', 502);
  const audio = await res.arrayBuffer();
  const seconds = Number(ready.duration) || 0;
  return { ok: true, done: true, value: { audio, lengthMs: Math.round(seconds * 1000) } };
}

async function look(ids: string): Promise<Job<MusicResult>> {
  const res = await call(`/api/get?ids=${encodeURIComponent(ids)}`);
  if (!res) return fail('곡 만들기 서버에 연결하지 못했어요.', 503);
  if (!res.ok) {
    console.error('suno get failed', res.status);
    return fail('곡 상태를 확인하지 못했어요.', 502);
  }
  const clips = (await res.json()) as Clip[];
  if (clips.some((c) => c.status === 'error')) {
    return fail('곡을 만들지 못했어요. 가사는 그대로 남아 있습니다.', 502);
  }
  const got = await harvest(clips);
  return got ?? { ok: true, done: false, jobId: ids };
}

export const sunoMusic: MusicProvider = {
  name: 'suno',

  async start(req) {
    if (!base()) {
      return fail('이 배포에는 곡 만들기가 설정되어 있지 않습니다.', 503);
    }

    const res = await call('/api/custom_generate', {
      method: 'POST',
      body: JSON.stringify({
        // Suno 의 custom 모드에서는 prompt 가 곧 가사다.
        prompt: req.lyrics,
        tags: `${STYLE_TAGS[req.style] ?? STYLE_TAGS.ballad}, ${VOICE_TAGS}`,
        title: req.title || '이름 없는 노래',
        make_instrumental: false,
        // 여기서 기다리지 않는다. 서버리스 한 요청이 몇 분을 못 버틴다.
        wait_audio: false,
      }),
    });

    if (!res) return fail('곡 만들기 서버에 연결하지 못했어요.', 503);
    if (!res.ok) {
      console.error('suno generate failed', res.status);
      // 402·429 는 고장이 아니라 계정 한도다. 화면에서 다르게 안내해야 한다.
      if (res.status === 402) {
        return fail('곡 만들기 계정의 한도가 찼어요. 가사는 그대로 남아 있습니다.', 402, {
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

    const clips = (await res.json()) as Clip[];
    const ids = clips.map((c) => c.id).filter(Boolean).join(',');
    if (!ids) return fail('곡 만들기를 시작하지 못했어요.', 502);

    // 드물게 바로 준비되는 경우가 있다.
    const now = await harvest(clips);
    return now ?? { ok: true, done: false, jobId: ids };
  },

  poll: look,
};
