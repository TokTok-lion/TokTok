'use client';

import { useCallback, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { forgetRecording } from './recorder';
import { readParticipantRecord, writeConsent } from './repo';
import { deleteSong } from './songStore';
import {
  DEFAULT_CONSENTS,
  type Consents,
  type ConsentKind,
  type ConsentState,
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

/*
 * v1 은 버린다.
 *
 * v1 로 저장된 회기의 elder.consents 는 앞 어르신(또는 씨앗)에게서 승계된
 * 값이라 누구의 동의인지 알 수 없다. 그 상태를 복원하면 고친 의미가 없으므로
 * 키를 올려 끊고, 남은 v1 기록은 기기에서 지운다 — 출처를 모르는 동의는
 * 남겨 둘 이유가 없다.
 */
const KEY = 'toktok.session.v2';
const LEGACY_KEYS = ['toktok.session.v1'];

export type SessionState = {
  elder: Elder;
  /** 오늘 회기 주제 */
  topic: string;
  memoryCard: string | null;
  questionLevel: QuestionLevel;
  checklist: Record<string, boolean>;
  /**
   * 전사 한 줄.
   *
   * example 은 둘러보기용 씨앗 줄에만 붙는다. 화면이 '예시'라고 적고,
   * 진짜 전사가 들어오면 통째로 교체되므로 저절로 사라진다.
   *
   * speaker 는 화자 분리 결과다. 회기는 복지사가 묻고 어르신이 답하는
   * 대화라, 누가 한 말인지 갈라야 두 가지가 된다 — 사실 추출에 복지사
   * 질문이 섞여 들어가지 않고, 출처 '어르신 음성 0:42'가 진짜 그 대목을
   * 가리킨다. 모르면 없다.
   */
  transcript: {
    id: string;
    text: string;
    at: number;
    example?: true;
    speaker?: 'elder' | 'worker';
  }[];
  transcriptConfirmed: boolean;
  /**
   * 지금 전사가 어느 녹음에서 나왔는지 (recordingStore 의 savedAt).
   *
   * 자동 전사가 같은 녹음을 두 번 보내지 않게 하는 표다. 새로 녹음하면
   * savedAt 이 바뀌므로 그 녹음은 다시 옮긴다. 실패한 경우에도 표를 남겨,
   * 안 되는 녹음을 화면을 열 때마다 다시 보내지 않는다.
   */
  transcribedFrom: number | null;
  /**
   * 인터뷰를 실제로 시작한 시각.
   *
   * remoteStartedAt 과 다르다. 그쪽은 어르신을 고른 순간이라 서버 기록의
   * 회기 시작이고, 이쪽은 어르신과 마주 앉아 이야기를 듣기 시작한 순간이다.
   * 활동일지의 '진행 시간'은 이 값에서 나와야 한다 — 어르신 선택 시각으로
   * 재면 목록만 띄워 놓고 점심을 먹고 온 시간까지 들어간다. 실제로 하지도
   * 않은 86분이 기관 서식에 찍혔다.
   */
  interviewStartedAt: string | null;
  story: StoryItem[];
  /** 복지사가 사실 확인을 끝내고 가사로 넘긴 시점 (원칙 3 · 사람 검수) */
  storyConfirmed: boolean;
  lyricsApproved: boolean;
  style: MusicStyleId | null;
  songStatus: SongStatus;
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
    /*
     * 기억 카드는 오늘 주제와 이어져야 한다.
     *
     * 여기 오래 '놀이'(deck 이 그렇게 그렸다)가 들어 있었다. 그래서 시연을
     * 열면 인터뷰 화면이 '첫 직장과 첫 월급' 칩 아래에 "어릴 때는 뛰노는
     * 놀이가 좋으셨어요?"를 띄웠고, 바로 다음 화면의 전사·이야기(공장·첫
     * 월급·어머니께 신발)와도 이어지지 않았다. 한 화면 안에서 어긋나는
     * 것이라 시연 동선에서 제일 먼저 눈에 띈다.
     *
     * '가족' 카드가 이 회기의 실제 내용과 맞는다 — 씨앗 이야기가 첫 월급으로
     * 어머니께 신발을 사드린 기억이고, 그 카드의 보조 질문(누가 함께 계셨어요·
     * 그때 마음이 어떠셨어요)도 그 이야기를 이어 묻는다.
     */
    memoryCard: 'family',
    questionLevel: 1,
    // The demo opens mid-session: 준비·기억카드·인터뷰가 끝나고 전사 교정
    // 차례. Steps read in order rather than looking randomly scattered.
    checklist: { elder: true, cards: true, familyNote: true, mic: true },
    transcript: SEED_TRANSCRIPT,
    transcriptConfirmed: false,
    // 씨앗 전사는 어느 녹음에서도 나오지 않았다. 표를 비워 두면 기기에 녹음이
    // 생기는 순간 자동 전사가 그 녹음을 옮긴다.
    transcribedFrom: null,
    interviewStartedAt: null,
    story: SEED_STORY,
    storyConfirmed: false,
    lyrics: SEED_LYRICS,
    songKey: null,
    lyricsApproved: false,
    style: 'ballad',
    songStatus: 'draft',
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

/**
 * 기기에 남아 있는 씨앗 사본에 예시 표를 다시 붙인다.
 *
 * 예시 표(example)는 나중에 생겼는데, 저장본이 씨앗을 덮어쓴다. 그래서 그
 * 전에 앱을 한 번이라도 연 기기에는 표 없는 씨앗이 그대로 남아, 화면이
 * '예시'라고 적을 근거를 잃는다 — 고쳐서 배포했는데 정작 쓰던 사람 화면은
 * 그대로였다. 실제로 그렇게 두 번 헛걸음했다.
 *
 * 씨앗은 id 로 알아본다. 진짜로 뽑힌 항목은 fact-0-11·note-1723... 처럼
 * 다른 모양이라 여기 걸리지 않는다. 표만 얹고 복지사가 고친 글자는 두므로,
 * 손으로 다듬어 둔 문장이 씨앗 문장으로 되돌아가지 않는다.
 */
const SEED_STORY_IDS = new Set(SEED_STORY.map((i) => i.id));
const SEED_TRANSCRIPT_IDS = new Set(SEED_TRANSCRIPT.map((t) => t.id));

function remarkSeeds(saved: Partial<SessionState>): Partial<SessionState> {
  const out = { ...saved };
  if (Array.isArray(saved.story)) {
    out.story = saved.story.map((i) =>
      !i.example && SEED_STORY_IDS.has(i.id) ? { ...i, example: true as const } : i,
    );
  }
  if (Array.isArray(saved.transcript)) {
    out.transcript = saved.transcript.map((t) =>
      !t.example && SEED_TRANSCRIPT_IDS.has(t.id) ? { ...t, example: true as const } : t,
    );
  }
  return out;
}

function load(): SessionState {
  try {
    for (const old of LEGACY_KEYS) localStorage.removeItem(old);
    const raw = localStorage.getItem(KEY);
    if (!raw) return seedState();
    const saved = remarkSeeds(JSON.parse(raw) as Partial<SessionState>);
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

/**
 * 화면 밖에서 회기 값을 바꾼다.
 *
 * 훅의 set 은 그 컴포넌트가 살아 있는 동안만 쓸 수 있다. 전사처럼 몇 분씩
 * 걸리는 일은 시작한 화면이 이미 사라진 뒤에 끝난다 — 인터뷰를 마치고
 * 넘어가면서 시작한 전사가 전사 교정 화면에서 끝나는 식이다. 결과를 받을
 * 자리가 화면에 묶여 있으면 그 사이에 넘긴 사람은 결과를 잃는다.
 */
export function setSessionField<K extends keyof SessionState>(
  key: K,
  value: SessionState[K],
): void {
  update({ ...state, [key]: value });
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

/**
 * 어르신을 고를 때 화면이 아는 것 — 신원 표시뿐이다.
 *
 * 타입을 이렇게 좁혀 둔 이유가 있다. 예전에는 Elder 를 통째로 받았고, 호출부는
 * 손에 있던 앞 어르신 객체를 `...s.elder` 로 펼쳐서 이름표만 갈아 끼워 넘겼다.
 * 그래서 동의·선호·회피 주제가 조용히 따라왔다. 넘길 수 없게 만들면 다시
 * 그럴 수 없다.
 */
export type ElderIdentity = Pick<
  Elder,
  'id' | 'displayName' | 'honorific' | 'avatar' | 'stage' | 'nextTopic'
>;

/**
 * 어르신을 바꾸면 작업대를 비운다.
 *
 * 예전에는 elder 만 갈아 끼웠다. 그래서 김 어르신 인터뷰를 하고 박 어르신을
 * 고르면, 박 어르신 회기에 김 어르신의 전사·이야기·가사·녹음이 그대로
 * 남았다. 그 상태로 곡을 만들면 박 어르신의 노래에 다른 분의 생애가 들어간다.
 * 화면에는 아무 표시도 나지 않는다 — 그게 제일 나쁘다.
 *
 * 기기에 남은 원음성과 곡도 같이 지운다. 출처를 눌렀을 때 다른 어르신
 * 목소리가 나오면 그건 사고다.
 *
 * 시연 기기(participantId 가 없는 경우)는 씨앗 이야기를 그대로 둔다. 보여
 * 주려고 만든 화면이 빈 채로 뜨면 그건 그것대로 고장으로 보인다.
 */
export function beginSession(next: {
  elder: ElderIdentity;
  topic: string;
  participantId: string | null;
}): void {
  const seed = seedState();
  const live = next.participantId !== null;

  /*
   * 동의·선호·회피 주제는 회기가 아니라 사람에게 붙는 값이다.
   *
   * 여기가 가장 오래 새던 구멍이다. 작업대는 비웠는데 elder 객체는 통째로
   * 받아 넣었고, 그 안의 consents 가 앞 어르신(초기화 직후에는 씨앗 김○○의
   * '전부 허용')에게서 그대로 넘어왔다. 그 값 하나가 원음성 전사·사실 추출·
   * 가사·곡 생성의 게이트라, 동의한 적 없는 분의 목소리가 실제로 외부로
   * 나갈 수 있었다. 빠뜨린 것이 아니라 명시적으로 복사해 온 값이었다는 점이
   * 더 나쁘다 — 안 넘겼더라면 DEFAULT_CONSENTS 가 전부 unset 이라 저절로
   * 막혔을 자리다.
   *
   * 그래서 신원만 받고 나머지는 여기서 새로 만든다. 실제 기관 회기는 전부
   * unset 으로 시작하고, 서버에 남아 있는 이 어르신의 동의를 읽어 채운다.
   */
  const elder: Elder = live
    ? {
        ...next.elder,
        communication: [],
        musicPreferences: [],
        avoidTopics: [],
        consents: DEFAULT_CONSENTS,
      }
    : // 시연 기기는 씨앗 프로필 위에 고른 분의 이름표를 얹는다.
      { ...SEED_ELDER, ...next.elder };

  update({
    ...seed,
    // 사람이 고른 설정은 회기와 무관하므로 넘어간다.
    textScale: state.textScale,
    elder,
    topic: next.topic,
    remoteParticipantId: next.participantId,
    // 회기가 시작된 시각은 지금이다. 저장할 때 찍으면 시작과 끝이 같은
    // 순간이 되어, 서버에 남는 모든 회기의 소요시간이 0 이 된다.
    remoteStartedAt: new Date().toISOString(),
    ...(live
      ? {
          transcript: [],
          transcriptConfirmed: false,
          transcribedFrom: null,
          interviewStartedAt: null,
          story: [],
          storyConfirmed: false,
          lyrics: [],
          lyricsApproved: false,
          memoryCard: null,
          checklist: {},
          // 음악 스타일도 복지사가 고르는 값이다. 여기를 비우지 않아 씨앗의
          // 'ballad' 가 그대로 남았고, 스타일 화면에 들어가기도 전에 스타일·
          // 미리듣기·노래 완성 화면이 모두 '따뜻한 발라드'라고 말했다. 고른
          // 적 없는 것을 고른 것처럼 보이게 하는 값이라 회기와 함께 비운다.
          // (시연 기기는 씨앗 그대로 발라드로 시작한다.)
          style: null,
          reactions: [],
          reactionNote: '',
          logDraft: '',
          logSaved: false,
          wrapNote: '',
          familyStories: [],
          familyReplies: [],
          songKey: null,
          songStatus: 'draft' as SessionState['songStatus'],
          // 다음 추천 주제를 계산하는 코드는 아직 없다. 씨앗 문자열을 그대로
          // 두면 '가장 자랑스러운 순간'이 모든 어르신의 활동일지·CSV·인쇄본에
          // AI 추천인 척 박힌다. 없는 것은 비워 둔다.
          nextTopic: '',
        }
      : {}),
  });

  if (live) {
    void forgetRecording();
    void deleteSong();
    void hydrateElderRecord(next.participantId!);
  }
}

/**
 * 서버에 남아 있는 이 어르신의 동의와 선호를 뒤늦게 채운다.
 *
 * 회기는 이것을 기다리지 않는다. 못 읽으면 unset 인 채로 둔다 — 모르는 것은
 * 허용이 아니므로, 화면이 동의를 다시 받는 쪽이 맞다(hasConsent 가 unset 을
 * false 로 본다). 통신이 끊긴 센터에서 "서버를 못 읽었으니 일단 허용"은
 * 있어서는 안 되는 기본값이다.
 */
async function hydrateElderRecord(participantId: string): Promise<void> {
  const record = await readParticipantRecord(participantId);
  if (!record) return;
  // 읽는 사이에 다른 어르신으로 넘어갔으면 버린다. 늦게 도착한 응답이 남의
  // 동의를 덮어쓰는 것이야말로 이 함수가 막으려던 사고다.
  if (state.remoteParticipantId !== participantId) return;
  update({
    ...state,
    elder: {
      ...state.elder,
      consents: record.consents,
      communication: record.communication,
      musicPreferences: record.musicPreferences,
      avoidTopics: record.avoidTopics,
    },
  });
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
    const before: Consents = { ...DEFAULT_CONSENTS, ...state.elder.consents };
    const decision: ConsentState = granted ? 'granted' : 'withdrawn';
    update({
      ...state,
      elder: { ...state.elder, consents: { ...before, [kind]: decision } },
    });

    // 녹음 동의를 거두면 기기에 저장된 음성도 지운다. 동의를 거뒀는데 소리가
    // 남아 있으면 그 동의는 말뿐이다 — 철회는 화면 표시가 아니라 삭제다.
    if (kind === 'recording' && !granted) void forgetRecording();

    const participantId = state.remoteParticipantId;
    // 시연 기기에는 남길 곳이 없다. 기기 안에서만 켜졌다 꺼진다.
    if (participantId === null) return;

    /*
     * 실제 기관이면 어르신 기록에 남긴다. 여기까지 와야 스위치가 "이 기기"가
     * 아니라 "이 어르신"의 동의가 된다 — 남기지 않으면 어르신을 바꿨다 돌아온
     * 순간 서버에서 unset 을 다시 읽어 와 방금 받은 동의가 사라진다.
     */
    void writeConsent(participantId, kind, decision).then((r) => {
      if (r.ok) return;
      // 그 사이 어르신이 바뀌었으면 남의 스위치를 건드리지 않는다.
      if (state.remoteParticipantId !== participantId) return;
      // 그 사이 같은 항목을 다시 눌렀으면 그쪽 결정이 최신이다.
      if (state.elder.consents[kind] !== decision) return;
      // 철회는 기록에 실패해도 철회다. 허용은 반대다 — 기록이 남아야 허용이고,
      // 못 남긴 채 켜 두면 동의 기록 없이 외부 전송이 열린다. 그래서 허용만
      // 되돌린다. 스위치가 도로 꺼지는 것이 복지사에게 보이는 신호다.
      if (!granted) return;
      update({
        ...state,
        elder: {
          ...state.elder,
          consents: { ...state.elder.consents, [kind]: before[kind] },
        },
      });
    });
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
