-- 복지사 가입과 기관 합류
--
-- 0004 는 "가입이 곧 기관 생성"이었다. 무소속 계정을 없애려는 선택이었는데,
-- 팔면서 두 가지가 어긋났다.
--
-- 1) 똑똑은 찾아가서 계약하고 계정을 만들어 드리는 방식으로 판다. 그런데
--    누구나 기관을 만들 수 있으면 요금·한도·보관정책을 함께 정하는 앞단이
--    통째로 건너뛰어진다.
--
-- 2) 더 나쁜 것. 같은 센터의 두 번째 복지사가 가입하면 create_my_tenant 가
--    **새 기관**을 만든다. 한 센터가 tenant 두 개로 갈라지고, 어르신도 회기도
--    서로 안 보인다. 되돌릴 길도 없다 — 이미 소속이 있는 사람은 다른 기관에
--    못 들어간다. 계약 한 곳이 계정 두 개로 쪼개진 채 굳는다.
--
-- 그래서 합류하는 길을 낸다. 기관마다 코드를 하나 두고, 복지사는 그 코드로
-- 자기 계정을 만들어 들어온다. 어르신은 tenant 단위 RLS 라 같은 기관이면
-- 저절로 공유된다 — 그 부분은 처음부터 되어 있었다.
--
-- 메일 초대가 아니라 코드인 이유: 센터장이 복지사 이메일을 전부 알고 있으리라는
-- 보장이 없고, 이 서비스에는 메일 발송 인프라도 없다. 코드는 카톡으로 보내면
-- 끝이고, 요양기관의 실제 업무 방식에 가깝다.
--
-- 실행: SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전하다.

-- ─────────────────────────────────────────── 기관 코드

alter table tenants add column if not exists join_code text;

do $$ begin
  alter table tenants add constraint tenant_join_code_unique unique (join_code);
exception when duplicate_object then null; end $$;

comment on column tenants.join_code is
  '복지사가 이 기관에 합류할 때 입력하는 코드. 센터장이 직원에게 전달한다. '
  '헷갈리는 글자(0·O·1·I)를 뺀 8자리라 받아 적어 옮기기 쉽다.';

/*
 * 코드를 만든다.
 *
 * 0·O·1·I·5·S 처럼 손으로 옮길 때 헷갈리는 글자는 뺐다. 카톡으로 받아
 * 태블릿에 치는 값이라, 한 글자 틀리면 "코드가 맞지 않아요"만 보고 왜인지
 * 모른 채 다시 물어야 한다.
 */
create or replace function make_join_code()
returns text
language plpgsql
volatile
as $$
declare
  -- 뺀 글자: 0 O · 1 I · 5 S. 손으로 옮길 때 서로 헷갈리는 짝들이다.
  alphabet constant text := 'ABCDEFGHJKLMNPQRTUVWXYZ2346789';
  candidate text;
begin
  loop
    candidate := '';
    for i in 1..8 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from tenants where join_code = candidate);
  end loop;
  return candidate;
end $$;

-- 이미 있는 기관에도 코드를 채운다. 없으면 그 기관 복지사는 합류할 수 없다.
update tenants set join_code = make_join_code() where join_code is null;

alter table tenants alter column join_code set default make_join_code();

-- ─────────────────────────────────────────── 기관에 합류
--
-- memberships 에는 INSERT 정책이 없다(0001). 앱이 직접 넣을 수 있으면 남의
-- 기관에 자기를 넣는 길이 생긴다. 그래서 이 함수만이 유일한 통로다.
--
-- security definer 로 돌되 안에서 네 가지를 강제한다:
--
--   1. 로그인한 사람만
--   2. 코드가 맞는 활성 기관만
--   3. 넣는 사람은 auth.uid() 뿐이다 — 인자로 user_id 를 받지 않는 이유가 그것이다
--   4. 역할은 언제나 worker — 코드를 아는 것만으로 센터장이 될 수는 없다

create or replace function join_tenant(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_code   text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_tenant uuid;
begin
  if v_user is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;

  if char_length(v_code) < 4 then
    raise exception '기관 코드를 확인해 주세요.' using errcode = '22023';
  end if;

  select id into v_tenant
    from tenants
   where join_code = v_code and status = 'active';

  if v_tenant is null then
    -- 어느 쪽으로 틀렸는지 말하지 않는다. 코드 하나로 남의 기관에 붙는 일을
    -- 시도해 볼 수 있는 자리라, 있는 코드인지 아닌지를 알려 주지 않는다.
    raise exception '기관 코드를 확인해 주세요.' using errcode = '22023';
  end if;

  -- 이미 그 기관 사람이면 조용히 통과시킨다. 코드를 두 번 넣는 것은 흔한
  -- 일이고, 그때 오류를 내면 멀쩡히 들어와 있는 사람이 막힌 줄 안다.
  if exists (
    select 1 from memberships
     where user_id = v_user and tenant_id = v_tenant and status = 'active'
  ) then
    return v_tenant;
  end if;

  if exists (
    select 1 from memberships where user_id = v_user and status = 'active'
  ) then
    raise exception '이미 다른 기관에 소속돼 있어요.' using errcode = '23505';
  end if;

  insert into memberships (tenant_id, user_id, role)
       values (v_tenant, v_user, 'worker')
  on conflict (tenant_id, user_id) do update set status = 'active';

  return v_tenant;
end $$;

revoke all on function join_tenant(text) from public;
grant execute on function join_tenant(text) to authenticated;

-- ─────────────────────────────────────────── 우리 기관 코드 보기
--
-- tenants 를 통째로 읽게 두지 않고 코드 한 칸만 내준다. 센터장이 직원에게
-- 전달할 값이라 화면에 필요하다.

create or replace function my_join_code()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select t.join_code
    from tenants t
   where t.id in (select current_tenant_ids())
   limit 1
$$;

grant execute on function my_join_code() to authenticated;
