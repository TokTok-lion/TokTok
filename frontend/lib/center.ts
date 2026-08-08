/**
 * Domain model for the 센터장 console (기능명세 · 기관, 82 functions).
 *
 * The console is deliberately a *management* surface, not a reading surface.
 * The spec's permission matrix gives the director "기본 미열람" on 원음성 and
 * "진행상태/필요 시 승인열람" on 전사·스토리 — so this console shows counts,
 * states and deadlines, and never the life story itself. Opening anything
 * sensitive requires a recorded reason (break-glass).
 */

/* ------------------------------------------------------------- roles */

export type StaffRole =
  | 'director' // 센터장
  | 'worker' // 사회복지사
  | 'assistant' // 세션 보조자
  | 'reviewer' // 개인정보·안전 검토자
  | 'finance'; // 재무 담당

export const ROLE_LABELS: Record<StaffRole, string> = {
  director: '센터장',
  worker: '사회복지사',
  assistant: '세션 보조자',
  reviewer: '개인정보·안전 검토자',
  finance: '재무 담당',
};

export const ROLE_SUMMARY: Record<StaffRole, string> = {
  director: '기관 설정·직원 권한·통계·청구·삭제 승인',
  worker: '담당 어르신 인터뷰·검수·세션·일지',
  assistant: '승인된 세션 진행 보조 (원음성·민감 스토리 편집 불가)',
  reviewer: '동의·공개·삭제·사고 검토 (센터 운영권과 분리)',
  finance: '요금·인보이스·결제 상태 (생애사·미디어 열람 불가)',
};

/** F-CM-STAFF-002 · 시스템 관리자는 기관에서 부여할 수 없다. */
export const ASSIGNABLE_ROLES: StaffRole[] = [
  'director',
  'worker',
  'assistant',
  'reviewer',
  'finance',
];

/** NFR-SEC-007 · 센터장·검토자와 민감 다운로드 권한은 MFA 대상. */
export const MFA_REQUIRED_ROLES: StaffRole[] = ['director', 'reviewer'];

export type Staff = {
  id: string;
  name: string;
  role: StaffRole;
  email: string;
  active: boolean;
  mfa: boolean;
  lastActiveDays: number;
  /** 담당 어르신 수 */
  assigned: number;
  /** 이번 주 세션 · 미확정 일지 · 검수 대기 — 집계일 뿐 점수가 아니다. */
  sessionsThisWeek: number;
  pendingLogs: number;
  pendingReviews: number;
};

/* --------------------------------------------------- pipeline board */

/** F-CM-DASH-003 · 수집→확인→가사→곡→세션→일지→가족전달 */
export type PipelineStage =
  | 'collect'
  | 'verify'
  | 'lyrics'
  | 'song'
  | 'session'
  | 'log'
  | 'delivered';

export const PIPELINE_STAGES: { id: PipelineStage; label: string }[] = [
  { id: 'collect', label: '수집' },
  { id: 'verify', label: '사실 확인' },
  { id: 'lyrics', label: '가사' },
  { id: 'song', label: '곡' },
  { id: 'session', label: '세션' },
  { id: 'log', label: '일지' },
  { id: 'delivered', label: '가족 전달' },
];

export type PipelineRow = {
  id: string;
  /** 가명 표기만 — 콘솔은 생애사 본문을 보여주지 않는다. */
  elder: string;
  worker: string;
  stage: PipelineStage;
  /** 며칠째 같은 단계에 머물러 있는지 */
  stalledDays: number;
  /** 동의 만료까지 남은 일수. null이면 해당 없음. */
  consentExpiresInDays: number | null;
};

/* ------------------------------------------------------- work queue */

export type TaskKind =
  | 'consentExpiring'
  | 'generationFailed'
  | 'logUnconfirmed'
  | 'deletionRequest'
  | 'familyPending';

export const TASK_LABELS: Record<TaskKind, string> = {
  consentExpiring: '동의 만료 예정',
  generationFailed: '생성 실패',
  logUnconfirmed: '일지 미확정',
  deletionRequest: '삭제 요청',
  familyPending: '가족 응답 대기',
};

export type CenterTask = {
  id: string;
  kind: TaskKind;
  subject: string;
  owner: string;
  /** 마감까지 남은 일수. 음수면 지난 것. */
  dueInDays: number;
};

/**
 * F-CM-DASH-002 · 자동 제재 금지.
 * 마감이 지나도 계정을 잠그거나 기능을 끄지 않는다. 정렬만 앞당긴다.
 */
export function sortTasks(tasks: CenterTask[]): CenterTask[] {
  return [...tasks].sort((a, b) => a.dueInDays - b.dueInDays);
}

/* ------------------------------------------------- deletion requests */

export type DeletionScope = 'item' | 'participant' | 'organization';

export const DELETION_SCOPE_LABELS: Record<DeletionScope, string> = {
  item: '자료 1건',
  participant: '어르신 전체 자료',
  organization: '기관 전체',
};

export type DeletionRequest = {
  id: string;
  scope: DeletionScope;
  subject: string;
  requestedBy: string;
  requestedByRole: StaffRole;
  requestedDaysAgo: number;
  /** 처리 기한(일). SLA는 기관이 정한다 (F-CM-POL-008). */
  slaDays: number;
  approvedBy: string | null;
  state: 'requested' | 'approved' | 'inProgress' | 'completedWithExceptions';
  /** 완전 삭제가 불가능한 항목 — 숨기지 않는다 (상태규칙 32). */
  exceptions: string[];
};

/** F-CM-DATA-004 · 고위험/기관 전체 삭제는 2인 승인. */
export function needsTwoPersonApproval(r: DeletionRequest): boolean {
  return r.scope !== 'item';
}

/**
 * F-CM-DATA-004 · 동일인이 요청하고 승인할 수 없다.
 * Returns the reason it is blocked, or null when the approval may proceed.
 */
export function blockApproval(
  r: DeletionRequest,
  approver: Staff,
): string | null {
  if (r.requestedBy === approver.name) {
    return '요청자와 승인자가 같을 수 없어요. 다른 승인권자에게 요청하세요.';
  }
  if (approver.role !== 'director' && approver.role !== 'reviewer') {
    return '삭제 승인은 센터장 또는 개인정보·안전 검토자만 할 수 있어요.';
  }
  if (!approver.mfa && needsTwoPersonApproval(r)) {
    return '고위험 삭제 승인에는 추가 인증(MFA)이 필요해요.';
  }
  return null;
}

/* ------------------------------------------------------- break-glass */

/**
 * F-CM-DATA-002 · 원음성·영상·삭제자료 접근은 사유를 남겨야 열린다.
 * 권한 매트릭스상 센터장의 원음성은 "기본 미열람".
 */
export type SensitiveResource = 'voice' | 'transcript' | 'video' | 'deleted';

export const SENSITIVE_LABELS: Record<SensitiveResource, string> = {
  voice: '원음성',
  transcript: '전사 본문',
  video: '세션 영상',
  deleted: '삭제 예정 자료',
};

export type AccessGrant = {
  resource: SensitiveResource;
  subject: string;
  reason: string;
  grantedAt: string;
  /** 단기 권한 — 분 단위로 만료된다. */
  expiresInMinutes: number;
};

export const MIN_REASON_LENGTH = 10;

export function validateAccessReason(reason: string): string | null {
  const r = reason.trim();
  if (r.length < MIN_REASON_LENGTH) {
    return `사유를 ${MIN_REASON_LENGTH}자 이상 적어 주세요. 이 기록은 감사로그에 남습니다.`;
  }
  return null;
}

/* ------------------------------------------------------- audit log */

export type AuditEntry = {
  id: string;
  at: string;
  actor: string;
  role: StaffRole;
  action: string;
  target: string;
  /** 사유가 필요한 행위였다면 남은 사유 */
  reason?: string;
};

/* ---------------------------------------------------------- policy */

export type RetentionKey = 'voice' | 'transcript' | 'photo' | 'song' | 'video' | 'log';

export const RETENTION_LABELS: Record<RetentionKey, string> = {
  voice: '원음성',
  transcript: '전사',
  photo: '사진',
  song: '곡',
  video: '세션 영상',
  log: '접근 로그',
};

/** F-CM-POL-003 · 무기한 금지. 유형별 서비스 상한/하한. */
export const RETENTION_BOUNDS: Record<RetentionKey, { min: number; max: number }> = {
  voice: { min: 30, max: 365 },
  transcript: { min: 30, max: 730 },
  photo: { min: 30, max: 730 },
  song: { min: 90, max: 1825 },
  video: { min: 30, max: 365 },
  log: { min: 180, max: 1095 },
};

export function clampRetention(key: RetentionKey, days: number): number {
  const { min, max } = RETENTION_BOUNDS[key];
  return Math.min(max, Math.max(min, days));
}

export type ConsentCode = 'C-01' | 'C-02' | 'C-03' | 'C-04' | 'C-05' | 'C-06' | 'C-07';

export type ConsentPolicy = {
  code: ConsentCode;
  name: string;
  /** 기관이 필수로 지정할 수 있는지 */
  canRequire: boolean;
  required: boolean;
  note: string;
};

/**
 * F-CM-POL-002 · 홍보 동의(C-05)를 필수로 만들 수 없다.
 * 서비스 이용 조건으로 강제 금지 (동의 카탈로그 C-05).
 */
export function canRequireConsent(code: ConsentCode): boolean {
  return code !== 'C-05';
}

/* ----------------------------------------------------- usage & cost */

export type UsageMetric = {
  key: string;
  label: string;
  used: number;
  quota: number;
  unit: string;
  /**
   * 이 항목이 한도를 넘어도 막아서는 안 되는 안전 기능인지.
   * F-CM-USE-003 · 서비스 핵심 안전기능 차단 금지.
   */
  safetyCritical: boolean;
};

export function quotaState(m: UsageMetric): 'ok' | 'warn' | 'over' {
  const pct = m.quota === 0 ? 0 : m.used / m.quota;
  if (pct >= 1) return 'over';
  if (pct >= 0.8) return 'warn';
  return 'ok';
}

/* -------------------------------------------------------------- ROI */

/**
 * F-CM-ANL-009 · 인건비 가정을 하드코딩하지 않는다. 센터가 입력한 값으로만
 * 계산하고, 화면에 가정을 함께 표시한다.
 */
export type RoiAssumptions = {
  /** 시간당 인건비(원) — 센터가 입력 */
  hourlyWage: number;
  /** 월 회기 수 */
  sessionsPerMonth: number;
  /** 서비스 전 회기당 준비시간(분) — 기준선 실측 */
  baselinePrepMin: number;
  /** 서비스 후 회기당 준비시간(분) — 실측 */
  currentPrepMin: number;
  /** 서비스 전 일지 작성시간(분) */
  baselineLogMin: number;
  /** 서비스 후 일지 작성시간(분) */
  currentLogMin: number;
  /** 월 구독료(원) */
  monthlyFee: number;
  /** 월 AI 직접비(원) */
  monthlyAiCost: number;
  /** 기준선 표본 수 — 작으면 경고한다 */
  baselineSampleSize: number;
};

export type RoiResult = {
  minutesSavedPerSession: number;
  hoursSavedPerMonth: number;
  laborValue: number;
  totalCost: number;
  net: number;
  /** F-CM-ANL-006 · 소표본 경고 */
  smallSample: boolean;
};

export const SMALL_SAMPLE_THRESHOLD = 20;

export function computeRoi(a: RoiAssumptions): RoiResult {
  const perSession =
    a.baselinePrepMin - a.currentPrepMin + (a.baselineLogMin - a.currentLogMin);
  const hours = (perSession * a.sessionsPerMonth) / 60;
  const laborValue = hours * a.hourlyWage;
  const totalCost = a.monthlyFee + a.monthlyAiCost;
  return {
    minutesSavedPerSession: perSession,
    hoursSavedPerMonth: hours,
    laborValue,
    totalCost,
    net: laborValue - totalCost,
    smallSample: a.baselineSampleSize < SMALL_SAMPLE_THRESHOLD,
  };
}

export function formatWon(n: number): string {
  return `${Math.round(n).toLocaleString('ko-KR')}원`;
}

/* ---------------------------------------------------- session stats */

/** F-CM-ANL-004 · 중단(STOPPED)을 실패로 낙인찍지 않는다. */
export type SessionOutcome = {
  completed: number;
  stopped: number;
  cancelled: number;
  planned: number;
};
