'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * 기기 알림.
 *
 * 정직하게 말하면 이건 "예약 알림"이지 "푸시 알림"이 아니다. 진짜 푸시는
 * 서버가 기기를 깨우는 것이라 VAPID 키와 발송 서버가 있어야 하고, 지금
 * 이 서비스에는 둘 다 없다. 대신 앱이 살아 있는 동안 시각을 재서 OS 알림을
 * 띄운다 — 회기 중에는 태블릿을 계속 켜 두므로 현장에서 필요한 알림
 * (30분 뒤 다음 어르신, 일지 미확정)은 이것으로 대부분 닿는다.
 *
 * 못 하는 것을 화면에서도 숨기지 않는다. 앱을 완전히 종료하면 알림이 오지
 * 않는다고 적어 둔다. 오지 않는 알림을 믿게 만드는 것이 알림이 없는 것보다
 * 나쁘기 때문이다.
 */

export type NotifyKind = 'sessionStart' | 'logPending' | 'consentExpiring';

export type NotifyPrefs = Record<NotifyKind, boolean>;

export const NOTIFY_LABELS: Record<NotifyKind, { title: string; desc: string }> = {
  sessionStart: {
    title: '회기 시작 전 알림',
    desc: '예정 시각 30분 전에 알려드려요',
  },
  logPending: {
    title: '활동일지 미확정 알림',
    desc: '회기가 끝났는데 일지를 저장하지 않았을 때',
  },
  consentExpiring: {
    title: '동의 만료 임박 알림',
    desc: '동의가 30일 안에 끝나는 어르신이 있을 때',
  },
};

const PREFS_KEY = 'toktok.notify.prefs.v1';
const DEFAULT_PREFS: NotifyPrefs = {
  sessionStart: true,
  logPending: true,
  consentExpiring: false,
};

/** 브라우저가 알림을 아예 지원하지 않는 경우도 있다 (구형 안드로이드 웹뷰). */
export type Permission = 'unsupported' | 'default' | 'granted' | 'denied';

type Snap = { permission: Permission; prefs: NotifyPrefs };

const SERVER_SNAP: Snap = { permission: 'default', prefs: DEFAULT_PREFS };
let snap: Snap = SERVER_SNAP;
let read = false;
const listeners = new Set<() => void>();

function readNow(): Snap {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { permission: 'unsupported', prefs: DEFAULT_PREFS };
  }
  let prefs = DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) prefs = { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<NotifyPrefs>) };
  } catch {
    /* 저장소가 막혀 있어도 기본값으로 돈다 */
  }
  return { permission: Notification.permission as Permission, prefs };
}

function emit(next: Snap) {
  snap = next;
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  if (!read) {
    read = true;
    snap = readNow();
  }
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/* ------------------------------------------------------------ 발송 */

/**
 * 알림을 띄운다.
 *
 * 서비스 워커가 있으면 그쪽으로 보낸다 — 그래야 알림을 눌렀을 때 앱으로
 * 돌아오고, 설치된 PWA 에서도 제대로 뜬다. 없으면 페이지에서 직접 띄운다.
 */
export async function showNotification(
  title: string,
  body: string,
  opts: { tag?: string; url?: string } = {},
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  const payload: NotificationOptions = {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: opts.tag,
    // 같은 tag 로 다시 띄울 때 조용히 갈아치우지 않는다 — 회기 알림은
    // 놓치면 안 되는 것이라 다시 울려야 한다.
    renotify: Boolean(opts.tag),
    data: { url: opts.url ?? '/home' },
    lang: 'ko',
  } as NotificationOptions;

  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, payload);
      return true;
    }
    new Notification(title, payload);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------ 예약 */

const timers = new Map<string, number>();

/** 예약을 전부 지운다. 화면이 다시 계산할 때마다 처음부터 건다. */
export function clearScheduled() {
  for (const id of timers.values()) window.clearTimeout(id);
  timers.clear();
}

/**
 * 지정한 시각에 알림을 예약한다. 이미 지난 시각이면 아무것도 하지 않는다.
 * setTimeout 은 브라우저가 탭을 얼려도 정확히 깨어나지 않을 수 있어서,
 * 이 예약은 "대체로 온다"는 수준이지 보장이 아니다.
 */
export function scheduleAt(
  key: string,
  at: Date,
  title: string,
  body: string,
  url?: string,
) {
  const delay = at.getTime() - Date.now();
  if (delay <= 0 || delay > 12 * 60 * 60 * 1000) return; // 12시간 넘는 예약은 의미 없다
  const existing = timers.get(key);
  if (existing) window.clearTimeout(existing);
  timers.set(
    key,
    window.setTimeout(() => {
      void showNotification(title, body, { tag: key, url });
      timers.delete(key);
    }, delay),
  );
}

/** 'HH:MM' 을 오늘 날짜의 Date 로. */
export function todayAt(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

/* ------------------------------------------------------------ 훅 */

export function useNotify() {
  const { permission, prefs } = useSyncExternalStore(
    subscribe,
    () => snap,
    () => SERVER_SNAP,
  );

  const request = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const result = (await Notification.requestPermission()) as Permission;
    emit({ ...snap, permission: result });
  }, []);

  const setPref = useCallback((kind: NotifyKind, on: boolean) => {
    const prefs = { ...snap.prefs, [kind]: on };
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* 저장 못 해도 이번 실행에는 반영된다 */
    }
    emit({ ...snap, prefs });
  }, []);

  return { permission, prefs, request, setPref };
}
