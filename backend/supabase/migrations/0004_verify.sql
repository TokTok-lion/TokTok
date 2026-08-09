-- 0004 가 "함수가 있다"가 아니라 "실제로 막는다"를 확인한다.
--
-- 실행: 0004 를 적용한 뒤 SQL Editor 에 붙여넣고 Run.
-- 하나의 트랜잭션이고 끝에서 ROLLBACK 하므로 아무것도 남지 않는다.

begin;

create temporary table _c (n text, what text) on commit drop;
grant insert, select on _c to public;

insert into auth.users (id, email) values
  ('a1a10000-0000-0000-0000-00000000000a', 'new1@toktok.test'),
  ('b1b10000-0000-0000-0000-00000000000b', 'new2@toktok.test'),
  ('c1c10000-0000-0000-0000-00000000000c', 'nomember@toktok.test')
on conflict (id) do nothing;

set local role authenticated;

-- ── 1. 가입하면 기관이 생기고 본인이 센터장이 된다
select set_config('request.jwt.claim.sub', 'a1a10000-0000-0000-0000-00000000000a', true);
do $$
declare t uuid; r staff_role;
begin
  t := create_my_tenant('가입검사 기관', '충청북도 청주시');
  if t is null then raise exception '기관이 만들어지지 않았습니다'; end if;

  select role into r from memberships
   where tenant_id = t and user_id = 'a1a10000-0000-0000-0000-00000000000a';
  if r is distinct from 'director' then
    raise exception '가입자가 센터장이 되지 않았습니다: %', r;
  end if;
  insert into _c values ('1', '가입 = 기관 생성 + 본인이 센터장');
end $$;

-- ── 2. 무료 기본값이 붙는다
do $$
declare p text; q int;
begin
  select plan, song_quota into p, q from tenants where name = '가입검사 기관';
  if p <> 'free' or q <> 3 then
    raise exception '무료 기본값이 아닙니다: plan=% quota=%', p, q;
  end if;
  insert into _c values ('2', format('무료 요금제 · 월 %s곡', q));
end $$;

-- ── 3. 같은 사람이 기관을 또 만들 수는 없다
do $$
begin
  begin
    perform create_my_tenant('두 번째 기관', null);
    raise exception '한 사람이 기관을 두 개 만들었습니다';
  exception when unique_violation then
    insert into _c values ('3', '이미 소속이 있으면 기관을 또 못 만듦');
  end;
end $$;

-- ── 4. 이름이 비면 거부한다
select set_config('request.jwt.claim.sub', 'b1b10000-0000-0000-0000-00000000000b', true);
do $$
begin
  begin
    perform create_my_tenant('  ', null);
    raise exception '빈 이름으로 기관이 만들어졌습니다';
  exception when invalid_parameter_value then
    insert into _c values ('4', '빈 기관 이름은 거부');
  end;
end $$;

-- ── 5. 로그인하지 않으면 기관을 만들 수 없다
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  begin
    perform create_my_tenant('익명 기관', null);
    raise exception '로그인 없이 기관이 만들어졌습니다';
  exception when insufficient_privilege then
    insert into _c values ('5', '로그인 없이는 기관 생성 불가');
  end;
end $$;

-- ── 6. 남은 곡 수가 보이고, 곡을 만들수록 줄어든다
select set_config('request.jwt.claim.sub', 'a1a10000-0000-0000-0000-00000000000a', true);
do $$
declare t uuid; p uuid; s uuid; left1 int; left2 int;
begin
  select id into t from tenants where name = '가입검사 기관';
  insert into participants (tenant_id, display_name) values (t, '검사 어르신') returning id into p;
  insert into sessions (tenant_id, participant_id, topic) values (t, p, '첫 직장') returning id into s;

  left1 := song_quota_left();
  if left1 <> 3 then raise exception '처음 남은 곡이 3이 아닙니다: %', left1; end if;

  insert into songs (tenant_id, session_id, participant_id, title, style, lyrics_hash)
       values (t, s, p, '곡1', 'ballad', 'H1');

  left2 := song_quota_left();
  if left2 <> 2 then raise exception '곡을 만들었는데 남은 수가 안 줄었습니다: %', left2; end if;
  insert into _c values ('6', format('남은 곡 %s → %s 로 줄어듦', left1, left2));
end $$;

-- ── 7. 한도를 넘으면 실제로 막힌다
--    화면 검사는 우회할 수 있다. 표에 기록되는 마지막 지점에서 막혀야 한다.
do $$
declare t uuid; p uuid; s uuid;
begin
  select id into t from tenants where name = '가입검사 기관';
  select id into p from participants where tenant_id = t limit 1;
  select id into s from sessions where tenant_id = t limit 1;

  insert into songs (tenant_id, session_id, participant_id, title, style, lyrics_hash)
       values (t, s, p, '곡2', 'ballad', 'H2');
  insert into songs (tenant_id, session_id, participant_id, title, style, lyrics_hash)
       values (t, s, p, '곡3', 'ballad', 'H3');

  begin
    insert into songs (tenant_id, session_id, participant_id, title, style, lyrics_hash)
         values (t, s, p, '곡4', 'ballad', 'H4');
    raise exception '한도를 넘겨 곡이 만들어졌습니다';
  exception when others then
    if sqlstate <> '53400' then raise; end if;
    insert into _c values ('7', '한도를 넘으면 DB 가 거부');
  end;
end $$;

-- ── 8. 남은 곡이 0으로 보인다
do $$
declare n int;
begin
  n := song_quota_left();
  if n <> 0 then raise exception '한도를 다 썼는데 남은 곡이 %입니다', n; end if;
  insert into _c values ('8', '다 쓰면 남은 곡 0');
end $$;

-- ── 9. 소속이 없으면 남은 곡을 물어도 아무것도 안 나온다
select set_config('request.jwt.claim.sub', 'c1c10000-0000-0000-0000-00000000000c', true);
do $$
declare n int;
begin
  n := song_quota_left();
  if n is not null then
    raise exception '소속 없는 계정에 남은 곡이 %로 나옵니다', n;
  end if;
  insert into _c values ('9', '소속 없으면 한도 조회도 비어 있음');
end $$;

reset role;
select n as "검사", what as "확인한 것" from _c order by n;

rollback;
