-- 전사와 가사를 기관 단위로 나눈다
--
-- 지금까지 회기의 중간 산물은 만든 태블릿 안에만 있었다. 어르신 목록·동의·곡은
-- 기관 단위로 공유되는데, 정작 그 회기의 알맹이 — 전사·이야기·가사 — 는
-- 기기에 갇혀 있었다. 복지사 A가 받은 이야기를 B가 이어받을 수 없고, A의
-- 태블릿이 고장 나면 그대로 사라진다.
--
-- 두 가지를 한다.
--
--   1) transcripts 표를 새로 만든다. 회기 하나에 한 줄이다.
--   2) lyrics 표는 이미 0001 에 있는데 코드가 한 번도 쓰지 않았다 —
--      곡 표와 같은 상황이었다. 쓸 수 있게 손질만 한다.
--
-- 실행: SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전하다.

-- ─────────────────────────────────────────── 전사
--
-- 왜 sessions 에 칸을 붙이지 않고 표를 따로 두는가.
--
-- 보관기간이 다르다. 명세의 상한이 전사 730일인데(center.ts 의
-- RETENTION_BOUNDS.transcript) 회기 행은 그보다 오래 남아야 한다 — 언제
-- 몇 단계까지 했는지는 기관의 업무 기록이다. 같은 행에 두면 전사를 지우려고
-- 회기를 지우게 된다.
--
-- 줄은 통째로 jsonb 다. 한 줄씩 행으로 쪼개면 전사 한 벌에 수백 행이 되고,
-- 화면은 언제나 전부를 한꺼번에 읽는다 — 쪼개서 얻을 것이 없다.

create table if not exists transcripts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  session_id  uuid not null references sessions(id) on delete cascade,
  -- [{id,text,at,speaker}] — lib/store.tsx 의 SessionState.transcript 와 같은 모양
  lines       jsonb not null default '[]'::jsonb,
  -- 복지사가 "수정 완료"를 눌렀는가. 원칙 3(사람 확인)의 그 표시다.
  confirmed   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- 회기 하나에 전사 한 벌. upsert 의 대상이 되므로 부분 인덱스로 만들지
  -- 않는다 — 0006 에서 그것 때문에 곡이 한 번도 저장되지 않았다.
  unique (session_id)
);

comment on table transcripts is
  '회기의 전사. 기관 단위로 공유된다. 센터장 콘솔에 내용을 그리지 말 것 — '
  '명세의 권한 행렬은 센터장에게 전사의 진행상태만 준다.';

create index if not exists transcripts_session_idx on transcripts (session_id);

-- ─────────────────────────────────────────── 가사
--
-- 표는 0001 에 이미 있다. 사람이 승인했는지를 approved_at 이 들고 있으므로
-- (원칙 3) 그대로 쓴다. unique (session_id, version) 도 이미 있어서 upsert 가
-- 걸린다 — 조건이 붙어 있지 않은 것을 확인했다.
--
-- 다만 코드가 한 번도 쓴 적이 없어 갱신 시각 칸이 없다. 누가 언제 마지막으로
-- 손댔는지 모르면 두 태블릿이 같은 회기를 만졌을 때 어느 쪽이 최신인지 가릴 수
-- 없다.

alter table lyrics add column if not exists updated_at timestamptz not null default now();

-- ─────────────────────────────────────────── 접근 규칙
--
-- 다른 tenant 표들과 같은 기준을 쓴다(0001 의 정책 묶음). 규칙이 두 벌이면
-- 언젠가 서로 어긋난다.

alter table transcripts enable row level security;

drop policy if exists transcripts_select on transcripts;
create policy transcripts_select on transcripts for select
  using (tenant_id in (select current_tenant_ids()));

drop policy if exists transcripts_write on transcripts;
create policy transcripts_write on transcripts for all
  using (tenant_id in (select current_tenant_ids()))
  with check (tenant_id in (select current_tenant_ids()));

-- ─────────────────────────────────────────── 확인
--
-- 0006 에서 배운 것: upsert 가 쓸 유니크 제약이 정말 조건 없이 있는지 눈으로
-- 본다. 없으면 42P10 으로 조용히 실패하고, 실패가 화면에 안 나온다.

do $$
declare n int;
begin
  select count(*) into n
    from pg_index i
   where i.indrelid = 'transcripts'::regclass
     and i.indisunique
     and i.indpred is null;
  if n = 0 then
    raise exception '전사 upsert 가 걸릴 유니크 제약이 없다';
  end if;

  select count(*) into n
    from pg_index i
   where i.indrelid = 'lyrics'::regclass
     and i.indisunique
     and i.indpred is null;
  if n = 0 then
    raise exception '가사 upsert 가 걸릴 유니크 제약이 없다';
  end if;

  raise notice '전사·가사 공유 준비 완료 — 이제 기관 단위로 나뉜다';
end $$;
