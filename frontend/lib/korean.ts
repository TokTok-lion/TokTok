/**
 * 조사를 말에 맞게 붙인다.
 *
 * ── 왜 필요한가
 *
 * 화면 문구에 값을 끼워 넣는 자리에서 조사를 글자로 박아 두면 반드시 어긋난다.
 * 「사별」**가** 적혀 있어요 — 실제로 배우자 카드 경고에서 이렇게 나왔다.
 * 받침이 있으면 '이', 없으면 '가'다.
 *
 * 어르신과 복지사가 읽는 글이다. 조사가 틀린 문장은 급하게 만든 티가 나고,
 * 그 티는 화면에 적힌 다른 말의 신뢰도까지 깎는다.
 *
 * ── 모르는 글자는 건드리지 않는다
 *
 * 한글이 아니면(숫자·영문·기호로 끝나면) 앞쪽 조사를 쓴다. 영어 낱말마다
 * 발음을 따지기 시작하면 규칙이 끝없이 늘어나는데, 이 앱의 값은 거의 다
 * 한글이라 그 복잡함이 값을 못 한다.
 */

/** 마지막 글자에 받침이 있는가. 한글이 아니면 null(모름). */
function hasBatchim(word: string): boolean | null {
  const last = word.trim().at(-1);
  if (!last) return null;
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;
  return (code - 0xac00) % 28 !== 0;
}

function pick(word: string, withBatchim: string, without: string): string {
  const b = hasBatchim(word);
  // 모르면 받침 없는 쪽으로 둔다. '사별가' 보다 '테스트가' 가 덜 어색하다.
  return b === true ? withBatchim : without;
}

/** 「사별」이 / 「어머니」가 */
export const iGa = (word: string) => pick(word, '이', '가');

/** 「사별」은 / 「어머니」는 */
export const eunNeun = (word: string) => pick(word, '은', '는');

/** 「사별」을 / 「어머니」를 */
export const eulReul = (word: string) => pick(word, '을', '를');

/** 「사별」과 / 「어머니」와 */
export const gwaWa = (word: string) => pick(word, '과', '와');
