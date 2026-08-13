import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { provenanceOf } from './provenance.ts';
import type { StoryItem } from './domain.ts';

const item = (over: Partial<StoryItem>): StoryItem => ({
  id: 'x',
  text: '순천에서 자라셨다',
  status: 'verified',
  sources: [{ kind: 'voice', at: 30, label: '어르신 음성 0:30' }],
  ...over,
});

test('노래에 쓸 수 있는 문장만 센다', () => {
  const p = provenanceOf([
    item({ id: 'a' }),
    item({ id: 'b', status: 'unverified' }),
    item({ id: 'c', status: 'excluded' }),
  ]);
  assert.equal(p.used, 1);
  assert.equal(p.unverified, 1);
  assert.equal(p.excluded, 1);
});

test('출처가 없는 문장은 확인됐어도 재료가 아니다', () => {
  const p = provenanceOf([item({ sources: [] })]);
  assert.equal(p.used, 0);
  assert.equal(p.sources, 0);
});

test('둘러보기 씨앗 항목은 세지 않는다', () => {
  const p = provenanceOf([item({ example: true }), item({ id: 'b' })]);
  assert.equal(p.used, 1);
});

test('출처 개수와 종류를 센다', () => {
  const p = provenanceOf([
    item({
      id: 'a',
      sources: [
        { kind: 'voice', at: 10, label: '어르신 음성 0:10' },
        { kind: 'voice', at: 200, label: '어르신 음성 3:20' },
      ],
    }),
    item({ id: 'b', sources: [{ kind: 'staffNote', label: '복지사 기록' }] }),
  ]);
  assert.equal(p.sources, 3);
  assert.equal(p.byKind.voice, 2);
  assert.equal(p.byKind.staffNote, 1);
});

test('근거가 된 음성의 첫 자리와 마지막 자리', () => {
  const p = provenanceOf([
    item({
      id: 'a',
      sources: [
        { kind: 'voice', at: 200, label: '' },
        { kind: 'voice', at: 12, label: '' },
      ],
    }),
  ]);
  assert.equal(p.voiceFrom, 12);
  assert.equal(p.voiceTo, 200);
});

test('음성 출처가 없으면 시각을 지어내지 않는다', () => {
  const p = provenanceOf([item({ sources: [{ kind: 'card', label: '기억 카드' }] })]);
  assert.equal(p.voiceFrom, null);
  assert.equal(p.voiceTo, null);
});

test('버린 문장 수는 그대로 싣되 음수는 0으로', () => {
  assert.equal(provenanceOf([], 3).dropped, 3);
  assert.equal(provenanceOf([], -1).dropped, 0);
});
