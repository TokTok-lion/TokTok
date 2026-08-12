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
 *
 * 90초였다. 120초로 올린다 — 곡을 늘리려는 것이 아니라, 빠르기를 늦춘 만큼
 * 자리를 내주려는 것이다.
 *
 * 가사는 1절 4줄 + 후렴 4줄 + 2절 4줄, 열두 줄로 정해져 있다
 * (app/api/lyrics/route.ts). 한 줄을 4/4 두 마디로 부르면 열두 줄에
 * 이만큼이 든다:
 *
 *   발라드   64박  90초      민요풍  70박  82초
 *   트로트   74박  78초      포크풍  78박  74초
 *
 * 후렴을 끝에 한 번 더 부르는 것이 흔한데, 그러면 98~120초가 된다.
 * 즉 90초는 가장 느린 발라드가 겨우 딱 맞는 길이였다. 여기에 전주·간주가
 * 붙으면 모델이 어딘가를 줄여야 하고, 줄이기 가장 쉬운 것이 빠르기다 —
 * 프롬프트로 "천천히"라고 해 놓고 통에는 90초만 주면, 통이 이긴다.
 *
 * Treblo 는 이 값을 30초 배수 구간으로 바꿔 쓴다(music-treblo.ts).
 * 90초는 [60, 120]으로 풀려서 60초짜리도 규격에 맞는 답이었다 — 열두 줄을
 * 60초에 넣으면 그게 바로 "노래가 너무 빠르다"는 그 곡이다.
 * 120초는 [90, 150]이 되어 바닥이 90초로 올라간다.
 *
 * 어르신이 끝까지 들으실 수 있는 길이라는 조건은 그대로다. 2분은 회기
 * 안에서 한 곡을 듣고 이야기까지 나눌 수 있는 길이다. 이보다 더 늘리려면
 * 그때는 근거가 '가사가 길어져서'여야 한다.
 */
const LENGTH_MS = Number(process.env.MUSIC_LENGTH_MS) || 120_000;

const WAIT_MS = 45_000;
const STEP_MS = 4_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(req: Request) {
  const url = new URL(req.url);
  const job = url.searchParams.get('job');
  if (!job) return NextResponse.json({ error: '작업 번호가 없습니다.' }, { status: 400 });

  /*
   * take 는 몇 번째 연주를 받을지다. 없으면 첫 번째 — 기존 동작 그대로다.
   *
   * Suno 는 한 번 만들 때 트랙을 두 개 낸다. 값은 두 개를 합쳐 한 번치로
   * 매겨지므로 두 번째는 이미 치른 값이고, 같은 작업 번호로 다시 물어보면
   * 된다. 새로 만드는 것이 아니라 이미 만들어진 것을 하나 더 받는 것이라
   * 크레딧이 나가지 않는다.
   */
  const take = Number(url.searchParams.get('take')) || 1;
  return settle(() => music.poll(job, take), job);
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
  // 곧바로 끝난 경우에는 작업 번호가 없다(Job 타입이 done 과 jobId 를 함께
  // 들지 않는다). 그러면 두 번째 연주를 물어볼 길이 없으므로 알려 주지 않는다 —
  // 화면이 있지도 않은 선택지를 내미는 것보다 낫다.
  if (started.done) return audio(started.value.audio, started.value.lengthMs, 1);
  return settle(() => music.poll(started.jobId), started.jobId);
}

function bad(f: { error: string; status: number; needsPaidPlan?: boolean; quota?: boolean }) {
  return NextResponse.json(
    { error: f.error, needsPaidPlan: f.needsPaidPlan, quota: f.quota },
    { status: f.status },
  );
}

function audio(buf: ArrayBuffer, lengthMs: number, takes = 1, jobId?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'audio/mpeg' };

  // 작업 번호를 함께 내려 준다. 두 번째 연주를 받으려면 같은 번호로 다시
  // 물어야 하는데, 클라이언트는 폴링이 끝나면 그 번호를 잃는다.
  if (jobId) headers['X-Music-Job'] = jobId;

  // 같은 요청에서 나온 연주가 몇 개인지 알려 준다. 화면이 "고르시겠어요"를
  // 내밀지 말지를 이 값으로 정한다 — 업체를 바꿔 하나만 나오면 1 이 되고,
  // 고르는 자리는 저절로 사라진다.
  headers['X-Music-Takes'] = String(takes);

  // 길이는 서버가 정한다. 곡을 기관 저장소에 기록할 때 필요하므로
  // 클라이언트가 되짚어 계산하지 않도록 함께 내려 준다.
  //
  // 다만 제공자가 길이를 알려 주지 않았으면(apiframe 은 duration 이 빌 때가
  // 있다) 아무것도 안 붙인다. 예전에는 그 자리에 LENGTH_MS 를 넣었는데,
  // 그러면 아무도 재지 않은 120초가 songs.length_ms 로 들어가 앉는다.
  // 기관 저장소에 남는 값이라 나중에 그것을 실측으로 읽는 사람이 생긴다.
  // 모르는 것은 모르는 채로 두는 편이 낫다 — 칸은 비어도 되게 되어 있다.
  if (lengthMs > 0) headers['X-Music-Length-Ms'] = String(lengthMs);

  return new NextResponse(buf, { headers });
}

async function settle(
  poll: () => Promise<Awaited<ReturnType<typeof music.poll>>>,
  jobId: string,
) {
  const until = Date.now() + WAIT_MS;
  for (;;) {
    const out = await poll();
    if (!out.ok) return bad(out);
    if (out.done) return audio(out.value.audio, out.value.lengthMs, out.value.takes, jobId);
    if (Date.now() >= until) return NextResponse.json({ job: jobId }, { status: 202 });
    await sleep(STEP_MS);
  }
}
