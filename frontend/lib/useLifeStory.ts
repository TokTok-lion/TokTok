'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount, type Account } from './auth';
import { lyricInputs } from './domain';
import { getSupabase } from './supabase';
import { SEED_PAST_FACTS } from './seed';
import { currentSession, useSession } from './store';

/**
 * 지금까지 모인 어르신의 이야기.
 *
 * 생애사는 한 회기에 다 나오지 않는다. 첫 회기에 "공장에 다녔다"가 나오고,
 * 세 번째에 "첫 월급으로 어머니께 신발을 사드렸다"가 나온다. 회기마다 곡을
 * 만들면 매번 조각난 이야기로 만들게 되고, 어르신께 드리는 노래로는 얕다.
 *
 * 여러 회기를 모으면 곡이 좋아지고, 부수적으로 곡 수가 줄어 요금도 준다.
 * 순서가 중요하다 — 요금 때문에 모으는 것이 아니라, 모으는 편이 좋은 곡이
 * 나오기 때문이고 요금은 따라온다.
 *
 * 지난 회기를 무엇으로 잡을지는 로그인 상태에 달렸는데, 예전에는 그 판정이
 * `account.status === 'in'` 하나였다. 로그인이 확인되기 전(loading)이나
 * 토큰이 풀린 뒤(out)에는 전부 "로그인 아님"으로 떨어져 씨앗 지난 기록이
 * 들어왔다. 그래서 회기 화면을 새로고침하면, 기기에 남아 있는 실제 어르신의
 * 확인된 이야기가 씨앗 어르신(김○○)의 '3회기 · 4월 18일'과 대조됐다 —
 * 그 어르신에게는 존재한 적 없는 회기 날짜다. 모르는 동안에는 아무것도
 * 주장하지 않는 편이 맞다.
 *
 * 그래서 이 훅은 지난 회기 목록만 주지 않고, 그 목록을 어디까지 아는지를
 * 함께 준다(PastState). '아직 모른다'·'없다'·'못 읽었다'·'예시다'는 화면에서
 * 각각 다른 말이 되어야 하고, 특히 '못 읽었다'가 '어긋난 곳이 없다'처럼
 * 보이면 안 된다.
 */

export type LifeFact = { id: string; text: string; when: string };

/** 지난 회기를 지금 어디까지 아는가. */
export type PastState =
  /** 로그인 확인 중. 무엇과 대조해야 하는지 아직 모르니 아무것도 대조하지 않는다. */
  | 'checking'
  /** 로그인됨. 이 어르신의 지난 회기를 서버에서 읽는 중. */
  | 'loading'
  /** 읽었다. 0개일 수도 있다 — 첫 회기면 대조할 지난 회기가 없는 게 정상이다. */
  | 'ready'
  /** 읽으려다 실패했다. '어긋난 곳이 없다'와 절대 같은 말이 아니다. */
  | 'failed'
  /** 이 기기의 회기는 기관에 등록된 어르신 것인데 로그인이 풀렸다 — 읽을 권한이 없다. */
  | 'signedOut'
  /** 둘러보기. 등록된 어르신이 아니므로 지난 회기가 씨앗 예시다. */
  | 'demo';

/**
 * 한 번 읽어 온 결과.
 *
 * key 는 이 결과가 어느 어르신 것인지다. 어르신을 바꾸면 새로 읽는 동안
 * 이전 어르신의 지난 회기가 그대로 남아 있었는데, 그러면 A의 지난 회기와
 * B의 이번 회기를 대조하게 된다 — 이 파일이 막으려는 바로 그 일이다.
 */
type PastLoad = { key: string; ok: boolean; facts: LifeFact[] };

/**
 * 지금 무엇과 대조할 수 있는가. 적힌 순서가 곧 판단 순서다.
 *
 * 로그인 상태를 먼저 보는 것이 핵심이다. 예전에는 '로그인됐다'만 물어서
 * 확인 중과 로그아웃이 한 칸에 들어갔고, 둘 다 씨앗 대조로 떨어졌다.
 */
function pastStateOf(
  status: Account['status'],
  key: string,
  loaded: PastLoad | null,
): PastState {
  // 아직 확인 중이면 아무것도 주장하지 않는다.
  if (status === 'loading') return 'checking';

  if (status === 'in') {
    if (!loaded) return 'loading';
    return loaded.ok ? 'ready' : 'failed';
  }

  // 로그인 밖. 이 기기의 회기가 기관에 등록된 어르신 것이라면 씨앗과 대조하면
  // 안 된다 — 그 어르신에게는 없었던 회기를 근거로 삼는 일이 된다.
  return key ? 'signedOut' : 'demo';
}

export function useLifeStory() {
  const { s } = useSession();
  const { account } = useAccount();
  const live = account.status === 'in';

  // 이 기기의 회기가 기관에 등록된 어르신 것인가. 빈 문자열이면 씨앗 회기다.
  const key = s.remoteParticipantId ?? '';

  const [past, setPast] = useState<PastLoad | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!live) return;
    let alive = true;
    void loadPastFacts().then((r) => {
      if (alive) setPast(r);
    });
    return () => {
      alive = false;
    };
  }, [live, key, attempt]);

  /** 못 읽었을 때 화면이 다시 시도할 수 있게 한다 — 막다른 길을 두지 않는다. */
  const reload = useCallback(() => {
    setPast(null);
    setAttempt((n) => n + 1);
  }, []);

  // 다른 어르신 것이면 아직 안 읽은 것으로 친다.
  const loaded = past && past.key === key ? past : null;
  const pastState = pastStateOf(account.status, key, loaded);

  // 이번 회기에서 어르신이 확인해 주신 것 (출처가 붙은 것만)
  const thisSession: LifeFact[] = lyricInputs(s.story).map((i) => ({
    id: i.id,
    text: i.text,
    when: '이번 회기',
  }));

  // 씨앗 지난 기록은 둘러보기에서만 쓴다. 확인 중이거나 못 읽은 동안에는
  // 빈 목록이다 — 모르는 것을 예시로 메우면 그 예시가 근거로 쓰인다.
  const previous = pastState === 'demo' ? SEED_PAST_FACTS : (loaded?.facts ?? []);

  // 같은 말이 여러 회기에 나오면 한 번만 쓴다. 노래에 같은 줄이 두 번
  // 들어가면 어르신이 "내가 이 말을 두 번 했나" 하고 헷갈리신다.
  const seen = new Set<string>();
  const all = [...previous, ...thisSession].filter((f) => {
    const k = f.text.replace(/\s/g, '');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // live(로그인 여부)는 내보내지 않는다. 이 버그가 바로 화면이 `live ? 실제 :
  // 씨앗` 으로 갈라서 생겼다 — 로그인 여부는 '확인 중'과 '로그아웃'을 한 칸에
  // 뭉뚱그린다. 같은 질문을 두 가지 방법으로 물을 수 있게 두면 다음 사람이
  // 다시 쉬운 쪽을 고른다. 지난 회기 이야기는 pastState 로만 묻는다.
  return {
    /** 이번 회기 것만 */
    thisSession,
    /** 지난 회기 것만 (대조에 실제로 쓴 것) */
    past: previous,
    /** 지난 회기 + 이번 회기 (중복 제거) */
    all,
    /** 지난 회기를 어디까지 아는지 */
    pastState,
    /** 지난 회기를 다시 읽어 본다 */
    reload,
    loading: pastState === 'checking' || pastState === 'loading',
  };
}

/**
 * 이 어르신의 지난 회기 확인분.
 *
 * 실패를 빈 목록으로 돌려주지 않는다. 예전에는 오류일 때도 [] 였고, 화면은
 * 그것을 '지난 회기와 어긋난 곳이 없다'와 똑같이 취급했다 — 통신이 끊겨
 * 대조를 아예 못 했는데도 다 맞춰 본 것처럼 보였다. 읽었는지(ok)를 값과
 * 함께 돌려주어 화면이 그 둘을 구분할 수 있게 한다.
 */
async function loadPastFacts(): Promise<PastLoad> {
  const sb = getSupabase();
  const s = currentSession();
  const key = s.remoteParticipantId ?? '';

  // 서버가 없거나 이 회기가 아직 어느 어르신 것도 아니면 읽을 것이 없다.
  // 실패가 아니라 '지난 회기 0개'다.
  if (!sb || !s.remoteParticipantId) return { key, ok: true, facts: [] };

  // 확인된 것만 가져온다. 미확인·제외 항목이 노래에 들어가면 안 된다(원칙 2).
  const { data, error } = await sb
    .from('story_facts')
    .select('id, text, created_at, session_id')
    .eq('participant_id', s.remoteParticipantId)
    .eq('status', 'verified')
    .neq('session_id', s.remoteSessionId ?? '00000000-0000-0000-0000-000000000000')
    .order('created_at');
  if (error || !data) return { key, ok: false, facts: [] };

  return {
    key,
    ok: true,
    facts: data.map((r) => ({
      id: r.id,
      text: r.text,
      when: new Date(r.created_at).toLocaleDateString('ko-KR', {
        month: 'numeric',
        day: 'numeric',
      }),
    })),
  };
}
