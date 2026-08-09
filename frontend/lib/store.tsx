'use client';

import { useCallback, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { forgetRecording } from './recorder';
import {
  DEFAULT_CONSENTS,
  type Consents,
  type ConsentKind,
  type Elder,
  type FamilyContribution,
  type FamilyMissionKind,
  type LyricSection,
  type MusicStyleId,
  type QuestionLevel,
  type ReactionId,
  type SongStatus,
  type StoryItem,
  type StoryStatus,
} from './domain';
import {
  SEED_ELDER,
  SEED_FAMILY_REPLIES,
  SEED_FAMILY_STORIES,
  SEED_LOG_DRAFT,
  SEED_LYRICS,
  SEED_STORY,
  SEED_TRANSCRIPT,
} from './seed';

/* ------------------------------------------------------------------ *
 * Session state.
 *
 * Everything lives on the device. No life story, recording, or family
 * message leaves the browser in this build — which is also the default the
 * spec asks for (원음성·전사 비공개). The seams that would call STT / LLM /
 * music vendors sit behind lib/services.ts, so a real backend can be added
 * without touching a single screen.
 *
 * localStorage is an external system, so it is wired through
 * useSyncExternalStore rather than an effect: the server renders the seed,
 * the client swaps in the saved session on hydration, and no render
 * cascades.
 * ------------------------------------------------------------------ */

const KEY = 'toktok.session.v1';

export type SessionState = {
  elder: Elder;
  /** 오늘 회기 주제 */
  topic: string;
  memoryCard: string | null;
  questionLevel: QuestionLevel;
  checklist: Record<string, boolean>;
  transcript: { id: string; text: string; at: number }[];
  transcriptConfirmed: boolean;
  story: StoryItem[];
  /** 복지사가 사실 확인을 끝내고 가사로 넘긴 시점 (원칙 3 · 사람 검수) */
  storyConfirmed: boolean;
  lyricsApproved: boolean;
  style: MusicStyleId | null;
  songStatus: SongStatus;
  previewChoice: 'A' | 'B' | 'C' | null;
  /** 함께 부르기 활동을 실제로 진행하고 마무리한 시점 */
  sangTogether: boolean;
  reactions: ReactionId[];
  reactionNote: string;
  logDraft: string;
  logSaved: boolean;
  nextTopic: string;
  wrapNote: string;
  familyStories: FamilyContribution[];
  familyReplies: FamilyContribution[];
  missionKind: FamilyMissionKind;
  missionBody: string;
  missionSent: boolean;
  /**
   * 가사. 확인된 이야기에서 나온다(원칙 2).
   *
   * 처음에는 시연용 씨앗이 들어 있고, 가사 검수 화면에서 만들면 그 결과가
   * 여기로 들어온다. 곡 만들기는 이 값을 읽으므로, 만든 가사가 그대로
   * 노래가 된다.
   */
  lyrics: LyricSection[];

  /**
   * 지금 기기에 있는 곡이 어떤 가사·스타일로 만들어졌는지.
   *
   * 이 값이 있으면 같은 가사로는 다시 만들지 않는다. 곡 한 개가 750크레딧
   * 이라, 곡 만드는 중 화면에서 새로고침 한 번이 그대로 요금이 된다.
   * useRef 가드는 새로고침에 초기화되므로 저장소에 남겨야 한다.
   */
  songKey: string | null;

  /** 글자 크기 배율 (1 / 1.15 / 1.3) — NFR-A11Y-003 */
  textScale: number;

  /* --- 서버 사본과의 연결 고리 -------------------------------------
   * 화면은 항상 이 로컬 상태를 본다. 아래 값들은 "이 회기가 서버의 어느
   * 행에 대응하는가"만 들고 있어서, 여러 번 저장해도 회기가 여러 개로
   * 늘어나지 않게 한다. 서버를 안 쓰면 전부 null 인 채로 그냥 논다. */

  /** 서버 sessions.id. 처음 저장할 때 생기고 그 뒤로는 갱신에만 쓴다. */
  remoteSessionId: string | null;
  /** 서버 participants.id. 어르신을 골라야 저장할 수 있다. */
  remoteParticipantId: string | null;
  remoteStartedAt: string | null;
  /** 9단계 중 어디까지 왔는지 — 콘솔이 진행상태만 보는 근거가 된다. */
  remoteStep: number;

  /**
   * 마지막 서버 저장 결과.
   *
   * 저장 버튼은 누르는 즉시 다음 화면으로 넘어간다(현장에서 기다리게 하지
   * 않으려고). 그래서 결과를 그 화면에 띄우면 아무도 못 본다 — 여기에 남겨서
   * 마무리 화면이 대신 말해 준다. off 는 "서버를 안 쓰는 중"이다.
   */
  serverSave: ServerSaveMark;
};

export type ServerSaveMark =
  | { kind: 'off' }
  | { kind: 'saved'; at: string }
  | { kind: 'error'; reason: string };

function seedState(): SessionState {
  return {
    elder: SEED_ELDER,
    topic: '첫 직장과 첫 월급',
    // the deck opens with 놀이 and 따뜻한 발라드 already chosen
    memoryCard: 'play',
    questionLevel: 1,
    // The demo opens mid-session: 준비·기억카드·인터뷰가 끝나고 전사 교정
    // 차례. Steps read in order rather than looking randomly scattered.
    checklist: { elder: true, cards: true, familyNote: true, mic: true },
    transcript: SEED_TRANSCRIPT,
    transcriptConfirmed: false,
    story: SEED_STORY,
    storyConfirmed: false,
    lyrics: SEED_LYRICS,
    songKey: null,
    lyricsApproved: false,
    style: 'ballad',
    songStatus: 'draft',
    previewChoice: 'B',
    sangTogether: false,
    reactions: ['speak', 'smile', 'clap'],
    reactionNote: '',
    logDraft: SEED_LOG_DRAFT,
    logSaved: false,
    nextTopic: '가장 자랑스러운 순간',
    wrapNote: '어머니께 선물을 드린 기억을 따뜻하게 회상하심',
    familyStories: SEED_FAMILY_STORIES,
    familyReplies: SEED_FAMILY_REPLIES,
    missionKind: 'photo',
    missionBody: '',
    missionSent: false,
    textScale: 1,
    remoteSessionId: null,
    remoteParticipantId: null,
    remoteStartedAt: null,
    remoteStep: 1,
    serverSave: { kind: 'off' },
  };
}

/* ---------------------------------------------------------- the store */

const SERVER_SNAPSHOT = seedState();
let state: SessionState = SERVER_SNAPSHOT;
let hydrated = false;
const listeners = new Set<() => void>();

function load(): SessionState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seedState();
    const saved = JSON.parse(raw) as Partial<SessionState>;
    const base = seedState();
    return { ...base, ...saved, elder: { ...base.elder, ...saved.elder } };
  } catch {
    // corrupt or unavailable storage: fall back to the seed rather than crash
    return seedState();
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage full or blocked — the session keeps working in memory
  }
}

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  // First subscriber triggers hydration from disk. Doing it here (rather than
  // in an effect) keeps the snapshot stable for the rest of the render pass.
  if (!hydrated) {
    hydrated = true;
    state = load();
    applyTextScale();
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;

/**
 * 지금 이 순간의 상태. 화면 밖(이펙트·콜백)에서 값을 볼 때 쓴다.
 *
 * 훅이 주는 s 는 그 렌더 시점의 값이라, 마운트 직후 이펙트에서 읽으면 아직
 * 저장소가 복원되기 전 값일 수 있다. 곡 재생성 방지가 그래서 한 번 뚫렸다 —
 * songKey 가 아직 null 인 채로 판단해 매번 새로 만들었다.
 */
export function currentSession(): SessionState {
  return state;
}
const getServerSnapshot = () => SERVER_SNAPSHOT;

function applyTextScale() {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--text-scale', String(state.textScale));
}

function update(next: SessionState) {
  const scaleChanged = next.textScale !== state.textScale;
  state = next;
  if (scaleChanged) applyTextScale();
  persist();
  emit();
}

/* --------------------------------------------------------- public API */

export function SessionProvider({ children }: { children: ReactNode }) {
  // Kept as a component so screens can stay agnostic about how state is held;
  // the store itself is module-level, so there is no context value to thread.
  return <>{children}</>;
}

export function useSession() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const set = useCallback(
    <K extends keyof SessionState>(key: K, value: SessionState[K]) => {
      update({ ...state, [key]: value });
    },
    [],
  );

  const setStoryStatus = useCallback((id: string, status: StoryStatus) => {
    update({
      ...state,
      story: state.story.map((i) => (i.id === id ? { ...i, status } : i)),
    });
  }, []);

  const setConsent = useCallback((kind: ConsentKind, granted: boolean) => {
    const consents: Consents = {
      ...DEFAULT_CONSENTS,
      ...state.elder.consents,
      [kind]: granted ? 'granted' : 'withdrawn',
    };
    update({ ...state, elder: { ...state.elder, consents } });

    // 녹음 동의를 거두면 기기에 저장된 음성도 지운다. 동의를 거뒀는데 소리가
    // 남아 있으면 그 동의는 말뿐이다 — 철회는 화면 표시가 아니라 삭제다.
    if (kind === 'recording' && !granted) void forgetRecording();
  }, []);

  const toggleReaction = useCallback((id: ReactionId) => {
    update({
      ...state,
      reactions: state.reactions.includes(id)
        ? state.reactions.filter((r) => r !== id)
        : [...state.reactions, id],
    });
  }, []);

  const setContributionState = useCallback(
    (
      bucket: 'familyStories' | 'familyReplies',
      id: string,
      contributionState: FamilyContribution['state'],
    ) => {
      update({
        ...state,
        [bucket]: state[bucket].map((c) =>
          c.id === id ? { ...c, state: contributionState } : c,
        ),
      });
    },
    [],
  );

  const toggleChecklist = useCallback((key: string) => {
    update({
      ...state,
      checklist: { ...state.checklist, [key]: !state.checklist[key] },
    });
  }, []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    update(seedState());
  }, []);

  return useMemo(
    () => ({
      s,
      set,
      setStoryStatus,
      setConsent,
      toggleReaction,
      setContributionState,
      toggleChecklist,
      reset,
    }),
    [
      s,
      set,
      setStoryStatus,
      setConsent,
      toggleReaction,
      setContributionState,
      toggleChecklist,
      reset,
    ],
  );
}
