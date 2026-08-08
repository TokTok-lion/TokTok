import type {
  Consents,
  Elder,
  FamilyContribution,
  LyricSection,
  StoryItem,
} from './domain';

/**
 * Seed content. Every string here is taken from the design deck so the app
 * opens on exactly the screens the deck shows.
 *
 * Names are stored the way the deck prints them — 김○○ — because the spec's
 * 최소수집 principle keeps full legal names out of the product surface.
 */

const GRANTED: Consents = {
  recording: 'granted',
  externalAi: 'granted',
  facilityPlay: 'granted',
  familyShare: 'granted',
  promotion: 'unset', // 홍보는 완전 선택형 (F-SW-CONS-007)
};

export const SEED_ELDER: Elder = {
  id: 'elder-kim',
  displayName: '김○○',
  honorific: '김○○ 어르신',
  // the deck's profile avatar: glasses + a leaf sprig at the lower left
  avatar: 'avatar_grandfather_leaf',
  stage: 3,
  nextTopic: '첫 직장과 첫 월급',
  communication: ['천천히 질문하기', '기억 카드 먼저'],
  musicPreferences: ['트로트', '포크', '민요풍'],
  avoidTopics: ['전쟁 이야기', '사별'],
  consents: GRANTED,
};

/** 전사 교정 화면(SW-STT)의 전사 문장. */
export const SEED_TRANSCRIPT = [
  { id: 't1', text: '첫 월급으로 어머니께 신발을 사드렸어요', at: 42 },
  { id: 't2', text: '공장에서 처음 일을 시작했어요', at: 18 },
  { id: 't3', text: '그날 정말 뿌듯했어요', at: 96 },
];

/** STT가 자신 없어 한 단어 — 복지사가 확인한다. */
export const SEED_UNCERTAIN_WORDS = ['신발', '공장'];

/**
 * 이야기 정리(SW-STORY). 모든 항목이 출처를 갖는다 —
 * 출처 없는 항목은 assertStoryIntegrity 가 거부한다.
 */
export const SEED_STORY: StoryItem[] = [
  {
    id: 's1',
    text: '첫 직장은 공장이었어요',
    status: 'verified',
    sources: [{ kind: 'voice', at: 18, label: '어르신 음성 0:18' }],
  },
  {
    id: 's2',
    text: '첫 월급으로 어머니께 신발을 사드렸어요',
    status: 'verified',
    sources: [{ kind: 'voice', at: 42, label: '어르신 음성 0:42' }],
  },
  {
    id: 's3',
    text: '그날의 기분은 뿌듯했어요',
    status: 'verified',
    sources: [{ kind: 'voice', at: 96, label: '어르신 음성 1:36' }],
  },
  {
    id: 's4',
    text: '그 신발은 어떤 신발이었나요?',
    status: 'unverified',
    sources: [{ kind: 'card', label: '기억 카드 · 첫 직장' }],
    followUp: '어떤 신발이었나요?',
  },
  {
    id: 's5',
    text: '당시 어머니의 반응은 어땠나요?',
    status: 'unverified',
    sources: [{ kind: 'family', label: '가족 제보 · 며느리' }],
    followUp: '어머니 반응은 어땠나요?',
  },
  {
    id: 's6',
    text: '어릴 때 자주 가던 동네 놀이터 이야기',
    status: 'excluded',
    sources: [{ kind: 'voice', at: 130, label: '어르신 음성 2:10' }],
  },
];

/** 가사 검수(SW-LYR) — 확정된 이야기만 반영된 초안. */
export const SEED_LYRICS: LyricSection[] = [
  {
    label: '1절',
    tone: 'verse',
    lines: [
      '첫 월급을 받던 그날',
      '두 손이 떨리던 순간',
      '봉투 속 소중한 마음',
      '어머니께 달려갔죠',
    ],
  },
  {
    label: '후렴',
    tone: 'chorus',
    lines: [
      '어머니께 드린 첫 선물',
      '그날의 마음 아직 따뜻해요',
      '함께 나눈 미소와 눈물',
      '내 삶의 가장 빛난 하루죠',
    ],
  },
];

/** 가사 카드(SW-LYR) — 큰 글씨로 보여주는 대표 4줄. */
export const SEED_LYRIC_CARD = [
  '첫 월급 봉투를',
  '두 손에 꼭 안고',
  '어머니께 달려가던',
  '그날이 생각나요',
];

/** 함께 부르기(SW-KAR) 후렴. */
export const SEED_CHORUS = ['사랑해요 고마워요', '우리 가족 늘 행복해요'];

/** 가족이 남긴 이야기(SW-FAM) — 확인 전에는 사실이 아니다. */
export const SEED_FAMILY_STORIES: FamilyContribution[] = [
  {
    id: 'f1',
    kind: 'photo',
    from: '며느리',
    title: '며느리가 보내준 고향 사진',
    art: 'photo_hometown_polaroid',
    state: 'pending',
  },
  {
    id: 'f2',
    kind: 'note',
    from: '가족',
    title: '첫 월급 이야기를 가족이 기억해요',
    body: '어머니께서 첫 월급으로 가족들과 외식을 하셨던 기억을 들려드렸어요.',
    art: 'photo_family_trio',
    state: 'pending',
  },
  {
    id: 'f3',
    kind: 'voice',
    from: '딸',
    title: '축하 음성 메시지',
    durationSec: 32,
    art: 'icon_envelope_open',
    state: 'pending',
  },
];

/** 가족 답장 보기(FM-MEDIA) — 이미 확인된 제보. */
export const SEED_FAMILY_REPLIES: FamilyContribution[] = [
  {
    id: 'r1',
    kind: 'photo',
    from: '딸',
    title: '고향 사진',
    body: '엄마가 태어나신 시골 마을이에요.',
    art: 'photo_hometown',
    state: 'pending',
  },
  {
    id: 'r2',
    kind: 'quote',
    from: '딸',
    title: '딸이 남긴 한마디',
    body: '“항상 가족을 먼저 챙겨주셨어요”',
    state: 'pending',
  },
  {
    id: 'r3',
    kind: 'voice',
    from: '아들',
    title: '축하 음성',
    body: '생신 축하 메시지를 보냈어요.',
    durationSec: 28,
    state: 'pending',
  },
];

/** 내 노래 보관함(SW-MUS). */
export type LibrarySong = {
  id: string;
  title: string;
  style: string;
  date: string;
  art: string;
  badge: '최근 재생' | '완료';
};

export const SEED_LIBRARY: LibrarySong[] = [
  {
    id: 'song-1',
    title: '첫 월급 이야기',
    style: '힘찬 트로트',
    date: '2025-05-20',
    art: 'album_briefcase_coins',
    badge: '최근 재생',
  },
  {
    id: 'song-2',
    title: '고향의 바닷바람',
    style: '따뜻한 발라드',
    date: '2025-04-12',
    art: 'album_lighthouse',
    badge: '완료',
  },
  {
    id: 'song-3',
    title: '가족에게 남기는 노래',
    style: '감성 포크',
    date: '2025-03-08',
    art: 'album_family',
    badge: '완료',
  },
];

/** 이전 회기 이어보기(SW-DASH). */
export type ResumeCard = {
  id: string;
  title: string;
  status: string;
  statusTone: 'brand' | 'leaf' | 'amber';
  detail: string;
  art: string;
  cta: '이어하기' | '보기';
  done: boolean;
};

export const SEED_RESUME: ResumeCard[] = [
  {
    id: 'r-sea',
    title: '고향의 바닷바람',
    status: '노래 생성 전',
    statusTone: 'brand',
    detail: '기억 카드 선택까지 완료',
    art: 'album_seaside_flowers',
    cta: '이어하기',
    done: false,
  },
  {
    id: 'r-family',
    title: '우리 가족의 탄생',
    status: '가사 검수 중',
    statusTone: 'amber',
    detail: '가족 답장 2개 확인됨',
    art: 'album_family_house',
    cta: '이어하기',
    done: false,
  },
  {
    id: 'r-proud',
    title: '가장 자랑스러운 순간',
    status: '활동일지 초안 있음',
    statusTone: 'leaf',
    detail: '다음 회기 추천 저장됨',
    art: 'album_trophy',
    cta: '보기',
    done: true,
  },
];

/** 회기 일정(SW-PLAN). */
export const SEED_SCHEDULE = [
  { time: '10:00', who: '김○○', what: '인터뷰', detail: '인생 이야기 듣기', kind: 'interview' as const },
  { time: '14:00', who: '박○○', what: '노래 듣기', detail: '음악 감상 및 대화', kind: 'music' as const },
  { time: '16:30', who: '이○○', what: '활동일지 정리', detail: '오늘 활동 내용 정리', kind: 'log' as const },
];

/** 기억 카드(SW-INT). */
export const SEED_MEMORY_CARDS = [
  { id: 'friends', label: '친구', art: 'card_friends' },
  { id: 'family', label: '가족', art: 'card_family' },
  { id: 'school', label: '학교', art: 'card_school' },
  { id: 'play', label: '놀이', art: 'card_play' },
  { id: 'holiday', label: '명절', art: 'card_holiday' },
] as const;

/** 인터뷰 진행 중(SW-INT) 보조 질문. */
export const SEED_INTERVIEW_PROMPTS = [
  { id: 'p1', text: '누구를 먼저 떠올리셨어요?', icon: 'people' as const },
  { id: 'p2', text: '당시 기분은 어땠나요?', icon: 'smile' as const },
  { id: 'p3', text: '어떤 선물을 하셨어요?', icon: 'gift' as const },
];

/** AI 질문 추천(SW-INT) — 확인된 이야기에서만 파생된다. */
export const SEED_SUGGESTED_QUESTIONS = [
  '어머니는 어떤 반응을 보이셨나요?',
  '어떤 신발을 사드렸나요?',
  '당시 어르신은 어떤 기분이셨나요?',
];

/** 활동일지 초안(SW-RPT) — AI 초안이며 복지사가 확정한다. */
export const SEED_LOG_DRAFT =
  '어르신은 첫 직장 시절에 대해 생생하게 기억하셨고, 첫 월급을 받았을 때의 감정을 따뜻하게 이야기하셨다. ' +
  '특히 어머니께 선물을 드렸던 경험을 회상하며 미소를 지으셨고, 노래를 함께 따라부르며 즐거워하는 모습이 인상적이었다. ' +
  '자발적으로 많은 이야기를 해주셔서 적극적인 반응을 보였다.';
