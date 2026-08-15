import { NextResponse } from 'next/server';
import { avoidTerms, mentionsAvoided } from '@/lib/avoidTopics';
import { requireUser } from '@/lib/apiAuth';

/**
 * 확인된 이야기 한 문장을 그림 한 장으로.
 *
 * ── 왜 만드나
 *
 * 장수복지관 관장님 말씀이다 — "노래만 만들지 말고 사연이 담긴 그림이나
 * 숏츠 제작까지 되면 좋겠다". 기획팀장님은 "동화책처럼 이미지화해서 책으로
 * 제작해도 좋겠다"고 하셨다.
 *
 * ── 규칙이 먼저다
 *
 * 그림도 **출처가 있어야 한다**(원칙 2). 어르신이 말씀하지 않은 장면을 그리면
 * 그건 우리가 지어낸 삶이다. 노래는 가사가 사실에서만 나오게 막아 뒀는데
 * 그림에서 그 문이 열리면 막아 둔 뜻이 없다.
 *
 * 그래서 이 라우트는 **사실 문장 하나 = 그림 한 장**만 만든다. 문장을 합치지
 * 않고, 문장에 없는 물건이나 사람을 넣지 않는다. 화면은 그림 옆에 그 문장을
 * 반드시 함께 보여 준다(components/SceneMaker).
 *
 * ── 얼굴은 그리지 않는다
 *
 * 사람 얼굴을 그리면 어르신을 닮은 얼굴이 만들어진다. 닮았으면 그분이 아닌
 * 사람이 그분인 척하는 것이고, 안 닮았으면 "이건 내가 아니다"가 된다. 어느
 * 쪽도 좋지 않다. 뒷모습·손·장면·물건으로 그린다.
 *
 * 글자도 넣지 않는다. 모델이 한글을 그리면 거의 깨진 글자가 나오고, 그
 * 깨진 글자가 어르신 이야기를 적은 것처럼 보인다.
 */

export const runtime = 'nodejs';
/** 그림 넉 장이면 1분을 넘길 수 있다. */
export const maxDuration = 120;

type Body = {
  /** 확인된 사실 문장들. 부르는 쪽이 lyricInputs 로 걸러 보낸다. */
  facts?: { id?: string; text?: string }[];
  /** 어르신 기록의 피하고 싶은 주제. */
  avoid?: string[];
};

/** 한 번에 넉 장까지. 그 이상은 비용도 기다림도 회기를 넘어선다. */
const MAX = 4;

const STYLE = [
  'A warm, gentle watercolor illustration for a Korean life-story picture book.',
  'Soft muted palette, cream paper texture, hand-painted feel, calm and dignified.',
  'Everyday Korean life of the 1950s-1980s, drawn with respect for older adults.',
].join(' ');

const RULES = [
  // 얼굴을 안 그리는 이유는 파일 머리말 참고.
  'Do not show any recognizable human face. If people appear, show them from',
  'behind, at a distance, or only their hands. No portraits, no close-up faces.',
  'No text, letters, numbers, captions, or signage anywhere in the image.',
  'Do not add objects, people, animals, or events that are not in the sentence.',
  'No modern items (smartphones, cars after the 1990s), no logos or brands.',
  'Nothing sad or frightening. No hospital, no funeral, no graves.',
].join(' ');

export async function POST(req: Request) {
  // 그림 한 장마다 요금이 나간다. 누가 부르는지부터 본다.
  const who = await requireUser(req);
  if (!who.ok) return NextResponse.json({ error: who.error }, { status: 401 });

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: '이 배포에는 그림 만들기가 설정되어 있지 않습니다.' },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: '요청을 읽지 못했습니다.' }, { status: 400 });
  }

  const avoid = (body.avoid ?? []).filter(
    (a): a is string => typeof a === 'string' && a.trim().length > 0,
  );
  const terms = avoidTerms(avoid);

  /*
   * 피하고 싶은 주제와 겹치는 문장은 그리지 않는다.
   *
   * 가사에서 막아 둔 것을 그림에서 열면 막은 뜻이 없다. 그림은 글보다 더
   * 오래 남고, 인쇄해서 가족에게 건네지기까지 한다.
   */
  const facts = (body.facts ?? [])
    .map((f) => ({ id: String(f?.id ?? ''), text: String(f?.text ?? '').trim() }))
    .filter((f) => f.text.length > 0)
    .filter((f) => !mentionsAvoided(f.text, terms))
    .slice(0, MAX);

  if (!facts.length) {
    return NextResponse.json(
      { error: '그림으로 옮길 이야기가 없어요. 이야기 정리에서 먼저 확인해 주세요.' },
      { status: 400 },
    );
  }

  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
  const size = process.env.OPENAI_IMAGE_SIZE || '1024x1024';

  /*
   * 한 장씩 따로 부른다.
   *
   * 한 번에 여러 장을 받을 수도 있지만 그러면 어느 그림이 어느 문장에서
   * 나왔는지가 흐려진다. 출처가 흐려지는 순간 이 그림은 근거 없는 그림이 된다.
   * 한 장이 실패해도 나머지는 살린다 — 넷 중 하나 때문에 회기가 멈추면 안 된다.
   */
  const drawn = await Promise.all(
    facts.map(async (fact) => {
      const prompt = [
        STYLE,
        '',
        'Draw exactly this one moment, nothing more:',
        fact.text,
        '',
        RULES,
      ].join('\n');

      try {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), 90_000);
        const res = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model, prompt, size, n: 1 }),
          signal: ac.signal,
        });
        clearTimeout(timer);

        if (!res.ok) {
          console.error('image failed', res.status, (await res.text().catch(() => '')).slice(0, 200));
          return { ...fact, ok: false as const };
        }
        const json = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
        const b64 = json.data?.[0]?.b64_json;
        if (b64) return { ...fact, ok: true as const, image: `data:image/png;base64,${b64}` };

        // 어떤 모델은 주소로 준다. 그 자리에서 받아 와 같은 모양으로 맞춘다 —
        // 주소는 곧 만료되므로 화면까지 들고 가면 빈 그림이 된다.
        const url = json.data?.[0]?.url;
        if (!url) return { ...fact, ok: false as const };
        const bin = await fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null));
        if (!bin) return { ...fact, ok: false as const };
        return {
          ...fact,
          ok: true as const,
          image: `data:image/png;base64,${Buffer.from(bin).toString('base64')}`,
        };
      } catch (e) {
        const aborted = e instanceof Error && e.name === 'AbortError';
        if (!aborted) console.error('image error', e);
        return { ...fact, ok: false as const };
      }
    }),
  );

  const scenes = drawn.filter((d) => d.ok);
  if (!scenes.length) {
    return NextResponse.json(
      { error: '그림을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.' },
      { status: 502 },
    );
  }

  // 몇 장을 못 그렸는지도 함께 돌려준다. 화면이 조용히 적게 그리면 복지사는
  // 그만큼만 나온 줄 안다.
  return NextResponse.json({ scenes, failed: drawn.length - scenes.length });
}
