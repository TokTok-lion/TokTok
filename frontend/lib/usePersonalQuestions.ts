'use client';

import { authHeader } from './authHeader';
import { useEffect, useState } from 'react';
import { membersMissing } from './groupConsent';
import { readParticipantRecord } from './repo';
import { getSupabase } from './supabase';
import { accountReady } from './auth';
import { currentSession, useSession } from './store';

/**
 * 지난 이야기에서 오늘 여쭐 질문을 받아 온다.
 *
 * ── 왜
 *
 * 인터뷰 질문이 전부 고정이라, 회기가 쌓여도 앱은 그분에 대해 아무것도 기억하지
 * 못하는 것처럼 보였다. 어제 김 어르신께 여쭌 질문을 오늘 박 어르신께 똑같이
 * 여쭙는다.
 *
 * 재료는 이미 있다 — 회기마다 확인된 사실이 출처와 함께 남는다. 어제 "순천에서
 * 자랐다"가 확인됐다면 오늘은 그 곁을 여쭐 수 있고, 그 질문은 다른 어르신께는
 * 나오지 않는다. 회기가 쌓일수록 달라지는 것이 눈에 보여야 한다.
 *
 * ── 확인된 것만 근거로 삼는다
 *
 * status='verified' 만 읽는다. 미확인 사실로 "형제가 일곱이셨죠?" 하고 물으면
 * 앱이 어르신 입에 말을 넣는 것이 된다. 어르신이 맞다고 하신 것만 근거다.
 *
 * ── 동의가 없으면 하지 않는다
 *
 * 지난 이야기를 외부 모델에 보내는 일이다. 그룹이면 참여하신 분 **전원**의
 * 동의가 있어야 한다 — 그룹 회기의 이야기에는 여러 분의 말씀이 섞여 있다.
 *
 * ── 실패해도 회기를 막지 않는다
 *
 * 못 받아 오면 빈 목록이고, 화면은 고정 질문으로 그대로 진행한다. 개인화는
 * 얹히는 것이지 없으면 안 되는 것이 아니다.
 */

export type PersonalQuestion = {
  text: string;
  /** 어느 지난 이야기에서 나왔는지 — 화면이 근거를 함께 보여 준다. */
  basis: string;
};

export type PersonalQuestions = {
  questions: PersonalQuestion[];
  loading: boolean;
  /** 지난 이야기가 아직 없어서 못 만든 경우 — 첫 회기가 여기다. */
  noHistory: boolean;
  /**
   * 피하고 싶은 주제와 겹쳐 아예 보내지 않은 지난 이야기 수.
   *
   * 화면이 이걸 말해 줘야 질문이 적게 나온 것이 고장이 아님을 안다. 다만
   * 어느 이야기였는지는 돌려주지 않는다 — 그걸 화면에 적으면 가리려던 것을
   * 그대로 보여 주는 셈이다.
   */
  withheld: number;
};

export function usePersonalQuestions(): PersonalQuestions {
  const { s } = useSession();
  const [out, setOut] = useState<PersonalQuestions>({
    questions: [],
    loading: true,
    noHistory: false,
    withheld: 0,
  });

  const participant = s.remoteParticipantId;
  const card = s.memoryCard;

  useEffect(() => {
    let alive = true;

    // 이펙트 본문에서 곧장 setState 하지 않는다 — 렌더가 연쇄로 돈다.
    // 어르신이 없을 때도 콜백을 거쳐 답한다.
    void (async () => {
      if (!participant) {
        if (alive) setOut({ questions: [], loading: false, noHistory: true, withheld: 0 });
        return;
      }
      const sb = getSupabase();
      const account = await accountReady();
      if (!sb || account.status !== 'in') {
        if (alive) setOut({ questions: [], loading: false, noHistory: true, withheld: 0 });
        return;
      }

      // 전원 동의라야 지난 이야기를 밖으로 보낸다.
      if ((await membersMissing('externalAi')).length > 0) {
        if (alive) setOut({ questions: [], loading: false, noHistory: false, withheld: 0 });
        return;
      }

      /*
       * 지난 회기의 확인된 사실. 이번 회기 것은 뺀다 — 오늘 방금 들은 이야기를
       * 오늘 다시 여쭈면 "아까 말씀드렸는데" 소리를 듣는다.
       */
      const { data } = await sb
        .from('story_facts')
        .select('text, session_id')
        .eq('participant_id', participant)
        .eq('status', 'verified')
        .order('created_at', { ascending: false })
        .limit(40);

      const here = currentSession().remoteSessionId;
      const facts = (data ?? [])
        .filter((r) => !here || r.session_id !== here)
        .map((r) => r.text);

      if (facts.length < 2) {
        if (alive) setOut({ questions: [], loading: false, noHistory: true, withheld: 0 });
        return;
      }

      /*
       * 피하고 싶은 주제는 어르신 기록에 있다(어르신 프로필에서 적는다).
       * 라우트가 이 목록으로 지난 이야기를 먼저 덜어 낸다 — 프롬프트에 적어
       * 보내는 것만으로는 지켜지지 않았다.
       */
      const rec = await readParticipantRecord(participant).catch(() => null);

      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({
          facts,
          card: card ?? undefined,
          avoid: rec?.avoidTopics ?? [],
        }),
      }).catch(() => null);

      const json = res?.ok
        ? ((await res.json().catch(() => null)) as {
            questions?: PersonalQuestion[];
            withheld?: number;
          } | null)
        : null;

      if (alive) {
        setOut({
          questions: json?.questions ?? [],
          loading: false,
          noHistory: false,
          withheld: typeof json?.withheld === 'number' ? json.withheld : 0,
        });
      }
    })();

    return () => {
      alive = false;
    };
  }, [participant, card]);

  return out;
}
