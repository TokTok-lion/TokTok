'use client';

import { useEffect, useState } from 'react';
import { hasConsent, type ConsentKind, type Consents } from './domain';
import { readParticipantRecord } from './repo';
import { sessionMembers, useSession } from './store';
import type { ElderIdentity } from './store';

/**
 * 그룹 회기의 동의 — 어르신마다 따로 읽고, 전원이 되어야 켠다.
 *
 * ── 왜 전원인가
 *
 * 방 하나를 녹음하면 그 방에 계신 분들 목소리가 **전부** 들어간다. 네 분이
 * 동의하시고 한 분이 거절하셔도, 녹음을 켜는 순간 그 한 분의 음성이 담긴다.
 * 그러면 그 거절은 물어본 시늉일 뿐이다.
 *
 * 그래서 그룹에서는 가장 낮은 쪽에 맞춘다. 한 분이라도 동의하지 않으셨으면
 * 녹음은 켜지지 않고, 복지사가 받아 적는 길로 간다 — 그 길은 이미 있다.
 * 명세의 "거절이 막다른 길이 되어서는 안 된다"가 여기서도 지켜진다.
 *
 * ── 왜 서버에서 읽는가
 *
 * 동의는 회기가 아니라 사람에게 붙는 값이다. 회기 상태(s.elder.consents)에는
 * 기준 어르신 것만 있고, 함께 모신 분들은 신원만 들고 있다 — 일부러 그렇게
 * 좁혀 뒀다. 예전에 그 자리로 앞 어르신의 동의가 통째로 따라와서, 동의한 적
 * 없는 분의 목소리가 외부로 나갈 뻔했다.
 *
 * ── 못 읽었을 때
 *
 * 허용으로 치지 않는다. 모르는 것은 미동의다(hasConsent 가 unset 을 false 로
 * 본다). 통신이 끊겼다는 이유로 어르신의 목소리가 녹음되어서는 안 된다.
 */

export type MemberConsent = {
  elder: ElderIdentity;
  /** 못 읽었으면 null — '전부 미동의'와 구분해 화면이 이유를 말할 수 있게. */
  consents: Consents | null;
};

export type GroupConsents = {
  members: MemberConsent[];
  loading: boolean;
  /** 이 항목에 전원이 동의했는가. 한 명이라도 아니면 false. */
  everyone: (kind: ConsentKind) => boolean;
  /** 아직 동의하지 않으신 분들 — 화면이 이름을 대고 말할 수 있게. */
  missing: (kind: ConsentKind) => ElderIdentity[];
  reload: () => void;
};

export function useGroupConsents(): GroupConsents {
  const { s } = useSession();
  const [members, setMembers] = useState<MemberConsent[]>([]);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  // 참여자 신원만 의존한다. 회기 상태는 글자 하나 고칠 때마다 바뀌는데,
  // 그때마다 어르신 수만큼 서버를 부르면 전사 교정 중에 요청이 쏟아진다.
  const ids = sessionMembers(s)
    .map((m) => m.id)
    .join(',');

  useEffect(() => {
    let alive = true;
    const list = sessionMembers();

    void Promise.all(
      list.map(async (elder) => {
        // 둘러보기 회기(서버에 없는 씨앗 어르신)는 읽을 곳이 없다. 그때는
        // 회기 상태에 있는 값을 그대로 쓴다 — 시연이 막히면 안 된다.
        if (!s.remoteParticipantId) {
          return { elder, consents: s.elder.consents } satisfies MemberConsent;
        }
        const rec = await readParticipantRecord(elder.id).catch(() => null);
        return { elder, consents: rec?.consents ?? null } satisfies MemberConsent;
      }),
    ).then((out) => {
      if (!alive) return;
      setMembers(out);
      setLoading(false);
    });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, nonce]);

  /*
   * 못 읽은 분(consents === null)은 미동의로 본다. 통신이 끊겼다는 이유로
   * 어르신의 목소리가 녹음되어서는 안 된다.
   */
  const missing = (kind: ConsentKind) =>
    members
      .filter((m) => !m.consents || !hasConsent(m.consents, kind))
      .map((m) => m.elder);

  return {
    members,
    loading,
    // 아직 읽는 중이면 '전원 동의'라고 답하지 않는다. 그 사이에 마이크가
    // 켜지면 그것이 바로 막으려던 일이다.
    everyone: (kind) => !loading && members.length > 0 && missing(kind).length === 0,
    missing,
    reload: () => setNonce((n) => n + 1),
  };
}
