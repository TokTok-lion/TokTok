import test from 'node:test';
import assert from 'node:assert/strict';
import { CARD_FLOW, OPEN_FLOW, PROMPT_KIND_LABEL, interviewFlow } from './prompts.ts';
import { SEED_MEMORY_CARDS } from './seed.ts';
import type { QuestionLevel } from './domain.ts';

/**
 * 질문 단계가 정말 갈리는지 잠근다.
 *
 * 이 파일이 있는 이유: 화면에는 「1단계 선택형 · 2단계 단답형 · 3단계 회상형」이
 * 있었는데, 실제로는 맨 앞 한 문장만 갈리고 뒤 아홉 개가 같았다. 복지사가
 * 고른 것이 지켜지지 않았고, 아무도 눈치채지 못한 채로 오래 갔다 — 화면상으로
 * 정상 동작과 구분되지 않기 때문이다.
 */

const LEVELS: QuestionLevel[] = [1, 2, 3];

test('카드마다 세 단계가 다 있다', () => {
  for (const card of SEED_MEMORY_CARDS) {
    const flow = CARD_FLOW[card.id];
    assert.ok(flow, `${card.id} 카드에 질문 흐름이 없다`);
    for (const level of LEVELS) {
      assert.ok(flow[level]?.length, `${card.id} 카드에 ${level}단계 흐름이 없다`);
    }
  }
});

test('단계가 다르면 질문도 다르다', () => {
  // 이것이 처음에 깨져 있던 조건이다. 세 단계의 흐름이 같은 배열이면
  // 「다음 질문」을 한 번 누르는 순간 셋이 합쳐진다.
  for (const [id, flow] of Object.entries({ open: OPEN_FLOW, ...CARD_FLOW })) {
    const [a, b, c] = LEVELS.map((l) => flow[l].map((p) => p.text).join('|'));
    assert.notEqual(a, b, `${id}: 선택형과 단답형이 같다`);
    assert.notEqual(b, c, `${id}: 단답형과 회상형이 같다`);
    assert.notEqual(a, c, `${id}: 선택형과 회상형이 같다`);
  }
});

test('선택형은 고를 것을 두 가지 내민다', () => {
  /*
   * 선택형은 말문이 안 트이시는 분께 드리는 질문이다. 고를 것이 없으면
   * 그냥 열린 질문이고, 그러면 단계를 고른 뜻이 없어진다.
   *
   * 근거는 '~요, ~요?' 꼴 — 두 가지를 나란히 내미는 우리말 형태다.
   */
  for (const [id, flow] of Object.entries({ open: OPEN_FLOW, ...CARD_FLOW })) {
    for (const p of flow[1]) {
      assert.match(p.text, /[요아까]\?*,|,\s*\S+(요|까)\?$/, `${id}: 고를 것이 없다 — "${p.text}"`);
    }
  }
});

test('아홉 갈래를 순서대로 지난다', () => {
  // 회상은 큰 것부터 물으면 안 나온다. 장면·사람·감각처럼 구체적인 것부터
  // 묻는 순서가 이 질문지의 뼈대이고, 단계가 달라도 그 뼈대는 같아야 한다.
  const arc = Object.keys(PROMPT_KIND_LABEL);
  for (const [id, flow] of Object.entries({ open: OPEN_FLOW, ...CARD_FLOW })) {
    for (const level of LEVELS) {
      const kinds = flow[level].map((p) => p.kind);
      assert.deepEqual(kinds, arc, `${id} ${level}단계의 갈래 순서가 다르다`);
    }
  }
});

test('여는 질문이 맨 앞에 서고 열 개가 된다', () => {
  const flow = interviewFlow('여는 질문', 'family', 1);
  assert.equal(flow[0].text, '여는 질문');
  assert.equal(flow.length, 10);
  // 카드를 안 고른 회기도 같은 길이여야 한다 — 화면이 '1번째 / 전체 10'을
  // 적으므로, 여기가 어긋나면 그 숫자가 거짓이 된다.
  assert.equal(interviewFlow('여는 질문', null, 2).length, 10);
});

test('모르는 카드는 주제를 가리지 않는 흐름으로 간다', () => {
  // 카드가 늘어나는데 흐름을 안 더하면 여기로 온다. 빈 화면이 되면 안 된다.
  const flow = interviewFlow('여는 질문', 'no-such-card', 3);
  assert.equal(flow.length, 10);
  assert.deepEqual(
    flow.slice(1).map((p) => p.text),
    OPEN_FLOW[3].map((p) => p.text),
  );
});
