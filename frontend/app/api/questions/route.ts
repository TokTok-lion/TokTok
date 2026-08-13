import { NextResponse } from 'next/server';

/**
 * 지난 이야기에서 오늘 여쭐 질문을 짓는다.
 *
 * ── 왜 필요한가
 *
 * 지금까지 인터뷰 질문은 전부 고정이었다(lib/prompts). 어느 어르신이든 같은
 * 질문이라, 어제 김 어르신께 여쭌 것을 오늘 박 어르신께 똑같이 여쭙는다.
 * 회기가 쌓여도 앱은 그분에 대해 아무것도 기억하지 못하는 것처럼 보인다.
 *
 * 그런데 재료는 이미 쌓이고 있다 — 회기마다 확인된 사실이 출처와 함께
 * 남는다(story_facts). 어제 "순천에서 자랐고 굴을 넣어 김장했다"가 확인됐다면
 * 오늘은 "그 굴은 어디서 구하셨어요?"를 여쭐 수 있다. 그 질문은 다른 어르신께는
 * 나올 수 없고, 회기가 쌓일수록 달라진다.
 *
 * ── 지켜야 하는 것
 *
 * 질문은 **확인된 사실만** 근거로 삼는다. 미확인 사실로 "형제가 일곱이셨죠?"
 * 하고 물으면 앱이 어르신 입에 말을 넣는 것이 된다. 그래서 부르는 쪽에서
 * 확인된 것만 골라 보내고(lyricInputs 와 같은 기준), 여기서는 그 목록 밖의
 * 내용을 지어내지 말라고 못 박는다.
 *
 * 그리고 모델이 어느 사실에서 나온 질문인지 번호로 답하게 한다. 그 번호가
 * 실제 목록을 가리키지 않으면 버린다 — 사실 추출(api/facts)에서 줄 번호를
 * 대조하는 것과 같은 이유다. 부탁하는 것과 통과할 수 없게 만드는 것은 다르다.
 */

export const runtime = 'nodejs';

type Body = {
  /** 확인된 지난 이야기. 부르는 쪽이 verified 만 골라 보낸다. */
  facts?: string[];
  /** 오늘 고른 기억 카드 이름 — 그쪽으로 기울여 묻게 한다. 없어도 된다. */
  card?: string;
  /** 피하고 싶은 주제. 있으면 그 근처를 묻지 않는다. */
  avoid?: string[];
};

const SYSTEM = [
  '당신은 요양기관에서 어르신과 회상 대화를 돕는 사람입니다.',
  '주어진 "지난 이야기" 목록만 근거로, 오늘 이어서 여쭐 질문을 만듭니다.',
  '',
  '규칙:',
  '- 목록에 없는 내용을 지어내지 않습니다. 새 사실을 질문 안에 넣지 마세요.',
  '- 질문 하나는 지난 이야기 하나에서 나옵니다. 그 번호를 from 에 적습니다.',
  '- 이미 아는 것을 다시 묻지 않습니다. 그 이야기의 **곁**을 묻습니다.',
  '  예) "순천에서 자랐다" → "그 동네에 자주 가시던 곳이 있었어요?"',
  '- 어르신께 드리는 말이므로 존댓말로, 한 문장으로 씁니다.',
  '- 예/아니오로 끝나는 질문은 피합니다. 이야기가 이어지게 여쭙니다.',
  '- 건강·질병·죽음을 묻지 않습니다. 판단하거나 평가하지 않습니다.',
  '',
  'JSON 으로만 답합니다:',
  '{"questions":[{"text":"...","from":0}]}',
].join('\n');

export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'AI 키가 설정되지 않았습니다.' }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: '요청을 읽지 못했습니다.' }, { status: 400 });
  }

  const facts = (body.facts ?? [])
    .filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
    .map((f) => f.trim())
    .slice(0, 40);

  /*
   * 지난 이야기가 없으면 지어낼 근거도 없다. 오류가 아니라 '아직 없음'이다 —
   * 첫 회기가 여기로 오고, 그때는 고정 질문이 그대로 쓰인다.
   */
  if (facts.length < 2) {
    return NextResponse.json({ questions: [] });
  }

  const user = [
    body.card ? `오늘 기억 카드: ${body.card}` : '',
    body.avoid?.length ? `피하실 주제(묻지 마세요): ${body.avoid.join(', ')}` : '',
    '',
    '지난 이야기:',
    ...facts.map((f, i) => `${i}. ${f}`),
    '',
    '위 이야기의 곁을 묻는 질문을 3~5개 만들어 주세요.',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 30_000);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        // 낮게 둔다. 질문은 참신함보다 "지난 이야기에서 나왔는가"가 먼저다.
        temperature: 0.5,
        max_tokens: 500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: user },
        ],
      }),
      signal: ac.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.error('openai questions failed', res.status);
      // 질문을 못 지어도 회기는 굴러가야 한다. 고정 질문이 그대로 쓰인다.
      return NextResponse.json({ questions: [] });
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as {
      questions?: { text?: unknown; from?: unknown }[];
    };

    const questions = (parsed.questions ?? [])
      .map((q) => {
        const text = typeof q.text === 'string' ? q.text.trim() : '';
        const n =
          typeof q.from === 'number'
            ? q.from
            : typeof q.from === 'string' && /^\d+$/.test(q.from.trim())
              ? Number(q.from.trim())
              : NaN;
        return { text, from: n };
      })
      /*
       * 근거가 실제 목록을 가리켜야 남긴다.
       *
       * 모델이 번호를 지어내면 화면은 "지난 이야기에서 나왔어요"라고 적으면서
       * 없는 이야기를 가리키게 된다. 출처가 거짓말을 하는 순간 이 제품에서
       * 믿을 수 있는 것이 하나도 남지 않는다(api/facts 와 같은 이유).
       */
      .filter((q) => q.text.length > 0 && Number.isInteger(q.from))
      .filter((q) => q.from >= 0 && q.from < facts.length)
      .slice(0, 5)
      .map((q) => ({ text: q.text, basis: facts[q.from] }));

    return NextResponse.json({ questions });
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    if (!aborted) console.error('questions route failed', e);
    // 여기서도 회기를 막지 않는다. 고정 질문으로 진행된다.
    return NextResponse.json({ questions: [] });
  }
}
