import { NextResponse } from 'next/server';

/**
 * 확인된 이야기로 가사 쓰기.
 *
 * 이 서비스의 규칙 하나가 여기서 지켜진다 — 가사에 들어갈 수 있는 것은
 * 어르신이 맞다고 확인했고 출처가 붙은 문장뿐이다(원칙 2). 부르는 쪽에서
 * lyricInputs() 로 걸러 보내고, 여기서는 그 목록 밖의 내용을 지어내지
 * 말라고 못박는다. 노래는 어르신의 삶이지 모델의 상상이 아니다.
 *
 * 특정 가수나 실존 곡을 흉내 내지 않는다(원칙 14 · NFR-AI-007).
 */

export const runtime = 'nodejs';

type Body = { topic?: string; facts?: string[]; style?: string };

const STYLE_HINT: Record<string, string> = {
  folkTrad: '민요처럼 정겹고 구수한 말맛',
  folkBright: '밝고 경쾌한 포크 느낌',
  ballad: '부드럽고 감성적인 발라드',
  trot: '애절하고 정감 있는 트로트',
};

const SYSTEM = `당신은 한국 어르신의 생애 이야기를 노래 가사로 옮기는 작사가입니다.

반드시 지킬 것:
- 아래에 주어진 '확인된 이야기'에 있는 내용만 씁니다. 어르신이 맞다고
  확인해 주신 것들입니다. 목록에 없는 사건·사람·장소·시기를 새로 만들지
  마십시오. 지어낸 한 줄이 어르신의 삶을 다른 사람의 것으로 만듭니다.
- 실존 가수나 기존 노래를 흉내 내지 마십시오.
- 어르신이 부르실 노래입니다. 쉬운 우리말로, 한 줄을 짧게 씁니다.
  어려운 한자어와 외래어는 피합니다.
- 구조: 1절 4줄, 후렴 4줄, 2절 4줄. 후렴은 이야기의 가장 중심되는 마음을
  담습니다.
- 이야기가 적으면 그만큼만 씁니다. 분량을 채우려고 없는 내용을 넣지 마십시오.

출력은 아래 JSON 형식만 내보냅니다. 다른 말은 붙이지 마십시오.
{"sections":[{"label":"1절","tone":"verse","lines":["...","...","...","..."]},
{"label":"후렴","tone":"chorus","lines":["...","...","...","..."]},
{"label":"2절","tone":"verse","lines":["...","...","...","..."]}]}`;

export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: '이 배포에는 가사 만들기가 설정되어 있지 않습니다.' },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: '요청을 읽지 못했습니다.' }, { status: 400 });
  }

  const facts = (body.facts ?? []).filter((f) => typeof f === 'string' && f.trim());
  if (!facts.length) {
    return NextResponse.json(
      {
        error:
          '확인된 이야기가 없어 가사를 만들 수 없어요. ' +
          '이야기 정리에서 어르신과 함께 확인해 주세요.',
      },
      { status: 400 },
    );
  }

  const user = [
    `노래 주제: ${body.topic ?? '(없음)'}`,
    `분위기: ${STYLE_HINT[body.style ?? 'ballad'] ?? STYLE_HINT.ballad}`,
    '',
    '확인된 이야기 (이 안에서만 쓸 것):',
    ...facts.map((f, i) => `${i + 1}. ${f}`),
  ].join('\n');

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 40_000);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        // 낮게. 가사는 문장력보다 "어르신 이야기에서 나왔는가"가 먼저다.
        temperature: 0.6,
        max_tokens: 700,
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
      console.error('openai lyrics failed', res.status);
      return NextResponse.json(
        {
          error:
            res.status === 401
              ? 'AI 키가 유효하지 않습니다. 관리자에게 알려주세요.'
              : '가사를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.',
        },
        { status: 502 },
      );
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({ error: '가사가 비어 있어요.' }, { status: 502 });
    }

    let sections: unknown;
    try {
      sections = (JSON.parse(raw) as { sections?: unknown }).sections;
    } catch {
      return NextResponse.json({ error: '가사 형식을 읽지 못했어요.' }, { status: 502 });
    }

    const clean = normalise(sections);
    if (!clean.length) {
      return NextResponse.json({ error: '가사 형식이 올바르지 않아요.' }, { status: 502 });
    }

    return NextResponse.json({ sections: clean });
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return NextResponse.json(
      {
        error: aborted
          ? '가사 만들기에 오래 걸려 멈췄어요. 다시 시도하실 수 있어요.'
          : '가사를 만들지 못했어요.',
      },
      { status: 504 },
    );
  }
}

/**
 * 모델이 준 것을 화면이 쓰는 모양으로 다듬는다.
 *
 * 형식을 그대로 믿지 않는다. JSON 모드를 켜도 줄이 문자열이 아니거나 절이
 * 통째로 빠지는 일이 있고, 그대로 화면에 넘기면 가사 자리에 빈칸이나
 * [object Object] 가 뜬다.
 */
function normalise(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input
    .map((sec) => {
      const s = sec as { label?: unknown; tone?: unknown; lines?: unknown };
      const lines = Array.isArray(s.lines)
        ? s.lines.filter((l): l is string => typeof l === 'string' && l.trim().length > 0)
            .map((l) => l.trim())
        : [];
      if (!lines.length) return null;
      return {
        label: typeof s.label === 'string' && s.label.trim() ? s.label.trim() : '가사',
        tone: s.tone === 'chorus' ? ('chorus' as const) : ('verse' as const),
        lines,
      };
    })
    .filter((x): x is { label: string; tone: 'verse' | 'chorus'; lines: string[] } => x !== null);
}
