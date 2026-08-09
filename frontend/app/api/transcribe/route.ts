import { NextResponse } from 'next/server';

/**
 * 녹음을 글로 옮기기 (ElevenLabs Scribe).
 *
 * 이 라우트는 이 서비스에서 가장 민감한 경로다 — 어르신 목소리가 기기를
 * 떠나 외부 서버로 나간다. 그래서 부르는 쪽에서 두 가지 동의를 모두 확인한다
 * (C-01 녹음, C-02 외부 AI 전송). 하나라도 없으면 화면에 버튼이 없다.
 *
 * 단어마다 시각이 함께 온다. 이게 핵심이다 — 그 시각을 이야기 항목의 출처로
 * 그대로 물리면, "확인된 이야기에는 반드시 출처가 붙는다"는 규칙이 사람 손을
 * 거치지 않고 지켜진다. 복지사가 일일이 "몇 분에 하신 말씀"을 적을 수 없으니,
 * 자동으로 붙지 않으면 그 규칙은 현실에서 지켜지지 않는다.
 */

export const runtime = 'nodejs';

/** 서버리스 요청 본문 한계를 넘지 않게. 대략 20분 분량. */
const MAX_BYTES = 4 * 1024 * 1024;

/** 문장 하나로 묶을 최대 길이와, 이만큼 쉬면 문장을 끊는다. */
const MAX_SEGMENT_CHARS = 60;
const PAUSE_SECONDS = 0.8;

type Word = { text: string; start?: number; end?: number; type?: string };

export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: '이 배포에는 전사 기능이 설정되어 있지 않습니다.' },
      { status: 503 },
    );
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get('file');
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: '녹음을 읽지 못했습니다.' }, { status: 400 });
  }

  if (!file || file.size === 0) {
    return NextResponse.json({ error: '녹음이 없습니다.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error:
          '녹음이 너무 길어요. 20분 이내로 나눠서 진행해 주세요. ' +
          '어르신께도 짧게 여러 번이 덜 힘드십니다.',
      },
      { status: 413 },
    );
  }

  try {
    const ac = new AbortController();
    // 전사는 오래 걸린다. 오디오 길이에 비례하므로 넉넉히 준다.
    const timer = setTimeout(() => ac.abort(), 120_000);

    const body = new FormData();
    body.append('file', file);
    body.append('model_id', 'scribe_v1');
    body.append('language_code', 'kor');
    body.append('timestamps_granularity', 'word');
    // 화자 구분은 켜지 않는다. 어르신과 복지사를 나누는 것이 유용해 보이지만,
    // 틀리면 어르신이 하지 않은 말이 어르신 것으로 기록된다. 지금은 전부
    // 사람이 확인하는 편이 안전하다.
    body.append('diarize', 'false');

    const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': key },
      body,
      signal: ac.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.error('scribe failed', res.status);
      const quota = res.status === 401 || res.status === 429;
      return NextResponse.json(
        {
          error: quota
            ? '이번 달 전사 한도를 다 썼어요. 복지사가 받아 적어 진행해 주세요.'
            : '전사하지 못했어요. 녹음은 그대로 남아 있습니다.',
          quota,
        },
        { status: quota ? 429 : 502 },
      );
    }

    const json = (await res.json()) as { text?: string; words?: Word[] };
    const segments = toSegments(json.words ?? [], json.text ?? '');

    if (!segments.length) {
      return NextResponse.json(
        { error: '말씀이 잡히지 않았어요. 마이크가 어르신 가까이 있었는지 확인해 주세요.' },
        { status: 422 },
      );
    }

    return NextResponse.json({ segments });
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return NextResponse.json(
      {
        error: aborted
          ? '전사에 시간이 오래 걸려 멈췄어요. 녹음은 남아 있으니 다시 시도하실 수 있어요.'
          : '전사하지 못했어요.',
      },
      { status: 504 },
    );
  }
}

/**
 * 단어 목록을 문장 단위로 묶는다.
 *
 * 화면은 문장 하나가 한 줄이고, 그 줄의 시각이 출처가 된다. 그래서 어디서
 * 끊느냐가 곧 "몇 분 몇 초의 말씀인지"를 정한다. 마침표가 없더라도 어르신이
 * 잠깐 쉬면 거기서 끊는다 — 말하다 쉬는 자리가 대개 문장의 끝이다.
 */
function toSegments(words: Word[], fallback: string) {
  const spoken = words.filter((w) => w.type !== 'spacing' && w.text.trim());
  if (!spoken.length) {
    return fallback.trim()
      ? [{ id: 'seg-0', text: fallback.trim(), at: 0 }]
      : [];
  }

  const out: { id: string; text: string; at: number }[] = [];
  let buf: string[] = [];
  let start = spoken[0].start ?? 0;
  let prevEnd = start;

  const flush = () => {
    const text = buf.join(' ').replace(/\s+([.,?!])/g, '$1').trim();
    if (text) out.push({ id: `seg-${out.length}`, text, at: Math.floor(start) });
    buf = [];
  };

  for (const w of spoken) {
    const gap = (w.start ?? prevEnd) - prevEnd;
    const long = buf.join(' ').length >= MAX_SEGMENT_CHARS;
    if (buf.length && (gap >= PAUSE_SECONDS || long)) {
      flush();
      start = w.start ?? prevEnd;
    }
    if (!buf.length) start = w.start ?? prevEnd;
    buf.push(w.text.trim());
    prevEnd = w.end ?? w.start ?? prevEnd;

    if (/[.?!]$/.test(w.text.trim())) {
      flush();
      start = prevEnd;
    }
  }
  flush();
  return out;
}
