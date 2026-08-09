-- 곡을 서버에 보관하기
--
-- 왜 필요한가: 지금 곡은 만든 기기 안에만 있다. 센터에 태블릿이 두 대면
-- 같은 어르신의 같은 곡이 두 번 만들어지고, 90초 곡 하나가 1,125크레딧이다.
-- 서버에 두면 어르신 한 분의 한 곡은 정말 한 번만 만들어진다.
--
-- 실행: SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전하다.

-- ─────────────────────────────────────────── 버킷
-- private 이다. 공개 버킷으로 만들면 링크를 아는 사람이 어르신의 노래를
-- 전부 내려받을 수 있다. 재생은 만료되는 서명 URL 로 한다.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('songs', 'songs', false, 20971520, array['audio/mpeg','audio/mp4','audio/webm'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ─────────────────────────────────────────── 접근 규칙
--
-- 파일 경로를 `<tenant_id>/<participant_id>/<song_id>.mp3` 로 쓴다.
-- 경로의 첫 칸이 기관이므로, 그것만 보면 남의 기관 파일인지 알 수 있다.
-- 데이터베이스와 같은 기준(current_tenant_ids)을 쓴다 — 규칙이 두 벌이면
-- 언젠가 서로 어긋난다.

drop policy if exists songs_read on storage.objects;
create policy songs_read on storage.objects for select
  using (
    bucket_id = 'songs'
    and (storage.foldername(name))[1]::uuid in (select current_tenant_ids())
  );

drop policy if exists songs_write on storage.objects;
create policy songs_write on storage.objects for insert
  with check (
    bucket_id = 'songs'
    and (storage.foldername(name))[1]::uuid in (select current_tenant_ids())
  );

-- 덮어쓰기는 허용한다. 같은 가사로 다시 만들면 새 파일이 아니라 교체다.
drop policy if exists songs_update on storage.objects;
create policy songs_update on storage.objects for update
  using (
    bucket_id = 'songs'
    and (storage.foldername(name))[1]::uuid in (select current_tenant_ids())
  );

-- 삭제는 남겨 둬야 한다. 지우는 길이 없으면 어르신이 지워 달라고 하셔도
-- 지울 수 없다.
drop policy if exists songs_delete on storage.objects;
create policy songs_delete on storage.objects for delete
  using (
    bucket_id = 'songs'
    and (storage.foldername(name))[1]::uuid in (select current_tenant_ids())
  );

-- ─────────────────────────────────────────── 곡 테이블 보완

-- 곡의 임자는 회기가 아니라 어르신이다. 복지사가 회기를 서버에 저장하기
-- 전에도 곡은 나올 수 있으므로, 회기 없이도 곡이 존재할 수 있어야 한다.
alter table songs alter column session_id drop not null;

-- 어떤 가사로 만든 곡인지. 같은 어르신에게 같은 가사면 다시 만들지 않는다.
alter table songs add column if not exists lyrics_hash text;
alter table songs add column if not exists participant_id uuid references participants(id) on delete cascade;
alter table songs add column if not exists length_ms integer;

-- 이것이 재생성을 막는 핵심이다. 같은 어르신·같은 가사·같은 스타일이면
-- 한 행만 존재한다.
create unique index if not exists songs_participant_lyrics_idx
  on songs (participant_id, lyrics_hash, style)
  where lyrics_hash is not null;

create index if not exists songs_participant_idx on songs (participant_id, created_at desc);

-- ─────────────────────────────────────────── 보관기간
--
-- 곡은 원자료가 아니라 어르신께 드리는 결과물이다. 녹음(30일)과 같은 기준을
-- 적용하면 선물이 한 달 만에 사라진다. 그렇다고 무기한도 안 된다.
--
-- 기본 3년으로 둔다. 기관 기록 보존 관행과 맞물리는 값이고, 필요하면 기관마다
-- 바꿀 수 있게 열어 둔다. 삭제 요청이 오면 기간과 무관하게 즉시 지운다 —
-- 보관기간은 상한이지 의무가 아니다.
alter table tenants add column if not exists song_retention_days integer not null default 1095;

do $$ begin
  alter table tenants add constraint song_retention_bounded
    check (song_retention_days between 30 and 3650) not valid;
exception when duplicate_object then null; end $$;

comment on column tenants.song_retention_days is
  '곡 보관 상한(일). 기본 3년. 삭제 요청 시에는 기간과 무관하게 즉시 지운다.';
