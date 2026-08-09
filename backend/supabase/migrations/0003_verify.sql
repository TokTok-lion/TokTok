-- 0003 이 "정책이 있다"가 아니라 "실제로 막는다"를 확인한다.
--
-- 실행: 0003 을 적용한 뒤 SQL Editor 에 붙여넣고 Run.
-- 하나의 트랜잭션이고 끝에서 ROLLBACK 하므로 아무것도 남지 않는다.

begin;

create temporary table _c (n text, what text) on commit drop;
grant insert, select on _c to public;

insert into auth.users (id, email) values
  ('aaaa0000-0000-0000-0000-00000000000a', 'a@toktok.test'),
  ('bbbb0000-0000-0000-0000-00000000000b', 'b@toktok.test')
on conflict (id) do nothing;

insert into tenants (id, name) values
  ('11110000-0000-0000-0000-000000000001', '검사 A기관'),
  ('22220000-0000-0000-0000-000000000002', '검사 B기관');

insert into memberships (tenant_id, user_id, role) values
  ('11110000-0000-0000-0000-000000000001', 'aaaa0000-0000-0000-0000-00000000000a', 'director'),
  ('22220000-0000-0000-0000-000000000002', 'bbbb0000-0000-0000-0000-00000000000b', 'director');

insert into participants (id, tenant_id, display_name) values
  ('33330000-0000-0000-0000-000000000003', '11110000-0000-0000-0000-000000000001', 'A기관 어르신'),
  ('44440000-0000-0000-0000-000000000004', '22220000-0000-0000-0000-000000000002', 'B기관 어르신');

insert into sessions (id, tenant_id, participant_id, topic) values
  ('55550000-0000-0000-0000-000000000005', '11110000-0000-0000-0000-000000000001',
   '33330000-0000-0000-0000-000000000003', '첫 직장');

-- 두 기관의 곡 파일을 각각 하나씩 (서비스 롤이라 정책을 통과한다)
insert into storage.objects (bucket_id, name) values
  ('songs', '11110000-0000-0000-0000-000000000001/33330000-0000-0000-0000-000000000003/s1.mp3'),
  ('songs', '22220000-0000-0000-0000-000000000002/44440000-0000-0000-0000-000000000004/s2.mp3');

-- ── 1. 버킷이 비공개인가
do $$
declare pub boolean;
begin
  select public into pub from storage.buckets where id = 'songs';
  if pub is not false then
    raise exception '곡 버킷이 공개로 열려 있습니다 — 링크만 알면 누구나 받습니다';
  end if;
  insert into _c values ('1', '곡 버킷이 비공개');
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaa0000-0000-0000-0000-00000000000a', true);

-- ── 2. 남의 기관 곡 파일은 보이지 않는다
do $$
declare n int;
begin
  select count(*) into n from storage.objects where bucket_id = 'songs';
  if n <> 1 then
    raise exception 'A기관 직원에게 곡 파일이 %건 보입니다 (1건이어야 함)', n;
  end if;
  insert into _c values ('2', '남의 기관 곡 파일이 보이지 않음');
end $$;

-- ── 3. 남의 기관 폴더에는 올릴 수 없다
do $$
begin
  begin
    insert into storage.objects (bucket_id, name)
      values ('songs', '22220000-0000-0000-0000-000000000002/44440000-0000-0000-0000-000000000004/x.mp3');
    raise exception '남의 기관 폴더에 업로드가 성공했습니다';
  exception when insufficient_privilege then
    insert into _c values ('3', '남의 기관 폴더에 업로드 거부');
  end;
end $$;

-- ── 4. 내 기관 폴더에는 올릴 수 있다
do $$
begin
  insert into storage.objects (bucket_id, name)
    values ('songs', '11110000-0000-0000-0000-000000000001/33330000-0000-0000-0000-000000000003/new.mp3');
  insert into _c values ('4', '내 기관 폴더에는 업로드 가능');
end $$;

-- ── 5. 지우는 길이 열려 있다 (삭제 요청에 응할 수 있어야 한다)
do $$
declare n int;
begin
  delete from storage.objects
   where bucket_id = 'songs'
     and name like '11110000-0000-0000-0000-000000000001/%new.mp3';
  get diagnostics n = row_count;
  if n <> 1 then raise exception '내 기관 파일을 지우지 못했습니다'; end if;
  insert into _c values ('5', '내 기관 파일 삭제 가능');
end $$;

-- ── 6. 같은 어르신·같은 가사로는 곡이 두 개 생기지 않는다
--    이것이 재생성을 막는 핵심이다. 곡 하나가 1,125크레딧이라 여기가 뚫리면
--    태블릿을 바꿀 때마다 요금이 나간다.
do $$
begin
  insert into songs (tenant_id, session_id, participant_id, title, style, lyrics_hash)
  values ('11110000-0000-0000-0000-000000000001', '55550000-0000-0000-0000-000000000005',
          '33330000-0000-0000-0000-000000000003', '테스트곡', 'ballad', 'HASH-A');
  begin
    insert into songs (tenant_id, session_id, participant_id, title, style, lyrics_hash)
    values ('11110000-0000-0000-0000-000000000001', '55550000-0000-0000-0000-000000000005',
            '33330000-0000-0000-0000-000000000003', '테스트곡', 'ballad', 'HASH-A');
    raise exception '같은 가사로 곡이 두 번 만들어졌습니다';
  exception when unique_violation then
    insert into _c values ('6', '같은 어르신·같은 가사는 곡 하나만');
  end;
end $$;

-- ── 7. 보관기간이 무한이 아니다
do $$
declare d int;
begin
  select song_retention_days into d from tenants limit 1;
  if d is null or d > 3650 then
    raise exception '곡 보관기간이 무한이거나 너무 깁니다: %', d;
  end if;
  insert into _c values ('7', format('곡 보관 상한 %s일 (무기한 아님)', d));
end $$;

reset role;
select n as "검사", what as "확인한 것" from _c order by n;

rollback;
