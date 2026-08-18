import { NextResponse } from 'next/server';
import { avoidTerms, dropAvoided, mentionsAvoided } from '@/lib/avoidTopics';
import { chatBody, modelFor } from '@/lib/openaiModel';
import { pastedLines, verbatimKept } from '@/lib/verbatim';

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
 *
 * 살아남았는지는 **직접 견준다**(lib/verbatim). 처음에는 모델에게 "살린
 * 표현을 적어 내라"고 시켰는데, 가사에는 '목구녕'도 '지대로여'도 그대로
 * 들어갔는데 적어 낸 목록은 비어 있었다. 자기 보고를 세는 것은 세는 것이
 * 아니다. 겹치는 토막을 찾는 일은 계산이지 판단이 아니므로 우리가 한다.
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

── 이야기는 재료입니다. 가사가 아닙니다.

주어진 '확인된 이야기'는 무엇을 노래할지 정하는 재료입니다. 그 문장을 가사
줄로 그대로 옮기지 마십시오. 말씀하신 순서대로 늘어놓는 것도 가사가 아닙니다.
받아 적은 말은 노래가 되지 않습니다 — 어르신 앞에서 그건 노래가 아니라
녹취록입니다.

  이렇게 쓰면 안 됩니다 (들은 말을 그대로 옮긴 것):
    내가 키가 작으니까
    당황을 했어
    그런 학교가 지금 폐교돼 버리고 없어

  이렇게 씁니다 (같은 이야기를 노랫말로 쓴 것):
    여든 명 왁자지껄 북적이던 우리 반
    우리 다니던 교정은 사라졌어도
    아름답던 추억만은 머물러 있네

  위 예시는 문체를 보이려고 적은 것입니다. 여기 나오는 학교·교실·인원은
  재료가 아닙니다. 주어진 이야기에 있는 것만 쓰십시오.

── 쓰는 차례

1. 이야기에서 눈에 보이는 것을 고릅니다 — 자리, 물건, 계절, 소리, 빛깔,
   하시던 일, 곁에 있던 사람.
2. 그 낱말로 한 줄에 한 장면씩 그립니다. 설명하지 말고 보여 주십시오.
   '당황을 했어'가 아니라 그때 눈에 들어온 것을 적습니다.
3. 후렴은 이 노래를 한 문장으로 기억하게 하는 마음입니다.

── 반드시 지킬 것

- 주어진 '확인된 이야기'에 있는 내용만 씁니다. 어르신이 맞다고 확인해 주신
  것들입니다. 목록에 없는 사건·사람·장소·시기를 새로 만들지 마십시오.
  지어낸 한 줄이 어르신의 삶을 다른 사람의 것으로 만듭니다.
- 실존 가수나 기존 노래를 흉내 내지 마십시오.
- 병·진단·치료·재산에 관한 말은 쓰지 마십시오. 마음을 판단하는 말도
  쓰지 않습니다.
- 잃은 것은 남은 것으로 여밉니다. 사실을 지우라는 뜻이 아닙니다 — 없어진
  것을 적었으면 그 줄이나 다음 줄은 남아 있는 것으로 맺습니다. 어르신이
  부르실 노래입니다.
- 이야기가 적으면 그만큼만 씁니다. 분량을 채우려고 없는 내용을 넣지 마십시오.

── 어르신 말씨

'어르신 말씀 그대로'가 주어지면, 거기서 **낱말**을 골라 씁니다. 사투리,
옛 물건 이름, 그분이 부르시던 말 같은 것입니다. 문장을 통째로 옮기지
마십시오 — 그것이 위에서 말한 녹취록입니다.

- 노래 하나에 두세 낱말이면 충분합니다.
- 주어진 말씀 안에 있는 낱말만 씁니다. 사투리를 지어내지 마십시오.

── 부르기 좋게

이 가사는 기계가 노래합니다. 줄마다 길이가 들쭉날쭉하면 음을 억지로 늘이고
줄여서 사람 목소리처럼 들리지 않습니다.

- 구조: 1절 4줄, 후렴 4줄, 2절 4줄.
- 한 줄은 띄어쓰기를 뺀 한글 9~14자로 씁니다. 한 덩이 안에서는 줄 길이를
  서로 비슷하게 맞춥니다.
- 한 글자에 한 음입니다. 담을 말이 많으면 두 줄로 나눕니다.
- 줄 끝은 열린 소리로 맺습니다 (…았네 / …있네 / …가네 / …더라).
  받침이 겹쳐 발음이 막히는 말은 줄 끝에 두지 않습니다.
- 같은 서술을 잇달아 되풀이하지 마십시오. '…했어 / …했어'가 붙어 나오면
  두 줄 다 다시 씁니다. 후렴은 되풀이해도 됩니다.
- 쉬운 우리말로 씁니다. 어려운 한자어와 외래어는 피합니다.
- 숫자·연도·나이는 한글로 풀어 씁니다 (19 → 열아홉, 1965년 → 천구백육십오년).
  아라비아 숫자와 기호는 쓰지 않습니다.
- 한 줄에 쉼표는 많아야 하나입니다. 마침표·물음표·느낌표는 쓰지 않습니다.

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
        const parsed = JSON.parse(raw) as { sections?: unknown };
        const clean = normalise(parsed.sections);
        if (!clean.length) return null;
        return { clean };
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
    /*
     * 걸린 것이 있으면 한 번만 더 부탁한다.
     *
     * 두 가지를 함께 본다. 피하고 싶은 주제가 남았는가, 그리고 받아 적은 말을
     * 통째로 옮긴 줄이 있는가. 한 번에 짚어 주고 한 번만 다시 부른다 — 부를
     * 때마다 사십 초가 걸리고, 어르신은 그 앞에 앉아 계신다.
     *
     * 두 번째도 걸리면 줄을 지우지 않고 그대로 돌려준다. 4줄짜리 절에서 한
     * 줄이 사라지면 노래가 무너지고, 사람이 모르는 채 확정하게 된다. 가사는
     * 어차피 사람이 확정하는 초안이므로(원칙 3), 짚어 주는 편이 맞다.
     */
    const sources = [...quotes, ...facts];
    let hit = hits(out.clean, terms);
    let pasted = pastedLines(out.clean.flatMap((sec) => sec.lines), sources);

    if (hit.length || pasted.length) {
      const notes = [
        hit.length
          ? `방금 만든 가사에 "${hit.join(', ')}"가 들어갔습니다. ` +
            '이 대목은 어르신이 다시 듣고 싶지 않다고 하신 주제입니다. ' +
            '해당 줄을 다른 이야기로 바꿔 주세요.'
          : null,
        pasted.length
          ? `다음 줄은 들은 말을 그대로 옮긴 것입니다: ${pasted
              .map((l) => `"${l}"`)
              .join(', ')}. ` +
            '이 줄들은 노래가 아니라 녹취록입니다. 같은 이야기를 두고, 그때 ' +
            '눈에 보이던 것을 장면으로 다시 써 주세요.'
          : null,
      ].filter((v): v is string => v !== null);

      const retry = await ask(
        `${notes.join('\n\n')}\n\n가사 전체를 다시 내보내 주세요.`,
      );
      if (retry.ok) {
        const second = await read(retry);
        if (second) {
          const h2 = hits(second.clean, terms);
          const p2 = pastedLines(second.clean.flatMap((sec) => sec.lines), sources);
          // 두 번째가 더 낫거나 같으면 그것을 쓴다.
          if (h2.length + p2.length <= hit.length + pasted.length) {
            out = second;
            hit = h2;
            pasted = p2;
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
      /**
       * 들은 말을 그대로 옮긴 줄. 뜻은 맞아도 노래가 아니라 녹취록이다.
       * 지우지 않고 짚어만 준다 — 고칠지는 복지사가 정한다.
       */
      pasted,
      /**
       * 어르신 말씀이 그대로 남은 대목 — 우리가 직접 견주어 찾은 것만.
       * 다듬어진 사실 문장에도 있는 말은 말투가 아니므로 뺀다.
       */
      kept: verbatimKept(quotes, lines, facts),
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
