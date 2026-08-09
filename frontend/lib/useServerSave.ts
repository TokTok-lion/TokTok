'use client';

import { useCallback, useState } from 'react';
import { canSync, readyToSync, saveSession } from './repo';
import { currentSession, useSession } from './store';

export type SaveState =
  /** 서버를 안 쓰거나 로그인 전 — 기기에만 저장되고, 그게 정상이다 */
  | { kind: 'off' }
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'error'; reason: string };

/**
 * 회기를 서버에도 남긴다.
 *
 * 로컬 저장은 이미 끝난 뒤에 부른다. 서버 저장이 실패해도 화면은 그대로
 * 진행된다 — 통신이 끊겼다고 어르신 앞에서 회기가 멈추면 안 되기 때문이다.
 * 대신 실패를 감추지 않고 문구로 남겨서, 나중에 다시 저장할 수 있게 한다.
 */
export function useServerSave() {
  const { set } = useSession();
  const [state, setState] = useState<SaveState>({ kind: 'idle' });

  const save = useCallback(async () => {
    setState({ kind: 'saving' });
    // 로그인 확인이 끝나기를 기다린다. 여기서 canSync() 를 그냥 물으면,
    // 회기 화면을 새로고침한 직후에는 아직 확인 중이라 "서버 안 씀"으로
    // 잘못 답하고 활동일지가 조용히 기기에만 남는다.
    if (!(await readyToSync())) {
      setState({ kind: 'off' });
      set('serverSave', { kind: 'off' });
      return;
    }
    // 버튼이 방금 바꾼 값(logSaved)까지 반영된 상태로 저장한다 — 훅이 준 s 는
    // 이 렌더 시점의 값이라 한 박자 뒤처져 있다.
    const res = await saveSession(currentSession());
    if (res.ok) {
      // 다음 저장이 같은 회기를 갱신하도록 서버 id 를 기억한다
      if (currentSession().remoteSessionId !== res.sessionId) {
        set('remoteSessionId', res.sessionId);
      }
      setState({ kind: 'saved' });
      set('serverSave', { kind: 'saved', at: new Date().toISOString() });
    } else {
      setState({ kind: 'error', reason: res.reason });
      set('serverSave', { kind: 'error', reason: res.reason });
    }
  }, [set]);

  return { state, save, enabled: canSync() };
}
