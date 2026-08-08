import type { ArtKey } from './art';

/**
 * 주제 → 장면 일러스트 해석기.
 *
 * The deck draws 노래 만드는 중 (p.8) and 노래 완성 (p.26) four times, once per
 * story topic, each with its own illustration — 첫 월급은 구두방, 손주와의
 * 하루는 아이와 그림, 아이 첫걸음은 사진첩, 신혼여행은 여행가방. The picture is
 * therefore a function of *what the elder talked about*, never a slideshow.
 *
 * Topics are free text (the worker can type anything), so matching is by
 * keyword with a documented fallback. Every rule is data, so adding a topic
 * means adding a row here — no screen changes.
 */

export type Scene = {
  /** stable id, handy for tests and analytics */
  id: string;
  /** the artwork shown while the song renders and on the finished song */
  art: ArtKey;
  /** what the picture shows, for screen-reader users */
  alt: string;
  /** any of these substrings in the topic selects this scene */
  match: string[];
};

/**
 * Order matters: the first scene whose keyword appears in the topic wins, so
 * put the specific ones above the general ones (신혼 before 가족).
 */
export const SCENES: Scene[] = [
  {
    id: 'firstPay',
    art: 'scene_paycheck_shop',
    alt: '첫 월급 봉투와 구두 가게가 있는 골목 그림',
    match: ['첫 월급', '월급', '첫 직장', '직장', '취직', '공장', '일터'],
  },
  {
    id: 'grandchild',
    art: 'album_grandchild_day',
    alt: '할머니와 손주가 함께 그림을 그리는 그림',
    match: ['손주', '손자', '손녀', '아이와', '함께한 하루'],
  },
  {
    id: 'firstSteps',
    art: 'album_first_steps',
    alt: '아기 사진첩과 첫 신발이 놓인 그림',
    match: ['첫걸음', '첫 걸음', '아기', '육아', '아이 키우'],
  },
  {
    id: 'honeymoon',
    art: 'album_honeymoon',
    alt: '여행 가방과 바다가 보이는 기차 창가 그림',
    match: ['신혼', '결혼', '여행', '신혼여행'],
  },
  {
    id: 'hometown',
    art: 'album_seaside_flowers',
    alt: '노란 꽃이 핀 바닷가 고향 풍경 그림',
    match: ['고향', '바다', '바닷', '시골', '동네', '마을'],
  },
  {
    id: 'family',
    art: 'album_family_house',
    alt: '집 앞에 모여 선 가족 그림',
    match: ['가족', '우리 가족', '어머니', '아버지', '부모'],
  },
  {
    id: 'proud',
    art: 'album_trophy',
    alt: '월계수에 둘러싸인 트로피 그림',
    match: ['자랑', '보람', '성취', '상 받'],
  },
  {
    id: 'school',
    art: 'card_school',
    alt: '학교 건물 그림',
    match: ['학교', '학창', '선생님', '공부'],
  },
  {
    id: 'friends',
    art: 'card_friends',
    alt: '어깨동무한 두 친구 그림',
    match: ['친구', '동무'],
  },
  {
    id: 'holiday',
    art: 'card_holiday',
    alt: '명절 차례상과 감나무 그림',
    match: ['명절', '설', '추석', '차례'],
  },
  {
    id: 'play',
    art: 'card_play',
    alt: '굴렁쇠와 구슬치기를 하는 아이들 그림',
    match: ['놀이', '놀던', '동무들과'],
  },
];

/**
 * 기본 장면. 어떤 주제와도 맞지 않을 때 쓰이며, 특정 사건을 그리지 않는
 * 중립적인 그림이라 어르신의 이야기를 잘못 대변하지 않는다.
 */
export const DEFAULT_SCENE: Scene = {
  id: 'default',
  art: 'scene_couple_reading',
  alt: '어르신 두 분이 사진첩을 함께 보는 그림',
  match: [],
};

/** 주제 문장에서 장면을 고른다. 매칭되지 않으면 기본 장면. */
export function sceneForTopic(topic: string | undefined | null): Scene {
  if (!topic) return DEFAULT_SCENE;
  const t = topic.replace(/\s+/g, ' ').trim();
  for (const s of SCENES) {
    if (s.match.some((k) => t.includes(k))) return s;
  }
  return DEFAULT_SCENE;
}

/** 곡 제목은 주제에서 파생된다. 이미 "이야기"로 끝나면 그대로 둔다. */
export function songTitleForTopic(topic: string | undefined | null): string {
  const t = (topic ?? '').trim();
  if (!t) return '오늘의 노래';
  if (/(이야기|노래|하루|순간|바람|탄생)$/.test(t)) return t;
  return `${t} 이야기`;
}
