import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CARD_FLOW,
  OPEN_FLOW,
  PROMPT_KIND_LABEL,
  STRENGTH_FLOW,
  interviewFlow,
} from './prompts.ts';
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

/*
 * 지난 이야기 갈래의 뼈대.
 *
 * 예전에는 PROMPT_KIND_LABEL 의 열쇠를 그대로 썼는데, 강점 갈래가 들어오면서
 * 그 표에 아홉 개가 더 붙었다. 표를 세는 대신 뼈대를 여기 적어 둔다 —
 * 지난 이야기의 순서가 이 아홉이라는 것이 이 시험의 내용이다.
 */
const RECALL_ARC = [
  'scene',
  'people',
  'sense',
  'doing',
  'event',
  'feel',
  'after',
  'now',
  'leave',
];

test('아홉 갈래를 순서대로 지난다', () => {
  // 회상은 큰 것부터 물으면 안 나온다. 장면·사람·감각처럼 구체적인 것부터
  // 묻는 순서가 이 질문지의 뼈대이고, 단계가 달라도 그 뼈대는 같아야 한다.
  const arc = RECALL_ARC;
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

/* ---- 강점 갈래 (장수복지관 관장님 면담에서 나온 축) ---- */

test('강점 갈래는 단계마다 아홉 갈래를 다 갖춘다', () => {
  const kinds = ['shine', 'praise', 'able', 'how', 'wish', 'give', 'ask', 'cheer', 'thanks'];
  for (const level of [1, 2, 3] as const) {
    assert.deepEqual(
      STRENGTH_FLOW[level].map((p) => p.kind),
      kinds,
      `${level}단계 순서가 어긋났다`,
    );
  }
});

test('강점 갈래는 카드를 가리지 않는다 — 강점은 사람에게 붙어 있다', () => {
  const a = interviewFlow('여는 질문', 'family', 2, 'strength');
  const b = interviewFlow('여는 질문', 'spouse', 2, 'strength');
  const c = interviewFlow('여는 질문', null, 2, 'strength');
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
});

test('갈래를 안 주면 예전 그대로 지난 이야기다', () => {
  assert.deepEqual(
    interviewFlow('여는 질문', 'family', 3),
    interviewFlow('여는 질문', 'family', 3, 'recall'),
  );
});

test('강점 질문은 과거형으로 묻지 않는다 — 그러면 이 갈래의 뜻이 없다', () => {
  /*
   * 지금도 하시는 것·그 요령·하고 싶으신 것. 이 셋은 오늘을 묻는 자리다.
   * '…하셨어요?'로 물으면 회상 질문이 되고, 그러면 강점 갈래를 만든 이유가
   * 사라진다 — 그분이 오늘 무엇을 하실 수 있는 분인지가 안 남는다.
   */
  for (const level of [1, 2, 3] as const) {
    for (const kind of ['able', 'how', 'wish'] as const) {
      const q = STRENGTH_FLOW[level].find((p) => p.kind === kind)!;
      assert.ok(
        !/셨어요|셨나요|였어요|이셨/.test(q.text),
        `${level}단계 ${kind} 가 과거형이다: ${q.text}`,
      );
    }
  }
});

/* ---- 배우자 카드 ---- */

test('배우자 카드도 단계마다 아홉 개다', () => {
  for (const level of [1, 2, 3] as const) {
    assert.equal(CARD_FLOW.spouse[level].length, 9);
  }
});

test('배우자 질문은 살아 계신지 아닌지를 넘겨짚지 않는다', () => {
  const all = [1, 2, 3].flatMap((l) => CARD_FLOW.spouse[l as 1].map((p) => p.text));
  for (const t of all) {
    assert.ok(!/돌아가|사별|먼저 가신|하늘/.test(t), `넘겨짚는 문장: ${t}`);
  }
});

test('갈래마다 화면에 붙일 이름이 있다', () => {
  // 이름이 없으면 인터뷰 화면의 꼬리표 자리가 빈다. 갈래를 더할 때 여기서 걸린다.
  const used = new Set<string>();
  for (const flow of [OPEN_FLOW, STRENGTH_FLOW, ...Object.values(CARD_FLOW)]) {
    for (const level of LEVELS) for (const p of flow[level]) used.add(p.kind);
  }
  for (const kind of used) {
    assert.ok(PROMPT_KIND_LABEL[kind as keyof typeof PROMPT_KIND_LABEL], `${kind} 이름 없음`);
  }
});
