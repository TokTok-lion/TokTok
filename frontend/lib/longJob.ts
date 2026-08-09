'use client';

/**
 * 오래 걸리는 일 기다리기.
 *
 * 전사도 곡 만들기도 서버리스 한 요청보다 오래 걸릴 수 있다. 그럴 때 서버는
 * 202 와 작업 번호를 준다. 여기서 그 번호를 들고 다시 물어본다.
 *
 * 화면 쪽 코드는 이 함수가 돌려주는 응답 하나만 보면 된다 — 한 번에 끝났든
 * 열 번 물어봤든 결과는 같은 모양이다.
 */
export async function settled(
  first: Response,
  again: (job: string) => string,
  opts: { everyMs?: number; timeoutMs?: number } = {},
): Promise<Response> {
  const every = opts.everyMs ?? 5_000;
  const until = Date.now() + (opts.timeoutMs ?? 6 * 60_000);

  let res = first;
  while (res.status === 202) {
    const { job } = (await res.json().catch(() => ({}))) as { job?: string };
    if (!job) return res;
    if (Date.now() > until) {
      // 응답 모양을 맞춰 돌려준다. 부르는 쪽이 예외 처리를 따로 안 하도록.
      return new Response(
        JSON.stringify({
          error: '시간이 오래 걸려 멈췄어요. 잠시 뒤 다시 시도해 주세요.',
        }),
        { status: 504, headers: { 'Content-Type': 'application/json' } },
      );
    }
    await new Promise((r) => setTimeout(r, every));
    res = await fetch(again(job));
  }
  return res;
}
