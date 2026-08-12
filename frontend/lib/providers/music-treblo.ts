import { fail, type Job, type MusicProvider, type MusicResult } from './types';

/**
 * 곡 만들기 (Treblo, 옛 Sonauto).
 *
 * 공식 REST API 다. 이게 이 파일이 존재하는 이유다.
 *
 * 처음에는 Suno 를 붙이려 했는데, 공개 API 가 없어서 중계 서버를 띄우는
 * 방법뿐이었다. 그 중계 서버는 2025년 1월부터 헤드리스 브라우저로 사람인
 * 척 접속하고 hCaptcha 를 대행 서비스로 푸는 물건이 되었다. 기관에 파는
 * 서비스가 딛고 설 바닥이 아니다 — 계정이 막히면 그날로 멎고, 어르신 이름이
 * 붙은 결과물의 권리 관계도 설명할 수 없다.
 *
 * Treblo 는 열쇠 하나로 부르고, 만든 곡의 상업적 이용권을 함께 준다.
 * 한국어 보컬도 된다. 곡당 약 $0.05.
 *
 * 길이를 지정할 수 있는 것도 크다. 회상용 노래는 짧아야 하는데(90초),
 * 그걸 못 정하면 3~4분짜리가 나와서 어르신이 끝까지 못 들으신다.
 */

const BASE = 'https://api.treblo.com/v1';

/** 스타일 → 태그. 모델이 한국어 장르명을 정확히 못 알아듣는다. */
/*
 * 빠르기를 여기에도 적는다.
 *
 * 기본 제공자(apiframe)에만 빠르기를 넣었더니, MUSIC_PROVIDER 를 바꾸는
 * 순간 "너무 빠르다"가 그대로 돌아오는 상태가 됐다. 같은 결정이 파일마다
 * 흩어져 있으면 한 곳만 고치게 되고, 고친 사람은 고쳤다고 믿는다.
 * 숫자의 근거는 music-apiframe.ts 의 표에 있다 — 회상·집단가창에서 흔히
 * 권장되는 60~80박 안에서 장르별로 놓았다.
 */
const STYLE_TAGS: Record<string, string> = {
  folkTrad:
    'korean traditional folk, minyo, acoustic, warm, gentle, unhurried, slow steady tempo around 70 bpm',
  folkBright:
    'korean acoustic folk, bright, warm, acoustic guitar, singalong, relaxed walking pace, slow steady tempo around 78 bpm',
  ballad:
    'korean ballad, tender, piano, strings, very slow and spacious, comforting, steady tempo around 64 bpm',
  trot:
    'korean trot, sentimental, nostalgic, electric organ, brushed drums, slow trot at about half the usual trot speed, steady tempo around 74 bpm',
};

/**
 * 창법 지시.
 *
 * 어느 모델이든 약점은 보컬이고, 부탁할 것도 같다 — 굴리지 말고, 한 글자에
 * 한 음, 또박또박. 듣는 분들은 고역 청력이 먼저 떨어지므로 자음이 살아야
 * 하고, 따라 부르실 수 있어야 하므로 음역이 좁아야 한다.
 */
const DIRECTION =
  'A gentle Korean song for an elderly person to sing along to. ' +
  'One warm mid-range voice, mature and unhurried, plain and conversational. ' +
  'Clear Korean diction — every word intelligible to an older listener. ' +
  'One note per syllable, no melisma, no heavy vibrato. ' +
  'Simple singable melody within one octave. Sparse arrangement, natural breaths. ' +
  'Do not imitate any specific artist or existing song.';

type Status = 'PENDING' | 'STARTED' | 'PROGRESS' | 'SUCCESS' | 'FAILURE' | string;

function key(): string {
  return process.env.TREBLO_API_KEY ?? '';
}

async function call(path: string, init?: RequestInit): Promise<Response | null> {
  if (!key()) return null;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 30_000);
  try {
    return await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key()}`,
        'Content-Type': 'application/json',
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

/**
 * 길이 힌트. 30초 배수로만 받는다.
 *
 * 90초를 원하면 [60, 120] 으로 감싼다. 딱 떨어지게 요구하면 모델이 곡을
 * 억지로 자르거나 늘여서 끝이 어색해진다.
 */
function lengthRange(ms: number): [number, number] {
  const target = Math.round(ms / 1000);
  const min = Math.max(0, Math.min(270, Math.floor((target - 30) / 30) * 30));
  const max = Math.max(30, Math.min(300, Math.ceil((target + 30) / 30) * 30));
  return [min, max];
}

async function fetchAudio(taskId: string, lengthMs: number): Promise<Job<MusicResult>> {
  const res = await call(`/generations/${encodeURIComponent(taskId)}`);
  if (!res) return fail('곡 만들기 서버에 연결하지 못했어요.', 503);
  if (!res.ok) {
    console.error('treblo fetch failed', res.status);
    return fail('만든 곡을 받아 오지 못했어요.', 502);
  }
  const json = (await res.json()) as { song_paths?: string[] };
  const url = json.song_paths?.[0];
  if (!url) return fail('만든 곡을 찾지 못했어요.', 502);

  const audio = await fetch(url);
  if (!audio.ok) return fail('만든 곡을 내려받지 못했어요.', 502);
  return {
    ok: true,
    done: true,
    // Treblo 는 한 번에 한 곡이다. 고를 것이 없으므로 takes 는 1.
    value: { audio: await audio.arrayBuffer(), lengthMs, takes: 1 },
  };
}

export const trebloMusic: MusicProvider = {
  name: 'treblo',

  async start(req) {
    if (!key()) {
      return fail('이 배포에는 곡 만들기가 설정되어 있지 않습니다.', 503);
    }

    const res = await call('/generations/v3', {
      method: 'POST',
      body: JSON.stringify({
        prompt: DIRECTION,
        tags: [STYLE_TAGS[req.style] ?? STYLE_TAGS.ballad],
        // 어르신의 생애가 담긴 그 가사가 그대로 노래가 된다.
        lyrics: req.lyrics,
        instrumental: false,
        length_range: lengthRange(req.lengthMs),
        num_songs: 1,
      }),
    });

    if (!res) return fail('곡 만들기 서버에 연결하지 못했어요.', 503);
    if (!res.ok) {
      console.error('treblo generate failed', res.status);
      // 401·402·429 는 고장이 아니라 열쇠나 한도 문제다. 다르게 안내해야
      // 복지사가 무엇을 해야 할지 안다.
      if (res.status === 401 || res.status === 403) {
        return fail('곡 만들기 열쇠가 올바르지 않아요. 관리자에게 알려 주세요.', 503);
      }
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
    // 길이를 표에 함께 실어 둔다. 다음 요청에서도 알아야 한다.
    return { ok: true, done: false, jobId: `${task_id}::${req.lengthMs}` };
  },

  async poll(jobId) {
    const at = jobId.lastIndexOf('::');
    const taskId = at < 0 ? jobId : jobId.slice(0, at);
    // 표에 길이가 없는 옛 작업표를 위한 대비값. 회상용 노래 기본 길이와
    // 같아야 한다 — 90초로 남아 있어서 새 기본값(120초)과 어긋나 있었다.
    const lengthMs = at < 0 ? 120_000 : Number(jobId.slice(at + 2)) || 120_000;

    const res = await call(`/generations/status/${encodeURIComponent(taskId)}`);
    if (!res) return fail('곡 만들기 서버에 연결하지 못했어요.', 503);
    if (!res.ok) {
      console.error('treblo status failed', res.status);
      return fail('곡 상태를 확인하지 못했어요.', 502);
    }

    const { status } = (await res.json()) as { status?: Status };
    if (status === 'SUCCESS') return fetchAudio(taskId, lengthMs);
    if (status === 'FAILURE') {
      return fail('곡을 만들지 못했어요. 가사는 그대로 남아 있습니다.', 502);
    }
    return { ok: true, done: false, jobId };
  },
};
