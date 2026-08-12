import { NextResponse } from 'next/server';
import { stt } from '@/lib/providers';
import { requireUser } from '@/lib/apiAuth';

/**
 * 녹음을 글로 옮기기.
 *
 * 이 라우트는 이 서비스에서 가장 민감한 경로다 — 어르신 목소리가 기기를
 * 떠나 외부 서버로 나간다. 그래서 부르는 쪽에서 두 가지 동의를 모두 확인한다
 * (C-01 녹음, C-02 외부 AI 전송). 하나라도 없으면 화면에 버튼이 없다.
 *
 * 단어마다 시각이 함께 온다. 이게 핵심이다 — 그 시각을 이야기 항목의 출처로
 * 그대로 물리면, "확인된 이야기에는 반드시 출처가 붙는다"는 규칙이 사람 손을
 * 거치지 않고 지켜진다.
 *
 * 어느 업체를 쓰는지는 여기서 모른다. lib/providers 가 정한다.
 *
 * 오래 걸리므로 두 걸음으로 나눈다. 서버리스 한 요청은 몇 분을 못 버티는데,
 * 30분짜리 녹음은 그보다 오래 걸린다. 끝났으면 결과를, 아직이면 표를 준다.
 */

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * 서버리스 요청 본문 한계.
 *
 * Vercel 함수는 4.5MB 를 넘는 본문을 받지 못한다. 인프라 수준 제약이라
 * 설정으로 못 올린다. 그래서 이 길로는 짧은 녹음만 온다.
 *
 * 주석에 오래 '대략 20분 분량'이라고 적혀 있었는데 그게 아니었다. 브라우저
 * 기본 비트레이트가 128kbps 라 4MB 는 **4분 22초**였다. 5분을 넘긴 회기는
 * 전부 413 으로 되돌아왔고, 화면은 "20분 이내로 나눠서 진행해 주세요"라고
 * 말했다 — 시키는 대로 20분을 녹음하면 17.7MB 라 또 거부된다. 복지사
 * 입장에서는 무엇을 해도 안 되는 일이었고, 어르신은 이미 말씀을 마치신 뒤다.
 *
 * 두 군데를 고쳤다. 녹음은 32kbps 로 받고(lib/recorder.ts), 그보다 긴 것은
 * 이 길로 오지 않는다 — 브라우저가 저장소로 바로 올리고 이름만 보낸다
 * (POST /api/transcribe/upload → object).
 */
const MAX_BYTES = 4 * 1024 * 1024;

/** 한 요청 안에서 이만큼은 기다려 본다. 짧은 녹음은 한 번에 끝난다. */
const WAIT_MS = 45_000;
const STEP_MS = 3_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 아직이면 표를 돌려주고, 끝났으면 전사 결과를 준다. */
export async function GET(req: Request) {
  const who = await requireUser(req);
  if (!who.ok) return NextResponse.json({ error: who.error }, { status: 401 });

  const job = new URL(req.url).searchParams.get('job');
  if (!job) return NextResponse.json({ error: '작업 번호가 없습니다.' }, { status: 400 });
  return settle(() => stt.poll(job), job);
}

export async function POST(req: Request) {
  // 어르신 목소리가 외부로 나가는 자리다. 누가 부르는지부터 확인한다.
  const who = await requireUser(req);
  if (!who.ok) return NextResponse.json({ error: who.error }, { status: 401 });

  /*
   * 입구가 둘이다.
   *
   *   · 저장소에 이미 올라간 녹음 → { object, contentType } (JSON)
   *   · 짧은 녹음 → multipart 로 파일 그대로
   *
   * 긴 것을 위해 새 길을 냈지만 짧은 것까지 그리로 몰지는 않았다. 지금
   * 돌아가고 있는 길이 있는데 새 길 하나에 전부를 걸면, 새 길이 삐끗할 때
   * 되던 것까지 같이 멎는다. 어르신 앞에서 멎는 자리다.
   */
  const isJson = (req.headers.get('content-type') ?? '').includes('application/json');

  if (isJson) {
    let object = '';
    let contentType = '';
    let topic = '';
    try {
      const body = (await req.json()) as {
        object?: string;
        contentType?: string;
        topic?: string;
      };
      object = (body.object ?? '').trim();
      contentType = (body.contentType ?? '').trim();
      topic = (body.topic ?? '').trim();
    } catch {
      return NextResponse.json({ error: '요청을 읽지 못했습니다.' }, { status: 400 });
    }
    if (!object || !contentType) {
      return NextResponse.json({ error: '올린 녹음을 찾지 못했습니다.' }, { status: 400 });
    }
    return begin(await stt.startUploaded(object, contentType, topic));
  }

  let file: File | null = null;
  // 오늘 회기 주제. 인식에 미리 알려 줄 낱말을 여기서 뽑는다(speechHints).
  let topic = '';
  try {
    const form = await req.formData();
    const f = form.get('file');
    if (f instanceof File) file = f;
    const t = form.get('topic');
    if (typeof t === 'string') topic = t.trim();
  } catch {
    return NextResponse.json({ error: '녹음을 읽지 못했습니다.' }, { status: 400 });
  }

  if (!file || file.size === 0) {
    return NextResponse.json({ error: '녹음이 없습니다.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    // 여기까지 왔다는 것은 화면이 저장소 업로드를 못 썼다는 뜻이다. 길이를
    // 탓하지 않는다 — 복지사가 고칠 수 있는 것이 아니다.
    return NextResponse.json(
      {
        error:
          '이 녹음을 보내지 못했어요. 잠시 뒤 다시 시도해 주세요. ' +
          '계속 안 되면 받아 적기로 진행해 주세요.',
      },
      { status: 413 },
    );
  }

  return begin(await stt.start(file, topic));
}

/** 시작 결과를 화면이 아는 모양으로 바꾼다. 두 입구가 같은 답을 준다. */
async function begin(started: Awaited<ReturnType<typeof stt.start>>) {
  if (!started.ok) {
    return NextResponse.json(
      { error: started.error, quota: started.quota },
      { status: started.status },
    );
  }
  if (started.done) return NextResponse.json({ segments: started.value });
  return settle(() => stt.poll(started.jobId), started.jobId);
}

/**
 * 될 때까지 잠깐 기다려 본다.
 *
 * 5분짜리 녹음은 대개 이 안에서 끝나서 화면이 한 번에 결과를 받는다. 안
 * 끝나면 표를 넘기고, 화면이 이어서 물어본다 — 기다리다 끊기는 것보다
 * 낫다. 어르신 앞에서 "다시 해 주세요"가 제일 나쁘다.
 */
async function settle(
  poll: () => Promise<Awaited<ReturnType<typeof stt.poll>>>,
  jobId: string,
) {
  const until = Date.now() + WAIT_MS;
  for (;;) {
    const out = await poll();
    if (!out.ok) {
      return NextResponse.json({ error: out.error, quota: out.quota }, { status: out.status });
    }
    if (out.done) return NextResponse.json({ segments: out.value });
    if (Date.now() >= until) {
      return NextResponse.json({ job: jobId }, { status: 202 });
    }
    await sleep(STEP_MS);
  }
}
