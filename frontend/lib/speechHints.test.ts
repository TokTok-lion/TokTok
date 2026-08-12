import test from 'node:test';
import assert from 'node:assert/strict';
import { speechContextsFor } from './speechHints.ts';
import { SCENES } from './scenes.ts';

const flat = (topic: string | null) => speechContextsFor(topic).flatMap((c) => c.phrases);

test('오늘 주제와 그 장면의 낱말이 세게 실린다', () => {
  const ctx = speechContextsFor('첫 월급 타던 날');
  const strong = ctx.find((c) => c.boost === 15);
  assert.ok(strong, '세게 미는 층이 있어야 한다');
  // 실측에서 '차 벌금'으로 들리던 바로 그 말.
  assert.ok(strong.phrases.includes('첫 월급'));
  assert.ok(strong.phrases.includes('첫 월급 타던 날'));
});

test('주제가 없어도 그 시절 낱말은 알려 준다', () => {
  const ctx = speechContextsFor(null);
  assert.equal(ctx.length, 1);
  assert.equal(ctx[0].boost, 8);
  assert.ok(ctx[0].phrases.includes('굴렁쇠'));
  assert.ok(ctx[0].phrases.length > 50);
});

test('같은 낱말이 두 층에 겹치지 않는다', () => {
  // 겹치면 어느 boost 가 이기는지 문서가 말해 주지 않는다.
  const ctx = speechContextsFor('김장하던 날');
  const [strong, wide] = ctx;
  for (const p of strong.phrases) {
    assert.ok(!wide.phrases.includes(p), `'${p}' 가 두 층에 다 있다`);
  }
});

test('한 글자 낱말은 보내지 않는다', () => {
  // 한 글자를 세게 밀면 없던 말이 튀어나온다. 주제 표에서 한 글자를
  // 없앤 것과 같은 이유다.
  for (const p of flat('설날 아침')) {
    assert.ok([...p].length >= 2, `'${p}' 는 한 글자다`);
  }
});

test('구글 제한(구문 100자)을 넘지 않는다', () => {
  const long = '가'.repeat(300);
  for (const p of flat(long)) assert.ok(p.length <= 100);
});

test('주제 표 전체가 재료로 쓰인다', () => {
  const all = new Set(flat(null));
  // 표에 낱말을 더하면 힌트도 같이 늘어야 한다. 따로 관리하면 반드시 어긋난다.
  const sample = SCENES.flatMap((s) => s.match).filter((w) => [...w].length >= 2);
  const missing = sample.filter((w) => !all.has(w));
  assert.equal(missing.length, 0, `표에는 있는데 힌트에 없다: ${missing.slice(0, 5)}`);
});

test('어르신 신원은 힌트에 섞이지 않는다', () => {
  // 주제 문장은 그대로 실리므로, 힌트 목록이 주제 밖의 것을 스스로
  // 만들어 내지는 않는다는 것만 잠근다.
  const ctx = speechContextsFor('고향 이야기');
  const strong = ctx.find((c) => c.boost === 15);
  assert.ok(strong);
  assert.deepEqual(
    strong.phrases.filter((p) => !p.includes('고향') && !p.includes('바다') &&
      !p.includes('바닷') && !p.includes('시골') && !p.includes('동네') &&
      !p.includes('마을') && !p.includes('섬')),
    [],
  );
});
