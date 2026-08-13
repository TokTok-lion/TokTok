import { NextResponse } from 'next/server';
import { alignLines } from '@/lib/align';
import { pollAlign, startAlign, startAlignFile } from '@/lib/providers/stt-align';
import { requireUser } from '@/lib/apiAuth';

/**
 * 가사 줄을 실제 노래에 맞춘다.
 *
 * ── 왜
 *
 * 함께 부르기 화면의 "지금 이 줄"은 글자 수로 나눈 어림이었다. 전주가 길거나
 * 후렴이 늘어지면 어긋나고, 어르신 여러 분이 한 화면을 건너다보며 부르는
 * 자리에서 글자가 어긋나면 그 순간 노래방이 아니게 된다.
 *
 * ── 어떻게
 *
 * 만들어진 곡을 인식에 한 번 넣어 "몇 초에 어떤 소리가 났는지"만 받고, 아는
 * 가사에 겹친다(lib/align). 받아쓰기를 새로 하는 것이 아니라 아는 것을 맞추는
 * 일이라, 노래 목소리를 군데군데 잘못 들어도 견딘다.
 *
 * ── 곡마다 한 번이면 된다
 *
 * 결과는 기기에 곡과 함께 저장된다. 이 라우트는 그 한 번을 위해 있다.
 * 실패해도 회기를 막지 않는다 — 못 맞추면 화면이 예전 어림으로 돌아가고,
 * 어림이라고 계속 적는다. 반쯤 맞은 정렬을 정확한 척 내놓는 것이 더 나쁘다.
 */

export const runtime = 'nodejs';

/** 한 요청 안에서 이만큼 기다려 본다. 3분짜리 곡은 대개 이 안에 끝난다. */
const WAIT_MS = 45_000;
const STEP_MS = 3_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 이만큼은 걸려야 "맞췄다"고 한다.
 *
 * 열두 줄짜리 가사에서 두 줄만 걸리면 나머지 열 줄은 사이를 채운 값이라
 * 어림과 다를 바 없다. 그런 결과를 저장해 두면 화면은 맞췄다고 믿고 어림이라는
 * 말을 지운다 — 지금보다 나쁜 상태가 된다.
 */
const ENOUGH = 0.4;

type Body = {
  /** 저장소에 올라간 곡(= /api/transcribe/upload 가 내준 이름). */
  object?: string;
  /** 이어서 물을 때의 표. */
  job?: string;
  /** 아는 가사 — 화면에 뜨는 줄 그대로, 순서대로. */
  lines?: string[];
  /** 곡 길이(초). 못 걸린 뒷줄을 채울 때 쓴다. */
  duration?: number;
};

/**
 * 입구가 둘이다.
 *
 *   · 곡 파일 그대로 (multipart) — 곡은 3~4MB 라 함수를 지나갈 수 있다.
 *   · 저장소에 이미 올라간 곡 { object } (JSON), 그리고 이어서 묻는 { job }.
 *
 * 파일을 그대로 받는 쪽이 기본이다. 브라우저가 저장소로 바로 올리는 길은
 * 저장소 CORS 설정에 달려 있는데, 지금 배포에서는 그 길이 막혀 있다.
 * 노래는 짧아서 함수를 지나가도 되므로, 되는 길로 간다.
 */
async function readBody(req: Request): Promise<{ body: Body; file: Blob | null }> {
  const type = req.headers.get('content-type') ?? '';
  if (!type.includes('multipart/form-data')) {
    return { body: (await req.json()) as Body, file: null };
  }
  const form = await req.formData();
  const file = form.get('file');
  const raw = form.get('lines');
  return {
    body: {
      lines: typeof raw === 'string' ? (JSON.parse(raw) as string[]) : [],
      duration: Number(form.get('duration')) || 0,
    },
    file: file instanceof Blob ? file : null,
  };
}

export async function POST(req: Request) {
  // 우리 저장소에 쓰고 인식 한도를 쓰는 자리다. 누가 부르는지부터 본다.
  const who = await requireUser(req);
  if (!who.ok) return NextResponse.json({ error: who.error }, { status: 401 });

  let body: Body;
  let file: Blob | null;
  try {
    ({ body, file } = await readBody(req));
  } catch {
    return NextResponse.json({ error: '요청을 읽지 못했습니다.' }, { status: 400 });
  }

  const lines = (body.lines ?? [])
    .filter((l): l is string => typeof l === 'string')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return NextResponse.json({ error: '맞출 가사가 없습니다.' }, { status: 400 });
  }
  const duration = Number(body.duration) || 0;

  const started = body.job
    ? await pollAlign(body.job)
    : file
      ? await startAlignFile(file)
      : body.object
        ? await startAlign(body.object)
        : null;
  if (!started) {
    return NextResponse.json({ error: '곡을 찾지 못했습니다.' }, { status: 400 });
  }
  if (!started.ok) {
    return NextResponse.json({ error: started.error }, { status: started.status });
  }

  let out = started;
  const until = Date.now() + WAIT_MS;
  while (!out.done) {
    if (Date.now() >= until) {
      // 아직이면 표를 넘긴다. 화면이 이어서 물어본다.
      return NextResponse.json({ job: out.jobId }, { status: 202 });
    }
    await sleep(STEP_MS);
    const next = await pollAlign(out.jobId);
    if (!next.ok) return NextResponse.json({ error: next.error }, { status: next.status });
    out = next;
  }

  const { starts, anchored } = alignLines(out.value, lines, duration);
  const ratio = lines.length ? anchored / lines.length : 0;

  /*
   * 못 맞췄으면 못 맞췄다고 한다. 시각은 함께 돌려주되 aligned=false 로 —
   * 화면은 이 값을 쓰지 않고 어림으로 남는다. 왜 안 됐는지는 복지사가 알
   * 필요가 없지만, 몇 줄이 걸렸는지는 우리가 볼 수 있어야 한다.
   */
  return NextResponse.json({
    aligned: ratio >= ENOUGH,
    anchored,
    lines: lines.length,
    starts,
  });
}
