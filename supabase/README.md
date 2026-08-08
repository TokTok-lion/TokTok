# Supabase

앱은 지금도 Supabase 없이 동작합니다. 화면 상태는 기기(localStorage)에 저장되고,
`lib/supabase.ts`는 환경변수가 없으면 `null`을 돌려줍니다. 이 폴더는 그 다음 단계,
즉 여러 기기·여러 직원이 같은 기록을 보게 만들 때 쓰는 데이터베이스 정의입니다.

## 설정

1. `.env.example`을 `.env.local`로 복사하고 두 값을 채웁니다.
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable 키)
2. Supabase 대시보드 → SQL Editor에서 `migrations/0001_init.sql`을 붙여넣고 Run.
3. 배포본에도 같은 두 값을 Vercel 환경변수에 넣습니다.

`service_role` 키와 DB 접속 문자열은 이 저장소에 넣지 않습니다. 이 저장소는
공개되어 있고, 그 두 값은 RLS를 통째로 우회합니다.

## 왜 RLS부터인가

publishable 키는 브라우저 번들에 그대로 들어갑니다. 숨길 수 없는 값입니다.
이 키로 남의 기관 데이터를 못 읽는 유일한 이유는 모든 테이블에 RLS가 켜져 있고
정책이 "내가 소속된 기관"으로만 범위를 좁히기 때문입니다(NFR-SEC-001).

그래서 `0001_init.sql`은 테이블을 만들 때마다 RLS를 함께 켭니다. 정책이 없는
RLS는 "전부 거부"이므로, 나중에 테이블을 추가하고 정책을 잊더라도 데이터가
새는 대신 조회가 0건이 됩니다.

## 첫 기관 만들기

`tenants` INSERT와 첫 `memberships`(센터장)에는 정책이 없습니다. 앱에서는 만들 수
없고 SQL Editor에서만 만들 수 있습니다. 누구나 기관을 만들 수 있으면 남의 기관에
자기를 직원으로 넣는 길이 생기기 때문입니다.

```sql
-- 1) 대시보드 Authentication 에서 센터장 계정을 먼저 만든 뒤, 그 uid 로:
insert into tenants (name, region) values ('○○데이케어', '충청북도 청주시');
insert into memberships (tenant_id, user_id, role)
values ((select id from tenants where name = '○○데이케어'), '<센터장 uid>', 'director');
```

이후 직원 추가는 앱(센터장 콘솔)에서 됩니다.

## 지금 없는 것

명세서 v1.6의 데이터모델은 55개가 넘는 엔터티를 정의합니다. 이 마이그레이션은
그중 앱이 실제로 쓰는 13개만 만듭니다. 아직 없는 것들:

- 원음성·전사 파일(`AudioAsset`, `Transcript`) — Storage 버킷과 보관기간 정책이
  함께 정해져야 합니다. 지금 앱은 녹음을 서버로 보내지 않습니다.
- 프로그램 계획(`ProgramPlan`, `SessionPlan`)·출석·만족도 — 센터장 콘솔이 아직
  시드 데이터로 동작합니다.
- 삭제 승인 워크플로(`Approval`) — 2인 승인 규칙은 `lib/center.ts`에 있고,
  DB로 옮길 때 함께 만듭니다.

## 검증

이 마이그레이션은 빈 PostgreSQL에 두 번 연속 적용해서 확인했습니다. 격리·감사로그
불변·출처 필수 같은 규칙은 SQL 테스트로 검사합니다. 스키마를 고치면 같은 방식으로
다시 확인하세요.
