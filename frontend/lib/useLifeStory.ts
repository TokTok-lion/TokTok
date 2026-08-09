'use client';

import { useEffect, useState } from 'react';
import { useAccount } from './auth';
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
 * 로그인해서 서버를 쓰면 이 어르신의 지난 회기 확인된 이야기를 전부 가져온다.
 * 서버가 없으면 시연용 지난 기록을 쓴다.
 */

export type LifeFact = { id: string; text: string; when: string };

export function useLifeStory() {
  const { s } = useSession();
  const { account } = useAccount();
  const live = account.status === 'in';
  const [past, setPast] = useState<LifeFact[] | null>(null);

  useEffect(() => {
    if (!live) return;
    let alive = true;
    void loadPastFacts().then((f) => {
      if (alive) setPast(f);
    });
    return () => {
      alive = false;
    };
  }, [live, s.remoteParticipantId]);

  // 이번 회기에서 어르신이 확인해 주신 것 (출처가 붙은 것만)
  const thisSession: LifeFact[] = lyricInputs(s.story).map((i) => ({
    id: i.id,
    text: i.text,
    when: '이번 회기',
  }));

  const previous = live ? (past ?? []) : SEED_PAST_FACTS;

  // 같은 말이 여러 회기에 나오면 한 번만 쓴다. 노래에 같은 줄이 두 번
  // 들어가면 어르신이 "내가 이 말을 두 번 했나" 하고 헷갈리신다.
  const seen = new Set<string>();
  const all = [...previous, ...thisSession].filter((f) => {
    const k = f.text.replace(/\s/g, '');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return {
    /** 이번 회기 것만 */
    thisSession,
    /** 지난 회기 + 이번 회기 (중복 제거) */
    all,
    loading: live && past === null,
    live,
  };
}

async function loadPastFacts(): Promise<LifeFact[]> {
  const sb = getSupabase();
  const s = currentSession();
  if (!sb || !s.remoteParticipantId) return [];

  // 확인된 것만 가져온다. 미확인·제외 항목이 노래에 들어가면 안 된다(원칙 2).
  const { data, error } = await sb
    .from('story_facts')
    .select('id, text, created_at, session_id')
    .eq('participant_id', s.remoteParticipantId)
    .eq('status', 'verified')
    .neq('session_id', s.remoteSessionId ?? '00000000-0000-0000-0000-000000000000')
    .order('created_at');
  if (error || !data) return [];

  return data.map((r) => ({
    id: r.id,
    text: r.text,
    when: new Date(r.created_at).toLocaleDateString('ko-KR', {
      month: 'numeric',
      day: 'numeric',
    }),
  }));
}
