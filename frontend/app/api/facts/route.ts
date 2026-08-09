import { NextResponse } from 'next/server';

/**
 * 전사에서 이야기 항목 뽑기.
 *
 * 여기가 이 서비스의 이음매다. 지금까지 녹음도 진짜였고 전사도 진짜였는데,
 * 그 사이가 비어 있어서 이야기 목록은 만들어 둔 예시였다. 그러면 "가사 한
 * 줄이 어르신 음성 몇 분 몇 초에서 나왔다"는 말이 화면 장식이 된다.
 *
 * 핵심 규칙 하나 — 모델은 반드시 근거가 된 전사 줄의 번호를 함께 내놓는다.
 * 그리고 그 번호가 실제로 존재하는지 여기서 대조한다. 없는 번호를 댄 항목은
 * 버린다. 프롬프트로 "지어내지 마라"라고 부탁하는 것과, 지어낸 것이 통과할
 * 수 없게 만드는 것은 다르다. 후자만 지켜진다.
 *
 * 뽑은 항목은 전부 '확인 필요'로 들어간다. 확정은 어르신과 복지사가 한다
 * (원칙 3 · 사람 검수). 모델이 확정한 사실은 이 제품에 존재하지 않는다.
 */

export const runtime = 'nodejs';

type Segment = { id: string; text: string; at: number };
type Body = { segments?: Segment[]; topic?: string };

const SYSTEM = `당신은 한국 어르신의 회상 인터뷰 전사를 정리하는 사람입니다.
전사에서 '어르신의 생애에 관한 사실'만 골라 짧은 문장으로 옮깁니다.

반드시 지킬 것:
- 전사에 있는 내용만 씁니다. 없는 사건·사람·장소·시기를 만들지 마십시오.
- 항목마다 근거가 된 줄 번호를 from 에 모두 적습니다. 근거를 댈 수 없으면
  그 항목은 아예 만들지 마십시오.
- 질문은 사실이 아닙니다. "어떤 신발이었나요" 같은 물음, 그리고 복지사의
  진행 발화("네", "그러셨구나", "다음은요")는 빼십시오.
- 어르신이 하신 말씀을 1인칭 평서문으로 다듬습니다.
  예: "그 공장을 열아홉에 들어갔지" → "열아홉에 공장에 들어갔어요"
- 한 항목에는 사실 하나만 담습니다. 두 가지가 붙어 있으면 나눕니다.
- 추측하지 마십시오. "아마 힘드셨을 것이다" 같은 해석은 사실이 아닙니다.
- 건강·질병·재산에 관한 내용은 담지 마십시오. 이 서비스는 그것을 다루지
  않습니다.
- 사실이 적으면 적은 대로 냅니다. 개수를 채우려고 늘리지 마십시오.

출력은 아래 JSON 형식만 내보냅니다. 다른 말은 붙이지 마십시오.
{"facts":[{"text":"열아홉에 공장에 들어갔어요","from":["3"]}]}`;

export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: '이 배포에는 이야기 정리가 설정되어 있지 않습니다.' },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: '요청을 읽지 못했습니다.' }, { status: 400 });
  }

  const segments = (body.segments ?? []).filter(
    (x) => x && typeof x.id === 'string' && typeof x.text === 'string',
  );
  if (!segments.length) {
    return NextResponse.json(
      { error: '전사가 없어 이야기를 뽑을 수 없어요. 먼저 녹음을 글로 옮겨 주세요.' },
      { status: 400 },
    );
  }

  // 모델에게는 줄 번호만 준다. 돌아온 번호를 그대로 되짚을 수 있어야 하므로
  // 번호는 배열 위치로 고정한다 — 문자열 id 를 주면 모델이 지어내기 쉽다.
  const numbered = segments
    .map((sg, i) => `${i}. ${sg.text.trim()}`)
    .join('\n');

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 60_000);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: [
              `오늘 회기 주제: ${body.topic || '(없음)'}`,
              '',
              '전사 (줄 번호. 내용):',
              numbered,
            ].join('\n'),
          },
        ],
      }),
      signal: ac.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.error('openai facts failed', res.status);
      return NextResponse.json(
        { error: '이야기를 뽑지 못했어요. 전사는 그대로 남아 있습니다.' },
        { status: 502 },
      );
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({ error: '이야기를 뽑지 못했어요.' }, { status: 502 });
    }

    let parsed: { facts?: { text?: string; from?: unknown }[] };
    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      return NextResponse.json({ error: '이야기를 읽지 못했어요.' }, { status: 502 });
    }

    /*
     * 여기가 이 파일에서 제일 중요한 열 줄이다.
     *
     * 모델이 댄 줄 번호를 실제 전사와 대조한다. 범위를 벗어났거나 숫자가
     * 아니면 그 근거는 버리고, 남은 근거가 하나도 없으면 항목 자체를 버린다.
     * 근거 없는 문장이 목록에 들어오는 순간 "출처가 반드시 붙는다"는 약속이
     * 깨지고, 그 뒤로는 어떤 화면도 그 약속을 되살릴 수 없다.
     */
    const facts = (parsed.facts ?? [])
      .map((f) => {
        const text = typeof f.text === 'string' ? f.text.trim() : '';
        const from = (Array.isArray(f.from) ? f.from : [])
          .map((v) => Number(v))
          .filter((n) => Number.isInteger(n) && n >= 0 && n < segments.length);
        return { text, from: [...new Set(from)].sort((a, b) => a - b) };
      })
      .filter((f) => f.text.length > 0 && f.from.length > 0)
      .map((f) => ({
        text: f.text,
        sources: f.from.map((i) => ({ at: segments[i].at, quote: segments[i].text })),
      }));

    const dropped = (parsed.facts ?? []).length - facts.length;
    return NextResponse.json({ facts, dropped });
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return NextResponse.json(
      {
        error: aborted
          ? '이야기 정리에 시간이 오래 걸려 멈췄어요. 전사는 남아 있습니다.'
          : '이야기를 뽑지 못했어요.',
      },
      { status: 504 },
    );
  }
}
