import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { eulReul, eunNeun, gwaWa, iGa } from './korean.ts';

test('받침이 있으면 이·은·을·과', () => {
  assert.equal(iGa('사별'), '이');
  assert.equal(eunNeun('사별'), '은');
  assert.equal(eulReul('사별'), '을');
  assert.equal(gwaWa('사별'), '과');
});

test('받침이 없으면 가·는·를·와', () => {
  assert.equal(iGa('어머니'), '가');
  assert.equal(eunNeun('어머니'), '는');
  assert.equal(eulReul('어머니'), '를');
  assert.equal(gwaWa('어머니'), '와');
});

test('여러 개를 이어 붙였으면 마지막 말이 정한다', () => {
  assert.equal(iGa('전쟁, 사별'), '이');
  assert.equal(iGa('사별, 전쟁'), '이');
  assert.equal(iGa('사별, 어머니'), '가');
});

test('한글이 아니면 받침 없는 쪽으로 둔다', () => {
  assert.equal(iGa('T-001'), '가');
  assert.equal(iGa(''), '가');
});
