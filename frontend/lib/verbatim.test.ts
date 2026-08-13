import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { quotesFor, verbatimKept } from './verbatim.ts';

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
