-- 사연 그림 — 기관 저장소에 남긴다.
--
-- ── 왜 서버에 두나
--
-- 지금까지 그림은 태블릿 안에만 있었다(IndexedDB). 그래서
--   · 다른 복지사 태블릿에서는 안 보이고
--   · 기기를 초기화하면 사라지고
--   · 지난 회기 그림을 다시 볼 방법이 없었다.
--
-- 노래는 이미 이 길로 다니고 있다(0003_songs_storage). 그림도 같은 길로 둔다.
--
-- ── 보관 기간
--
-- 요청은 "영구"였다. 그런데 이 서비스에는 무기한 보관을 두지 않는다는 규칙이
-- 있다(명세 P0 · RETENTION_BOUNDS). 어르신 기록을 기한 없이 쥐고 있는 것은
-- 동의서에 적을 수 없는 말이기도 하다.
--
-- 그래서 결과물 중 가장 긴 기한인 **곡과 같은 5년**으로 둔다. 그림은 원본
-- 사진이 아니라 이야기에서 만들어진 산출물이라 사진(2년)이 아니라 곡 쪽에
-- 붙이는 것이 맞다. 더 길게 두려면 RETENTION_BOUNDS 자체를 바꿔야 하고,
-- 그건 동의서 문구와 함께 정할 일이다.

-- ─────────────────────────────────────────── 저장소

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('scenes', 'scenes', false, 10485760, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 경로는 `<tenant>/<participant>/<fact>.png` 다. 맨 앞 칸이 소속이라
-- 그것만 보고 가른다 — 곡 버킷과 같은 규칙이다.

drop policy if exists scenes_read on storage.objects;
create policy scenes_read on storage.objects for select
  using (
    bucket_id = 'scenes'
    and (storage.foldername(name))[1] in (select current_tenant_ids()::text)
  );

drop policy if exists scenes_write on storage.objects;
create policy scenes_write on storage.objects for insert
  with check (
    bucket_id = 'scenes'
    and (storage.foldername(name))[1] in (select current_tenant_ids()::text)
  );

drop policy if exists scenes_update on storage.objects;
create policy scenes_update on storage.objects for update
  using (
    bucket_id = 'scenes'
    and (storage.foldername(name))[1] in (select current_tenant_ids()::text)
  );

drop policy if exists scenes_delete on storage.objects;
create policy scenes_delete on storage.objects for delete
  using (
    bucket_id = 'scenes'
    and (storage.foldername(name))[1] in (select current_tenant_ids()::text)
  );

-- ─────────────────────────────────────────── 표

create table if not exists scenes (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  -- 어느 회기에서 나온 그림인지. 기기 쪽 sessionId 는 시각 문자열이라
  -- 회기 행과 못 잇는 경우가 있어 그대로 문자열로 둔다.
  session_key    text,
  -- 이 그림이 나온 사실 문장의 id. 같은 문장을 다시 그리면 덮어쓴다.
  fact_id        text not null,
  -- 그 문장 그대로. 그림 옆에 늘 함께 보여야 하므로 같이 둔다.
  text           text not null,
  image_path     text not null,
  -- 복지사가 쓰기로 한 그림인가. 확정 전에는 책·숏츠에 들어가지 않는다.
  approved       boolean not null default false,
  created_at     timestamptz not null default now(),
  -- 무기한은 두지 않는다. 곡과 같은 5년.
  expires_at     timestamptz not null default (now() + interval '1825 days'),
  unique (participant_id, fact_id)
);

create index if not exists scenes_tenant_idx on scenes (tenant_id, participant_id, created_at desc);
create index if not exists scenes_expiry_idx on scenes (expires_at);

alter table scenes enable row level security;

drop policy if exists scenes_select on scenes;
create policy scenes_select on scenes for select
  using (tenant_id in (select current_tenant_ids()));

drop policy if exists scenes_rw on scenes;
create policy scenes_rw on scenes for all
  using (tenant_id in (select current_tenant_ids()))
  with check (tenant_id in (select current_tenant_ids()));

-- ─────────────────────────────────────────── 확인
--
-- unique 제약이 부분 인덱스가 아닌지 본다. 부분 인덱스는 on_conflict 로 쓸 수
-- 없어서, 앱은 조용히 아무것도 저장하지 않게 된다 — 0006 에서 곡이 그랬다.

do $$
declare bad int;
begin
  select count(*) into bad
    from pg_index i
    join pg_class c on c.oid = i.indexrelid
   where i.indrelid = 'scenes'::regclass
     and i.indisunique
     and i.indpred is not null;
  if bad > 0 then
    raise exception '사연 그림 unique 인덱스에 조건이 붙어 있습니다 — on_conflict 로 쓸 수 없습니다';
  end if;
end $$;
