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
 *
 * ── 확인 안 된 말씀은 빼야 한다
 *
 * 강점 갈래로 회기를 돌려 보다 찾았다. 어르신이 "내가 아직 쓸모가 있구나
 * 싶어서 좋았어"라고 하셨고, 사실 추출은 그 문장을 **일부러 뺐다**(자기
 * 평가라서). 그런데 그 말이 말씨 재료를 타고 후렴 첫 줄로 들어갔다.
 *
 * 「확인된 것만 가사로」(원칙 2)에 이 기능이 뒷문을 낸 셈이다. 어르신이
 * 하신 말씀인 것은 맞지만, 복지사가 확인하지 않은 말이고 빼 달라고 하신
 * 말일 수도 있다.
 *
 * 그래서 확인되지 않은 항목(미확인·제외)이 가리키는 대목의 말씀은 재료에서
 * 뺀다. 한 줄에 두 마디가 섞여 있으면 통째로 뺀다 — 반만 빼는 방법이 없고,
 * 덜 쓰는 쪽이 잘못 쓰는 쪽보다 낫다.
 */
export function quotesFor(
  items: ItemLike[],
  transcript: LineLike[],
  /** 확인되지 않은 항목들 — 이들이 가리키는 대목은 말씨 재료에서 뺀다. */
  unverified: ItemLike[] = [],
  limit = 12,
): string[] {
  const elder = transcript.filter((l) => l.speaker === 'elder' && !l.example);
  if (!elder.length) return [];

  /*
   * 빼야 할 대목의 시각. 미확인·제외 항목의 출처가 가리키는 자리다.
   */
  const blocked = unverified
    .flatMap((i) => i.sources.map((src) => src.at))
    .filter((at): at is number => typeof at === 'number');
  const isBlocked = (line: LineLike) =>
    blocked.some((at) => Math.abs(line.at - at) <= NEAR);

  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    for (const src of item.sources) {
      if (typeof src.at !== 'number') continue;
      for (const line of elder) {
        if (Math.abs(line.at - src.at) > NEAR) continue;
        if (isBlocked(line)) continue;
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

const NOISE = /[\s.,!?…·'"''""~-]/;

/** 견줄 때는 띄어쓰기와 문장부호를 지운다. 어디서 왔는지는 자리로 기억해 둔다. */
function strip(s: string): { bare: string; at: number[] } {
  const chars: string[] = [];
  const at: number[] = [];
  for (let i = 0; i < s.length; i += 1) {
    if (NOISE.test(s[i])) continue;
    chars.push(s[i]);
    at.push(i);
  }
  return { bare: chars.join(''), at };
}

/** 두 글 사이에서 가장 길게 겹치는 토막. a 안의 시작 자리와 길이. */
function longestCommon(a: string, b: string): { start: number; len: number } {
  let best = { start: 0, len: 0 };
  let prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] !== b[j - 1]) continue;
      cur[j] = prev[j - 1] + 1;
      if (cur[j] > best.len) best = { start: i - cur[j], len: cur[j] };
    }
    prev = cur;
  }
  return best;
}

/** 이만큼은 겹쳐야 말투라고 부른다. 서너 글자는 우연히도 겹친다. */
const MIN = 4;

/**
 * 어르신 말씀이 가사에 그대로 남은 대목을 찾는다.
 *
 * ── 왜 모델에게 묻지 않는가
 *
 * 처음에는 "그대로 살린 표현을 kept 에 적으라"고 시키고 그 목록을 대조했다.
 * 실제로 돌려 보니 가사에는 "목구녕"도 "지대로여"도 그대로 들어갔는데 kept
 * 는 빈 배열이었다. 시킨 일을 안 해도 결과는 좋을 수 있고, 그 반대도 된다 —
 * 어느 쪽이든 모델의 자기 보고를 세는 것은 세는 것이 아니다.
 *
 * 그래서 직접 견준다. 겹치는 토막을 찾는 일은 계산이지 판단이 아니다.
 *
 * ── 사실 문장에도 있는 말은 세지 않는다
 *
 * '김장에 굴을 넣으셨다'는 이미 다듬어진 문장이고 가사도 그 말을 쓴다. 그건
 * 말투가 아니라 그냥 내용이다. 어르신 입에서 나온 원문에는 있고 다듬어진
 * 문장에는 없는 토막만이 "그분 말씨가 살아남았다"는 증거가 된다.
 */
export function verbatimKept(
  quotes: string[],
  lyricLines: string[],
  facts: string[],
): string[] {
  const flat = facts.map((f) => strip(f).bare).join('|');
  const found: string[] = [];

  /*
   * 줄을 이어 붙인 것도 함께 견준다.
   *
   * 한 말씀이 두 줄에 걸치는 일이 흔하다 — "밥이 목구녕으로 안 / 넘어갔어".
   * 줄 단위로만 보면 이걸 두 대목으로 세어, 살린 표현이 둘인 것처럼 보인다.
   * 이어 붙인 쪽에서 통째로 잡히면 짧은 조각들은 아래 정리에서 빠진다.
   */
  const targets = [...lyricLines, lyricLines.join('')];

  for (const quote of quotes) {
    const q = strip(quote);
    for (const line of targets) {
      const l = strip(line).bare;
      const hit = longestCommon(q.bare, l);
      if (hit.len < MIN) continue;
      const piece = q.bare.slice(hit.start, hit.start + hit.len);
      // 다듬어진 사실 문장에도 있는 말은 말투가 아니다.
      if (flat.includes(piece)) continue;
      // 띄어쓰기까지 살려 보여 준다 — 붙여 쓴 글자는 읽기 어렵다.
      found.push(quote.slice(q.at[hit.start], q.at[hit.start + hit.len - 1] + 1));
    }
  }

  /*
   * 겹치는 것끼리 정리한다. '목구녕으로 안'과 '목구녕으로'가 나란히 뜨면
   * 두 개를 살린 것처럼 보이지만 실은 한 대목이다. 긴 것만 남긴다.
   */
  const out: string[] = [];
  for (const piece of found.sort((a, b) => b.length - a.length)) {
    const b = strip(piece).bare;
    if (out.some((k) => strip(k).bare.includes(b))) continue;
    out.push(piece);
  }
  return out.slice(0, 5);
}

/* ------------------------------------------------------------------ *
 * 베껴 온 줄 찾기
 *
 * 받아 적은 말이 그대로 가사가 되는 일이 실제로 있었다. 화면에는
 * "내가 키가 작으니까 / 당황을 했어 / 그때 작았어 그래서 / 당황을 했어"가
 * 떴다. 뜻은 어르신 것이 맞지만 그건 노래가 아니라 녹취록이고, 어르신
 * 앞에서 부를 수 없는 글이다.
 *
 * 프롬프트에 "옮기지 마십시오"라고 적는 것만으로는 안 지켜진다는 것을
 * 피하고 싶은 주제에서 이미 봤다. 그래서 여기서 직접 견준다 — 한 줄이
 * 어느 원문이나 사실 문장과 통째로 겹치면 베껴 온 줄이다.
 *
 * 찾은 줄을 몰래 지우지는 않는다. 절이 무너진 가사를 사람이 모르고
 * 확정하게 된다. 한 번 다시 부탁하고, 그래도 남으면 복지사에게 짚어 준다.
 * ------------------------------------------------------------------ */

/** 이 비율만큼 겹치면 통째로 옮긴 것으로 본다. */
const PASTE_RATIO = 0.7;
/** 짧은 줄은 우연히도 통째로 겹친다. 이보다 짧으면 견주지 않는다. */
const PASTE_MIN = 7;

export function pastedLines(lyricLines: string[], sources: string[]): string[] {
  const bare = sources.map((v) => strip(v).bare).filter((v) => v.length >= PASTE_MIN);
  if (!bare.length) return [];

  const out: string[] = [];
  for (const line of lyricLines) {
    const l = strip(line).bare;
    if (l.length < PASTE_MIN) continue;
    const need = Math.max(PASTE_MIN, Math.ceil(l.length * PASTE_RATIO));
    if (bare.some((src) => longestCommon(l, src).len >= need)) out.push(line);
  }
  return out;
}
