-- 그룹 회기 — 복지사 한 명이 어르신 서너 분과 함께
--
-- 지금까지 회기는 1:1 이었다. sessions.participant_id 가 단일 필수 칸이고,
-- 화자 분리도 "마주 앉은 두 사람"으로 못 박혀 있다.
--
-- 그런데 현장은 대개 1:3~5 다. 주야간보호센터의 프로그램은 집단으로 돌고,
-- 복지사 한 분이 같은 회기를 다섯 번 반복할 시간은 없다. 집단 회상 자체도
-- 확립된 방식이다 — 한 분의 기억이 옆자리 기억을 연다.
--
-- ── 무엇을 조심하는가
--
-- 그룹에서 가장 위험한 것은 **누가 한 말인지 잘못 붙이는 것**이다. 원칙 1이
-- "근거 없는 사실은 없다"인데, 그룹에서 그 근거는 곧 "누가 한 말인가"다.
-- 잘못 붙이면 김 어르신 생애지도에 박 어르신 이야기가 들어가고, 화면상으로는
-- 정상과 구분되지 않는다.
--
-- 그래서 기본 귀속은 **회기**다. 개인 기록으로 올라가는 것은 복지사가 그 줄을
-- 특정 어르신에게 지정했을 때뿐이다(story_facts.participant_id 는 그대로 두고,
-- 지정 전에는 기준 어르신이 아니라 null 을 쓴다).
--
-- ── 기준 어르신을 남겨 두는 이유
--
-- sessions.participant_id 를 없애지 않는다. 녹음·곡의 저장 칸 이름과 여러 조회가
-- 그 값에 매여 있어서, 지금 갈아엎으면 이번 주에 고친 것들이 전부 흔들린다.
-- 대신 뜻을 좁힌다 — '이 회기의 임자'가 아니라 '저장 기준'이다. 실제로 누가
-- 참여했는지는 아래 표가 들고 있다.
--
-- 실행: SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전하다.

-- ─────────────────────────────────────────── 참여자

create table if not exists session_participants (
  session_id     uuid not null references sessions(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  tenant_id      uuid not null references tenants(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (session_id, participant_id)
);

comment on table session_participants is
  '이 회기에 실제로 참여한 어르신들. 1:1 회기도 한 줄이 들어간다 — 두 갈래를 '
  '두면 세는 쪽이 언젠가 한쪽을 빠뜨린다.';

create index if not exists session_participants_participant_idx
  on session_participants (participant_id);

alter table session_participants enable row level security;

drop policy if exists session_participants_select on session_participants;
create policy session_participants_select on session_participants for select
  using (tenant_id in (select current_tenant_ids()));

drop policy if exists session_participants_write on session_participants;
create policy session_participants_write on session_participants for all
  using (tenant_id in (select current_tenant_ids()))
  with check (tenant_id in (select current_tenant_ids()));

comment on column sessions.participant_id is
  '저장 기준 어르신. 이 회기의 유일한 임자라는 뜻이 아니다 — 실제 참여자는 '
  'session_participants 에 있다. 녹음·곡의 저장 칸 이름이 이 값에 매여 있다.';

-- ─────────────────────────────────────────── 지금까지의 회기 채우기
--
-- 1:1 회기도 참여자 표에 한 줄이 있어야 한다. 두 갈래로 세면 어느 쪽이든
-- 언젠가 빠뜨린다.

insert into session_participants (session_id, participant_id, tenant_id)
select s.id, s.participant_id, s.tenant_id
  from sessions s
 where s.participant_id is not null
on conflict do nothing;

-- ─────────────────────────────────────────── 이야기의 임자
--
-- 그룹에서 나온 사실은 기본이 '함께 나눈 이야기'다. 누구의 것인지 복지사가
-- 지정하기 전에는 개인 기록이 아니다.
--
-- 지금 participant_id 는 not null 이라 지정 전에 넣을 값이 없다. null 을
-- 허용하고, 그 빈칸이 곧 '아직 누구의 것도 아님'이 된다.
--
-- 1:1 회기는 지금처럼 채워진다 — 마주 앉은 한 분의 말씀이니 지정이 필요 없다.

alter table story_facts alter column participant_id drop not null;

comment on column story_facts.participant_id is
  '이 사실이 누구의 생애인지. null 이면 아직 아무의 것도 아니다 — 그룹 회기에서 '
  '복지사가 지정하기 전의 상태다. 개인 생애지도는 이 칸이 찬 것만 읽는다.';

-- ─────────────────────────────────────────── 확인

do $$
declare n int;
begin
  select count(*) into n from session_participants;
  raise notice '참여자 표 준비 완료 — 기존 회기 % 줄을 옮겼다', n;

  perform 1
     from information_schema.columns
    where table_name = 'story_facts'
      and column_name = 'participant_id'
      and is_nullable = 'YES';
  if not found then
    raise exception '이야기의 임자 칸이 아직 필수다 — 그룹 회기에서 넣을 값이 없다';
  end if;

  raise notice '그룹 회기 준비 완료';
end $$;
