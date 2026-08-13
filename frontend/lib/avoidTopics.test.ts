import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { avoidTerms, dropAvoided, mentionsAvoided } from './avoidTopics.ts';

test('가운뎃점으로 붙여 적은 주제는 낱말마다 걸린다', () => {
  const terms = avoidTerms(['전쟁·피난']);
  assert.deepEqual(terms.sort(), ['전쟁', '피난']);
});

test('뒤에 붙은 군더더기는 떼어 낸다', () => {
  assert.deepEqual(avoidTerms(['전쟁 이야기']), ['전쟁']);
  assert.deepEqual(avoidTerms(['둘째 아드님 이야기']), ['둘째 아드님']);
});

test('군더더기만 적힌 값은 낱말로 쓰지 않는다 — 모든 문장이 걸린다', () => {
  assert.deepEqual(avoidTerms(['이야기']), []);
});

test('한 글자는 쓰지 않는다', () => {
  assert.deepEqual(avoidTerms(['일', '것']), []);
});

test('겹치는 지난 이야기는 보내지 않는다', () => {
  const facts = [
    '남편과 사별한 뒤 혼자 지내셨다',
    '순천에서 자랐다',
    '김장에 굴을 넣었다',
  ];
  const out = dropAvoided(facts, ['사별']);
  assert.deepEqual(out.kept, ['순천에서 자랐다', '김장에 굴을 넣었다']);
  assert.equal(out.withheld, 1);
});

test('적어 둔 주제가 없으면 아무것도 덜어 내지 않는다', () => {
  const facts = ['순천에서 자랐다'];
  assert.deepEqual(dropAvoided(facts, []).kept, facts);
  assert.equal(dropAvoided(facts, []).withheld, 0);
});

test('돌아온 질문도 같은 낱말로 훑는다', () => {
  const terms = avoidTerms(['사별', '둘째 아드님 이야기']);
  assert.equal(mentionsAvoided('남편과 사별한 뒤 어떻게 지내셨어요?', terms), true);
  assert.equal(mentionsAvoided('둘째 아드님과의 추억이 있으세요?', terms), true);
  assert.equal(mentionsAvoided('순천 어디에 자주 가셨어요?', terms), false);
});
