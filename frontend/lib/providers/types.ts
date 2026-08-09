/**
 * 바깥 AI 업체와 맞닿는 자리.
 *
 * 화면도, 저장도, 비용 계산도 어느 업체를 쓰는지 몰라야 한다. 그래야 업체를
 * 바꾸는 일이 파일 하나를 더 쓰는 일이 된다 — 실제로 한 번 겪었다. 음악
 * 생성이 라우트 안에 박혀 있어서, 바꾸려면 라우트를 통째로 다시 써야 했다.
 *
 * 여기 있는 것은 계약뿐이다. 구현은 각 파일에 있고, 무엇을 쓸지는
 * index.ts 가 환경변수를 보고 정한다.
 */

/** 전사 한 줄. 이 줄의 시각이 그대로 이야기 항목의 출처가 된다. */
export type Segment = { id: string; text: string; at: number };

export type Fail = {
  ok: false;
  error: string;
  status: number;
  /** 요금제 문제 — 고장이 아니므로 화면에서 다르게 안내한다 */
  needsPaidPlan?: boolean;
  /** 한도 소진 */
  quota?: boolean;
};

/**
 * 오래 걸리는 작업의 결과.
 *
 * 전사도 곡 만들기도 몇 초에서 몇 분까지 걸린다. 서버리스는 한 요청이 오래
 * 살지 못하므로, 끝났으면 결과를 주고 아직이면 표를 준다. 그 표를 들고
 * 다시 물으면 된다.
 */
export type Job<T> =
  | { ok: true; done: true; value: T }
  | { ok: true; done: false; jobId: string }
  | Fail;

export type MusicRequest = {
  /** 가사 전문. 어르신의 생애가 들어 있다. */
  lyrics: string;
  title: string;
  /** 앱의 스타일 id (ballad · trot · folkTrad · folkBright) */
  style: string;
  lengthMs: number;
};

export type MusicResult = { audio: ArrayBuffer; lengthMs: number };

export interface MusicProvider {
  readonly name: string;
  start(req: MusicRequest): Promise<Job<MusicResult>>;
  poll(jobId: string): Promise<Job<MusicResult>>;
}

export interface SttProvider {
  readonly name: string;
  start(file: File): Promise<Job<Segment[]>>;
  poll(jobId: string): Promise<Job<Segment[]>>;
}

export interface TtsProvider {
  readonly name: string;
  speak(text: string): Promise<{ ok: true; audio: ArrayBuffer; contentType: string } | Fail>;
}

export function fail(
  error: string,
  status = 502,
  extra: Omit<Fail, 'ok' | 'error' | 'status'> = {},
): Fail {
  return { ok: false, error, status, ...extra };
}

/**
 * 단어 목록을 문장 단위로 묶는다.
 *
 * 화면은 문장 하나가 한 줄이고, 그 줄의 시각이 출처가 된다. 그래서 어디서
 * 끊느냐가 곧 "몇 분 몇 초의 말씀인지"를 정한다. 마침표가 없더라도 어르신이
 * 잠깐 쉬면 거기서 끊는다 — 말하다 쉬는 자리가 대개 문장의 끝이다.
 *
 * 업체마다 단어를 주는 모양은 다르지만 묶는 규칙은 같아야 한다. 규칙이
 * 업체마다 다르면 출처 시각도 업체마다 달라진다.
 */
const MAX_SEGMENT_CHARS = 60;
const PAUSE_SECONDS = 0.8;

export function toSegments(
  words: { text: string; start: number }[],
  fallback = '',
): Segment[] {
  const spoken = words.filter((w) => w.text.trim());
  if (!spoken.length) {
    return fallback.trim() ? [{ id: 'seg-0', text: fallback.trim(), at: 0 }] : [];
  }

  const out: Segment[] = [];
  let buf: string[] = [];
  let start = spoken[0].start;
  let prevStart = start;

  const flush = () => {
    const text = buf.join(' ').replace(/\s+/g, ' ').trim();
    if (text) out.push({ id: `seg-${out.length}`, text, at: Math.round(start) });
    buf = [];
  };

  for (const w of spoken) {
    const gap = w.start - prevStart;
    const long = buf.join(' ').length >= MAX_SEGMENT_CHARS;
    if (buf.length && (gap >= PAUSE_SECONDS || long)) {
      flush();
      start = w.start;
    }
    buf.push(w.text.trim());
    prevStart = w.start;
  }
  flush();
  return out;
}
