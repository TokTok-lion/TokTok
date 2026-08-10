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

/**
 * 전사 한 줄. 이 줄의 시각이 그대로 이야기 항목의 출처가 된다.
 *
 * speaker 는 화자 분리 결과다. 회기는 복지사가 묻고 어르신이 답하는 대화라,
 * 누가 한 말인지 갈라야 사실 추출에 복지사 질문이 섞이지 않는다.
 *
 * 여기서 꼭 짚어야 할 것 — **어느 목소리가 어르신인지 기계는 모른다.** 구글이
 * 주는 것은 "1번 목소리 · 2번 목소리"까지고, 그중 누가 어르신인지는 아무 데도
 * 적혀 있지 않다. 이 값은 추정이다(회기에서 더 오래 말씀하신 쪽을 어르신으로
 * 본다). 그래서 화면이 추정이라고 밝히고 복지사가 뒤집을 수 있어야 한다.
 * 갈라지지 않았으면 붙이지 않는다 — 모르는 것은 모른다고 둔다.
 */
export type Segment = {
  id: string;
  text: string;
  at: number;
  speaker?: 'elder' | 'worker';
};

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

/**
 * 한국어는 단어가 아니라 조각으로 온다.
 *
 * 구글에 단어별 시각을 달라고 하면 한국어는 서브워드 단위로 쪼개져서
 * 돌아온다 — "열아홉에"가 `▁열` `아` `홉` `의` 네 조각이다. 앞의 `▁`
 * (U+2581)가 "여기서 새 단어가 시작한다"는 표시다.
 *
 * 이걸 모르고 공백으로 이어 붙였더니 "▁열 아 홉 의 ▁그 ▁공 장 을"이
 * 나왔다. 그 상태로 이야기를 뽑으면 사실 문장이 될 리가 없고, 출처로
 * 되짚을 원문도 읽을 수 없는 글자가 된다.
 *
 * 그래서 표시가 있으면 그 규칙대로 붙이고, 없으면(영어처럼 이미 단어로
 * 오는 경우) 예전처럼 공백으로 잇는다.
 */
const WORD_MARK = '▁';

function joinTokens(tokens: string[]): string {
  const subword = tokens.some((t) => t.includes(WORD_MARK));
  if (!subword) return tokens.join(' ').replace(/\s+/g, ' ').trim();

  let out = '';
  // 표시만 홀로 오는 조각이 있다. 글자가 없다고 버리면 그 자리의 띄어쓰기가
  // 사라져서 "공장을들어갔지"가 된다 — 다음 조각에 넘겨 준다.
  let boundary = false;
  for (const t of tokens) {
    const startsWord = t.startsWith(WORD_MARK);
    const text = t.split(WORD_MARK).join('');
    if (!text) {
      boundary = true;
      continue;
    }
    if ((startsWord || boundary) && out) out += ' ';
    boundary = false;
    out += text;
  }
  return out.replace(/\s+/g, ' ').trim();
}

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
    const text = joinTokens(buf);
    if (text) out.push({ id: `seg-${out.length}`, text, at: Math.round(start) });
    buf = [];
  };

  for (const w of spoken) {
    const gap = w.start - prevStart;
    const long = joinTokens(buf).length >= MAX_SEGMENT_CHARS;
    // 조각 한가운데서 끊으면 단어가 두 동강 난다. 새 단어가 시작하는
    // 자리에서만 줄을 바꾼다.
    const boundary = !buf.length || w.text.startsWith(WORD_MARK) ||
      !buf.some((t) => t.includes(WORD_MARK));
    if (buf.length && boundary && (gap >= PAUSE_SECONDS || long)) {
      flush();
      start = w.start;
    }
    buf.push(w.text.trim());
    prevStart = w.start;
  }
  flush();
  return out;
}
