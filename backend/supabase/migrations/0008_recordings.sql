-- 녹음을 기관 저장소에 둔다
--
-- 마지막까지 기기에만 있던 자료다. 그래서 복지사 A의 태블릿이 고장 나면
-- 어르신 목소리가 어디에도 남지 않았고, 이어받은 B는 출처를 눌러도 그 대목을
-- 들을 수 없었다.
--
-- 원음성은 이 서비스에서 가장 민감한 자료다. 그래서 곡·전사와 같은 방식으로
-- 올리되, 세 가지를 더 건다.
--
--   1. 보관기간 30일 — 무기한 금지(F-CM-POL-003)이고, 명세의 음성 하한이 30일이다.
--   2. 동의 철회하면 서버 사본까지 지운다 — 지금까지는 기기에만 있어서 저절로
--      지켜지던 약속이다. 서버에 두는 순간 코드로 지켜야 한다.
--   3. 열어 본 사실을 남긴다 — 명세의 권한 행렬은 센터장에게 원음성 '기본
--      미열람'을 준다. 콘솔에 녹음을 그리는 화면을 만들지 말 것.
--
-- 실행: SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전하다.

-- ─────────────────────────────────────────── 버킷
--
-- private 이다. 공개로 만들면 주소를 아는 사람이 어르신 목소리를 그대로
-- 내려받는다.
--
-- 60MB 상한: 앱이 녹음하는 32kbps 로는 20분이 5MB 남짓이지만, 밖에서 받아
-- 올리는 wav 는 1분에 2MB 가까이 된다(16kHz 모노). 30분짜리 wav 를 받아 줄
-- 만큼은 열어 두되, 실수로 영상이 올라오는 것은 막는 크기다.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recordings', 'recordings', false, 62914560,
        array['audio/webm','audio/ogg','audio/wav','audio/x-wav','audio/mpeg','audio/mp4','audio/aac','audio/flac'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 경로는 `<tenant_id>/<participant_id>/<session_id>.<ext>` 다. 첫 칸이 기관이라
-- 그것만 보면 남의 기관 파일인지 알 수 있다 — 곡과 같은 기준을 쓴다.

drop policy if exists recordings_read on storage.objects;
create policy recordings_read on storage.objects for select
  using (
    bucket_id = 'recordings'
    and (storage.foldername(name))[1]::uuid in (select current_tenant_ids())
  );

drop policy if exists recordings_write on storage.objects;
create policy recordings_write on storage.objects for insert
  with check (
    bucket_id = 'recordings'
    and (storage.foldername(name))[1]::uuid in (select current_tenant_ids())
  );

-- 같은 회기를 다시 녹음하면 새 파일이 아니라 교체다.
drop policy if exists recordings_update on storage.objects;
create policy recordings_update on storage.objects for update
  using (
    bucket_id = 'recordings'
    and (storage.foldername(name))[1]::uuid in (select current_tenant_ids())
  );

-- 삭제는 반드시 열려 있어야 한다. 동의 철회와 보관기간이 이 길로 지켜진다.
drop policy if exists recordings_delete on storage.objects;
create policy recordings_delete on storage.objects for delete
  using (
    bucket_id = 'recordings'
    and (storage.foldername(name))[1]::uuid in (select current_tenant_ids())
  );

-- ─────────────────────────────────────────── 표
--
-- 파일만 두면 무엇이 언제 지워져야 하는지 알 수 없다. 보관기간은 파일 이름이
-- 아니라 표가 들고 있어야 한다.

create table if not exists recordings (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  session_id     uuid not null references sessions(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  storage_path   text not null,
  -- 길이(초). 못 잰 파일이 실제로 있다 — 재생기가 답하지 않는 경우가 있어서
  -- 앱도 null 을 그대로 들고 다닌다. 0 으로 메우지 않는다.
  seconds        integer,
  mime           text not null default 'audio/webm',
  bytes          integer not null default 0,
  created_at     timestamptz not null default now(),
  -- 이 시각이 지나면 지운다. 기본 30일.
  expires_at     timestamptz not null default (now() + interval '30 days'),
  -- 회기 하나에 녹음 한 벌. upsert 대상이므로 조건을 달지 않는다(0006 참고).
  unique (session_id)
);

comment on table recordings is
  '어르신 원음성. 보관 30일. 센터장 콘솔에 재생기를 두지 말 것 — 명세의 권한 '
  '행렬은 원음성에 기본 미열람을 준다. 여는 일은 사유 확인과 감사로그를 거쳐야 한다.';

create index if not exists recordings_participant_idx on recordings (participant_id);
create index if not exists recordings_expiry_idx on recordings (expires_at);

alter table recordings enable row level security;

drop policy if exists recordings_select on recordings;
create policy recordings_select on recordings for select
  using (tenant_id in (select current_tenant_ids()));

drop policy if exists recordings_write_row on recordings;
create policy recordings_write_row on recordings for all
  using (tenant_id in (select current_tenant_ids()))
  with check (tenant_id in (select current_tenant_ids()));

-- ─────────────────────────────────────────── 보관기간 청소
--
-- 파일은 SQL 로 지울 수 없다 — Supabase 가 storage.objects 의 직접 삭제를
-- 막는다. 그래서 이 함수는 "지워야 할 것"을 알려 주고 표에서만 지운다.
-- 파일은 부르는 쪽이 저장소 API 로 지운다(lib/recordingSync).
--
-- 순서가 중요하다. 표를 먼저 지우고 파일이 남으면 주인 없는 소리가 되어
-- 아무도 못 찾고 안 지워진다. 그래서 이 함수는 **경로만 돌려주고 지우지
-- 않는다** — 부르는 쪽이 파일을 지운 뒤 다시 불러 표를 정리한다.

create or replace function expired_recordings()
returns table (id uuid, storage_path text)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.storage_path
    from recordings r
   where r.tenant_id in (select current_tenant_ids())
     and r.expires_at <= now()
$$;

grant execute on function expired_recordings() to authenticated;

comment on function expired_recordings is
  '보관기간이 지난 녹음. 부르는 쪽이 파일을 지운 뒤 행을 지운다. '
  '파일을 남긴 채 행만 지우면 주인 없는 음성이 저장소에 남는다.';

-- ─────────────────────────────────────────── 확인

do $$
declare n int;
begin
  select count(*) into n
    from pg_index i
   where i.indrelid = 'recordings'::regclass
     and i.indisunique
     and i.indpred is null;
  if n = 0 then
    raise exception '녹음 upsert 가 걸릴 유니크 제약이 없다';
  end if;

  perform 1 from storage.buckets where id = 'recordings' and public = false;
  if not found then
    raise exception '녹음 버킷이 없거나 공개로 설정돼 있다';
  end if;

  raise notice '녹음 기관 보관 준비 완료 — 30일, 철회 시 삭제, 콘솔 미열람';
end $$;
