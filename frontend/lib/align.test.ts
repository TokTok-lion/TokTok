import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { alignLines } from './align.ts';

const LINES = ['순천서 나고 자랐지', '거기가 내 고향이여', '김장에는 굴을 넣어'];

test('깨끗하게 들린 노래는 줄마다 제 시각에 걸린다', () => {
  const words = [
    { text: '순천서', at: 10 },
    { text: '나고', at: 11 },
    { text: '자랐지', at: 12 },
    { text: '거기가', at: 14 },
    { text: '내', at: 15 },
    { text: '고향이여', at: 16 },
    { text: '김장에는', at: 20 },
    { text: '굴을', at: 22 },
    { text: '넣어', at: 23 },
  ];
  const out = alignLines(words, LINES, 30);
  assert.equal(out.anchored, 3);
  assert.equal(Math.round(out.starts[0]), 10);
  assert.equal(Math.round(out.starts[1]), 14);
  assert.equal(Math.round(out.starts[2]), 20);
});

test('전주가 길어도 첫 줄은 노래가 시작된 자리에 붙는다', () => {
  // 어림(글자 수 비례)이라면 첫 줄이 0초다. 실제로는 22초에 시작한다.
  const words = [
    { text: '순천서', at: 22 },
    { text: '나고', at: 23 },
    { text: '자랐지', at: 24 },
    { text: '거기가', at: 27 },
    { text: '내', at: 28 },
    { text: '고향이여', at: 29 },
    { text: '김장에는', at: 33 },
    { text: '굴을', at: 34 },
    { text: '넣어', at: 35 },
  ];
  const out = alignLines(words, LINES, 60);
  assert.ok(out.starts[0] > 20, `첫 줄이 ${out.starts[0]}초로 잡혔다`);
});

test('군데군데 잘못 들어도 걸린 줄로 나머지를 채운다', () => {
  // 가운데 줄을 통째로 못 알아들은 경우.
  const words = [
    { text: '순천서', at: 10 },
    { text: '나고', at: 11 },
    { text: '자랐지', at: 12 },
    { text: '으으음', at: 15 },
    { text: '김장에는', at: 20 },
    { text: '굴을', at: 22 },
  ];
  const out = alignLines(words, LINES, 30);
  assert.equal(out.anchored, 2);
  // 못 걸린 가운데 줄은 앞뒤 사이에 놓인다.
  assert.ok(out.starts[1] > out.starts[0] && out.starts[1] < out.starts[2]);
});

test('시각은 뒤로만 간다', () => {
  const words = [
    { text: '김장에는', at: 30 },
    { text: '순천서', at: 5 },
    { text: '나고', at: 6 },
    { text: '자랐지', at: 7 },
    { text: '거기가', at: 9 },
  ];
  const out = alignLines(words, LINES, 40);
  for (let i = 1; i < out.starts.length; i += 1) {
    assert.ok(out.starts[i] >= out.starts[i - 1], `${i}번째 줄이 앞으로 튀었다`);
  }
});

test('후렴이 되풀이돼도 순서대로 붙는다', () => {
  const lines = ['고향이 그리워', '고향이 그리워', '김장에는 굴을 넣어'];
  const words = [
    { text: '고향이', at: 10 },
    { text: '그리워', at: 11 },
    { text: '고향이', at: 14 },
    { text: '그리워', at: 15 },
    { text: '김장에는', at: 18 },
  ];
  const out = alignLines(words, lines, 25);
  assert.ok(out.starts[1] > out.starts[0], '두 번째 후렴이 첫 번째 앞에 붙었다');
});

test('하나도 못 알아들으면 걸린 줄이 없다고 말한다', () => {
  const out = alignLines([{ text: '라라라', at: 3 }], LINES, 30);
  assert.equal(out.anchored, 0);
});

test('받아쓴 것이 없으면 시각을 지어내지 않는다', () => {
  const out = alignLines([], LINES, 30);
  assert.equal(out.anchored, 0);
  assert.deepEqual(out.starts, [0, 0, 0]);
});

test('가사가 없으면 빈 결과', () => {
  const out = alignLines([{ text: '아', at: 1 }], [], 10);
  assert.deepEqual(out.starts, []);
  assert.equal(out.anchored, 0);
});
