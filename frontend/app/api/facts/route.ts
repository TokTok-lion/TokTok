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

type Speaker = 'elder' | 'worker';
type Segment = { id: string; text: string; at: number; speaker?: Speaker };
type Body = { segments?: Segment[]; topic?: string };

/** 줄 앞에 붙는 이름표. 모르면 '모름' — 없는 것을 있다고 하지 않는다. */
const TAG: Record<Speaker, string> = { elder: '어르신', worker: '복지사' };
const tagOf = (sp: Speaker | undefined) => (sp ? TAG[sp] : '모름');

const RULES = `당신은 한국 어르신의 회상 인터뷰 전사를 정리하는 사람입니다.
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
- 사실이 적으면 적은 대로 냅니다. 개수를 채우려고 늘리지 마십시오.`;

/**
 * 화자가 갈린 전사에만 붙이는 규칙.
 *
 * 복지사 줄을 아예 빼고 보내지 않는 이유가 있다. "그때 몇 살이셨어요?"를
 * 지우면 바로 뒤의 "열아홉"이 무슨 열아홉인지 알 수 없는 말이 된다. 물음이
 * 있어야 답이 읽힌다. 그래서 문맥으로는 보여 주되, 거기서 사실을 뽑지는
 * 말라고 못 박는다.
 *
 * 줄 번호는 복지사 줄까지 세어 그대로 간다. 번호를 다시 매기면 돌아온 번호를
 * 원래 줄로 되짚을 수 없고, 그 대조가 이 파일의 핵심이다.
 */
const SPEAKER_RULE = `
줄마다 앞에 [어르신] · [복지사] · [모름] 이름표가 붙어 있습니다.
- [복지사] 로 표시된 줄에서는 사실을 뽑지 마십시오. 그 줄은 어르신 말씀을
  읽기 위한 문맥일 뿐입니다. from 에도 적지 마십시오.
- [어르신] 과 [모름] 줄에서만 사실을 찾습니다.
- 이름표는 목소리로 나눈 추정이라 틀릴 수 있습니다. 그래도 이름표를 따르되,
  [복지사] 줄의 내용을 어르신의 사실로 옮기지는 마십시오.`;

const FORMAT = `
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

  // speaker 는 요청 본문에서 온다. 아무 문자열이나 그대로 믿으면 이름표에
  // 엉뚱한 글자가 찍히고, 아래 '복지사 줄은 뺀다' 판정도 헛돈다.
  const segments = (body.segments ?? [])
    .filter((x) => x && typeof x.id === 'string' && typeof x.text === 'string')
    .map((x) => ({
      ...x,
      speaker: x.speaker === 'elder' || x.speaker === 'worker' ? x.speaker : undefined,
    }));
  if (!segments.length) {
    return NextResponse.json(
      { error: '전사가 없어 이야기를 뽑을 수 없어요. 먼저 녹음을 글로 옮겨 주세요.' },
      { status: 400 },
    );
  }

  /*
   * 화자가 갈린 회기인가.
   *
   * 'worker' 한 줄만 있어도 갈린 것으로 본다. 갈리지 않았으면 이름표를 아예
   * 안 붙인다 — 전부 [모름] 인 줄을 보여 주는 것은 잡음일 뿐이다.
   */
  const split = segments.some((sg) => sg.speaker === 'elder' || sg.speaker === 'worker');
  const usable = segments.filter((sg) => sg.speaker !== 'worker');

  /*
   * 전부 복지사 줄이면 뽑을 것이 없다. 화자 추정이 통째로 뒤집힌 회기다.
   *
   * 여기서 "사실을 못 찾았어요"라고만 답하면 복지사는 전사를 몇 번 다시
   * 읽다 포기한다. 어디로 가면 되는지 같은 문장에서 알린다.
   */
  if (split && !usable.length) {
    return NextResponse.json(
      {
        error:
          '전사가 전부 복지사 말씀으로 되어 있어 뽑을 것이 없어요. ' +
          '전사 교정에서 「어르신 ↔ 복지사 통째로 바꾸기」를 누른 뒤 다시 시도해 주세요.',
      },
      { status: 400 },
    );
  }

  // 모델에게는 줄 번호만 준다. 돌아온 번호를 그대로 되짚을 수 있어야 하므로
  // 번호는 배열 위치로 고정한다 — 문자열 id 를 주면 모델이 지어내기 쉽다.
  // 복지사 줄도 번호를 차지한 채로 함께 보낸다. 빼면 뒤 번호가 다 밀려서
  // 아래 대조가 엉뚱한 줄을 가리킨다.
  const numbered = segments
    .map((sg, i) =>
      split ? `${i}. [${tagOf(sg.speaker)}] ${sg.text.trim()}` : `${i}. ${sg.text.trim()}`,
    )
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
          { role: 'system', content: RULES + (split ? SPEAKER_RULE : '') + FORMAT },
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
          /*
           * Number() 로 바로 바꾸면 안 된다.
           *
           * 이 한 줄이 이 파일 전체의 근거 검증을 무력화하고 있었다.
           * JS 에서 Number('') · Number(null) · Number(' ') · Number([]) ·
           * Number(false) 는 전부 0 이고, 0 은 정수이며 범위 안이다. 그래서
           * 모델이 근거를 못 대고 빈 값을 내놓으면 그 문장이 버려지는 대신
           * **0번 줄의 출처를 달고** 통과했다. 어르신이 하시지도 않은 말이
           * '어르신 음성 0:00'이라는 이름표를 달고 가사까지 갈 수 있었다.
           *
           * 근거를 못 대면 버린다 — 그것이 이 파일이 존재하는 이유다.
           * 그러니 숫자로 보이는 것만 숫자로 친다.
           */
          .map((v) => {
            if (typeof v === 'number') return v;
            if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number(v.trim());
            return NaN;
          })
          .filter((n) => Number.isInteger(n) && n >= 0 && n < segments.length)
          /*
           * 복지사 줄은 근거가 될 수 없다.
           *
           * 프롬프트로 부탁하는 것과 통과할 수 없게 만드는 것은 다르다 —
           * 이 파일이 줄 번호를 대조하는 이유와 똑같다. 여기서 안 막으면
           * 복지사 질문에 붙은 시각이 '어르신 음성 0:42'라는 이름표를 달고
           * 화면에 나간다. 눌러 보면 복지사 목소리가 나온다. 출처가 거짓말을
           * 하는 순간 이 제품에서 믿을 수 있는 것이 하나도 남지 않는다.
           *
           * [모름] 줄은 막지 않는다. 화자를 못 가른 것이지 복지사 말씀이라고
           * 밝혀진 것이 아니다.
           */
          .filter((n) => segments[n].speaker !== 'worker');
        return { text, from: [...new Set(from)].sort((a, b) => a - b) };
      })
      .filter((f) => f.text.length > 0 && f.from.length > 0)
      .map((f) => ({
        text: f.text,
        /*
         * 화자를 함께 내보낸다.
         *
         * [모름] 줄(화자를 못 가른 줄)도 근거로 허용하는데, 여기서 speaker 를
         * 버리면 받는 쪽이 모든 출처를 '어르신 음성'으로 이름 붙인다. 어느
         * 목소리인지 모르는 대목에 어르신 이름표를 다는 것은 출처가 아니라
         * 주장이다. worker 는 위에서 이미 걸러졌으므로 여기 오는 값은
         * 'elder' 아니면 undefined(모름)뿐이다.
         */
        sources: f.from.map((i) => ({
          at: segments[i].at,
          quote: segments[i].text,
          speaker: segments[i].speaker,
        })),
      }));

    const dropped = (parsed.facts ?? []).length - facts.length;

    /*
     * 전부 버려졌으면 왜 그랬는지 남긴다.
     *
     * 화면은 "말씀 N개를 뽑았는데 버렸어요"까지 말할 수 있지만, **왜** 근거가
     * 안 맞았는지는 여기서만 보인다 — 모델이 복지사 줄을 근거로 댔는지,
     * 있지도 않은 줄 번호를 지어냈는지.
     *
     * 짧은 인터뷰에서 자주 나는 일이다. 어르신 줄이 몇 개 없으면 모델이 근거로
     * 댈 것이 없어서 복지사 질문 줄을 가리키기 쉽고, 그 줄은 출처가 될 수 없어
     * (원칙 1) 통째로 버려진다.
     */
    if (dropped > 0 && facts.length === 0) {
      const cited = (parsed.facts ?? []).flatMap((f) =>
        Array.isArray((f as { from?: unknown }).from) ? (f as { from: unknown[] }).from : [],
      );
      const bad = cited.filter((v) => {
        const n = typeof v === 'number' ? v : Number(v);
        return !Number.isInteger(n) || n < 0 || n >= segments.length;
      }).length;
      const workerCited = cited.filter((v) => {
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isInteger(n) && n >= 0 && n < segments.length && segments[n].speaker === 'worker';
      }).length;
      console.warn(
        `[똑똑] 사실 ${dropped}개를 전부 버렸습니다 — 전사 ${segments.length}줄 ` +
          `(어르신 ${usable.length}줄), 근거로 댄 줄 ${cited.length}개 중 ` +
          `없는 번호 ${bad}개 · 복지사 줄 ${workerCited}개`,
      );
    }

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
