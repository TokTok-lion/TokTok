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
  /**
   * 이 실패로 작업이 끝났는가.
   *
   * '전사를 못 했다'와 '지금 상태를 못 읽었다'는 다르다. 뒤쪽은 와이파이가
   * 잠깐 끊겼다는 뜻이지 작업이 죽었다는 뜻이 아닌데, 둘을 같이 다루면
   * 부르는 쪽이 아직 돌고 있는 작업의 원음성을 지워 버린다. 다시 물어볼
   * 수도, 다시 보낼 수도 없게 된다 — 요금은 이미 나간 뒤다.
   *
   * 안 붙어 있으면 "모른다"이고, 모를 때는 지우지 않는다.
   */
  settled?: boolean;
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
  /**
   * 이미 저장소에 올라와 있는 녹음으로 전사를 시작한다.
   *
   * 왜 두 갈래인가. 우리 함수를 거쳐 오는 길에는 4.5MB 한도가 있고(Vercel
   * 인프라 제약, 설정으로 못 올린다) 회기 녹음은 그보다 길다. 그래서 긴
   * 녹음은 브라우저가 저장소로 바로 올리고, 여기에는 그 이름만 온다.
   *
   * 짧은 녹음까지 이 길로 몰지 않은 이유: 지금 돌아가고 있는 길이 있는데
   * 새 길 하나에 전부를 걸면, 새 길이 삐끗할 때 되던 것까지 같이 멎는다.
   */
  startUploaded(object: string, contentType: string): Promise<Job<Segment[]>>;
  poll(jobId: string): Promise<Job<Segment[]>>;
}

/**
 * 이 녹음을 전사에 보낼 수 있는가.
 *
 * 구글 v1 이 아는 것은 FLAC · LINEAR16(wav) · MP3 · OGG_OPUS · WEBM_OPUS ·
 * AMR 뿐이다. **AAC(m4a·mp4)는 목록에 없다.** 그런데 사파리의 MediaRecorder
 * 는 audio/mp4 를 준다 — 아이패드로 받은 회기 녹음이 그것이다.
 *
 * 여기가 조용히 틀리던 자리다. 예전에는 무엇이 오든 config 에 WEBM_OPUS 를
 * 박아 보냈다. 아이패드 녹음은 AAC 인데 WebM/Opus 라고 말하고 보낸 셈이라,
 * 구글이 못 알아듣거나 엉뚱한 글자를 냈다. 화면에는 "전사하지 못했어요"만
 * 떠서, 마이크가 나쁜 줄 알기 딱 좋다.
 *
 * 모르는 형식은 모른다고 말한다. 형식을 속여 보내는 것보다 낫다.
 */
export type AudioConfig = { encoding: string; sampleRateHertz?: number };

export function audioConfigFor(contentType: string): AudioConfig | null {
  const t = (contentType || '').toLowerCase();
  if (t.includes('webm')) return { encoding: 'WEBM_OPUS', sampleRateHertz: 48000 };
  if (t.includes('ogg') || t.includes('opus')) return { encoding: 'OGG_OPUS', sampleRateHertz: 48000 };
  if (t.includes('flac')) return { encoding: 'FLAC' };
  // wav·flac 은 머리말만 보고 구글이 알아낸다. 샘플레이트를 우리가 우겨
  // 넣으면 오히려 실제 파일과 어긋난다.
  if (t.includes('wav') || t.includes('x-wav') || t.includes('wave')) {
    return { encoding: 'LINEAR16' };
  }
  if (t.includes('mpeg') || t.includes('mp3')) return { encoding: 'MP3' };
  if (t.includes('amr')) return { encoding: 'AMR' };
  return null;
}

/** 사람에게 보여 줄 말. 무엇을 가져오면 되는지까지 적는다. */
export const UNSUPPORTED_AUDIO =
  '이 녹음 형식(m4a·aac 등)은 전사가 되지 않아요. ' +
  'wav·mp3·webm 으로 바꿔서 올려 주세요.';

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

function joinTokens(tokens: string[], subword: boolean): string {
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

  /*
   * 서브워드인지는 목록 전체를 보고 한 번만 정한다.
   *
   * 예전에는 joinTokens 가 넘겨받은 조각만 보고 그때그때 정했는데, 넘겨받는
   * 것은 전체 단어가 아니라 모으던 중인 부분 버퍼다. 그 버퍼에 ▁ 가 하나도
   * 없는 순간(한 단어의 가운데 조각들만 담겨 있을 때)이 오면 "서브워드가
   * 아니다"로 판정해 공백으로 이어 붙인다 — "아 홉 에" 같은 줄이 그렇게
   * 만들어졌다. 판정 근거는 한 줄이 아니라 이 응답 전체여야 한다.
   */
  const subword = spoken.some((w) => w.text.includes(WORD_MARK));

  const out: Segment[] = [];
  let buf: string[] = [];
  let start = spoken[0].start;
  let prevStart = start;

  const flush = () => {
    const text = joinTokens(buf, subword);
    if (text) out.push({ id: `seg-${out.length}`, text, at: Math.round(start) });
    buf = [];
  };

  for (const w of spoken) {
    const gap = w.start - prevStart;
    const long = joinTokens(buf, subword).length >= MAX_SEGMENT_CHARS;
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
