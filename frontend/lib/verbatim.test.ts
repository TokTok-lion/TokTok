import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { pastedLines, quotesFor, verbatimKept } from './verbatim.ts';

const transcript = [
  { speaker: 'worker', at: 10, text: '식사는 어떠셨어요?' },
  { speaker: 'elder', at: 12, text: '밥이 목구녕으로 안 넘어갔어' },
  { speaker: 'elder', at: 40, text: '순천서 나고 자랐지' },
  { speaker: 'elder', at: 55, text: '응' },
];

test('출처 시각으로 어르신 말씀 원문을 찾는다', () => {
  const items = [{ text: '식사를 하기 힘드셨다', sources: [{ kind: 'voice', at: 12 }] }];
  assert.deepEqual(quotesFor(items, transcript), ['밥이 목구녕으로 안 넘어갔어']);
});

test('너무 짧은 대답과 가까운 줄이 없는 출처는 담지 않는다', () => {
  const items = [
    { text: 'x', sources: [{ kind: 'voice', at: 55 }] }, // '응'
    { text: 'y', sources: [{ kind: 'voice', at: 200 }] }, // 그 자리에 아무 말씀도 없다
  ];
  assert.deepEqual(quotesFor(items, transcript), []);
});

test('복지사가 여쭌 시각에 붙은 출처도 바로 뒤 어르신 말씀을 집는다', () => {
  // 출처 시각은 질문 쪽에 찍히기도 한다. 두 줄은 한 대목이다.
  const items = [{ text: 'x', sources: [{ kind: 'voice', at: 10 }] }];
  assert.deepEqual(quotesFor(items, transcript), ['밥이 목구녕으로 안 넘어갔어']);
});

test('시각이 없는 출처(수기·카드)는 원문을 찾지 않는다', () => {
  const items = [{ text: 'x', sources: [{ kind: 'staffNote' }] }];
  assert.deepEqual(quotesFor(items, transcript), []);
});

test('어르신 말씨가 가사에 남으면 찾아낸다', () => {
  const quotes = ['밥이 목구녕으로 안 넘어갔어'];
  const lines = ['목구녕으로 안 넘어가던 날', '그래도 살아냈지요'];
  const facts = ['식사를 하기 어려우셨다'];
  // 어르신은 '넘어갔어', 가사는 '넘어가던' — 겹치는 데까지만 집는다.
  assert.deepEqual(verbatimKept(quotes, lines, facts), ['목구녕으로 안 넘어']);
});

test('다듬어진 가사에는 아무것도 남지 않는다', () => {
  const quotes = ['밥이 목구녕으로 안 넘어갔어'];
  const lines = ['밥을 먹기 힘들었죠'];
  assert.deepEqual(verbatimKept(quotes, lines, ['식사를 하기 어려우셨다']), []);
});

test('사실 문장에도 있는 말은 말투로 세지 않는다', () => {
  const quotes = ['김장에는 꼭 굴을 넣어야 지대로여'];
  const lines = ['김장에 굴을 넣고'];
  const facts = ['김장에 굴을 넣으셨다'];
  assert.deepEqual(verbatimKept(quotes, lines, facts), []);
});

test('짧게 겹치는 것은 우연이므로 세지 않는다', () => {
  assert.deepEqual(verbatimKept(['그때가 좋았지'], ['그때 하늘'], []), []);
});

test('한 대목이 길고 짧게 두 번 잡히면 긴 것만 남긴다', () => {
  const quotes = ['순천서 나고 자랐지 거기가 내 고향이여'];
  const lines = ['순천서 나고 자랐지', '순천서 나고'];
  const out = verbatimKept(quotes, lines, ['순천에서 나고 자라셨다']);
  assert.deepEqual(out, ['순천서 나고 자랐지']);
});

test('두 줄에 걸친 한 말씀은 하나로 센다', () => {
  const quotes = ['밥이 목구녕으로 안 넘어갔어'];
  const lines = ['밥이 목구녕으로 안', '넘어갔어 그 시절'];
  assert.deepEqual(verbatimKept(quotes, lines, ['식사를 하기 어려우셨다']), [
    '밥이 목구녕으로 안 넘어갔어',
  ]);
});

test('확인 안 된 대목의 말씀은 말씨 재료에서 뺀다', () => {
  /*
   * 강점 갈래 회기에서 실제로 샜던 자리다. 어르신이 "내가 아직 쓸모가
   * 있구나 싶어서 좋았어"라고 하셨는데 사실 추출이 그 문장을 뺐고(자기 평가),
   * 그 말이 말씨 재료를 타고 후렴 첫 줄로 들어갔다.
   */
  const lines = [
    { speaker: 'elder', at: 12, text: '지금도 단추 다는 건 눈 감고도 해' },
    { speaker: 'elder', at: 40, text: '내가 아직 쓸모가 있구나 싶어서 좋았어' },
  ];
  const used = [{ text: '지금도 단추를 답니다', sources: [{ kind: 'voice', at: 12 }] }];
  const notVerified = [{ text: '쓸모가 있다고 느끼신다', sources: [{ kind: 'voice', at: 40 }] }];

  assert.deepEqual(quotesFor(used, lines), ['지금도 단추 다는 건 눈 감고도 해']);
  // 확인된 항목만 넣어도 40초 줄은 애초에 안 잡히지만, 확인 안 된 항목이
  // 같은 대목을 가리키면 그 줄은 확실히 빠져야 한다.
  const both = [...used, { text: 'x', sources: [{ kind: 'voice', at: 40 }] }];
  assert.deepEqual(quotesFor(both, lines, notVerified), [
    '지금도 단추 다는 건 눈 감고도 해',
  ]);
});

test('받아 적은 말이 그대로 가사 줄이 되면 찾아낸다', () => {
  const quotes = ['그런 학교가 지금 폐교돼 버리고 없어요', '내가 키가 작으니까 당황을 했어'];
  const lines = [
    '그런 학교가 지금',
    '폐교돼 버리고 없어',
    '우리 다니던 교정은 사라졌어도',
    '아름답던 추억만은 머물러 있네',
  ];
  // 한 말씀이 두 줄로 잘려 들어가도 두 줄 다 베껴 온 줄이다.
  const found = pastedLines(lines, quotes);
  assert.deepEqual(found, ['그런 학교가 지금', '폐교돼 버리고 없어']);
});

test('낱말 하나가 겹치는 것은 베낀 것이 아니다', () => {
  const quotes = ['밥이 목구녕으로 안 넘어갔어 그때는 참 힘들었지'];
  const lines = ['목구녕으로 넘어가지 않던 그 시절'];
  assert.deepEqual(pastedLines(lines, quotes), []);
});

test('다듬어진 사실 문장을 그대로 옮긴 줄도 찾아낸다', () => {
  const facts = ['열아홉에 방직공장에 들어갔어요'];
  const lines = ['열아홉에 방직공장에 들어갔어요', '실 냄새 가득하던 그 마당'];
  assert.deepEqual(pastedLines(lines, facts), ['열아홉에 방직공장에 들어갔어요']);
});

test('견줄 원문이 없으면 아무것도 찾지 않는다', () => {
  assert.deepEqual(pastedLines(['어느 줄이든 상관없다'], []), []);
});
