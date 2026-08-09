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
      songs: Tbl<SongRow, Partial<SongRow> & { tenant_id: string; title: string }, Partial<SongRow>>;
      observations: Tbl<ObservationRow, Partial<ObservationRow> & { tenant_id: string; session_id: string }, Partial<ObservationRow>>;
      activity_logs: Tbl<ActivityLogRow, Partial<ActivityLogRow> & { tenant_id: string; session_id: string; draft: string }, Partial<ActivityLogRow>>;
      // Update 를 막는 것은 타입이 아니라 RLS 다. 감사로그에는 UPDATE 정책이
      // 없어서 앱 키로는 0건이 바뀐다.
      audit_log: Tbl<AuditLogRow, Omit<AuditLogRow, 'id' | 'at'> & { at?: string }, Partial<AuditLogRow>>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
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
