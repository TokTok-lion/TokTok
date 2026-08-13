import { NextResponse } from 'next/server';
import { chatBody, modelFor } from '@/lib/openaiModel';

/**
 * 활동일지 초안 생성 (F-SW-LOG-001).
 *
 * 서버에서만 돈다. OPENAI_API_KEY 는 절대 브라우저로 나가면 안 되므로
 * NEXT_PUBLIC_ 접두사를 쓰지 않고, 이 라우트 안에서만 읽는다.
 *
 * 보내는 것을 최소로 줄였다 — 확인된 이야기 문장과 관찰된 행동, 회기 주제뿐이다.
 * 어르신 이름·생년·기관명·녹음 원본은 보내지 않는다. 외부로 나가는 순간
 * 되돌릴 수 없으므로, 필요한 것만 나가야 한다(최소수집).
 *
 * 이 초안은 초안일 뿐이다. 복지사가 저장을 눌러야 기록이 된다(원칙 3).
 */

export const runtime = 'nodejs';

type Body = {
  topic?: string;
  /** 확인된 이야기 문장만. 미확인·제외 항목은 보내지 않는다. */
  facts?: string[];
  /** 눈으로 본 행동 (웃으심·박수 등). 정서·인지 추정값은 없다. */
  reactions?: string[];
  note?: string;
};

const SYSTEM = `당신은 한국 주야간보호센터의 사회복지사를 돕는 기록 보조입니다.
아래에 주어지는 '확인된 이야기'와 '관찰된 행동'을 활동일지 문단으로 옮깁니다.

가장 중요한 규칙 — 주어진 내용만 씁니다:
- '확인된 이야기'에 적힌 사건·장소·사람·시기를 그대로 살려서 씁니다.
  그것이 이 기록의 알맹이입니다. 두루뭉술하게 뭉개지 마십시오.
- 목록에 없는 것은 단 한 가지도 만들어 내지 마십시오. 특히 다른 어르신,
  집단 활동, 프로그램 참여, 대화 상대처럼 주어지지 않은 상황을 지어내는 것은
  심각한 오류입니다. 활동일지는 공식 기록이고, 없던 일이 적히면 안 됩니다.
- 내용이 적으면 짧게 쓰십시오. 분량을 채우려고 살을 붙이지 마십시오.

표현 규칙:
- 진단·평가·예후를 쓰지 않습니다. "인지 기능 향상", "우울감 감소",
  "정서적으로 안정됨" 같은 임상적·평가적 표현은 금지입니다.
  의학적 판단은 이 서비스의 역할이 아닙니다.
- 어르신을 존중하는 존댓말로 씁니다. "어르신은 …하셨습니다" 형태.
- 2~4문장, 250자 이내. 기관 양식에 붙여 쓸 문단 하나입니다.
- 제목·머리말·목록 없이 문단 본문만 출력합니다.`;

export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: '이 배포에는 AI 초안 기능이 설정되어 있지 않습니다.' },
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
      { error: '확인된 이야기가 없어 초안을 만들 수 없습니다.' },
      { status: 400 },
    );
  }

  const user = [
    `회기 주제: ${body.topic ?? '(없음)'}`,
    '',
    '확인된 이야기 (이 내용을 반드시 반영하고, 여기 없는 일은 쓰지 말 것):',
    ...facts.map((f, i) => `${i + 1}. ${f}`),
    '',
    `관찰된 행동: ${(body.reactions ?? []).join(', ') || '(기록 없음)'}`,
    body.note ? `복지사 메모: ${body.note}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    // 25초를 넘기면 끊는다. 어르신 앞에서 무한정 기다릴 수는 없고,
    // 실패하면 복지사가 직접 쓰면 된다.
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 25_000);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(
        chatBody({
          model: modelFor('log'),
          // 낮게 잡는다. 활동일지에 필요한 것은 문장력이 아니라 정확함이고,
          // 온도가 높으면 주어지지 않은 내용을 채워 넣는다.
          temperature: 0.2,
          maxTokens: 400,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: user },
          ],
        }),
      ),
      signal: ac.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      // 원문에는 키 일부나 조직 정보가 섞일 수 있어 그대로 흘리지 않는다.
      console.error('openai draft failed', res.status);
      return NextResponse.json(
        {
          error:
            res.status === 401
              ? 'AI 키가 유효하지 않습니다. 관리자에게 알려주세요.'
              : '초안을 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
        },
        { status: 502 },
      );
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const draft = json.choices?.[0]?.message?.content?.trim();
    if (!draft) {
      return NextResponse.json(
        { error: '초안이 비어 있습니다. 다시 시도해 주세요.' },
        { status: 502 },
      );
    }

    return NextResponse.json({ draft });
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return NextResponse.json(
      {
        error: aborted
          ? '시간이 오래 걸려 중단했어요. 직접 작성하셔도 됩니다.'
          : '초안을 만들지 못했습니다.',
      },
      { status: 504 },
    );
  }
}
