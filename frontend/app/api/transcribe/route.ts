import { NextResponse } from 'next/server';
import { stt } from '@/lib/providers';

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

/** 서버리스 요청 본문 한계. 대략 20분 분량. */
const MAX_BYTES = 4 * 1024 * 1024;

/** 한 요청 안에서 이만큼은 기다려 본다. 짧은 녹음은 한 번에 끝난다. */
const WAIT_MS = 45_000;
const STEP_MS = 3_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 아직이면 표를 돌려주고, 끝났으면 전사 결과를 준다. */
export async function GET(req: Request) {
  const job = new URL(req.url).searchParams.get('job');
  if (!job) return NextResponse.json({ error: '작업 번호가 없습니다.' }, { status: 400 });
  return settle(() => stt.poll(job), job);
}

export async function POST(req: Request) {
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

  const started = await stt.start(file);
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
