-- 똑똑 TokTok — 초기 스키마 (P0 핵심)
--
-- 기능명세서 v1.6 「데이터모델」 시트의 논리 모델 중, 앱이 지금 실제로 쓰는
-- 범위만 물리 테이블로 만든다. 나머지 엔터티는 쓰이는 시점에 추가한다.
--
-- 설계 원칙 — 명세서가 P0로 지정한 것들:
--   NFR-SEC-001  모든 테이블 RLS. 교차 기관 조회는 어떤 경로로도 불가
--   원칙 2       사실에는 반드시 출처가 붙는다 (story_facts -> fact_sources)
--   원칙 3       AI 결과는 사람이 승인해야 확정된다 (approved_by/at)
--   원칙 4       동의는 목적별로 따로 기록·철회된다
--   NFR-OPS-003  권한·동의·승인·삭제는 감사로그에 남는다
--
-- 실행: Supabase 대시보드 > SQL Editor 에 붙여넣고 Run.
-- 여러 번 실행해도 같은 결과가 되도록 썼다. 이 파일에는 비밀값이 없다.
--
-- 부트스트랩 주의: tenants INSERT 와 첫 director membership 에는 정책이 없다.
-- 즉 앱에서는 만들 수 없고, SQL Editor(서비스 롤, RLS 우회)에서만 만들 수 있다.
-- 기관을 스스로 만들 수 있으면 남의 기관에 자기를 넣을 길이 생기기 때문이다.

-- ─────────────────────────────────────────── 기관 · 사람

create table if not exists tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null default '주야간보호',
  region      text,                                   -- 예: 충청북도 청주시
  status      text not null default 'active' check (status in ('active','suspended','closed')),
  created_at  timestamptz not null default now()
);

do $$ begin
  create type staff_role as enum ('director','worker','assistant','reviewer','finance');
exception when duplicate_object then null; end $$;

create table if not exists memberships (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        staff_role not null default 'worker',
  status      text not null default 'active' check (status in ('active','inactive')),
  created_at  timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index if not exists memberships_user_active_idx
  on memberships (user_id) where status = 'active';

-- RLS 정책이 매 행마다 memberships 를 다시 읽지 않도록 함수로 감싼다.
-- security definer 이므로 memberships 자신의 정책과 서로를 물지 않는다.
create or replace function current_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from memberships
   where user_id = auth.uid() and status = 'active'
$$;

create or replace function has_role(t uuid, roles staff_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
     where user_id = auth.uid() and tenant_id = t
       and status = 'active' and role = any(roles)
  )
$$;

-- ─────────────────────────────────────────── 어르신

create table if not exists participants (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  -- 화면에 쓰는 표기. 주민등록번호·계좌·진단명은 저장하지 않는다 (최소수집 원칙).
  display_name  text not null,
  internal_no   text,
  honorific     text,
  avatar_key    text,
  status        text not null default 'active' check (status in ('active','paused','ended')),
  family_state  text not null default 'available'
                check (family_state in ('available','none','unreachable')),
  -- 질문 추천·가사 생성에서 제외할 주제 (F-SW-PTC-009)
  avoid_topics  text[] not null default '{}',
  music_prefs   text[] not null default '{}',
  comm_prefs    text[] not null default '{}',
  created_at    timestamptz not null default now()
);
create index if not exists participants_tenant_idx on participants (tenant_id, status);

-- ─────────────────────────────────────────── 동의

do $$ begin
  create type consent_kind as enum ('recording','external_ai','facility_play','family_share','promotion');
exception when duplicate_object then null; end $$;

do $$ begin
  create type consent_state as enum ('granted','denied','withdrawn','unset');
exception when duplicate_object then null; end $$;

create table if not exists consents (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  participant_id  uuid not null references participants(id) on delete cascade,
  kind            consent_kind not null,
  state           consent_state not null default 'unset',
  -- 어떻게 확인했는지: 말·카드·서명 등 (원칙 1 · 본인 최종 통제)
  method          text,
  policy_version  text,
  decided_at      timestamptz,
  expires_at      timestamptz,
  created_at      timestamptz not null default now(),
  unique (participant_id, kind)
);
create index if not exists consents_expiry_idx
  on consents (tenant_id, expires_at) where state = 'granted';

-- ─────────────────────────────────────────── 회기

do $$ begin
  create type session_status as enum ('planned','running','done','stopped','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists sessions (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  participant_id  uuid not null references participants(id) on delete cascade,
  facilitator     uuid references memberships(id) on delete set null,
  topic           text not null,
  status          session_status not null default 'planned',
  -- lib/flow.ts 의 9단계 중 어디까지 왔는지
  step            smallint not null default 1 check (step between 1 and 9),
  scheduled_at    timestamptz,
  started_at      timestamptz,
  ended_at        timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists sessions_schedule_idx on sessions (tenant_id, scheduled_at);
create index if not exists sessions_participant_idx on sessions (participant_id, status);

-- ─────────────────────────────────────────── 이야기와 출처

do $$ begin
  create type fact_status as enum ('verified','unverified','excluded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type source_kind as enum ('voice','card','staff_note','family');
exception when duplicate_object then null; end $$;

create table if not exists story_facts (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  session_id      uuid not null references sessions(id) on delete cascade,
  participant_id  uuid not null references participants(id) on delete cascade,
  text            text not null,
  status          fact_status not null default 'unverified',
  follow_up       text,
  -- 어르신이 확인해 준 시점. 이것이 없으면 verified 가 될 수 없다 (원칙 1·3).
  decided_by      uuid references memberships(id) on delete set null,
  decided_at      timestamptz,
  created_at      timestamptz not null default now(),
  constraint verified_needs_decision
    check (status <> 'verified' or decided_at is not null)
);
create index if not exists story_facts_session_idx on story_facts (session_id, status);

create table if not exists fact_sources (
  id        uuid primary key default gen_random_uuid(),
  fact_id   uuid not null references story_facts(id) on delete cascade,
  kind      source_kind not null,
  -- 음성 출처면 재생 위치(초). 화면에 "어르신 음성 0:42" 로 그대로 보인다.
  at_sec    integer,
  label     text not null
);
create index if not exists fact_sources_fact_idx on fact_sources (fact_id);

-- 원칙 2: 출처 없는 사실은 존재할 수 없다. 앱의 assertStoryIntegrity() 와
-- 같은 규칙을 DB에서도 지킨다. deferred 이므로 사실과 출처를 한 트랜잭션에서
-- 순서 상관없이 넣을 수 있고, 커밋 시점에만 검사한다.
create or replace function assert_fact_has_source()
returns trigger
language plpgsql
as $$
begin
  if not exists (select 1 from fact_sources where fact_id = new.id) then
    raise exception '출처 없는 이야기 항목은 확정할 수 없습니다 (fact_id=%)', new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists story_facts_require_source on story_facts;
create constraint trigger story_facts_require_source
after insert or update of status on story_facts
deferrable initially deferred
for each row
when (new.status = 'verified')
execute function assert_fact_has_source();

-- ─────────────────────────────────────────── 가사 · 곡

create table if not exists lyrics (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  session_id     uuid not null references sessions(id) on delete cascade,
  version        integer not null default 1,
  sections       jsonb not null,                      -- [{label,tone,lines[]}]
  model          text,
  prompt_version text,
  -- 원칙 3: 사람이 승인하기 전에는 초안이다.
  approved_by    uuid references memberships(id) on delete set null,
  approved_at    timestamptz,
  created_at     timestamptz not null default now(),
  unique (session_id, version)
);

do $$ begin
  create type song_status as enum ('draft','generating','ready','complete','failed');
exception when duplicate_object then null; end $$;

create table if not exists songs (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  session_id    uuid not null references sessions(id) on delete cascade,
  lyric_id      uuid references lyrics(id) on delete set null,
  title         text not null,
  style         text,
  status        song_status not null default 'draft',
  audio_path    text,                                  -- private bucket 키
  art_key       text,
  provider      text,
  -- 같은 요청이 두 번 들어와도 곡이 두 개 생기지 않게 (NFR-OPS-001)
  idem_key      text unique,
  created_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────── 관찰 · 활동일지

create table if not exists observations (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  session_id  uuid not null references sessions(id) on delete cascade,
  -- 눈으로 본 행동만. 정서·인지 상태를 추정하는 값은 두지 않는다 (원칙 7).
  reactions   text[] not null default '{}',
  note        text,
  recorder    uuid references memberships(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists activity_logs (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  session_id    uuid not null references sessions(id) on delete cascade,
  draft         text not null,
  next_topic    text,
  -- AI 초안은 복지사가 확정해야 최종 기록이 된다.
  confirmed_by  uuid references memberships(id) on delete set null,
  confirmed_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────── 가족

do $$ begin
  create type contribution_state as enum ('pending','accepted','held');
exception when duplicate_object then null; end $$;

create table if not exists family_contributions (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  participant_id  uuid not null references participants(id) on delete cascade,
  kind            text not null,                       -- photo | note | voice | quote
  from_label      text,                                -- 딸 · 아들 · 며느리
  title           text,
  body            text,
  file_path       text,
  -- 가족 제보는 그 자체로 사실이 아니다. 확인 전에는 pending.
  state           contribution_state not null default 'pending',
  reviewed_by     uuid references memberships(id) on delete set null,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────── 감사로그

create table if not exists audit_log (
  id          bigserial primary key,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  actor       uuid references auth.users(id) on delete set null,
  action      text not null,
  target      text,
  -- 민감자료 열람은 사유가 있어야 한다 (F-CM-DATA-002)
  reason      text,
  at          timestamptz not null default now()
);
create index if not exists audit_log_recent_idx on audit_log (tenant_id, at desc);

-- ─────────────────────────────────────────── RLS
-- 모든 테이블에 켠다. 정책이 없는 상태의 RLS는 "전부 거부"이므로,
-- 새 테이블을 추가하고 정책을 잊더라도 데이터가 새지 않는다 (fail closed).

do $$
declare t text;
begin
  foreach t in array array[
    'tenants','memberships','participants','consents','sessions','story_facts',
    'fact_sources','lyrics','songs','observations','activity_logs',
    'family_contributions','audit_log'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- 소속 기관의 행만 보이고, 소속 기관에만 쓸 수 있다.
do $$
declare t text;
begin
  foreach t in array array[
    'participants','consents','sessions','story_facts','lyrics','songs',
    'observations','activity_logs','family_contributions'
  ] loop
    execute format('drop policy if exists %I on %I', t || '_select', t);
    execute format('drop policy if exists %I on %I', t || '_write', t);
    execute format(
      'create policy %I on %I for select using (tenant_id in (select current_tenant_ids()))',
      t || '_select', t);
    execute format(
      'create policy %I on %I for all using (tenant_id in (select current_tenant_ids()))'
      || ' with check (tenant_id in (select current_tenant_ids()))',
      t || '_write', t);
  end loop;
end $$;

-- fact_sources 는 tenant_id 를 들고 있지 않으므로 부모를 따라간다.
drop policy if exists fact_sources_select on fact_sources;
create policy fact_sources_select on fact_sources for select
  using (exists (
    select 1 from story_facts f
     where f.id = fact_sources.fact_id
       and f.tenant_id in (select current_tenant_ids())));

drop policy if exists fact_sources_write on fact_sources;
create policy fact_sources_write on fact_sources for all
  using (exists (
    select 1 from story_facts f
     where f.id = fact_sources.fact_id
       and f.tenant_id in (select current_tenant_ids())))
  with check (exists (
    select 1 from story_facts f
     where f.id = fact_sources.fact_id
       and f.tenant_id in (select current_tenant_ids())));

-- 기관 정보는 소속 직원만 읽는다. 기관 생성·수정 정책은 두지 않는다.
drop policy if exists tenants_select on tenants;
create policy tenants_select on tenants for select
  using (id in (select current_tenant_ids()));

drop policy if exists memberships_select on memberships;
create policy memberships_select on memberships for select
  using (tenant_id in (select current_tenant_ids()));

-- 직원 초대·역할 변경은 센터장만 (F-CM-STAFF-002)
drop policy if exists memberships_manage on memberships;
create policy memberships_manage on memberships for all
  using (has_role(tenant_id, array['director']::staff_role[]))
  with check (has_role(tenant_id, array['director']::staff_role[]));

-- 감사로그는 남기고 읽을 수만 있다. UPDATE·DELETE 정책이 없으므로
-- 앱 키로는 고치거나 지울 수 없고, 그래야 증빙이 된다.
drop policy if exists audit_select on audit_log;
create policy audit_select on audit_log for select
  using (tenant_id in (select current_tenant_ids()));

drop policy if exists audit_insert on audit_log;
create policy audit_insert on audit_log for insert
  with check (tenant_id in (select current_tenant_ids()));
