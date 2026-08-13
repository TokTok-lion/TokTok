/**
 * 어르신이 실제로 쓰신 말을 가사에 살리는 길.
 *
 * ── 무엇이 문제였나
 *
 * 가사를 만들 때 "쉬운 우리말로 쓰라"고만 시켰다. 그래서 어르신이 "밥이
 * 목구녕으로 안 넘어갔어"라고 하신 것이 가사에서는 "밥을 먹기 힘들었죠"로
 * 다듬어져 나온다. 뜻은 맞는데 **그 어르신 것이 아니게 된다.**
 *
 * 이름과 고향을 넣는 것은 누구나 한다. 그분의 말투로 노래가 나오는 것은
 * 어느 말이 그분 입에서 나왔는지 알아야 가능하고, 우리는 안다 — 사실마다
 * 출처가 붙어 있고 그 출처는 전사의 시각을 가리킨다.
 *
 * ── 어떻게 하나
 *
 * 1. 가사에 쓸 사실마다 그 근거가 된 **어르신 말씀 원문**을 찾는다. 출처의
 *    시각과 전사 줄의 시각을 맞춘다(voiceOwners 와 같은 방식).
 * 2. 그 원문을 가사 만들기에 함께 보내며 "특징적인 표현은 그대로 살리라"고
 *    한다. 그리고 살린 표현을 스스로 적어 내게 한다.
 * 3. **적어 낸 것을 그대로 믿지 않는다.** 그 표현이 실제로 어르신 말씀 안에
 *    있고, 동시에 가사 안에도 있어야 인정한다. 둘 중 하나라도 아니면 버린다.
 *
 * 3번이 이 파일의 핵심이다. "어르신 말투를 살렸습니다"는 확인할 수 없으면
 * 하지 말아야 할 말이다 — 근거 번호를 대조하는 것과 같은 이유다.
 */

export type SourceLike = { kind: string; at?: number };
export type ItemLike = { text: string; sources: SourceLike[] };
/** 전사 한 줄. 화자를 모르는 줄이 있어서 speaker 는 없을 수 있다. */
export type LineLike = { speaker?: string; at: number; text: string; example?: true };

/** 출처 시각과 전사 줄이 이만큼 벌어져 있어도 같은 대목으로 본다(초). */
const NEAR = 2.5;

/**
 * 이 사실들의 근거가 된 어르신 말씀 원문.
 *
 * 지난 회기 사실은 이번 회기 전사에 없다. 못 찾으면 그냥 빠진다 — 없는 말을
 * 만들어 채우면 그 순간 이 기능의 뜻이 사라진다.
 */
export function quotesFor(
  items: ItemLike[],
  transcript: LineLike[],
  limit = 12,
): string[] {
  const elder = transcript.filter((l) => l.speaker === 'elder' && !l.example);
  if (!elder.length) return [];

  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    for (const src of item.sources) {
      if (typeof src.at !== 'number') continue;
      for (const line of elder) {
        if (Math.abs(line.at - src.at) > NEAR) continue;
        const t = line.text.trim();
        // 너무 짧은 줄("네", "그럼")에는 말투가 담기지 않는다.
        if (t.length < 6 || seen.has(t)) continue;
        seen.add(t);
        out.push(t);
      }
    }
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}

/** 견줄 때는 띄어쓰기와 문장부호를 지운다. 줄바꿈으로 갈린 말도 같은 말이다. */
function bare(s: string): string {
  return s.replace(/[\s.,!?…·'"''""~-]/g, '');
}

/**
 * 모델이 "살렸다"고 적어 낸 표현 가운데 진짜만 남긴다.
 *
 * 어르신 말씀 안에 있고, 가사 안에도 있어야 한다. 한쪽만 맞으면 버린다 —
 * 어르신이 안 하신 말을 말투랍시고 넣었거나, 넣었다고만 하고 안 넣은 것이다.
 *
 * 못 알아보고 버리는 쪽으로 기운다. 어긋난 말을 "어르신 말씀 그대로"라고
 * 적는 것보다 적게 세는 편이 낫다.
 */
export function keptVerbatim(
  claimed: string[],
  quotes: string[],
  lyricLines: string[],
): string[] {
  const q = quotes.map(bare).join('|');
  const l = lyricLines.map(bare).join('|');
  const out: string[] = [];
  for (const raw of claimed) {
    const c = typeof raw === 'string' ? raw.trim() : '';
    // 두 글자로는 우연히 겹친다. 말투라고 부를 만한 길이만 센다.
    if (c.length < 3) continue;
    const b = bare(c);
    if (!b || b.length < 3) continue;
    if (!q.includes(b) || !l.includes(b)) continue;
    if (!out.includes(c)) out.push(c);
  }
  return out;
}
