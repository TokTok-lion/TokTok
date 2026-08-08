-- 첫 기관과 첫 센터장 만들기
--
-- 이 두 가지는 앱에서 만들 수 없습니다. tenants INSERT 와 첫 membership 에는
-- 정책이 없기 때문입니다 — 앱에서 기관을 만들 수 있으면 남의 기관에 자기를
-- 직원으로 넣는 길이 생깁니다. 그래서 SQL Editor(서비스 롤)에서만 만듭니다.
--
-- 순서:
--   1. 대시보드 Authentication > Users > Add user 로 센터장 계정을 먼저 만듭니다.
--      "Auto Confirm User" 를 켜세요. 안 켜면 메일 인증 전까지 로그인이 안 됩니다.
--   2. 아래 세 값을 고칩니다.
--   3. SQL Editor 에 붙여넣고 Run.
--
-- 여러 번 실행해도 기관이 여러 개 생기지 않습니다.

do $$
declare
  -- ────────────── 여기 세 줄만 고치세요 ──────────────
  v_name   text := '햇살주야간보호센터';
  v_region text := '충청북도 청주시';
  v_email  text := 'director@example.com';   -- 1번에서 만든 계정의 이메일
  -- ───────────────────────────────────────────────────
  v_tenant uuid;
  v_user   uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(v_email);
  if v_user is null then
    raise exception
      '그 이메일의 계정이 없습니다: %  →  Authentication > Users 에서 먼저 만들어 주세요',
      v_email;
  end if;

  select id into v_tenant from tenants where name = v_name;
  if v_tenant is null then
    insert into tenants (name, region) values (v_name, v_region)
      returning id into v_tenant;
    raise notice '기관을 만들었습니다: %', v_name;
  else
    raise notice '기관이 이미 있습니다: %', v_name;
  end if;

  insert into memberships (tenant_id, user_id, role)
       values (v_tenant, v_user, 'director')
  on conflict (tenant_id, user_id)
    do update set role = 'director', status = 'active';

  raise notice '센터장으로 등록했습니다: %', v_email;
end $$;

-- 확인용. 한 줄이 나오면 성공입니다.
select t.name as "기관", t.region as "지역", u.email as "센터장", m.role as "권한"
  from memberships m
  join tenants t on t.id = m.tenant_id
  join auth.users u on u.id = m.user_id
 where m.role = 'director';
