import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { keptVerbatim, quotesFor } from './verbatim.ts';

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

test('말씀에도 있고 가사에도 있어야 살린 것으로 센다', () => {
  const quotes = ['밥이 목구녕으로 안 넘어갔어'];
  const lines = ['목구녕으로 안 넘어가던 날', '그래도 살아냈지요'];
  assert.deepEqual(keptVerbatim(['목구녕'], quotes, lines), ['목구녕']);
});

test('가사에 없으면 살렸다고 적어 내도 버린다', () => {
  const quotes = ['밥이 목구녕으로 안 넘어갔어'];
  const lines = ['밥을 먹기 힘들었죠'];
  assert.deepEqual(keptVerbatim(['목구녕'], quotes, lines), []);
});

test('어르신이 안 하신 말은 말투가 아니다', () => {
  const quotes = ['순천서 나고 자랐지'];
  const lines = ['부산서 나고 자랐지'];
  assert.deepEqual(keptVerbatim(['부산서'], quotes, lines), []);
});

test('띄어쓰기가 달라도 같은 말로 본다', () => {
  const quotes = ['밥이 목구녕으로 안 넘어갔어'];
  const lines = ['목구녕으로  안넘어가던 날'];
  assert.deepEqual(keptVerbatim(['목구녕으로 안 넘어'], quotes, lines), [
    '목구녕으로 안 넘어',
  ]);
});

test('두 글자짜리는 우연히 겹치므로 세지 않는다', () => {
  assert.deepEqual(keptVerbatim(['그때'], ['그때가 좋았지'], ['그때가 좋았네']), []);
});
