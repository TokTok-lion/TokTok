'use client';

import { useEffect, useState } from 'react';
import { useAccount } from './auth';
import { participantExists } from './repo';
import { useSession } from './store';

/**
 * 지금 회기가 가리키는 어르신이 진짜인가.
 *
 * 화면은 기기에 저장된 회기를 본다. 그게 현장에서 옳다 — 통신이 끊겨도
 * 회기는 이어져야 하니까. 그런데 기관 목록은 서버에 있어서, 둘이 어긋나면
 * 화면이 없는 사람을 계속 가리킨다.
 *
 * 실제로 두 가지 모습으로 나왔다.
 *   · 어르신을 서버에서 지웠는데 오늘 화면은 그대로 "테스트○○ 4/9단계"
 *   · 갓 가입한 기관이 앱을 처음 열면, 등록한 적 없는 씨앗 어르신이
 *     진행 중인 것처럼 보인다
 *
 * 뒤쪽이 더 나쁘다. 실제로 쓰는 서비스에서 등록한 적 없는 사람 이름이
 * 떠 있으면, 그 화면의 다른 숫자도 못 믿게 된다.
 *
 * 그래서 서버를 쓰는 상태에서는 "서버에 있는 어르신"만 진행 중으로 본다.
 * 서버를 안 쓰는 기기(시연·둘러보기)는 씨앗이 정상이므로 건드리지 않는다.
 */
export type ActiveElder = 'checking' | 'ok' | 'missing';

export function useActiveElder(): ActiveElder {
  const { account } = useAccount();
  const { s } = useSession();
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const live = account.status === 'in';
  const id = s.remoteParticipantId;

  useEffect(() => {
    if (!live || !id) return;
    let alive = true;
    void participantExists(id).then((ok) => {
      if (alive) setChecked((prev) => (prev[id] === ok ? prev : { ...prev, [id]: ok }));
    });
    return () => {
      alive = false;
    };
  }, [live, id]);

  // 서버를 안 쓰거나 아직 확인 중이면 화면을 흔들지 않는다.
  if (account.status === 'local' || account.status === 'out') return 'ok';
  if (account.status === 'loading') return 'checking';

  // 로그인은 했는데 이 회기가 어느 어르신 것도 아니다 — 씨앗 상태다.
  if (!id) return 'missing';

  const hit = checked[id];
  if (hit === undefined) return 'checking';
  return hit ? 'ok' : 'missing';
}
