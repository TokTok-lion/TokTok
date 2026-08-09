-- 기관 가입과 무료 한도
--
-- 지금까지 기관과 첫 센터장은 SQL Editor 에서 손으로 만들었다. 계약한 기관이
-- 몇 곳일 때는 그래도 되지만, 무료로 열어 보게 하려면 스스로 시작할 수 있어야
-- 한다.
--
-- 개인 가입은 열지 않는다. 누구나 가입하면 어느 기관에도 속하지 않은 계정이
-- 쌓이고, 그중 하나가 남의 기관 데이터에 붙는 사고가 난다. 대신 가입이 곧
-- 기관 생성이다 — 모든 계정이 자기 기관을 갖고 태어나므로 무소속이 없다.
--
-- 실행: SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전하다.

-- ─────────────────────────────────────────── 요금제와 한도

alter table tenants add column if not exists plan text not null default 'free';
alter table tenants add column if not exists song_quota integer not null default 3;

do $$ begin
  alter table tenants add constraint tenant_plan_known
    check (plan in ('free', 'starter', 'pro'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table tenants add constraint song_quota_sane
    check (song_quota between 0 and 100000);
exception when duplicate_object then null; end $$;

comment on column tenants.song_quota is
  '월 곡 생성 한도. 곡이 이 서비스에서 유일하게 비싼 자원이라(90초 1,125크레딧) '
  '여기만 센다. 전사·활동일지·읽어주기는 원가가 거의 없어 막지 않는다 — '
  '막으면 무료 사용자가 제품의 값어치를 느끼기 전에 떠난다.';

-- ─────────────────────────────────────────── 가입 = 기관 생성
--
-- tenants 에는 INSERT 정책이 없다(0001). 앱이 직접 기관을 만들 수 있으면
-- 남의 기관에 자기를 넣는 길이 생기기 때문이다. 그래서 이 함수만이 유일한
-- 통로다. security definer 로 돌되, 안에서 세 가지를 강제한다:
--
--   1. 로그인한 사람만
--   2. 이미 어느 기관에 속해 있으면 못 만든다 (기관 남발 방지)
--   3. 만든 기관의 센터장은 auth.uid() 뿐이다 — 남을 넣을 수 없다
--
-- 3번이 핵심이다. 인자로 user_id 를 받지 않는 이유가 그것이다.

create or replace function create_my_tenant(p_name text, p_region text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_tenant uuid;
  v_name   text := nullif(btrim(p_name), '');
begin
  if v_user is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;

  if v_name is null or char_length(v_name) < 2 then
    raise exception '기관 이름을 두 글자 이상 입력해 주세요.' using errcode = '22023';
  end if;

  if exists (
    select 1 from memberships
     where user_id = v_user and status = 'active'
  ) then
    raise exception '이미 소속된 기관이 있습니다.' using errcode = '23505';
  end if;

  insert into tenants (name, region)
       values (v_name, nullif(btrim(p_region), ''))
    returning id into v_tenant;

  -- 만든 사람이 그 기관의 센터장이 된다. 다른 사람은 넣을 수 없다.
  insert into memberships (tenant_id, user_id, role)
       values (v_tenant, v_user, 'director');

  return v_tenant;
end $$;

revoke all on function create_my_tenant(text, text) from public;
grant execute on function create_my_tenant(text, text) to authenticated;

-- ─────────────────────────────────────────── 이번 달 남은 곡 수

create or replace function song_quota_left()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
           0,
           t.song_quota - (
             select count(*)
               from songs s
              where s.tenant_id = t.id
                and s.created_at >= date_trunc('month', now())
           )
         )::int
    from tenants t
   where t.id in (select current_tenant_ids())
   limit 1
$$;

grant execute on function song_quota_left() to authenticated;

-- ─────────────────────────────────────────── 한도를 실제로 막는다
--
-- 화면에서 먼저 확인하지만 그것만으로는 부족하다. 화면 검사는 우회할 수 있고,
-- 우회되면 우리 크레딧이 나간다. 표에 기록되는 마지막 지점에서 한 번 더 막는다.

create or replace function enforce_song_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quota int;
  v_used  int;
begin
  select song_quota into v_quota from tenants where id = new.tenant_id;
  if v_quota is null then return new; end if;

  select count(*) into v_used
    from songs
   where tenant_id = new.tenant_id
     and created_at >= date_trunc('month', now());

  if v_used >= v_quota then
    raise exception '이번 달 곡 만들기 한도(%곡)를 다 쓰셨습니다.', v_quota
      using errcode = '53400';
  end if;
  return new;
end $$;

drop trigger if exists songs_quota_guard on songs;
create trigger songs_quota_guard
before insert on songs
for each row execute function enforce_song_quota();
