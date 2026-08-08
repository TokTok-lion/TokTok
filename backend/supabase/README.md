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

## 앱이 서버를 쓰는 방식

화면은 **항상 기기 저장(localStorage)을 봅니다.** 서버는 그 위에 얹히는 사본입니다.
순서를 이렇게 잡은 이유는 현장 때문입니다 — 주야간보호센터의 와이파이는 자주
끊기고, 어르신 앞에서 한 시간 들은 이야기가 통신 오류로 사라지는 일은 없어야
합니다. 그래서 서버 저장이 실패해도 회기는 그대로 진행되고, 실패는 화면에 남습니다.

상태는 네 가지입니다.

| 상태 | 뜻 | 화면 |
|---|---|---|
| `local` | 환경변수 없음 | 로그인 항목 자체를 숨김, 시연 데이터 |
| `out` | 로그인 안 됨 | 시연 데이터 + 로그인 안내 |
| `in` | 로그인 + 소속 확인 | 서버 데이터 |
| — | 소속 없는 계정 | `out`으로 되돌림 (볼 것이 없으므로) |

지금 서버를 실제로 쓰는 곳:

- 로그인 (`/login`), 더보기의 기관 계정
- 어르신 목록 (`/elder`) — 로그인 시 `participants`
- 활동일지 저장 (`/session/log`) — `sessions` + `story_facts` + `fact_sources`
  + `observations` + `activity_logs` 를 한 번에
- 센터장 콘솔 (`/center`) 맨 위 "기관 데이터" 패널

아직 기기 저장만 쓰는 곳: 가사·노래 생성 화면(연동할 벤더가 아직 없음),
콘솔의 파이프라인·비용·직원 지표(시연 데이터라고 화면에 적혀 있음).

## 검증

빈 PostgreSQL 17 컨테이너에 실제로 적용해서 확인했습니다.

- `0001_init.sql` 적용 → `0001_verify.sql` 11개 검사 전부 통과
- 같은 마이그레이션을 두 번째 적용해도 오류 없음 (idempotent)
- 재적용 뒤 검사 재실행도 통과, 검사가 남긴 행 0개

재현하려면 Docker 로:

```bash
docker run -d --name tokpg -e POSTGRES_PASSWORD=x postgres:17-alpine
```

컨테이너에는 Supabase 의 `auth` 스키마가 없으므로 `auth.users`·`auth.uid()`·
`authenticated` 롤을 먼저 만들어야 합니다. 스키마를 고치면 같은 방식으로 다시
확인하세요 — 특히 RLS 는 눈으로 읽어서는 맞는지 알 수 없습니다.
