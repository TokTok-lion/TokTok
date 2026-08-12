import test from 'node:test';
import assert from 'node:assert/strict';
import { art } from './art.ts';
import { DEFAULT_SCENE, SCENES, sceneForTopic, songTitleForTopic } from './scenes.ts';

/**
 * 주제 → 그림 표를 지키는 테스트.
 *
 * 이 표는 위에서부터 먼저 걸리는 것이 이긴다. 그래서 줄 하나를 옮기거나
 * 열쇠말 하나를 더하는 것만으로 멀쩡하던 주제가 다른 그림을 달고 나온다.
 * 화면은 멀쩡해 보이므로 아무도 신고하지 않는다 — 실제로 세 번 그랬다.
 *
 *   · '설' 한 글자였다 → '건설 현장에서 일하던 시절'에 송편이 떴다
 *   · '여행'이 신혼여행 줄에 있었다 → 모든 여행이 신혼여행 그림이었다
 *   · 놀이의 '동무들과'는 위 친구 줄의 '동무'에 늘 먼저 먹혔다 (죽은 규칙)
 *
 * 그래서 두 가지를 건다. 아래 '규칙'은 주제 이름을 몰라도 무너지는 것을
 * 잡고, '함정'은 실제로 부딪혔거나 부딪힐 자리를 하나씩 적어 둔다.
 *
 *   node --test lib/scenes.test.ts     (또는 npm test)
 */

test('규칙: 모든 열쇠말은 제 장면에 닿는다', () => {
  // 위 줄이 먼저 먹어 버리면 그 열쇠말은 규칙인 척만 한다.
  for (const s of SCENES) {
    for (const k of s.match) {
      assert.equal(
        sceneForTopic(k).id,
        s.id,
        `'${k}' 은 ${s.id} 의 열쇠말인데 ${sceneForTopic(k).id} 가 먼저 먹는다`,
      );
    }
  }
});

test('규칙: 한 글자짜리 열쇠말은 없다', () => {
  // 한 글자는 주제 문장 어디에나 박힌다. '설'이 '건설'을 명절로 만들었다.
  for (const s of SCENES) {
    for (const k of s.match) {
      assert.ok([...k].length >= 2, `'${k}' (${s.id}) 은 한 글자라 아무 데나 걸린다`);
    }
  }
});

test('규칙: 모든 장면의 그림이 실제로 있다', () => {
  for (const s of [...SCENES, DEFAULT_SCENE]) {
    assert.ok(s.art in art, `${s.id} 의 그림 ${s.art} 이 public/art 에 없다`);
  }
});

test('규칙: 장면 id 는 겹치지 않는다', () => {
  const ids = SCENES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, `겹치는 id: ${ids.filter((x, i) => ids.indexOf(x) !== i)}`);
});

test('규칙: 모든 장면에 대체텍스트가 있다', () => {
  // 낭독으로 듣는 사람에게는 이 문장이 그림 전부다.
  for (const s of [...SCENES, DEFAULT_SCENE]) {
    assert.ok(s.alt.trim().length > 0, `${s.id} 에 alt 가 없다`);
  }
});

test('규칙: 기본 장면은 열쇠말을 갖지 않는다', () => {
  // 기본은 아무것도 안 맞았을 때 오는 자리지, 겨루는 자리가 아니다.
  assert.deepEqual(DEFAULT_SCENE.match, []);
});

/**
 * 함정. 왼쪽 주제가 오른쪽 장면으로 가야 한다.
 *
 * 새 줄을 넣을 때 여기 한 줄을 같이 넣는다. 특히 열쇠말이 다른 열쇠말을
 * 품을 때 — '결혼식'은 '결혼'을, '김장'은 '김치'를 품는다.
 */
const 함정: [string, string][] = [
  // 서로를 품는 열쇠말 — 줄 순서가 유일한 방어선이다
  ['결혼식 하던 날', 'wedding'],
  ['신혼여행 이야기', 'honeymoon'],
  ['결혼하던 해', 'honeymoon'],
  ['김장하던 날', 'kimjang'],
  ['김치 담그던 날', 'kimjang'],
  ['김치찌개 끓이던 부엌', 'mealTable'],
  ['설날 아침 떡국', 'newYear'],
  ['추석 차례상', 'holiday'],
  ['노래자랑 나갔던 날', 'radio'],
  ['상 받던 날', 'proud'],
  ['어머니가 차려 주신 밥상', 'mealTable'],

  // 짧은 열쇠말이 엉뚱한 낱말에 박히던 자리
  ['건설 현장에서 일하던 시절', 'default'],
  ['소설 읽던 이야기', 'default'],
  ['섬유공장 다니던 시절', 'firstPay'],

  // 각 장면이 제 주제를 실제로 받는가
  ['첫 월급 타던 날', 'firstPay'],
  ['손주와의 하루', 'grandchild'],
  ['아이 첫걸음 떼던 날', 'firstSteps'],
  ['기차 타고 서울 가던 날', 'travel'],
  ['고향 바닷가', 'hometown'],
  ['논밭에서 모내기하던 날', 'farming'],
  ['군대 시절', 'army'],
  ['시장에서 장사하던 이야기', 'market'],
  ['재봉틀로 삯바느질하던 시절', 'sewing'],
  ['우리 집 문패 달던 날', 'house'],
  ['우리 가족 이야기', 'family'],
  ['라디오에서 나오던 유행가', 'radio'],
  ['학교 다니던 길', 'school'],
  ['동무들과 막걸리 마시던 이야기', 'friends'],
  ['자전거 배우던 날', 'bicycle'],

  // 주제가 없거나 아무것과도 안 맞으면 기본
  ['', 'default'],
  ['   ', 'default'],
  ['무엇에도 걸리지 않는 이야기', 'default'],
];

test('함정: 주제가 제 그림으로 간다', () => {
  for (const [topic, want] of 함정) {
    assert.equal(sceneForTopic(topic).id, want, `'${topic}' 이 ${sceneForTopic(topic).id} 로 갔다`);
  }
});

test('주제가 없어도 터지지 않는다', () => {
  assert.equal(sceneForTopic(null).id, 'default');
  assert.equal(sceneForTopic(undefined).id, 'default');
});

test('곡 제목은 주제를 따른다', () => {
  assert.equal(songTitleForTopic('첫 월급'), '첫 월급 이야기');
  assert.equal(songTitleForTopic('고향 이야기'), '고향 이야기'); // 이미 '이야기'로 끝나면 그대로
  assert.equal(songTitleForTopic('어머니의 하루'), '어머니의 하루');
  assert.equal(songTitleForTopic(''), '오늘의 노래');
  assert.equal(songTitleForTopic(null), '오늘의 노래');
});
