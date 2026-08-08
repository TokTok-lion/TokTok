import type {
  AuditEntry,
  CenterTask,
  ConsentPolicy,
  DeletionRequest,
  PipelineRow,
  RetentionKey,
  RoiAssumptions,
  SessionOutcome,
  Staff,
  UsageMetric,
} from './center';

/**
 * Sample data for the 센터장 console.
 *
 * F-CM-DASH-008 requires operating figures to be labelled as samples until a
 * pilot supplies real measurements, so every screen that reads from here shows
 * the 샘플 데이터 badge. Scale matches the first customer: a day-care centre of
 * 30 or fewer, roughly 5 staff.
 */

export const CENTER = {
  name: '청주 햇살주야간보호센터',
  type: '주야간보호',
  capacity: 28,
  activeElders: 22,
  contact: '043-000-0000',
  hours: '평일 08:00 – 18:00',
  holidays: '주말 · 법정공휴일',
  contractUntil: '2026-12-31',
};

export const STAFF: Staff[] = [
  {
    id: 'st-1',
    name: '이정은',
    role: 'director',
    email: 'director@example.kr',
    active: true,
    mfa: true,
    lastActiveDays: 0,
    assigned: 0,
    sessionsThisWeek: 2,
    pendingLogs: 0,
    pendingReviews: 3,
  },
  {
    id: 'st-2',
    name: '박서준',
    role: 'worker',
    email: 'worker1@example.kr',
    active: true,
    mfa: false,
    lastActiveDays: 0,
    assigned: 8,
    sessionsThisWeek: 6,
    pendingLogs: 2,
    pendingReviews: 1,
  },
  {
    id: 'st-3',
    name: '김하늘',
    role: 'worker',
    email: 'worker2@example.kr',
    active: true,
    mfa: false,
    lastActiveDays: 1,
    assigned: 7,
    sessionsThisWeek: 5,
    pendingLogs: 1,
    pendingReviews: 0,
  },
  {
    id: 'st-4',
    name: '최민서',
    role: 'assistant',
    email: 'assist@example.kr',
    active: true,
    mfa: false,
    lastActiveDays: 2,
    assigned: 0,
    sessionsThisWeek: 4,
    pendingLogs: 0,
    pendingReviews: 0,
  },
  {
    id: 'st-5',
    name: '한지우',
    role: 'reviewer',
    email: 'privacy@example.kr',
    active: true,
    mfa: true,
    lastActiveDays: 5,
    assigned: 0,
    sessionsThisWeek: 0,
    pendingLogs: 0,
    pendingReviews: 2,
  },
  {
    id: 'st-6',
    name: '오세영',
    role: 'worker',
    email: 'worker3@example.kr',
    active: false,
    mfa: false,
    lastActiveDays: 96,
    assigned: 0,
    sessionsThisWeek: 0,
    pendingLogs: 0,
    pendingReviews: 0,
  },
];

export const PIPELINE: PipelineRow[] = [
  { id: 'p1', elder: '김○○', worker: '박서준', stage: 'log', stalledDays: 1, consentExpiresInDays: 12 },
  { id: 'p2', elder: '박○○', worker: '박서준', stage: 'song', stalledDays: 0, consentExpiresInDays: null },
  { id: 'p3', elder: '이○○', worker: '김하늘', stage: 'verify', stalledDays: 6, consentExpiresInDays: 4 },
  { id: 'p4', elder: '정○○', worker: '김하늘', stage: 'lyrics', stalledDays: 2, consentExpiresInDays: null },
  { id: 'p5', elder: '한○○', worker: '박서준', stage: 'delivered', stalledDays: 0, consentExpiresInDays: 45 },
  { id: 'p6', elder: '조○○', worker: '김하늘', stage: 'collect', stalledDays: 9, consentExpiresInDays: null },
  { id: 'p7', elder: '윤○○', worker: '박서준', stage: 'session', stalledDays: 1, consentExpiresInDays: 21 },
  { id: 'p8', elder: '장○○', worker: '김하늘', stage: 'verify', stalledDays: 3, consentExpiresInDays: null },
];

export const TASKS: CenterTask[] = [
  { id: 't1', kind: 'consentExpiring', subject: '이○○ 녹음·전사 동의', owner: '김하늘', dueInDays: 4 },
  { id: 't2', kind: 'logUnconfirmed', subject: '김○○ 5월 21일 활동일지', owner: '박서준', dueInDays: -1 },
  { id: 't3', kind: 'deletionRequest', subject: '조○○ 사진 3건 삭제 요청', owner: '한지우', dueInDays: 2 },
  { id: 't4', kind: 'generationFailed', subject: '정○○ 곡 생성 실패 (제공자 오류)', owner: '김하늘', dueInDays: 0 },
  { id: 't5', kind: 'familyPending', subject: '한○○ 가족 미션 응답 대기 2건', owner: '박서준', dueInDays: 3 },
  { id: 't6', kind: 'logUnconfirmed', subject: '박○○ 5월 19일 활동일지', owner: '박서준', dueInDays: 1 },
];

export const SESSION_OUTCOME: SessionOutcome = {
  completed: 41,
  stopped: 3,
  cancelled: 2,
  planned: 48,
};

export const DELETION_REQUESTS: DeletionRequest[] = [
  {
    id: 'd1',
    scope: 'item',
    subject: '조○○ 가족 제보 사진 3건',
    requestedBy: '김하늘',
    requestedByRole: 'worker',
    requestedDaysAgo: 1,
    slaDays: 7,
    approvedBy: null,
    state: 'requested',
    exceptions: [],
  },
  {
    id: 'd2',
    scope: 'participant',
    subject: '오○○ 어르신 전체 자료 (퇴소)',
    requestedBy: '박서준',
    requestedByRole: 'worker',
    requestedDaysAgo: 3,
    slaDays: 30,
    approvedBy: null,
    state: 'requested',
    exceptions: [],
  },
  {
    // 센터장 본인이 올린 요청 — 같은 사람이 승인할 수 없다는 규칙을 화면에서
    // 그대로 보여 주기 위한 사례 (F-CM-DATA-004).
    id: 'd4',
    scope: 'organization',
    subject: '기관 전체 시연 데이터 삭제',
    requestedBy: '이정은',
    requestedByRole: 'director',
    requestedDaysAgo: 0,
    slaDays: 14,
    approvedBy: null,
    state: 'requested',
    exceptions: [],
  },
  {
    id: 'd3',
    scope: 'item',
    subject: '한○○ 원음성 1건 (본인 철회)',
    requestedBy: '한지우',
    requestedByRole: 'reviewer',
    requestedDaysAgo: 9,
    slaDays: 7,
    approvedBy: '이정은',
    state: 'completedWithExceptions',
    exceptions: [
      '야간 백업본은 보존주기(30일)가 지나야 순차 삭제됩니다.',
      '가족이 이미 내려받은 사본은 회수할 수 없습니다.',
    ],
  },
];

export const AUDIT: AuditEntry[] = [
  { id: 'a1', at: '2025-05-21 16:42', actor: '박서준', role: 'worker', action: '활동일지 확정', target: '김○○ 5/21' },
  { id: 'a2', at: '2025-05-21 15:10', actor: '이정은', role: 'director', action: '원음성 열람', target: '한○○ 5/14', reason: '삭제 요청 범위 확인을 위해 열람' },
  { id: 'a3', at: '2025-05-21 11:03', actor: '김하늘', role: 'worker', action: '가사 승인', target: '정○○' },
  { id: 'a4', at: '2025-05-20 18:20', actor: '한지우', role: 'reviewer', action: '공유링크 만료', target: '조○○ 가족 링크 2건' },
  { id: 'a5', at: '2025-05-20 09:55', actor: '이정은', role: 'director', action: '직원 권한 변경', target: '최민서 · 세션 보조자' },
  { id: 'a6', at: '2025-05-19 14:31', actor: '박서준', role: 'worker', action: '가족 초대 발송', target: '한○○ 가족 3명' },
];

export const USAGE: UsageMetric[] = [
  { key: 'stt', label: '전사(STT)', used: 412, quota: 600, unit: '분', safetyCritical: false },
  { key: 'llm', label: 'LLM 호출', used: 1840, quota: 3000, unit: '회', safetyCritical: false },
  { key: 'song', label: '곡 생성', used: 26, quota: 30, unit: '곡', safetyCritical: false },
  { key: 'storage', label: '스토리지', used: 38, quota: 50, unit: 'GB', safetyCritical: false },
  { key: 'consent', label: '동의·철회 처리', used: 74, quota: 0, unit: '건', safetyCritical: true },
  { key: 'deletion', label: '삭제 요청 처리', used: 6, quota: 0, unit: '건', safetyCritical: true },
];

export const AI_COST = [
  { label: '전사(STT)', amount: 38_400 },
  { label: 'LLM(구조화·가사)', amount: 52_100 },
  { label: '음악 생성', amount: 96_800 },
  { label: '스토리지·전송', amount: 14_200 },
];

export const ROI_DEFAULTS: RoiAssumptions = {
  hourlyWage: 12_000,
  sessionsPerMonth: 48,
  baselinePrepMin: 35,
  currentPrepMin: 18,
  baselineLogMin: 22,
  currentLogMin: 9,
  monthlyFee: 190_000,
  monthlyAiCost: 201_500,
  baselineSampleSize: 12,
};

export const RETENTION_DEFAULTS: Record<RetentionKey, number> = {
  voice: 180,
  transcript: 365,
  photo: 365,
  song: 730,
  video: 90,
  log: 365,
};

export const CONSENT_POLICIES: ConsentPolicy[] = [
  { code: 'C-01', name: '녹음·전사', canRequire: true, required: true, note: '거부 시 카드+복지사 메모로 진행' },
  { code: 'C-02', name: '외부 AI 전송', canRequire: true, required: true, note: '국외이전 고지 포함. 거부 시 수동 작성' },
  { code: 'C-03', name: '시설 내 재생', canRequire: true, required: false, note: '기본값은 개인 감상' },
  { code: 'C-04', name: '가족 공유', canRequire: true, required: false, note: '가족 미참여도 서비스 완결' },
  { code: 'C-05', name: '홍보 공개', canRequire: false, required: false, note: '이용 조건으로 강제할 수 없음' },
  { code: 'C-06', name: '사진·영상 촬영', canRequire: true, required: false, note: '영상은 기본 off' },
  { code: 'C-07', name: '가족 자료 제보', canRequire: true, required: false, note: '제보는 확인 전 사실이 아님' },
];

export const RECIPES = [
  { id: 'r1', title: '고향과 명절', origin: '공식', uses: 34, updated: '2025-04-02', cards: 8 },
  { id: 'r2', title: '첫 직장과 첫 월급', origin: '공식', uses: 51, updated: '2025-03-18', cards: 7 },
  { id: 'r3', title: '충북 지역 · 옛 시장 이야기', origin: '기관', uses: 12, updated: '2025-05-09', cards: 6 },
  { id: 'r4', title: '봄나들이 회상', origin: '기관', uses: 5, updated: '2025-05-16', cards: 5 },
];

export const PROVIDER_STATUS = [
  { name: '전사(STT) 제공자', state: 'ok' as const, note: '정상' },
  { name: 'LLM 제공자', state: 'ok' as const, note: '정상' },
  { name: '음악 생성 제공자', state: 'degraded' as const, note: '생성 지연 (평균 4분 → 11분)' },
  { name: '결제 대행사', state: 'ok' as const, note: '정상' },
];

export const TICKETS = [
  { id: 'k1', title: '태블릿에서 녹음 버튼이 눌리지 않아요', by: '김하늘', state: '처리 중', days: 1 },
  { id: 'k2', title: '활동일지 내보내기 서식 문의', by: '박서준', state: '답변 완료', days: 4 },
];

export const NOTICES = [
  { id: 'n1', title: '5월 27일(화) 정기 점검 안내', at: '2025-05-20', by: '이정은' },
  { id: 'n2', title: '개인정보 교육 이수 기한 안내', at: '2025-05-12', by: '이정은' },
];

export const TRAINING = [
  { name: '박서준', onboarding: true, privacy: true, safety: false },
  { name: '김하늘', onboarding: true, privacy: true, safety: true },
  { name: '최민서', onboarding: true, privacy: false, safety: false },
  { name: '한지우', onboarding: true, privacy: true, safety: true },
];

/** F-CM-DATA-007 · 데이터 품질 점검 규칙 실행 결과. */
export const QUALITY_ISSUES = [
  { id: 'q1', rule: '출처 없는 사실', count: 0, severity: 'ok' as const },
  { id: 'q2', rule: '미승인 곡 공유', count: 0, severity: 'ok' as const },
  { id: 'q3', rule: '누락된 동의', count: 1, severity: 'warn' as const },
  { id: 'q4', rule: '고아 파일(연결 없는 미디어)', count: 4, severity: 'warn' as const },
];

export const FAMILY_ENGAGEMENT = {
  invited: 14,
  responded: 9,
  /** 가족이 없거나 연락이 닿지 않는 어르신 — 참여율 분모에서 제외한다. */
  notApplicable: 6,
};
