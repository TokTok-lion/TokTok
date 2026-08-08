'use client';

import { useCallback, useState } from 'react';
import { canSync, saveSession } from './repo';
import { useSession } from './store';

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
  const { s, set } = useSession();
  const [state, setState] = useState<SaveState>({ kind: 'idle' });

  const save = useCallback(async () => {
    if (!canSync()) {
      setState({ kind: 'off' });
      return;
    }
    setState({ kind: 'saving' });
    const res = await saveSession(s);
    if (res.ok) {
      // 다음 저장이 같은 회기를 갱신하도록 서버 id 를 기억한다
      if (s.remoteSessionId !== res.sessionId) set('remoteSessionId', res.sessionId);
      setState({ kind: 'saved' });
    } else {
      setState({ kind: 'error', reason: res.reason });
    }
  }, [s, set]);

  return { state, save, enabled: canSync() };
}
