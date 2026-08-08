-- 0001_init.sql 이 "돌아간다"가 아니라 "지켜야 할 것을 지킨다"를 확인한다.
--
-- 실행: 0001_init.sql 을 적용한 뒤, 같은 SQL Editor 에 이 파일을 붙여넣고 Run.
-- 전체가 하나의 트랜잭션이고 끝에서 ROLLBACK 하므로, 검사용 데이터는 남지 않는다.
--
-- 읽는 법: 오류 없이 끝나면 전부 통과다. 하나라도 어긋나면 그 자리에서
-- 무엇이 왜 틀렸는지와 함께 멈춘다. 마지막 SELECT 는 통과 목록을 보여준다.

begin;

create temporary table _checks (n text, what text) on commit drop;
-- 아래에서 authenticated 롤로 바꿔 검사하므로, 그 롤도 결과를 적을 수 있어야 한다
grant insert, select on _checks to public;

-- ── 1. public 의 모든 테이블에 RLS 가 켜져 있는가 (NFR-SEC-001)
do $$
declare bad text[];
begin
  select array_agg(c.relname order by c.relname) into bad
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if bad is not null then
    raise exception 'RLS 가 꺼진 테이블이 있습니다: %', bad;
  end if;
  insert into _checks values ('1', 'public 의 모든 테이블에 RLS');
end $$;

-- ── 씨앗. 여기까지는 서비스 롤이라 RLS 를 통과한다.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'director-a@toktok.test'),
  ('22222222-2222-2222-2222-222222222222', 'director-b@toktok.test'),
  ('33333333-3333-3333-3333-333333333333', 'worker-a@toktok.test')
on conflict (id) do nothing;

insert into tenants (id, name, region) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '검사용 A기관', '충청북도 청주시'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '검사용 B기관', '서울특별시');

insert into memberships (tenant_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'director'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'director'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'worker');

insert into participants (tenant_id, display_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'A기관 어르신'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'B기관 어르신');

-- ── 여기서부터는 앱과 같은 조건: authenticated 롤 + JWT 의 sub
-- (서비스 롤은 RLS 를 우회하므로, 그대로 두면 아무것도 검사되지 않는다)
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

-- ── 2. 다른 기관의 어르신은 존재하지 않는 것처럼 보여야 한다
do $$
declare names text[];
begin
  select array_agg(display_name order by display_name) into names from participants;
  if names is distinct from array['A기관 어르신'] then
    raise exception '기관 격리 실패 — 보이는 어르신: %', names;
  end if;
  insert into _checks values ('2', '다른 기관 어르신이 보이지 않음');
end $$;

-- ── 3. 남의 기관에는 쓸 수 없다
do $$
begin
  begin
    insert into participants (tenant_id, display_name)
      values ('bbbbbbbb-0000-0000-0000-000000000002', '몰래 넣은 어르신');
    raise exception '남의 기관에 INSERT 가 성공했습니다';
  exception when insufficient_privilege then
    insert into _checks values ('3', '남의 기관에 INSERT 거부');
  end;
end $$;

-- ── 4. 출처 없는 사실은 확정될 수 없다 (원칙 2)
--    트리거가 deferred 이므로 INSERT 시점이 아니라 커밋 시점에 걸린다.
--    검사에서는 SET CONSTRAINTS 로 그 시점을 당겨 온다.
do $$
declare sid uuid; fid uuid;
        pid uuid := (select id from participants limit 1);
        mid uuid := (select id from memberships
                      where user_id = '11111111-1111-1111-1111-111111111111');
begin
  insert into sessions (tenant_id, participant_id, topic)
    values ('aaaaaaaa-0000-0000-0000-000000000001', pid, '첫 직장')
    returning id into sid;

  -- 4a. 출처를 안 붙이면 커밋이 거부되어야 한다
  begin
    insert into story_facts (tenant_id, session_id, participant_id, text,
                             status, decided_by, decided_at)
      values ('aaaaaaaa-0000-0000-0000-000000000001', sid, pid,
              '열아홉에 방직공장에 들어갔다', 'verified', mid, now());
    set constraints all immediate;          -- 커밋 시점을 여기로 당긴다
    raise exception '출처 없는 사실이 확정되었습니다';
  exception when raise_exception then
    if sqlerrm not like '%출처 없는%' then raise; end if;
    insert into _checks values ('4a', '출처 없는 사실은 확정 거부');
  end;

  -- 4b. 같은 트랜잭션에서 출처를 함께 넣으면 통과해야 한다.
  --     사실을 먼저, 출처를 나중에 넣어도 되는 것이 deferred 의 이유다.
  set constraints all deferred;
  insert into story_facts (tenant_id, session_id, participant_id, text,
                           status, decided_by, decided_at)
    values ('aaaaaaaa-0000-0000-0000-000000000001', sid, pid,
            '열아홉에 방직공장에 들어갔다', 'verified', mid, now())
    returning id into fid;
  insert into fact_sources (fact_id, kind, at_sec, label)
    values (fid, 'voice', 42, '어르신 음성 0:42');
  set constraints all immediate;
  insert into _checks values ('4b', '출처를 함께 넣으면 확정됨 (순서 무관)');
  set constraints all deferred;
end $$;

-- ── 5. 어르신이 확인해 준 시점 없이는 확정 불가 (원칙 1·3)
do $$
declare pid uuid := (select id from participants limit 1);
        sid uuid := (select id from sessions limit 1);
begin
  begin
    insert into story_facts (tenant_id, session_id, participant_id, text, status)
      values ('aaaaaaaa-0000-0000-0000-000000000001', sid, pid, '확인 안 받은 말', 'verified');
    raise exception 'decided_at 없이 verified 로 저장되었습니다';
  exception when check_violation then
    insert into _checks values ('5', '확인 시점 없이는 확정 불가');
  end;
end $$;

-- ── 6. 감사로그는 남기고 읽을 수만 있다 (NFR-OPS-003)
do $$
declare n int;
begin
  insert into audit_log (tenant_id, actor, action, target, reason)
    values ('aaaaaaaa-0000-0000-0000-000000000001',
            '11111111-1111-1111-1111-111111111111',
            'consent.grant', 'participant:A', '동의 갱신');

  update audit_log set action = '조작됨';
  get diagnostics n = row_count;
  if n <> 0 then raise exception '감사로그가 수정되었습니다 (%건)', n; end if;

  delete from audit_log;
  get diagnostics n = row_count;
  if n <> 0 then raise exception '감사로그가 삭제되었습니다 (%건)', n; end if;

  insert into _checks values ('6', '감사로그 수정·삭제 불가');
end $$;

-- ── 7. 같은 요청이 두 번 와도 곡은 하나 (NFR-OPS-001)
do $$
declare sid uuid := (select id from sessions limit 1);
begin
  insert into songs (tenant_id, session_id, title, idem_key)
    values ('aaaaaaaa-0000-0000-0000-000000000001', sid, '열아홉의 봄', 'job-abc');
  begin
    insert into songs (tenant_id, session_id, title, idem_key)
      values ('aaaaaaaa-0000-0000-0000-000000000001', sid, '열아홉의 봄', 'job-abc');
    raise exception '같은 요청키로 곡이 두 번 만들어졌습니다';
  exception when unique_violation then
    insert into _checks values ('7', '같은 요청키는 한 번만');
  end;
end $$;

-- ── 8. 직원 초대·역할 변경은 센터장만 (F-CM-STAFF-002)
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
do $$
declare n int;
begin
  begin
    insert into memberships (tenant_id, user_id, role)
      values ('aaaaaaaa-0000-0000-0000-000000000001',
              '22222222-2222-2222-2222-222222222222', 'worker');
    raise exception '복지사가 직원을 추가했습니다';
  exception when insufficient_privilege then
    insert into _checks values ('8a', '복지사는 직원 추가 불가');
  end;

  update memberships set role = 'director'
   where user_id = '33333333-3333-3333-3333-333333333333';
  get diagnostics n = row_count;
  if n <> 0 then raise exception '복지사가 스스로 센터장이 되었습니다'; end if;
  insert into _checks values ('8b', '복지사는 자기 역할을 못 올림');
end $$;

-- ── 9. 로그인하지 않았으면 아무것도 보이지 않는다
select set_config('request.jwt.claim.sub', '', true);
do $$
declare n int; m int;
begin
  select count(*) into n from participants;
  select count(*) into m from tenants;
  if n <> 0 or m <> 0 then
    raise exception '익명 상태에서 어르신 %건, 기관 %건이 보입니다', n, m;
  end if;
  insert into _checks values ('9', '로그인 전에는 0건');
end $$;

reset role;
select n as "검사", what as "확인한 것" from _checks order by n;

rollback;
