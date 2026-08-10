import type { SessionState } from './store';

/**
 * 회기 흐름 — 단일 진실 공급원.
 *
 * A session is not a set of tabs to browse; it is one job that runs from
 * 준비 to 마무리, often across several days. Everything that needs to know
 * "where are we / what is next" reads this file: the step indicator on every
 * session screen, and the single 지금 할 일 button on 오늘.
 *
 * Screens are grouped into nine steps. Sub-screens (AI 질문 추천, 노래 생성
 * 중 …) share their parent's step so the indicator never jitters.
 */

export type StepId =
  | 'prepare'
  | 'memory'
  | 'interview'
  | 'transcript'
  | 'story'
  | 'lyrics'
  | 'song'
  | 'sing'
  | 'wrap';

export type Step = {
  id: StepId;
  /** 1-based, shown as "3 / 9" */
  index: number;
  label: string;
  /** where tapping this step takes you */
  href: string;
  /** every screen that belongs to this step; the first is the entry point */
  screens: string[];
  /** what the worker is actually doing here — used on 오늘 */
  action: string;
};

export const STEPS: Step[] = [
  {
    id: 'prepare',
    index: 1,
    label: '회기 준비',
    href: '/session/checklist',
    screens: ['/session/checklist'],
    action: '동의와 장비를 점검해요',
  },
  {
    id: 'memory',
    index: 2,
    label: '기억 카드',
    href: '/session/cards',
    screens: ['/session/cards', '/session/level'],
    action: '어떤 기억부터 여쭐지 고르세요',
  },
  {
    id: 'interview',
    index: 3,
    label: '인터뷰',
    href: '/session/interview',
    screens: ['/session/interview', '/session/suggest', '/session/confirm'],
    action: '어르신 이야기를 들어요',
  },
  {
    id: 'transcript',
    index: 4,
    label: '전사 교정',
    href: '/session/transcript',
    screens: ['/session/transcript'],
    action: '기록된 말을 다듬어요',
  },
  {
    id: 'story',
    index: 5,
    label: '이야기 정리',
    href: '/session/story',
    screens: ['/session/story'],
    action: '어르신과 사실을 확인해요',
  },
  {
    id: 'lyrics',
    index: 6,
    label: '가사 검수',
    href: '/session/lyrics',
    screens: ['/session/lyrics'],
    action: '가사 초안을 확인해요',
  },
  {
    id: 'song',
    index: 7,
    label: '노래 만들기',
    href: '/session/style',
    screens: [
      '/session/style',
      '/session/generating',
      '/session/preview',
      '/session/song',
      '/session/lyric-card',
    ],
    action: '분위기를 고르고 곡을 만들어요',
  },
  {
    id: 'sing',
    index: 8,
    label: '함께 부르기',
    href: '/session/sing',
    screens: ['/session/sing'],
    action: '완성된 노래를 함께 불러요',
  },
  {
    id: 'wrap',
    index: 9,
    label: '마무리',
    href: '/session/reactions',
    screens: ['/session/reactions', '/session/log', '/session/wrap'],
    action: '반응과 활동일지를 남겨요',
  },
];

export const TOTAL_STEPS = STEPS.length;

/**
 * 1단계에서 점검하는 준비물.
 *
 * 회기 준비 화면(app/session/checklist)이 그리는 항목의 키와 같은 목록이다.
 * 그 화면은 이 배열을 돌면서 그리므로, 항목을 늘리거나 이름을 바꾸면 화면과
 * 완료 판정이 함께 움직인다 — 한쪽만 고쳐 어긋나는 일을 타입이 막는다.
 */
/**
 * 회기 준비에서 사람이 실제로 확인해야 하는 것.
 *
 * 넷이었다 — 어르신 선택·기억 카드·가족 메모·마이크. 그런데 앞의 셋은
 * 확인할 것이 아니었다. 어르신 선택은 이 화면에 왔다는 사실이 곧 증거이고
 * (안 고르면 회기가 열리지 않는다), 기억 카드는 바로 다음 화면에서 고르는
 * 것이라 여기서 미리 체크할 대상이 아니며, 가족 메모는 제보가 있을 때만
 * 의미가 있다. 앱이 이미 아는 것을 사람에게 다시 묻는 칸이었다.
 *
 * 마이크만 남긴다. 이것은 사람이 소리를 내 봐야 알 수 있고, 틀리면 어르신이
 * 한 시간 들려주신 이야기가 통째로 사라진다 — 실제로 그렇게 무음을 담았다.
 */
export const PREP_CHECKS = ['mic'] as const;
export type PrepCheck = (typeof PREP_CHECKS)[number];

const BY_SCREEN = new Map<string, Step>();
for (const s of STEPS) {
  for (const screen of s.screens) BY_SCREEN.set(screen, s);
}

/** 이 화면이 흐름의 몇 번째 단계인지. 흐름 밖 화면이면 undefined. */
export function stepForScreen(pathname: string): Step | undefined {
  return BY_SCREEN.get(pathname);
}

/**
 * 각 단계가 끝났는지 판정한다.
 *
 * 판정은 어르신·복지사가 실제로 남긴 결과(승인·확정·저장)만 본다.
 * 화면을 열어봤다는 사실만으로 완료 처리하지 않는다 — 원칙 3(사람 검수)에
 * 따라 "봤다"와 "확인했다"는 다르기 때문이다.
 */
export function isStepDone(step: StepId, s: SessionState): boolean {
  switch (step) {
    case 'prepare':
      /*
       * 빈 체크리스트는 '다 했다'가 아니라 '아직 아무것도 안 했다'이다.
       *
       * 예전에는 Object.values(s.checklist).every(Boolean) 이었다. 시연 기기는
       * 씨앗이 네 항목을 모두 켜 둔 채로 열려서 이 식이 맞아 보였지만, 기관
       * 계정의 실제 회기는 beginSession 이 checklist 를 {} 로 비우고 시작한다.
       * 빈 배열의 every 는 true 라, 어르신을 고른 직후 아무것도 점검하지 않은
       * 회기가 1단계 '완료'로 표시됐다. 회기 화면에는 초록 체크가 뜨고 오늘
       * 화면은 '지금 할 일'을 2단계로 건너뛰는데, 정작 준비 화면은 '인터뷰
       * 시작 (4건 남음)'이라고 말한다 — 같은 값을 보는 두 화면이 서로 다른
       * 말을 하는 자리였다.
       *
       * 그래서 있는 키를 훑지 않고 있어야 할 키를 확인한다. 없는 키는 false 로
       * 읽히므로, 비어 있으면 미완료가 된다.
       */
      return PREP_CHECKS.every((k) => s.checklist[k] === true);
    case 'memory':
      return !!s.memoryCard;
    case 'interview':
      return s.transcript.length > 0;
    case 'transcript':
      return s.transcriptConfirmed;
    case 'story':
      // having verified items is not the same as the worker having finished
      // checking them — the CTA on 이야기 정리 is the act that completes it
      return s.storyConfirmed;
    case 'lyrics':
      return s.lyricsApproved;
    case 'song':
      /*
       * 'complete' 는 "곡 파일이 있다"가 아니라 "복지사가 이 단계를 닫았다"는
       * 표시다. 두 가지 방식으로 닫힌다 — 미리듣기에서 '이 곡으로 진행'을
       * 누르거나, 곡이 안 나온 날 '가사 카드로 진행'을 택하거나.
       *
       * 예전에는 앞의 하나만 이 값을 세웠다. 그래서 곡 생성이 실패해 가사
       * 카드로 넘어간 회기는 7단계가 영원히 미완료로 남았고, 오늘 화면이
       * '다음 할 일: 노래 만들기'를 무한 반복하며 9/9 에 닿지 못했다. 그날의
       * 결과물이 가사 카드였는데도 회기를 못 끝내는 것은 막다른 길이다.
       *
       * 어느 쪽으로 닫혔는지는 songKey 로 구분된다 — 곡이 실제로 만들어진
       * 회기에만 값이 있다. 판정에는 쓰지 않지만, 뒤에서 회기를 들여다볼 때
       * 곡이 있었는지 없었는지는 그 값이 말해 준다.
       */
      return s.songStatus === 'complete';
    case 'sing':
      return s.sangTogether;
    case 'wrap':
      return s.logSaved;
  }
}

export type FlowState = {
  /** 아직 끝나지 않은 첫 단계 — 화면이 강조하는 "지금 할 일" */
  next: Step;
  done: number;
  total: number;
  /** 모든 단계가 끝났는지 */
  complete: boolean;
};

/**
 * 지금 할 일 하나를 고른다.
 *
 * 앞 단계가 비어 있어도 막지 않는다. 현장에서는 순서가 뒤바뀌기도 하고
 * (곡을 먼저 만들고 일지를 나중에 쓰는 식), 이 앱은 진행을 막는 도구가
 * 아니라 다음 할 일을 알려주는 도구다.
 */
export function flowState(s: SessionState): FlowState {
  const done = STEPS.filter((st) => isStepDone(st.id, s)).length;
  const next = STEPS.find((st) => !isStepDone(st.id, s));
  return {
    next: next ?? STEPS[STEPS.length - 1],
    done,
    total: TOTAL_STEPS,
    complete: !next,
  };
}
