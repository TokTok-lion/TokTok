/**
 * 피하고 싶은 주제를 실제로 걸러 낸다.
 *
 * ── 왜 부탁만으로는 안 되나
 *
 * 처음에는 프롬프트에 "피하실 주제(묻지 마세요): 사별"이라고 적어 보내는 것이
 * 전부였다. 실제로 넣고 돌려 보니 모델은 "남편과 사별한 뒤 혼자 지내시면서
 * 어떤 일들을 하셨나요?"를 그대로 만들어 냈다. 부탁은 지켜질 때도 있고 아닐
 * 때도 있는데, 이 자리는 아닐 때의 값이 너무 크다 — 어르신이 다시 듣고 싶지
 * 않다고 하신 대목을 앱이 먼저 꺼내는 것이다.
 *
 * 그래서 재료에서 뺀다. 그 주제를 담은 지난 이야기는 아예 보내지 않는다.
 * 보내지 않은 이야기는 근거로 댈 수 없고(api/questions 가 근거 번호를
 * 대조한다), 근거가 없으면 질문이 남지 않는다. 돌아온 질문도 한 번 더 훑는다.
 *
 * 사실 추출에서 줄 번호를 대조하는 것과 같은 생각이다 — 부탁하는 것과
 * 통과할 수 없게 만드는 것은 다르다.
 *
 * ── 낱말을 어떻게 자르나
 *
 * 복지사가 적는 말은 '전쟁·피난'처럼 여러 개가 붙어 있기도 하고, '둘째 아드님
 * 이야기'처럼 뒤에 군더더기가 붙기도 한다. 가운뎃점으로 나누고, 뒤에 붙은
 * 일반 낱말은 떼어 낸다. '이야기'를 그대로 두면 거의 모든 문장에 걸려서
 * 지난 이야기가 통째로 사라진다 — 너무 많이 거르는 것도 고장이다.
 *
 * 한 글자 낱말은 쓰지 않는다. '일'이나 '것' 하나로 걸면 걸리지 않는 문장이
 * 없다.
 */

/** 뒤에 붙는 군더더기. 이대로 두면 걸림이 너무 넓어진다. */
const TRAILING = ['이야기', '얘기', '내용', '부분', '관련', '주제', '쪽'];

/** 적어 둔 주제를 실제로 견줄 낱말로 바꾼다. */
export function avoidTerms(avoid: string[]): string[] {
  const out = new Set<string>();
  for (const raw of avoid) {
    if (typeof raw !== 'string') continue;
    for (const seg of raw.split(/[·,、/|]/)) {
      let t = seg.trim();
      for (const g of TRAILING) {
        // 낱말이 통째로 군더더기이면 두지 않는다 — '이야기' 하나만 적어 둔
        // 경우는 거를 대상이 아니라 잘못 적힌 값이다.
        if (t.length > g.length && t.endsWith(g)) t = t.slice(0, -g.length).trim();
      }
      // 군더더기 낱말 하나만 남았으면 버린다. '이야기'로 걸면 걸리지 않는
      // 문장이 없어서 지난 이야기가 통째로 사라진다.
      if (t.length >= 2 && !TRAILING.includes(t)) out.add(t);
    }
  }
  return [...out];
}

/** 이 문장이 피하고 싶은 낱말을 담고 있는가. */
export function mentionsAvoided(text: string, terms: string[]): boolean {
  return terms.some((t) => text.includes(t));
}

/**
 * 지난 이야기에서 피할 것을 덜어 낸다.
 *
 * 몇 개를 뺐는지 함께 돌려준다. 화면이 "겹치는 이야기는 빼고 만들었어요"라고
 * 말할 수 있어야, 질문이 적게 나온 것이 고장이 아니라는 걸 복지사가 안다.
 */
export function dropAvoided(
  facts: string[],
  avoid: string[],
): { kept: string[]; withheld: number } {
  const terms = avoidTerms(avoid);
  if (terms.length === 0) return { kept: facts, withheld: 0 };
  const kept = facts.filter((f) => !mentionsAvoided(f, terms));
  return { kept, withheld: facts.length - kept.length };
}
