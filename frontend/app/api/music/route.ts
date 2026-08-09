import { NextResponse } from 'next/server';
import { music } from '@/lib/providers';

/**
 * 가사로 곡 만들기.
 *
 * 가사에는 어르신의 생애가 들어 있다. 그래서 외부 AI 전송 동의(C-02)가
 * 있을 때만 부르며, 그 확인은 화면에서 한다.
 *
 * 특정 가수나 실존 곡을 흉내 내는 요청은 만들지 않는다 (원칙 14 · NFR-AI-007).
 * 스타일 목록 자체에 그런 항목이 없고, 제공자에게도 장르만 말한다. 어르신께
 * 드리는 곡이 남의 노래를 베낀 것이면 그건 선물이 아니다.
 *
 * 어느 업체를 쓰는지는 여기서 모른다. lib/providers 가 정한다.
 *
 * 곡 만들기는 1~3분이 걸린다. 서버리스 한 요청이 그만큼 못 사는 경우가
 * 있어서 두 걸음으로 나눈다 — 되면 오디오를, 아직이면 표를 준다.
 */

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * 곡 길이.
 *
 * 제공자가 길이를 받아 주면 이 값을 쓰고, 아니면 참고값으로만 둔다.
 * Suno 는 길이를 지정할 수 없어서 나온 곡의 실제 길이를 그대로 쓴다.
 */
const LENGTH_MS = Number(process.env.MUSIC_LENGTH_MS) || 90_000;

const WAIT_MS = 45_000;
const STEP_MS = 4_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(req: Request) {
  const job = new URL(req.url).searchParams.get('job');
  if (!job) return NextResponse.json({ error: '작업 번호가 없습니다.' }, { status: 400 });
  return settle(() => music.poll(job), job);
}

export async function POST(req: Request) {
  let style: string;
  let lyrics: string;
  let title: string;
  try {
    const body = (await req.json()) as {
      style?: string;
      lyrics?: string;
      title?: string;
    };
    style = body.style ?? 'ballad';
    lyrics = (body.lyrics ?? '').trim();
    title = (body.title ?? '').trim();
  } catch {
    return NextResponse.json({ error: '요청을 읽지 못했습니다.' }, { status: 400 });
  }

  if (!lyrics) {
    return NextResponse.json(
      { error: '가사가 없어 곡을 만들 수 없습니다.' },
      { status: 400 },
    );
  }

  const started = await music.start({ lyrics, title, style, lengthMs: LENGTH_MS });
  if (!started.ok) return bad(started);
  if (started.done) return audio(started.value.audio, started.value.lengthMs);
  return settle(() => music.poll(started.jobId), started.jobId);
}

function bad(f: { error: string; status: number; needsPaidPlan?: boolean; quota?: boolean }) {
  return NextResponse.json(
    { error: f.error, needsPaidPlan: f.needsPaidPlan, quota: f.quota },
    { status: f.status },
  );
}

function audio(buf: ArrayBuffer, lengthMs: number) {
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'audio/mpeg',
      // 길이는 서버가 정한다. 곡을 기관 저장소에 기록할 때 필요하므로
      // 클라이언트가 되짚어 계산하지 않도록 함께 내려 준다.
      'X-Music-Length-Ms': String(lengthMs || LENGTH_MS),
    },
  });
}

async function settle(
  poll: () => Promise<Awaited<ReturnType<typeof music.poll>>>,
  jobId: string,
) {
  const until = Date.now() + WAIT_MS;
  for (;;) {
    const out = await poll();
    if (!out.ok) return bad(out);
    if (out.done) return audio(out.value.audio, out.value.lengthMs);
    if (Date.now() >= until) return NextResponse.json({ job: jobId }, { status: 202 });
    await sleep(STEP_MS);
  }
}
