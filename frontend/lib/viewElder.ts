'use client';

import { useEffect, useState } from 'react';
import { currentSession } from './store';

/**
 * 지금 **보고 있는** 어르신 — 회기의 어르신과는 다른 값이다.
 *
 * ── 왜 나눠 두나
 *
 * 보관함과 기록은 지금 회기의 어르신 것만 보여 준다. 그래서 박○○ 어르신의
 * 노래를 보려면 그분으로 회기를 시작해야 했다.
 *
 * 그렇다고 목록에서 어르신을 바꾸게 하면 안 된다. 회기 중에 어르신이 바뀌면
 * 진행하던 이야기·가사·녹음이 다른 분 것으로 넘어간다 — 그걸 막는 경고가
 * 이미 회기 쪽에 있다(app/elder 의 전환 확인). 기록을 들춰 보려다 회기가
 * 망가지는 일은 있어서는 안 된다.
 *
 * 그래서 **보기 전용** 값을 따로 둔다. 이 값은 화면이 무엇을 읽을지만 정하고,
 * 회기 상태(store)는 한 글자도 건드리지 않는다.
 *
 * ── 왜 sessionStorage 인가
 *
 * 탭을 닫으면 사라져야 한다. 며칠 뒤에 앱을 다시 열었을 때 남의 어르신 기록이
 * 먼저 떠 있으면, 복지사는 그것을 지금 회기의 어르신으로 읽는다.
 */

const KEY = 'toktok.viewElder';

export type ViewElder = {
  /** 서버 participants.id. null 이면 지금 회기의 어르신을 본다. */
  id: string | null;
  /** 화면에 적을 이름. id 가 null 이면 비어 있다. */
  name: string;
};

const NONE: ViewElder = { id: null, name: '' };

let value: ViewElder = NONE;
let loaded = false;
const listeners = new Set<() => void>();

function load(): ViewElder {
  if (loaded) return value;
  loaded = true;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as ViewElder;
      if (typeof v?.id === 'string' && v.id) value = { id: v.id, name: String(v.name ?? '') };
    }
  } catch {
    // 저장소를 못 읽는 기기가 있다. 못 읽으면 지금 회기의 어르신을 본다.
  }
  return value;
}

export function setViewElder(next: ViewElder): void {
  value = next.id ? next : NONE;
  loaded = true;
  try {
    if (value.id) sessionStorage.setItem(KEY, JSON.stringify(value));
    else sessionStorage.removeItem(KEY);
  } catch {
    // 못 남겨도 이 화면에서는 동작한다. 다음 화면에서 회기 어르신으로 돌아갈 뿐.
  }
  for (const fn of listeners) fn();
}

/**
 * 지금 읽어야 하는 어르신 id.
 *
 * 고른 것이 없으면 회기의 어르신이다 — 예전 동작 그대로다. 화면들이 이 함수
 * 하나만 보게 해서, 어느 화면은 회기를 보고 어느 화면은 고른 값을 보는 일이
 * 생기지 않게 한다.
 */
export function viewOwnerId(): string {
  const v = load();
  if (v.id) return v.id;
  const s = currentSession();
  return s.remoteParticipantId ?? s.elder.id;
}

export function useViewElder(): ViewElder & { sameAsSession: boolean } {
  const [v, setV] = useState<ViewElder>(load);
  useEffect(() => {
    const fn = () => setV(value);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  const s = currentSession();
  const sessionId = s.remoteParticipantId ?? s.elder.id;
  return { ...v, sameAsSession: !v.id || v.id === sessionId };
}
