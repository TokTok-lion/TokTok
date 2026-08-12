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
 *
 * ── 그림이 바뀐 이유 ──────────────────────────────────────────────
 * 덱은 앨범 타일을 세 장만 그려 준다(p.26 → prepare-scenes.py). 나머지 주제는
 * 누끼.zip 의 가로 삽화를 빌려 쓰면서 정사각 타일 안에서 잘렸다 — 명절은
 * 560x193 짜리 띠를 112x112 에 밀어 넣어 차례상이 반쯤 잘린 채로 나왔다.
 * 그래서 주제용 커버만 1:1 수채 정물 세트로 새로 깔았다(prepare-covers.py).
 *
 * 덱이 직접 그린 세 장(손주·첫걸음·신혼여행)은 그대로 둔다. 화면을 덱과
 * 비교해서 검수하는 프로젝트라, 덱에 있는 그림을 말없이 갈아 끼우지 않는다.
 * 첫 월급도 덱의 이야기(구두)를 그대로 따른다. 덱 그림 파일만 못 쓰는데,
 * 이유는 그 줄에 적어 뒀다.
 *
 * 새 커버에는 사람이 없다. 취향이 아니라 규칙이다 — 이 타일은 어르신 본인의
 * 이야기 옆에 붙는다. 얼굴이 그려져 있으면 그 자리에 남의 얼굴이 들어앉는다.
 * 사물은 주제를 틀릴 수는 있어도 사람을 틀리지는 않는다.
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
 * put the specific ones above the general ones.
 *
 * 줄 순서가 곧 규칙이다. 옮기기 전에 아래를 확인한다.
 *
 *   · 혼례가 신혼여행보다 위 — '결혼식'은 '결혼'을 품는다.
 *   · 김장이 밥상보다 위 — '김장'을 밥상의 '김치'가 먼저 먹는다.
 *   · 설날이 명절보다 위 — 설은 떡국, 추석은 송편이다.
 *   · 밥상이 가족보다 위 — '어머니가 차려 주신 밥상'은 가족이 아니라 밥상이다.
 *   · 라디오가 자랑보다 위 — '노래자랑'은 상 이야기가 아니라 노래 이야기다.
 *
 * 열쇠말은 짧을수록 위험하다. '설' 한 글자가 '건설 현장'을 명절로 만들었다.
 * 두 글자 미만이거나 흔한 낱말에 박히는 것은 쓰지 않는다 — '집'(집안일·집사람),
 * '논'(이론·논의)이 그래서 '우리 집'·'논밭'으로 적혀 있다.
 */
export const SCENES: Scene[] = [
  {
    id: 'firstPay',
    // 덱 p.26 의 첫 월급은 구두방이다 — 첫 월급으로 구두를 사 드린 이야기.
    // 덱 그림 자체(scene_paycheck_shop)는 못 쓴다. '월급'과 '구두'가 글자로
    // 박혀 있는데 이 타일은 112px 과 64px 로 쓰이고, 그 크기에서 글자는
    // 뭉개진다. 게다가 그림 속 글자는 글자 크기 조절(--text-scale)을 따라
    // 커지지 않는다 — 가장 크게 해 두신 어르신에게도 그대로 3px 이다.
    // 그래서 그림만 바꾸고 이야기는 덱의 것을 그대로 둔다.
    art: 'cover_first_pay_shoes',
    alt: '잘 닦은 갈색 구두 한 켤레와 월급봉투가 놓인 그림',
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
    id: 'wedding',
    art: 'cover_wedding',
    alt: '나무로 깎은 기러기와 청실홍실 매듭이 놓인 그림',
    match: ['혼례', '결혼식', '예식', '시집가', '장가가', '신부', '신랑'],
  },
  {
    id: 'honeymoon',
    // 덱 p.26 의 신혼여행 타일. '여행'은 아래 travel 로 내려보냈다 — 예전에는
    // 어떤 여행 이야기든 신혼여행 그림이 떴다.
    art: 'album_honeymoon',
    alt: '여행 가방과 바다가 보이는 기차 창가 그림',
    match: ['신혼여행', '신혼', '결혼'],
  },
  {
    id: 'travel',
    art: 'cover_travel_case',
    alt: '여행 가방 옆에 종이로 싼 들꽃 다발이 놓인 그림',
    match: ['여행', '기차', '객지', '타향', '서울살이'],
  },
  {
    id: 'hometown',
    art: 'cover_lighthouse',
    alt: '등대 옆에 노란 유채꽃 다발이 놓인 그림',
    match: ['고향', '바다', '바닷', '시골', '동네', '마을', '섬마을', '섬에서'],
  },
  {
    id: 'farming',
    art: 'cover_farming',
    alt: '지게에 기대어 놓인 볏단과 낫 그림',
    match: ['농사', '논밭', '논일', '밭일', '모내기', '추수', '벼 베', '소 먹이'],
  },
  {
    id: 'army',
    art: 'cover_army',
    alt: '군화 한 켤레와 수통, 접힌 편지가 놓인 그림',
    match: ['군대', '군 생활', '입대', '제대', '병역', '훈련소'],
  },
  {
    id: 'market',
    art: 'cover_market',
    alt: '양팔 저울과 나무 됫박이 놓인 그림',
    match: ['장사', '시장', '좌판', '노점', '가게', '점포', '행상'],
  },
  {
    id: 'kimjang',
    art: 'cover_kimjang',
    alt: '장독 옆 소쿠리에 배추 한 포기가 담긴 그림',
    match: ['김장', '배추', '김치 담'],
  },
  {
    id: 'mealTable',
    art: 'cover_meal_table',
    alt: '소반 위에 밥 한 그릇과 국 한 그릇, 젓가락이 놓인 그림',
    match: ['밥상', '부엌', '반찬', '김치', '장독', '도시락', '음식', '요리'],
  },
  {
    id: 'sewing',
    art: 'cover_sewing',
    alt: '발재봉틀과 실패 두 개, 골무가 놓인 그림',
    match: ['바느질', '재봉', '삯바느질', '뜨개', '옷 지'],
  },
  {
    id: 'house',
    art: 'cover_house_key',
    alt: '나무 문패와 열쇠 세 개가 놓인 그림',
    match: ['이사', '문패', '우리 집', '집 짓', '셋방', '전세', '내 집'],
  },
  {
    id: 'family',
    art: 'cover_family_shoes',
    alt: '댓돌 위에 나란히 놓인 신발 세 켤레 그림',
    match: ['가족', '우리 가족', '어머니', '아버지', '부모'],
  },
  {
    id: 'radio',
    art: 'cover_radio',
    alt: '나무 라디오와 음반 세 장이 놓인 그림',
    match: ['라디오', '전축', '유행가', '노래', '음악', '가수'],
  },
  {
    id: 'proud',
    art: 'cover_trophy',
    alt: '월계수 가지 옆에 놓인 금빛 트로피 그림',
    match: ['자랑', '보람', '성취', '상 받'],
  },
  {
    id: 'school',
    art: 'cover_school_bag',
    alt: '가죽 책가방 옆에 공책과 연필이 놓인 그림',
    match: ['학교', '학창', '선생님', '공부'],
  },
  {
    id: 'friends',
    art: 'cover_kettle_bowls',
    alt: '주전자와 사발 두 개가 놓인 그림',
    match: ['친구', '동무'],
  },
  {
    id: 'newYear',
    art: 'cover_tteokguk',
    alt: '놋그릇에 담긴 떡국과 놋숟가락 그림',
    match: ['설날', '정월', '떡국', '설 명절', '세배'],
  },
  {
    id: 'holiday',
    art: 'cover_songpyeon',
    alt: '놋그릇에 담긴 송편과 감 하나가 놓인 그림',
    // '설' 한 글자였다. 그래서 '건설 현장', '소설' 같은 주제가 전부 명절
    // 그림을 달고 나왔다. 한 글자짜리 열쇠말은 주제 문장 어디에나 박힌다.
    match: ['명절', '추석', '한가위', '차례'],
  },
  {
    id: 'play',
    art: 'cover_hoop_marbles',
    alt: '굴렁쇠와 구슬 다섯 알이 놓인 그림',
    // '동무들과'가 있었는데 위 friends 의 '동무'가 늘 먼저 먹어서 한 번도
    // 닿은 적이 없다. 닿지 않는 규칙은 규칙인 척만 한다.
    match: ['놀이', '놀던'],
  },
  {
    id: 'bicycle',
    art: 'cover_bicycle',
    alt: '들꽃 한 다발이 놓인 낡은 자전거 그림',
    match: ['자전거', '나들이', '소풍'],
  },
];

/**
 * 기본 장면. 어떤 주제와도 맞지 않을 때 쓰이며, 특정 사건을 그리지 않는
 * 중립적인 그림이라 어르신의 이야기를 잘못 대변하지 않는다.
 *
 * 사진첩 안의 사진은 기와지붕 두 장뿐이다 — 사물도 사건도 아니라서 어떤
 * 이야기 위에 놓여도 그 이야기인 척하지 않는다. 아기 신발이 놓인 판본도
 * 만들어 봤지만 기본값으로는 육아 쪽으로 기울어 지웠다.
 */
export const DEFAULT_SCENE: Scene = {
  id: 'default',
  art: 'cover_photo_album_plain',
  alt: '기와지붕 사진이 붙은 낡은 사진첩 그림',
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
