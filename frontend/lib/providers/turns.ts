import { toSegments, type Segment } from './types';

/**
 * 단어 목록을 '누가 언제 말했는가'로 바꾸는 규칙.
 *
 * 업체마다 단어를 주는 모양은 다르지만 이 규칙은 같아야 한다. 여기서 정해지는
 * 것이 화면의 한 줄이고, 그 줄의 시각이 그대로 이야기 항목의 출처가 된다 —
 * 업체를 바꿨다고 출처가 가리키는 자리가 달라지면 안 된다.
 *
 * 그래서 v1(stt-google)과 v2(stt-google-v2)가 이 파일을 함께 쓴다.
 */

/** 업체 응답을 우리가 다루기 좋은 모양으로 옮긴 단어 하나. */
export type W = {
  text: string;
  start: number;
  end: number;
  /** 화자 열쇠. 못 갈랐으면 null — 모르는 것은 모른다고 둔다. */
  key: string | null;
};

/**
 * 누가 복지사인가 — 이 함수가 하는 일은 **추정**이다.
 *
 * 업체가 주는 것은 "1번 목소리 · 2번 목소리"까지고, 그중 누가 누구인지는
 * 응답 어디에도 없다. 회기에서 말씀을 가장 적게 하는 쪽이 복지사일 가능성이
 * 높다는 것뿐이다 — 복지사는 묻고 어르신은 답하니까. 하지만 말수가 적은 날도
 * 있고, 복지사가 길게 설명한 날도 있다.
 *
 * ── 왜 '어르신 찾기'에서 '복지사 찾기'로 바꿨나
 *
 * 예전에는 가장 오래 말한 한 사람을 어르신으로 보고 나머지를 전부 복지사로
 * 돌렸다. 1:1 에서는 같은 말이지만, 어르신 세 분이 모인 그룹에서는 두 분이
 * 복지사로 뒤집힌다 — 그러면 그분들 말씀이 사실 추출에서 통째로 빠진다.
 * 복지사는 언제나 한 명이므로 그쪽을 찾는 편이 사람 수에 무관하게 맞다.
 *
 * 1:1 회기에서 답은 예전과 같다. 둘 중 적게 말한 쪽이 복지사면, 많이 말한
 * 쪽이 어르신이다.
 *
 * 그래서 이 추정은 화면에서 뒤집을 수 있어야 한다(전사 교정 화면).
 *
 * 화자가 하나뿐이면 null 을 낸다. 갈라지지 않은 것을 한쪽으로 몰아 붙이면
 * 복지사 질문이 어르신 말씀으로 둔갑한다.
 */
export function guessWorker(words: W[]): string | null {
  const spoken = new Map<string, number>();
  const said = new Map<string, number>();
  for (const w of words) {
    if (!w.key) continue;
    spoken.set(w.key, (spoken.get(w.key) ?? 0) + (w.end - w.start));
    said.set(w.key, (said.get(w.key) ?? 0) + 1);
  }
  if (spoken.size < 2) return null;

  // 발화 시간이 원칙이다. 끝 시각이 안 와서 전부 0 이면 단어 수로 잰다.
  const scale = [...spoken.values()].some((v) => v > 0) ? spoken : said;
  let best: string | null = null;
  let least = Number.POSITIVE_INFINITY;
  for (const [key, v] of scale) {
    if (v < least) {
      least = v;
      best = key;
    }
  }
  return best;
}

/**
 * 말차례(turn)로 나눠 줄을 만든다. 화자가 갈리지 않았으면 null.
 *
 * 말차례 하나를 그대로 한 줄로 두지 않고 안에서 문장으로 더 나눈다. 어르신이
 * 40초를 내리 말씀하시면 그것이 한 말차례인데, 통째로 한 줄이면 그 줄의 시각
 * 하나가 40초 전체를 가리킨다 — 고치려던 문제가 그대로 남는다. 문장으로
 * 나누는 규칙(쉬는 자리·길이)은 toSegments 에 있다.
 */
export function byTurn(words: W[]): Segment[] | null {
  const worker = guessWorker(words);
  if (!worker) return null;

  type Turn = { key: string; words: { text: string; start: number }[] };
  const turns: Turn[] = [];
  // 화자표가 빠진 단어는 앞사람 말에 잇는다. 맨 앞이 비어 있으면 처음으로
  // 화자표가 붙은 사람 것으로 본다 — 어느 쪽이든 말씀을 버리지는 않는다.
  let last = words.find((w) => w.key)?.key ?? '';
  let cur: Turn | null = null;
  for (const w of words) {
    const key = w.key ?? last;
    if (!cur || cur.key !== key) {
      cur = { key, words: [] };
      turns.push(cur);
    }
    cur.words.push({ text: w.text, start: w.start });
    last = key;
  }

  const out: Segment[] = [];
  for (const t of turns) {
    // 복지사로 짚은 한 목소리만 worker 다. 나머지는 전부 어르신 — 그룹이면
    // 여러 분이고, 서로 가르는 일은 voice 가 맡는다.
    const speaker = t.key === worker ? ('worker' as const) : ('elder' as const);
    for (const seg of toSegments(t.words)) {
      out.push({
        id: `seg-${out.length}`,
        text: seg.text,
        at: seg.at,
        speaker,
        voice: t.key,
      });
    }
  }
  return out.length ? out : null;
}
