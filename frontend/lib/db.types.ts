/**
 * backend/supabase/migrations/0001_init.sql 의 테이블을 그대로 옮긴 타입.
 *
 * supabase gen types 로 뽑는 것이 정석이지만, 그러려면 DB 접속 문자열이
 * 있어야 한다. 그 값은 이 저장소에 두지 않기로 했으므로 손으로 맞춰 둔다.
 * 스키마를 고치면 이 파일도 같이 고쳐야 한다 — 어긋나면 타입은 통과하는데
 * 런타임에서 조용히 틀린다.
 */

export type StaffRole = 'director' | 'worker' | 'assistant' | 'reviewer' | 'finance';
export type ConsentKind =
  | 'recording'
  | 'external_ai'
  | 'facility_play'
  | 'family_share'
  | 'promotion';
export type ConsentState = 'granted' | 'denied' | 'withdrawn' | 'unset';
export type SessionStatus = 'planned' | 'running' | 'done' | 'stopped' | 'cancelled';
export type FactStatus = 'verified' | 'unverified' | 'excluded';
export type SourceKind = 'voice' | 'card' | 'staff_note' | 'family';
export type SongStatus = 'draft' | 'generating' | 'ready' | 'complete' | 'failed';
export type ContributionState = 'pending' | 'accepted' | 'held';

export type TenantRow = {
  id: string;
  name: string;
  type: string;
  region: string | null;
  status: 'active' | 'suspended' | 'closed';
  /** free | starter | pro — 0004 에서 추가 */
  plan: string;
  /** 월 곡 생성 한도. 곡이 유일하게 비싼 자원이라 여기만 센다. */
  song_quota: number;
  /** 곡 보관 상한(일). 기본 3년 — 0003 에서 추가 */
  song_retention_days: number;
  created_at: string;
};

export type MembershipRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  role: StaffRole;
  status: 'active' | 'inactive';
  created_at: string;
};

export type ParticipantRow = {
  id: string;
  tenant_id: string;
  display_name: string;
  internal_no: string | null;
  honorific: string | null;
  avatar_key: string | null;
  status: 'active' | 'paused' | 'ended';
  family_state: 'available' | 'none' | 'unreachable';
  avoid_topics: string[];
  music_prefs: string[];
  comm_prefs: string[];
  created_at: string;
};

export type ConsentRow = {
  id: string;
  tenant_id: string;
  participant_id: string;
  kind: ConsentKind;
  state: ConsentState;
  method: string | null;
  policy_version: string | null;
  decided_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export type SessionRow = {
  id: string;
  tenant_id: string;
  participant_id: string;
  facilitator: string | null;
  topic: string;
  status: SessionStatus;
  step: number;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
};

export type StoryFactRow = {
  id: string;
  tenant_id: string;
  session_id: string;
  participant_id: string;
  text: string;
  status: FactStatus;
  follow_up: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};

export type FactSourceRow = {
  id: string;
  fact_id: string;
  kind: SourceKind;
  at_sec: number | null;
  label: string;
};

export type LyricRow = {
  id: string;
  tenant_id: string;
  session_id: string;
  version: number;
  sections: unknown;
  model: string | null;
  prompt_version: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  /** 0007 에서 붙였다. 두 태블릿이 같은 회기를 만졌을 때 최신을 가리는 근거. */
  updated_at: string;
};

/**
 * 회기의 전사 한 벌 (0007).
 *
 * 줄을 행으로 쪼개지 않고 통째로 jsonb 에 둔다 — 화면은 언제나 전부를 한꺼번에
 * 읽고, 쪼개면 전사 하나에 수백 행이 된다.
 *
 * 센터장 콘솔에 내용을 그리지 말 것. 명세의 권한 행렬은 센터장에게 전사의
 * '진행상태'만 준다.
 */
export type TranscriptRow = {
  id: string;
  tenant_id: string;
  session_id: string;
  /** [{id,text,at,speaker}] — SessionState.transcript 와 같은 모양 */
  lines: unknown;
  /** 복지사가 「수정 완료」를 눌렀는가 */
  confirmed: boolean;
  created_at: string;
  updated_at: string;
};

export type SongRow = {
  id: string;
  tenant_id: string;
  /** 곡의 임자는 회기가 아니라 어르신이다. 회기 없이도 곡은 존재할 수 있다. */
  session_id: string | null;
  participant_id: string | null;
  lyric_id: string | null;
  title: string;
  style: string | null;
  status: SongStatus;
  audio_path: string | null;
  art_key: string | null;
  provider: string | null;
  idem_key: string | null;
  /** 같은 어르신·같은 가사면 다시 만들지 않기 위한 지문 */
  lyrics_hash: string | null;
  length_ms: number | null;
  created_at: string;
};

export type ObservationRow = {
  id: string;
  tenant_id: string;
  session_id: string;
  reactions: string[];
  note: string | null;
  recorder: string | null;
  created_at: string;
};

export type ActivityLogRow = {
  id: string;
  tenant_id: string;
  session_id: string;
  draft: string;
  next_topic: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
};

export type AuditLogRow = {
  id: number;
  tenant_id: string;
  actor: string | null;
  action: string;
  target: string | null;
  reason: string | null;
  at: string;
};

/**
 * supabase-js 의 제네릭이 기대하는 모양.
 *
 * Relationships 는 비워 두지만 반드시 있어야 한다 — 없으면 테이블 타입이
 * GenericTable 에 맞지 않아 모든 질의가 never 로 무너진다. (조인 결과의
 * 타입 추론에만 쓰이는 값이라, 조인을 안 하는 지금은 빈 배열로 충분하다.)
 */
type Tbl<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      tenants: Tbl<TenantRow, Partial<TenantRow> & { name: string }, Partial<TenantRow>>;
      memberships: Tbl<MembershipRow, Omit<MembershipRow, 'id' | 'created_at'> & { id?: string }, Partial<MembershipRow>>;
      participants: Tbl<ParticipantRow, Partial<ParticipantRow> & { tenant_id: string; display_name: string }, Partial<ParticipantRow>>;
      consents: Tbl<ConsentRow, Partial<ConsentRow> & { tenant_id: string; participant_id: string; kind: ConsentKind }, Partial<ConsentRow>>;
      sessions: Tbl<SessionRow, Partial<SessionRow> & { tenant_id: string; participant_id: string; topic: string }, Partial<SessionRow>>;
      story_facts: Tbl<StoryFactRow, Partial<StoryFactRow> & { tenant_id: string; session_id: string; participant_id: string; text: string }, Partial<StoryFactRow>>;
      fact_sources: Tbl<FactSourceRow, Partial<FactSourceRow> & { fact_id: string; kind: SourceKind; label: string }, Partial<FactSourceRow>>;
      lyrics: Tbl<LyricRow, Partial<LyricRow> & { tenant_id: string; session_id: string; sections: unknown }, Partial<LyricRow>>;
      transcripts: Tbl<TranscriptRow, Partial<TranscriptRow> & { tenant_id: string; session_id: string }, Partial<TranscriptRow>>;
      songs: Tbl<SongRow, Partial<SongRow> & { tenant_id: string; title: string }, Partial<SongRow>>;
      observations: Tbl<ObservationRow, Partial<ObservationRow> & { tenant_id: string; session_id: string }, Partial<ObservationRow>>;
      activity_logs: Tbl<ActivityLogRow, Partial<ActivityLogRow> & { tenant_id: string; session_id: string; draft: string }, Partial<ActivityLogRow>>;
      // Update 를 막는 것은 타입이 아니라 RLS 다. 감사로그에는 UPDATE 정책이
      // 없어서 앱 키로는 0건이 바뀐다.
      audit_log: Tbl<AuditLogRow, Omit<AuditLogRow, 'id' | 'at'> & { at?: string }, Partial<AuditLogRow>>;
    };
    Views: Record<string, never>;
    Functions: {
      /**
       * 가입 = 기관 생성. 기관을 만드는 유일한 통로다 — tenants 에는 INSERT
       * 정책이 없고, 이 함수 안에서 "만든 사람만 센터장이 된다"를 강제한다.
       * 그래서 인자로 user_id 를 받지 않는다.
       */
      join_tenant: {
        Args: { p_code: string };
        Returns: string;
      };
      my_join_code: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      create_my_tenant: {
        Args: { p_name: string; p_region?: string };
        Returns: string;
      };
      /** 이번 달 남은 곡 수. 소속이 없으면 아무것도 돌려주지 않는다. */
      song_quota_left: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
    };
    Enums: {
      staff_role: StaffRole;
      consent_kind: ConsentKind;
      consent_state: ConsentState;
      session_status: SessionStatus;
      fact_status: FactStatus;
      source_kind: SourceKind;
      song_status: SongStatus;
      contribution_state: ContributionState;
    };
    CompositeTypes: Record<string, never>;
  };
};
