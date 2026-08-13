import { NextResponse } from 'next/server';
import { avoidTerms, dropAvoided, mentionsAvoided } from '@/lib/avoidTopics';
import { chatBody, modelFor } from '@/lib/openaiModel';
import { keptVerbatim } from '@/lib/verbatim';

/**
 * 확인된 이야기로 가사 쓰기.
 *
 * 이 서비스의 규칙 하나가 여기서 지켜진다 — 가사에 들어갈 수 있는 것은
 * 어르신이 맞다고 확인했고 출처가 붙은 문장뿐이다(원칙 2). 부르는 쪽에서
 * lyricInputs() 로 걸러 보내고, 여기서는 그 목록 밖의 내용을 지어내지
 * 말라고 못박는다. 노래는 어르신의 삶이지 모델의 상상이 아니다.
 *
 * 특정 가수나 실존 곡을 흉내 내지 않는다(원칙 14 · NFR-AI-007).
 *
 * ── 피하고 싶은 주제
 *
 * 어르신 기록에 적어 둔 주제와 겹치는 이야기는 재료에서 뺀다. 프롬프트에
 * "쓰지 마세요"라고 적어 보내는 것만으로는 지켜지지 않는다는 것을 개인화
 * 질문에서 확인했다(api/questions). 다 만든 가사도 한 번 더 훑어서, 그래도
 * 걸리면 다시 한 번 부탁하고 그래도 남으면 **복지사에게 짚어 준다.** 줄을
 * 몰래 지우지는 않는다 — 절이 무너진 가사를 사람이 모르고 확정하게 된다.
 *
 * ── 어르신 말투
 *
 * 사실 문장은 이미 다듬어진 말이다. "밥이 목구녕으로 안 넘어갔어"가 사실
 * 목록에서는 "식사를 하기 어려우셨다"가 된다. 그래서 그 사실의 근거가 된
 * 어르신 말씀 원문을 함께 보내고, 특징적인 표현은 그대로 살리라고 한다.
 * 살렸다고 적어 낸 표현은 말씀과 가사 양쪽에 실제로 있는지 대조한다
 * (lib/verbatim). 확인할 수 없는 자랑은 하지 않는다.
 */

export const runtime = 'nodejs';

type Body = {
  topic?: string;
  facts?: string[];
  style?: string;
  /** 어르신 기록의 피하고 싶은 주제. */
  avoid?: string[];
  /** 그 사실들의 근거가 된 어르신 말씀 원문. */
  quotes?: string[];
};

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

어르신 말투 살리기 — 이 노래는 그분의 노래입니다:
- '어르신 말씀 그대로'가 주어지면, 거기 나오는 사투리·옛말·그분 특유의
  표현을 **다듬지 말고 그대로** 가사에 넣으십시오. "밥이 목구녕으로 안
  넘어갔어"를 "밥을 먹기 힘들었죠"로 고치면 뜻은 맞아도 그분 것이 아닙니다.
- 다만 없는 말을 지어내지는 마십시오. 주어진 말씀 안에 있는 표현만 씁니다.
- 그렇게 그대로 살린 표현을 kept 에 적습니다. 말씀과 가사 양쪽에 똑같이
  들어 있는 말만 적으십시오. 적어 낸 것은 대조합니다.

부르기 좋게 쓰는 법 — 이 가사는 기계가 노래합니다. 줄마다 길이가 들쭉날쭉
하면 음을 억지로 늘이고 줄여서 사람 목소리처럼 들리지 않습니다:
- 한 줄은 띄어쓰기를 뺀 한글 7~10자로 씁니다. 한 덩이(1절·후렴·2절) 안에서는
  줄 길이를 서로 비슷하게 맞춥니다.
- 한 글자에 한 음입니다. 담을 말이 많으면 두 줄로 나눕니다.
- 줄 끝은 열린 소리로 맺습니다 (…어요 / …았죠 / …네요 / …더라).
  받침이 겹쳐 발음이 막히는 말은 줄 끝에 두지 않습니다.
- 후렴 첫 줄은 이 노래를 한 문장으로 기억할 수 있는 말로 씁니다.
  그 줄을 후렴 안에서 한 번 더 되풀이해도 좋습니다.
- 숫자·연도·나이는 한글로 풀어 씁니다 (19 → 열아홉, 1965년 → 천구백육십오년).
  아라비아 숫자와 기호는 쓰지 않습니다.
- 한 줄에 쉼표는 많아야 하나입니다. 마침표·물음표·느낌표는 쓰지 않습니다.

출력은 아래 JSON 형식만 내보냅니다. 다른 말은 붙이지 마십시오.
{"sections":[{"label":"1절","tone":"verse","lines":["...","...","...","..."]},
{"label":"후렴","tone":"chorus","lines":["...","...","...","..."]},
{"label":"2절","tone":"verse","lines":["...","...","...","..."]}],
"kept":["그대로 살린 표현","..."]}`;

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

  const all = (body.facts ?? []).filter(
    (f): f is string => typeof f === 'string' && f.trim().length > 0,
  );
  const avoid = (body.avoid ?? []).filter(
    (a): a is string => typeof a === 'string' && a.trim().length > 0,
  );
  const terms = avoidTerms(avoid);

  // 피하고 싶은 주제와 겹치는 이야기는 여기서 빠진다. 재료에 없으면 가사에
  // 들어갈 수도 없다.
  const { kept: facts, withheld } = dropAvoided(all, avoid);

  if (!facts.length) {
    return NextResponse.json(
      {
        error: withheld
          ? '남은 이야기가 모두 피하고 싶은 주제와 겹쳐 가사를 만들지 못했어요. ' +
            '다른 이야기를 더 확인하시거나, 어르신 프로필에서 주제를 다시 살펴 주세요.'
          : '확인된 이야기가 없어 가사를 만들 수 없어요. ' +
            '이야기 정리에서 어르신과 함께 확인해 주세요.',
      },
      { status: 400 },
    );
  }

  /*
   * 어르신 말씀 원문. 피하고 싶은 주제가 담긴 말씀은 여기서도 뺀다 —
   * 사실에서 뺐는데 원문으로 다시 들어가면 뒷문을 열어 두는 셈이다.
   */
  const quotes = (body.quotes ?? [])
    .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
    .map((q) => q.trim())
    .filter((q) => !mentionsAvoided(q, terms))
    .slice(0, 12);

  const user = [
    `노래 주제: ${body.topic ?? '(없음)'}`,
    `분위기: ${STYLE_HINT[body.style ?? 'ballad'] ?? STYLE_HINT.ballad}`,
    avoid.length ? `쓰지 말 주제: ${avoid.join(', ')}` : null,
    '',
    '확인된 이야기 (이 안에서만 쓸 것):',
    ...facts.map((f, i) => `${i + 1}. ${f}`),
    ...(quotes.length
      ? [
          '',
          '어르신 말씀 그대로 (말투를 살릴 것 — 여기 있는 표현만):',
          ...quotes.map((q) => `- ${q}`),
        ]
      : []),
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  /** 한 번 부탁하고, 결과를 뜯어서 돌려준다. */
  const ask = async (extra: string | null) => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 40_000);
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify(
          chatBody({
            model: modelFor('lyrics'),
            // 낮게. 가사는 문장력보다 "어르신 이야기에서 나왔는가"가 먼저다.
            temperature: 0.6,
            maxTokens: 700,
            json: true,
            messages: [
              { role: 'system', content: SYSTEM },
              { role: 'user', content: extra ? `${user}\n\n${extra}` : user },
            ],
          }),
        ),
        signal: ac.signal,
      });
      return res;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    const res = await ask(null);

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

    const read = async (r: Response) => {
      const json = (await r.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const raw = json.choices?.[0]?.message?.content;
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as { sections?: unknown; kept?: unknown };
        const clean = normalise(parsed.sections);
        if (!clean.length) return null;
        const claimed = Array.isArray(parsed.kept)
          ? parsed.kept.filter((x): x is string => typeof x === 'string')
          : [];
        return { clean, claimed };
      } catch {
        return null;
      }
    };

    let out = await read(res);
    if (!out) {
      return NextResponse.json({ error: '가사 형식을 읽지 못했어요.' }, { status: 502 });
    }

    /*
     * 피하고 싶은 주제가 그래도 가사에 들어갔으면 한 번 더 부탁한다.
     *
     * 재료에서 빼도 남은 이야기의 곁을 쓰다가 그쪽으로 흘러갈 수 있다. 다만
     * 두 번째도 걸리면 줄을 지우지 않고 그대로 돌려준다 — 4줄짜리 절에서 한
     * 줄이 사라지면 노래가 무너지고, 사람이 모르는 채 확정하게 된다. 가사는
     * 어차피 사람이 확정하는 초안이므로(원칙 3), 짚어 주는 편이 맞다.
     */
    let hit = hits(out.clean, terms);
    if (hit.length) {
      const retry = await ask(
        `방금 만든 가사에 "${hit.join(', ')}"가 들어갔습니다. ` +
          '이 대목은 어르신이 다시 듣고 싶지 않다고 하신 주제입니다. ' +
          '해당 줄을 다른 이야기로 바꿔 다시 써 주세요.',
      );
      if (retry.ok) {
        const second = await read(retry);
        if (second) {
          const stillHit = hits(second.clean, terms);
          // 두 번째가 더 낫거나 같으면 그것을 쓴다.
          if (stillHit.length <= hit.length) {
            out = second;
            hit = stillHit;
          }
        }
      }
    }

    const lines = out.clean.flatMap((sec) => sec.lines);

    return NextResponse.json({
      sections: out.clean,
      /** 피하고 싶은 주제와 겹쳐 아예 안 보낸 이야기 수. */
      withheld,
      /** 그래도 가사에 남은 낱말. 있으면 화면이 복지사에게 짚어 준다. */
      avoidHit: hit,
      /** 어르신 말씀 그대로 살린 표현 — 말씀과 가사 양쪽에서 확인된 것만. */
      kept: keptVerbatim(out.claimed, quotes, lines),
      /** 말투를 살릴 재료가 몇 줄 있었는지. 0이면 살릴 것이 없었다는 뜻이다. */
      quotesUsed: quotes.length,
    });
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

/** 가사 줄 가운데 피하고 싶은 낱말을 담은 것이 있는가 — 걸린 낱말을 돌려준다. */
function hits(
  sections: { lines: string[] }[],
  terms: string[],
): string[] {
  const text = sections.flatMap((s) => s.lines).join('\n');
  return terms.filter((t) => text.includes(t));
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
