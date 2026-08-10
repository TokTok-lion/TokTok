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
 *
 * 여기 남은 것은 화면이 실제로 import 하는 씨앗뿐이다.
 *
 * 화면들이 씨앗 대신 이 회기의 값을 쓰도록 바뀌면서 쓰이지 않게 된 배열이
 * 여럿 남아 있었다(예시 곡 목록·이어보기 카드·후렴·가사 카드 네 줄·추천
 * 질문…). export 는 ESLint 가 미사용으로 잡아 주지 않아서, 남아 있는 동안은
 * 다음 사람이 살아 있는 자료로 읽는다 — 실제로 "이 앱에는 예시 곡이 세 곡
 * 있다"는 오해가 화면 문구까지 갔던 적이 있다. 그래서 참조가 0건이 된
 * 씨앗은 그때그때 지운다. 다시 필요하면 그 화면이 쓰는 값에서 만들면 된다.
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

/**
 * 어르신 목록(SW-PTC-L).
 *
 * 이름은 전부 가명 표기다 — 명세서의 최소수집 원칙에 따라 실명·주민번호·
 * 건강정보는 제품 표면에 두지 않는다. 목록에 두는 것은 진행 상태와 다음
 * 일정처럼 업무에 필요한 최소 정보뿐이다 (F-SW-PTC-001).
 */
export type ServiceStatus = 'active' | 'paused' | 'ended';

export const SERVICE_STATUS_LABELS: Record<ServiceStatus, string> = {
  active: '이용 중',
  paused: '일시중지',
  ended: '종료',
};

/** 가족 협업 가능 여부. 미참여가 서비스 이용을 막지 않는다 (F-SW-PTC-007). */
export type FamilyAvailability = 'available' | 'none' | 'unreachable';

export const FAMILY_AVAILABILITY_LABELS: Record<FamilyAvailability, string> = {
  available: '가족 참여',
  none: '가족 미사용',
  unreachable: '연락 불가',
};

export type ElderSummary = {
  id: string;
  /** 가명 표기 */
  displayName: string;
  /** 기관 내부 번호 — 검색용, 개인 식별정보 아님 */
  code: string;
  avatar: string;
  worker: string;
  status: ServiceStatus;
  family: FamilyAvailability;
  /** 9단계 중 완료 단계 수 */
  step: number;
  topic: string;
  nextSession: string;
  /** 동의 만료까지 남은 일수. null이면 해당 없음. */
  consentExpiresInDays: number | null;
};

export const SEED_ELDERS: ElderSummary[] = [
  { id: 'elder-kim', displayName: '김○○', code: 'A-01', avatar: 'avatar_grandfather_leaf', worker: '박서준', status: 'active', family: 'available', step: 3, topic: '첫 직장과 첫 월급', nextSession: '5/21 10:00', consentExpiresInDays: 12 },
  { id: 'elder-park', displayName: '박○○', code: 'A-02', avatar: 'avatar_grandmother_round', worker: '박서준', status: 'active', family: 'available', step: 7, topic: '고향의 바닷바람', nextSession: '5/21 14:00', consentExpiresInDays: null },
  { id: 'elder-lee', displayName: '이○○', code: 'A-03', avatar: 'avatar_grandfather_round', worker: '김하늘', status: 'active', family: 'none', step: 5, topic: '우리 가족의 탄생', nextSession: '5/22 10:00', consentExpiresInDays: 4 },
  { id: 'elder-jung', displayName: '정○○', code: 'A-04', avatar: 'avatar_grandmother', worker: '김하늘', status: 'active', family: 'available', step: 6, topic: '가장 자랑스러운 순간', nextSession: '5/22 11:00', consentExpiresInDays: null },
  { id: 'elder-han', displayName: '한○○', code: 'A-05', avatar: 'portrait_grandfather', worker: '박서준', status: 'active', family: 'available', step: 9, topic: '손주와의 하루', nextSession: '5/23 10:00', consentExpiresInDays: 45 },
  { id: 'elder-cho', displayName: '조○○', code: 'A-06', avatar: 'avatar_grandmother_round', worker: '김하늘', status: 'active', family: 'unreachable', step: 1, topic: '아이 첫걸음', nextSession: '5/23 14:00', consentExpiresInDays: null },
  { id: 'elder-yoon', displayName: '윤○○', code: 'A-07', avatar: 'avatar_grandfather', worker: '박서준', status: 'paused', family: 'available', step: 4, topic: '신혼여행', nextSession: '—', consentExpiresInDays: 21 },
  { id: 'elder-jang', displayName: '장○○', code: 'A-08', avatar: 'avatar_grandmother', worker: '김하늘', status: 'ended', family: 'none', step: 9, topic: '학창시절 친구들', nextSession: '—', consentExpiresInDays: null },
];

/**
 * 전사 교정 화면(SW-STT)의 전사 문장.
 *
 * example 표를 달아 둔다. 이 줄들이 입력칸에 담겨 나오는 바람에, 직접
 * 녹음해 본 사람이 자기 말이 옮겨진 줄로 읽었다. 표가 있어야 화면이
 * '예시'라고 적을 수 있다. 타입을 적어 두지 않으면 example 이 boolean 으로
 * 넓어져 저장소 타입과 어긋난다.
 */
export const SEED_TRANSCRIPT: {
  id: string;
  text: string;
  at: number;
  example?: true;
}[] = [
  { id: 't1', text: '첫 월급으로 어머니께 신발을 사드렸어요', at: 42, example: true },
  { id: 't2', text: '공장에서 처음 일을 시작했어요', at: 18, example: true },
  { id: 't3', text: '그날 정말 뿌듯했어요', at: 96, example: true },
];

/**
 * 이야기 정리(SW-STORY). 모든 항목이 출처를 갖는다 —
 * 출처 없는 항목은 assertStoryIntegrity 가 거부한다.
 */
export const SEED_STORY: StoryItem[] = [
  {
    id: 's0',
    example: true,
    text: '열아홉에 공장에 들어갔어요',
    status: 'verified',
    sources: [{ kind: 'voice', at: 11, label: '어르신 음성 0:11' }],
  },
  {
    id: 's1',
    example: true,
    text: '첫 직장은 공장이었어요',
    status: 'verified',
    sources: [{ kind: 'voice', at: 18, label: '어르신 음성 0:18' }],
  },
  {
    id: 's2',
    example: true,
    text: '첫 월급으로 어머니께 신발을 사드렸어요',
    status: 'verified',
    sources: [{ kind: 'voice', at: 42, label: '어르신 음성 0:42' }],
  },
  {
    id: 's3',
    example: true,
    text: '그날의 기분은 뿌듯했어요',
    status: 'verified',
    sources: [{ kind: 'voice', at: 96, label: '어르신 음성 1:36' }],
  },
  {
    id: 's4',
    example: true,
    text: '그 신발은 어떤 신발이었나요?',
    status: 'unverified',
    sources: [{ kind: 'card', label: '기억 카드 · 첫 직장' }],
    followUp: '어떤 신발이었나요?',
  },
  {
    id: 's5',
    example: true,
    text: '당시 어머니의 반응은 어땠나요?',
    status: 'unverified',
    sources: [{ kind: 'family', label: '가족 제보 · 며느리' }],
    followUp: '어머니 반응은 어땠나요?',
  },
  {
    id: 's6',
    example: true,
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

/**
 * 회기 일정(SW-PLAN) — 로그인 전 둘러보기에서만 쓰는 예시.
 *
 * 기관 계정에서는 어느 화면도 이 배열을 그리지 않는다. 일정을 넣는 기능이
 * 서버에도 화면에도 없어서, 어르신을 한 명도 등록하지 않은 기관에 등록한 적
 * 없는 김○○·박○○·이○○의 오늘 일정이 뜨기 때문이다. 알림도 이 배열로는
 * 예약하지 않는다 — 오지 않을 시각에 알림을 걸어 두는 셈이라(경위는
 * components/NotifySettings.tsx 주석).
 */
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

/** 활동일지 초안(SW-RPT) — AI 초안이며 복지사가 확정한다. */
export const SEED_LOG_DRAFT =
  '어르신은 첫 직장 시절에 대해 생생하게 기억하셨고, 첫 월급을 받았을 때의 감정을 따뜻하게 이야기하셨다. ' +
  '특히 어머니께 선물을 드렸던 경험을 회상하며 미소를 지으셨고, 노래를 함께 따라부르며 즐거워하는 모습이 인상적이었다. ' +
  '자발적으로 많은 이야기를 해주셔서 적극적인 반응을 보였다.';

/**
 * 지난 회기에서 확인된 이야기.
 *
 * 모순 탐지가 무엇과 대조하는지 보여주기 위한 시연용 자료다. 서버를 쓰면
 * 이 자리에 story_facts 의 과거 회기 기록이 들어온다.
 *
 * 3회기의 '스물둘'과 이번 회기의 '열아홉'이 어긋난다 — 회상 인터뷰에서
 * 실제로 흔한 일이고, 지금까지는 회기 기록이 따로 쌓여 아무도 못 봤다.
 */
export const SEED_PAST_FACTS = [
  { id: 'p1', text: '스물둘에 공장에 들어갔어요', when: '3회기 · 4월 18일' },
  { id: 'p2', text: '첫 월급으로 어머니께 신발을 사드렸어요', when: '3회기 · 4월 18일' },
  { id: 'p3', text: '고향은 바닷가 마을이었어요', when: '5회기 · 5월 2일' },
];
