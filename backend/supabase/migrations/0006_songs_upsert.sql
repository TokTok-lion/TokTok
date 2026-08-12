-- 곡이 기관 표에 한 번도 저장되지 않고 있었다
--
-- 증상: 파일은 storage 에 멀쩡히 올라가는데(3.8MB mp3 확인) songs 표에는
-- 행이 하나도 없었다. 그래서
--
--   · 다른 태블릿에서 그 곡을 볼 수 없고 (보관함은 표를 읽는다)
--   · findServerSong 이 늘 빈손으로 돌아와, 같은 어르신·같은 가사인데도
--     태블릿을 바꾸면 곡을 새로 만들었다 — 곡 하나가 1,125크레딧이다
--
-- 원인은 0003 이 만든 이 인덱스다.
--
--   create unique index songs_participant_lyrics_idx
--     on songs (participant_id, lyrics_hash, style)
--     where lyrics_hash is not null;          -- ← 이 줄
--
-- 부분 인덱스(partial index)는 ON CONFLICT 의 대상이 되지 못한다. 정확히는,
-- 포스트그레스가 어느 인덱스를 쓸지 추론하려면 인덱스의 조건식이 질의에도
-- 그대로 적혀 있어야 하는데, PostgREST 의 on_conflict 는 컬럼 이름만 보내고
-- WHERE 를 붙일 방법이 없다. 그래서 앱이 부르면 이렇게 답한다.
--
--   42P10  there is no unique or exclusion constraint matching
--          the ON CONFLICT specification
--
-- 이 오류는 upsert 한 번을 통째로 실패시키는데, uploadSong 은 실패해도 회기를
-- 막지 않도록 결과를 삼키게 되어 있다(그 판단 자체는 맞다 — 어르신 앞에서
-- 통신 때문에 멈추면 안 된다). 그래서 아무도 모른 채로 계속 실패했다.
--
-- 고침: 조건을 뗀다.
--
-- 조건을 뗐을 때 lyrics_hash 가 없는 옛 곡들이 서로 부딪히지 않을까? 안
-- 부딪힌다. 유니크 인덱스에서 NULL 은 서로 다른 값으로 보므로, 지문이 없는
-- 행은 몇 개가 있어도 충돌하지 않는다 — 0003 이 WHERE 로 막으려 했던 것이
-- 애초에 그것이었고, 그건 조건 없이도 이미 성립한다.
--
-- 실행: SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전하다.

drop index if exists songs_participant_lyrics_idx;

create unique index if not exists songs_participant_lyrics_idx
  on songs (participant_id, lyrics_hash, style);

comment on index songs_participant_lyrics_idx is
  '같은 어르신·같은 가사·같은 분위기면 한 행. uploadSong 의 on_conflict 대상이라 '
  '부분 인덱스로 만들면 안 된다 — 그러면 42P10 으로 upsert 가 통째로 실패한다.';

-- ─────────────────────────────────────────── 확인
--
-- 고쳐졌는지 눈으로 본다. 조건식(indpred)이 비어 있어야 한다.

do $$
declare has_predicate boolean;
begin
  select indpred is not null into has_predicate
    from pg_index
   where indexrelid = 'songs_participant_lyrics_idx'::regclass;

  if has_predicate then
    raise exception '아직 부분 인덱스다 — upsert 가 계속 실패한다';
  end if;

  raise notice '곡 upsert 인덱스 정상 — 이제 songs 표에 행이 쌓인다';
end $$;
