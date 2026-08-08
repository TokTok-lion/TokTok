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
      return Object.values(s.checklist).every(Boolean);
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
