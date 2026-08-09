'use client';

import { useEffect, useState } from 'react';
import { useAccount } from './auth';
import { listParticipants } from './repo';
import { SEED_ELDERS, type ElderSummary } from './seed';
import type { ParticipantRow } from './db.types';

/**
 * 어르신 목록.
 *
 * 로그인해서 기관이 정해졌으면 서버에서 읽고, 아니면 시연용 씨앗을 쓴다.
 * 두 경우를 같은 타입으로 돌려주는 이유는 화면이 "서버가 있는지"를 몰라도
 * 되게 하기 위해서다 — 화면마다 분기를 넣으면 한 곳을 빠뜨린다.
 */
export function useElders(): { elders: ElderSummary[]; live: boolean; loading: boolean } {
  const { account } = useAccount();
  const live = account.status === 'in';
  const [rows, setRows] = useState<ParticipantRow[] | null>(null);

  useEffect(() => {
    if (!live) return;
    let alive = true;
    void listParticipants().then((r) => {
      if (alive) setRows(r);
    });
    return () => {
      alive = false;
    };
  }, [live]);

  // 로그아웃하면 rows 에 지난 값이 남지만, 아래에서 live 를 먼저 보므로
  // 화면에 나가지 않는다. 이펙트에서 굳이 지우지 않는 이유다.

  if (!live) return { elders: SEED_ELDERS, live: false, loading: false };
  if (rows === null) return { elders: [], live: true, loading: true };

  return { elders: rows.map(toSummary), live: true, loading: false };
}

/**
 * 서버 행을 화면이 쓰는 모양으로.
 *
 * 담당자·다음 회기·동의 만료는 아직 서버에서 계산하지 않는다. 없는 값을
 * 그럴듯하게 채우면 화면은 멀쩡해 보이는데 내용이 거짓이 되므로, 비워 두고
 * 화면이 "—"로 그리게 둔다.
 *
 * 주제만 빈 문자열이다. 다른 칸은 목록의 한 칸으로만 읽히지만 주제는 화면들이
 * 문장 안에 끼워 넣는 값이라, '—'를 넣으면 그대로 말이 되어 나갔다 — 인터뷰
 * 화면은 화면에서 가장 큰 글씨로 「—」 이야기를 들어보려 해요를 띄웠고
 * SpeakButton 이 어르신께 그렇게 읽어 드렸다. 곡 제목은 '— 이야기'가 됐다.
 * 게다가 참가자 표에는 주제 칸이 아예 없다(db.types.ts 의 ParticipantRow —
 * 주제는 sessions.topic 이다). 없는 것은 '—'가 아니라 없는 것이므로 비워
 * 두고, 주제를 쓰는 화면이 주제 없이도 말이 되는 문장을 갖는다.
 */
function toSummary(p: ParticipantRow): ElderSummary {
  return {
    id: p.id,
    displayName: p.display_name,
    code: p.internal_no ?? '—',
    avatar: p.avatar_key ?? 'avatar_grandfather_leaf',
    worker: '—',
    status: p.status === 'active' ? 'active' : p.status === 'paused' ? 'paused' : 'ended',
    family: p.family_state === 'available' ? 'available' : p.family_state === 'none' ? 'none' : 'unreachable',
    step: 0,
    topic: '',
    nextSession: '—',
    consentExpiresInDays: null,
  };
}
