import { fail, type MusicProvider } from './types';

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
 *
 * ── 빠르기를 왜 숫자로 박아 두는가 ─────────────────────────────
 *
 * 여기 장르만 적고 빠르기를 말하지 않던 시절이 있었다(ballad 에만 'slow'가
 * 있었다). 그러면 모델이 그 장르의 흔한 속도를 고른다 — 트로트의 흔한 속도는
 * 120~130 BPM 이다. 그 곡을 어르신 앞에 틀어 드렸더니 "너무 빠르다"는 말이
 * 돌아왔다. 감상용으로는 멀쩡한 곡이었지만, 이 제품의 노래는 감상용이 아니라
 * 함께 부르는 노래다. 따라 부를 수 없으면 만든 값을 못 한 것이다.
 *
 * 기준으로 삼은 것: 회상·집단가창 프로그램에서 어르신과 함께 부르는 곡은
 * 대체로 분당 60~80박이 권장된다. 안정 시 맥박과 편안한 걸음의 속도이고,
 * 그 언저리에서 숨과 박이 맞는다. 나이가 들면 소리를 듣고 말로 알아듣기까지
 * 걸리는 시간이 길어지므로, 가사 한 줄과 다음 줄 사이에 숨 돌릴 자리가
 * 있어야 따라올 수 있다.
 *
 * 그 60~80 안에서 장르마다 다르게 놓았다. 트로트와 민요풍을 같은 숫자로
 * 묶으면 둘 다 어색해진다 — 장르가 서 있는 자리가 다르기 때문이다.
 *
 *   ballad     64  가장 느리게. 발라드는 한 음을 길게 끌기 때문에 여기서 더
 *                  내리면 한 줄을 한 숨에 못 부르신다. 60이 바닥이다.
 *   folkTrad   70  굿거리처럼 흔들리는 결이라 아주 느리면 가락이 처진다.
 *                  느긋하되 멈추지 않는 자리.
 *   trot       74  흔한 트로트(120~130)의 절반 언저리. 화면에 적힌 이름이
 *                  '느린 트로트'인데 120이 나오면 이름이 거짓말이 된다.
 *   folkBright 78  넷 중 가장 밝고 빠르다. 그래도 권장 상한인 80을 넘기지
 *                  않는다 — '밝다'와 '빠르다'는 같은 말이 아니다.
 *
 * 주의: 모델은 bpm 을 지시가 아니라 힌트로 본다. 숫자만 적으면 절반·두 배로
 * 알아듣는 일이 있어서(74 를 148 로 치는 식), 숫자 옆에 'slow',
 * 'unhurried' 같은 말을 함께 둔다. 막는 쪽은 AVOID 가 한 번 더 맡는다.
 *
 * 이 숫자를 바꾸려거든 어르신 앞에서 들어 보고 바꿔라. 위 근거보다 현장에서
 * 들은 것이 세다. 다만 근거 없이 올리지는 마라 — 올라가는 방향은 언제나
 * 만든 사람에게만 편하다.
 */
const STYLE: Record<string, string> = {
  folkTrad:
    'korean traditional folk, minyo, warm and homely, acoustic, gentle pentatonic, ' +
    'unhurried, slow steady tempo around 70 bpm',
  folkBright:
    'korean acoustic folk, bright, warm, acoustic guitar, easy singalong, ' +
    'relaxed walking pace, slow steady tempo around 78 bpm',
  ballad:
    'korean ballad, tender, upright piano, small strings, comforting, ' +
    'very slow and spacious, steady tempo around 64 bpm',
  trot:
    'korean trot, sentimental, nostalgic, electric organ, brushed drums, ' +
    'slow trot at about half the usual trot speed, steady tempo around 74 bpm',
};

/**
 * 창법·녹음 지시.
 *
 * 근거를 하나씩 달아 둔다. 이 문자열은 눈에 안 보이는 곳에 있어서, 왜 이 말이
 * 여기 있는지 모르면 다음 사람이 "장황하다"며 지우기 쉽다.
 *
 *   crisp consonants           고역 청력이 먼저 떨어진다(노인성 난청). 모음은
 *                              웬만하면 들리지만 ㅅ·ㅊ·ㅋ 처럼 높은 데 실린
 *                              자음이 먼저 사라진다. 자음이 뭉개지면 소리는
 *                              들리는데 말은 안 들리는 상태가 된다.
 *   lead vocal well in front   반주가 목소리와 같은 크기면 목소리가 덮인다.
 *   soft sparse backing        난청이 있으면 소리 두 개를 갈라 듣는 일이 더
 *                              어렵기 때문에, 건강한 귀보다 더 벌려 줘야 한다.
 *   very short intro           전주가 길면 "언제 시작하나" 하고 기다리다
 *                              지치신다. 회기 시간도 길지 않다. 목소리가
 *                              먼저 나와야 무엇을 하는 시간인지 안다.
 *   steady tempo / no key      따라 부르는 중에 빨라지거나 조가 바뀌면
 *                              그 자리에서 놓치신다. 한 번 놓치면 다시
 *                              들어오기 어렵다.
 *   within one octave          음역이 넓으면 높은 데서 목이 안 따라간다.
 */
const VOICE =
  'clear korean diction, crisp consonants, one note per syllable, no melisma, ' +
  'no heavy vibrato, warm mid-range voice, simple singable melody within one octave, ' +
  'steady tempo throughout, no tempo change, no key change, ' +
  'lead vocal well in front of the accompaniment, soft sparse backing under the voice, ' +
  'very short intro with the vocal entering in the first few seconds, ' +
  'natural breaths between lines, warm analog recording';

/**
 * 막을 것.
 *
 * 앞의 다섯은 원래 있던 것(고함·오토튠·EDM·랩·디스토션)이고, 뒤는 빠르기와
 * 복잡함을 막으려고 더한 것이다. STYLE 의 bpm 을 모델이 힌트로만 볼 때
 * 여기가 한 번 더 잡아 준다.
 */
const AVOID =
  'shouting, heavy autotune, edm, rap, distorted guitar, ' +
  'fast tempo, uptempo, double time, driving beat, busy drums, rapid hi-hats, ' +
  'complex rhythm, tempo change, key change, ' +
  'long instrumental intro, dense mix, loud backing track, ' +
  'belting, high notes, wide vocal leaps';

/** style 필드 상한. 넘긴 만큼은 말없이 잘린다. */
const STYLE_MAX = 1000;

/**
 * 스타일 + 창법을 한 문자열로.
 *
 * 지금 가장 긴 조합은 trot 의 559자라 여유가 있다. 그래도 재고 나서 자르는 것은,
 * 넘치면 잘려 나가는 자리가 하필 VOICE 의 끝이기 때문이다 — '전주 짧게'와
 * '숨 자리'가 조용히 사라지고, 곡은 멀쩡히 나온다. 무엇이 빠졌는지 아무도
 * 모르는 채로. 그래서 잘릴 때는 로그에 남긴다.
 */
function styleText(id: string): string {
  const full = `${STYLE[id] ?? STYLE.ballad}, ${VOICE}`;
  if (full.length > STYLE_MAX) {
    console.error(
      `apiframe style prompt ${full.length}자 — ${STYLE_MAX}자를 넘어 뒤가 잘립니다`,
    );
  }
  return full.slice(0, STYLE_MAX);
}

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
          style: styleText(req.style),
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

    /*
     * Suno 는 한 번에 트랙을 **두 개** 낸다. 같은 가사·같은 스타일로 만든 서로
     * 다른 두 번의 연주다 — 멜로디와 편곡이 달라진다. 골라 들으라고 주는 것이고,
     * 값은 두 개를 합쳐 한 번치(11크레딧)로 매겨진다.
     *
     * 지금은 첫 번째만 쓰고 두 번째를 버린다. 이미 값을 치른 트랙이므로,
     * 「두 가지 중에 고르기」 화면은 요금을 더 쓰지 않고도 되살릴 수 있다
     * (app/session/preview 에 그 이야기를 적어 뒀다). 지금 버리는 이유는
     * 하나뿐이다 — 아직 그 화면이 없다.
     */
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
