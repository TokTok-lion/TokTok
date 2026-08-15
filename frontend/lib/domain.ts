/**
 * Domain model for 똑똑 TokTok · 생애여정 음악지도.
 *
 * The types and guards here encode the product invariants that the
 * functional spec (v1.6) marks P0 — the ones that must hold before any
 * feature is allowed to work:
 *
 *   원칙 2 · 검증된 사실만 생성  every fact carries a source
 *   원칙 3 · 사람 검수 필수      AI output is a draft until a human approves
 *   원칙 1 · 본인 최종 통제      the elder decides what is true and what is shared
 *   원칙 4 · 목적별 분리 동의    consent is per-purpose, never bundled
 *   NFR-AI-003                  UNVERIFIED/CONFLICT/EXCLUDED never reach lyrics
 */

// ---------------------------------------------------------------- consent

/** The five consents the spec requires to be collected independently. */
export type ConsentKind =
  | 'recording' // 녹음·전사
  | 'externalAi' // 외부 AI 전송
  | 'facilityPlay' // 시설 재생
  | 'familyShare' // 가족 공유
  | 'promotion'; // 홍보 공개

export type ConsentState = 'granted' | 'denied' | 'withdrawn' | 'unset';

export const CONSENT_LABELS: Record<ConsentKind, string> = {
  recording: '녹음·전사',
  externalAi: '외부 AI 전송',
  facilityPlay: '시설 재생',
  familyShare: '가족 공유',
  promotion: '홍보 공개',
};

export type Consents = Record<ConsentKind, ConsentState>;

export const DEFAULT_CONSENTS: Consents = {
  recording: 'unset',
  externalAi: 'unset',
  facilityPlay: 'unset',
  familyShare: 'unset',
  promotion: 'unset',
};

export function hasConsent(c: Consents, kind: ConsentKind): boolean {
  return c[kind] === 'granted';
}

/**
 * 원칙 4 + F-SW-CONS-009: refusing a consent must never dead-end the user.
 * Each denial has a documented alternative path.
 */
export const CONSENT_FALLBACK: Record<ConsentKind, string> = {
  recording: '녹음 없이 복지사가 어르신 말씀을 받아 적어 기록할 수 있어요.',
  externalAi: '자동 정리 없이 복지사가 직접 이야기와 가사를 작성할 수 있어요.',
  facilityPlay: '어르신 개인 감상으로만 들을 수 있어요.',
  familyShare: '가족 공유 없이 어르신과 복지사만 확인할 수 있어요.',
  promotion: '외부 공개 없이 서비스 안에서만 사용해요.',
};

// ----------------------------------------------------------------- source

/** Where a recorded fact came from. 출처 없는 사실은 존재할 수 없다. */
export type SourceKind =
  | 'voice' // 어르신 음성 (타임스탬프 포함)
  | 'card' // 기억 카드 응답
  | 'staffNote' // 녹음 거부 시 복지사 수기 기록
  | 'family'; // 가족 제보

export type Source = {
  kind: SourceKind;
  /** 음성 출처의 재생 위치(초). voice 일 때만 존재. */
  at?: number;
  /** 사람이 읽을 수 있는 출처 설명 — 화면에 그대로 노출된다. */
  label: string;
};

export const SOURCE_LABELS: Record<SourceKind, string> = {
  voice: '어르신 음성',
  card: '기억 카드',
  staffNote: '복지사 기록',
  family: '가족 제보',
};

// ------------------------------------------------------------------ story

/**
 * 이야기 정리(SW-STORY) 화면의 세 갈래.
 * VERIFIED 만 가사 생성 입력으로 넘어간다.
 */
export type StoryStatus =
  | 'verified' // 확인된 이야기 — 어르신이 맞다고 확인
  | 'unverified' // 확인 필요 — 되물어야 하는 항목
  | 'excluded'; // 이번 곡에서 제외 — 어르신이 빼달라고 함

export type StoryItem = {
  id: string;
  text: string;
  status: StoryStatus;
  /** 비어 있을 수 없다. assertStoryIntegrity 가 강제한다. */
  sources: Source[];
  /** unverified 인 경우 어르신에게 되물을 질문. */
  followUp?: string;
  /**
   * 둘러보기용 예시 항목인가.
   *
   * 씨앗 이야기는 화면 모양을 보여 주려고 넣어 둔 것인데, 실제 추출 결과와
   * 생김새가 똑같았다. '출처 · 어르신 음성 0:42'까지 붙어 있어서, 직접
   * 녹음해 본 사람이 "내 녹음이 반영된 건가?" 하고 물었다. 실제로 그런
   * 질문을 받았다 — 화면이 구별을 안 해 주면 만든 사람도 헷갈린다.
   *
   * 이 표가 붙은 항목은 화면에 '예시'라고 적히고, 진짜 전사가 들어오는
   * 순간 목록에서 빠진다.
   */
  example?: true;
};

export const STORY_STATUS_LABELS: Record<StoryStatus, string> = {
  verified: '확인된 이야기',
  unverified: '확인 필요',
  excluded: '이번 곡에서 제외',
};

/**
 * NFR-AI-002 (출처 완전성) + NFR-AI-003 (미확인 차단).
 * 가사 생성 입력을 만드는 유일한 통로. 여기를 거치지 않고는
 * 어떤 문장도 가사로 갈 수 없다.
 */
export function lyricInputs(items: StoryItem[]): StoryItem[] {
  return items.filter((i) => i.status === 'verified' && i.sources.length > 0);
}

/** 개발 중 출처 없는 항목이 새어 들어오는 것을 잡는 가드. */
export function assertStoryIntegrity(items: StoryItem[]): void {
  const orphan = items.find((i) => i.sources.length === 0);
  if (orphan) {
    throw new Error(
      `출처 없는 이야기 항목이 있습니다 (id=${orphan.id}). ` +
        '모든 사실에는 음성·카드·복지사 기록·가족 제보 중 하나가 연결되어야 합니다.',
    );
  }
}

// ----------------------------------------------------------------- lyrics

/** 원칙 3: AI 결과는 초안이며, 사람이 승인해야 확정된다. */
export type ReviewState = 'draft' | 'approved';

export type LyricSection = {
  /** 1절 · 후렴 처럼 화면에 그대로 보이는 라벨 */
  label: string;
  tone: 'verse' | 'chorus';
  lines: string[];
};

export type Lyrics = {
  sections: LyricSection[];
  state: ReviewState;
  /** 이 가사가 어떤 이야기에서 나왔는지 — 화면에 근거로 표시된다. */
  basedOn: string[];
};

// ------------------------------------------------------------------ music

export type MusicStyleId = 'folkTrad' | 'folkBright' | 'ballad' | 'trot';

export type MusicStyle = {
  id: MusicStyleId;
  name: string;
  description: string;
  art: string;
};

/**
 * 제품 경계: 특정 실존 가수·곡 모사는 스타일 목록에 존재하지 않는다.
 * (원칙 14 · NFR-AI-007)
 *
 * description 은 스타일 고르는 화면에 그대로 나온다(app/session/style).
 * 그래서 여기 적힌 말은 실제로 만들어지는 곡과 같아야 한다.
 *
 * 예전에는 넷 다 '~ 스타일'로 끝나고 빠르기를 말하지 않았다. 밝은 포크풍은
 * '경쾌한'이라고 적혀 있었는데, 그때 프롬프트에는 빠르기가 아예 없어서 정말
 * 경쾌한 — 따라 부르기엔 빠른 — 곡이 나왔다. 이제 넷 다 분당 64~78박으로
 * 묶었으므로(lib/providers/music-apiframe.ts 의 STYLE 참고) 설명도 그 사실을
 * 말한다. 빠르기 숫자를 바꾸면 이 줄들도 같이 바꿔야 한다.
 *
 * 화면 칸이 좁아 두 줄이다(\n 은 whitespace-pre-line 으로 그대로 그려진다).
 * 첫 줄은 분위기, 둘째 줄은 갈래와 빠르기.
 */
export const MUSIC_STYLES: MusicStyle[] = [
  {
    id: 'folkTrad',
    name: '민요풍',
    description: '정겹고 구수한\n느긋한 전통 민요',
    art: 'style_folk_trad',
  },
  {
    id: 'folkBright',
    name: '밝은 포크풍',
    description: '따뜻하고 밝은\n걷는 빠르기의 포크',
    art: 'style_folk_bright',
  },
  {
    id: 'ballad',
    name: '따뜻한 발라드',
    description: '부드럽고 감성적인\n가장 느린 발라드',
    art: 'style_ballad',
  },
  {
    id: 'trot',
    name: '느린 트로트',
    description: '애절하고 정감 있는\n천천히 부르는 트로트',
    art: 'style_trot',
  },
];

export type SongStatus =
  | 'draft' // 기억 카드까지만 진행
  | 'lyricsReview' // 가사 검수 중
  | 'generating' // 곡 생성 중
  | 'ready' // 미리듣기 대기
  | 'complete'; // 확정된 곡

export const SONG_STATUS_LABELS: Record<SongStatus, string> = {
  draft: '노래 생성 전',
  lyricsReview: '가사 검수 중',
  generating: '곡 생성 중',
  ready: '들어보기 준비됨',
  complete: '완료',
};

// ------------------------------------------------------- family & session

export type FamilyMissionKind = 'photo' | 'note' | 'voice';

export const FAMILY_MISSION_LABELS: Record<FamilyMissionKind, string> = {
  photo: '고향 사진 보내기',
  note: '짧은 응원 글 남기기',
  voice: '축하 음성 보내기',
};

/** 가족 제보는 자동으로 사실이 되지 않는다 (원칙 2, F-SW-FAM). */
export type FamilyContributionState = 'pending' | 'accepted' | 'held';

export type FamilyContribution = {
  id: string;
  kind: FamilyMissionKind | 'quote';
  from: string;
  title: string;
  body?: string;
  art?: string;
  durationSec?: number;
  state: FamilyContributionState;
};

/**
 * 관찰 반응(F-SW-RPT). 복지사가 눈으로 본 행동만 기록한다 —
 * 정서·인지 상태를 추정하는 항목은 의도적으로 존재하지 않는다 (원칙 7).
 */
export type ReactionId =
  | 'speak'
  | 'smile'
  | 'eyeContact'
  | 'singAlong'
  | 'clap'
  | 'rest'
  // 아래 넷은 자주성·공생성을 보려고 나중에 더한 것이다 (설명은 REACTIONS 위).
  | 'lead'
  | 'choose'
  | 'toOther'
  | 'helpOther';

/**
 * 이 반응이 무엇을 보여 주는가.
 *
 * ── 왜 축을 붙였나
 *
 * 기획팀장님이 "목소리 톤이나 감정을 분석해서 반영할 수 있는지" 물으셨다.
 * 그건 만들지 않는다 — 이 서비스는 관찰된 행동만 기록하고 감정을 추론하지
 * 않는다(원칙 4). 음성으로 기분을 판정하면 비의료인이 만든 심리 평가가 기관
 * 공식 기록에 들어가고, 틀렸을 때 그 기록으로 사람이 판단하게 된다.
 *
 * 대신 셀 수 있는 것을 센다. 관장님이 복지관의 평가 축으로 드신 두 가지다.
 *
 *   자주성  스스로 하려는 힘. 먼저 말을 꺼내셨는가, 스스로 고르셨는가.
 *   공생성  남과 더불어 살려는 마음. 다른 분 이야기에 반응하셨는가.
 *
 * 둘 다 추론이 아니라 **본 것**이다. 복지사가 그 자리에서 보고 체크한다.
 * 점수·등급·순위는 만들지 않는다 — 개수만 남긴다.
 */
export type ReactionAxis = 'self' | 'together' | 'other';

export const REACTION_AXIS_LABEL: Record<ReactionAxis, string> = {
  self: '자주성 — 스스로 하려는 모습',
  together: '공생성 — 남과 더불어 하는 모습',
  other: '그 밖에 보인 모습',
};

export const REACTIONS: {
  id: ReactionId;
  label: string;
  art: string;
  axis: ReactionAxis;
  /** 무엇을 보면 체크하는지. 복지사마다 다르게 세면 숫자가 뜻을 잃는다. */
  when: string;
}[] = [
  {
    id: 'lead',
    label: '먼저 이야기 꺼냄',
    art: 'react_speak',
    axis: 'self',
    when: '여쭙기 전에 어르신이 먼저 말씀을 시작하셨을 때',
  },
  {
    id: 'speak',
    label: '자발적 답변',
    art: 'react_speak',
    axis: 'self',
    when: '한 마디로 끝내지 않고 이어서 말씀하셨을 때',
  },
  {
    id: 'choose',
    label: '스스로 고르심',
    art: 'react_eye_contact',
    axis: 'self',
    when: '주제·노래 분위기 같은 것을 어르신이 정하셨을 때',
  },
  {
    id: 'toOther',
    label: '다른 분 이야기에 반응',
    art: 'react_eye_contact',
    axis: 'together',
    when: '다른 어르신 말씀에 맞장구치거나 되물으셨을 때',
  },
  {
    id: 'helpOther',
    label: '다른 분을 거드심',
    art: 'react_clap',
    axis: 'together',
    when: '말씀을 도와드리거나 손을 잡아 주시는 등 거드셨을 때',
  },
  {
    id: 'singAlong',
    label: '노래 따라부름',
    art: 'react_sing_along',
    axis: 'together',
    when: '한 소절이라도 함께 부르셨을 때',
  },
  {
    id: 'smile',
    label: '미소',
    art: 'react_smile',
    axis: 'other',
    when: '보고 웃으셨을 때 (기분을 짐작하지 않고 본 것만)',
  },
  {
    id: 'eyeContact',
    label: '눈맞춤',
    art: 'react_eye_contact',
    axis: 'other',
    when: '눈을 마주치며 들으셨을 때',
  },
  {
    id: 'clap',
    label: '손동작 참여',
    art: 'react_clap',
    axis: 'other',
    when: '손뼉·손짓으로 함께하셨을 때',
  },
  {
    id: 'rest',
    label: '쉬고 싶음',
    art: 'react_rest',
    axis: 'other',
    when: '그만하고 싶다는 뜻을 보이셨을 때 — 그 자리에서 멈춥니다',
  },
];

/** 질문 단계 — 말문이 트이지 않을 때 선택형부터 시작한다. */
export type QuestionLevel = 1 | 2 | 3;

/**
 * 오늘 무엇을 여쭐 것인가.
 *
 * 회상만 있던 자리에 강점이 생겼다. 장수복지관 관장님 면담에서 나온 지적이다 —
 * "AI로 노래 만들기가 아니라 어르신들에게 삶의 자신감을 부여해 줘야 한다".
 * 복지관이 재는 것도 회기 수가 아니라 자주성과 공생성이라, 지난 이야기만
 * 물어서는 그 축에 닿지 않는다.
 *
 * 단계(선택형·단답형·회상형)와는 다른 축이다. 단계는 **어떻게** 묻느냐,
 * 갈래는 **무엇을** 묻느냐다. 둘은 곱해진다.
 */
export type InterviewTrack = 'recall' | 'strength';

export const INTERVIEW_TRACKS: {
  id: InterviewTrack;
  name: string;
  what: string;
  example: string;
}[] = [
  {
    id: 'recall',
    name: '지난 이야기',
    what: '살아오신 이야기를 여쭙고 노래로 남깁니다',
    example: '그 시절에 제일 기억에 남는 날이 언제세요?',
  },
  {
    id: 'strength',
    name: '지금의 강점',
    what: '지금도 잘하시는 것과 하고 싶으신 것을 여쭙습니다',
    example: '지금도 남들보다 잘하신다 싶은 게 있으세요?',
  },
];

export const QUESTION_LEVELS: {
  level: QuestionLevel;
  name: string;
  example: string;
  recommended?: boolean;
}[] = [
  {
    level: 1,
    name: '선택형',
    example: '산과 바다 중 어디가 더 기억나세요?',
    recommended: true,
  },
  { level: 2, name: '단답형', example: '그 장소는 어디였나요?' },
  { level: 3, name: '회상형', example: '그곳에서 있었던 일을 이야기해 주세요.' },
];

// ------------------------------------------------------------------ elder

export type Elder = {
  id: string;
  /** 화면에는 항상 가명 표기 (김○○). 최소수집 원칙. */
  displayName: string;
  honorific: string;
  avatar: string;
  stage: number;
  nextTopic: string;
  communication: string[];
  musicPreferences: string[];
  /** 질문·가사 생성에서 제외할 주제 (F-SW-PTC-009). */
  avoidTopics: string[];
  consents: Consents;
};

// ------------------------------------------------------------- formatting

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}
