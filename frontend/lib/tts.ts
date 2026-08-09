'use client';

import { useCallback, useState } from 'react';

/**
 * 문장 읽어주기.
 *
 * 한도가 빠듯해서(무료 10,000자/월) 같은 문장을 두 번 만들지 않는 것이
 * 기능 자체보다 중요하다. 인터뷰 질문은 정해져 있으므로, 한 번 만든 소리를
 * 기기에 두면 그다음부터는 한도를 쓰지 않는다.
 *
 * 캐시는 두 겹이다.
 *   - 메모리: 같은 화면에서 여러 번 눌러도 즉시 난다
 *   - IndexedDB: 앱을 껐다 켜도 남는다. 질문 12개를 한 번 만들어 두면
 *     그 기기는 그 뒤로 공짜다
 *
 * 실패는 조용히 다룬다. 소리가 안 나도 회기는 그대로 진행되어야 하고,
 * 어르신 앞에서 오류 화면이 뜨는 것이 소리가 없는 것보다 나쁘다.
 */

const DB_NAME = 'toktok-tts';
const STORE = 'clips';

const memory = new Map<string, string>();
let audio: HTMLAudioElement | null = null;

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, 1);
    } catch {
      return resolve(null);
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

function idb<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  body: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const r = body(db.transaction(STORE, mode).objectStore(STORE));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function cached(key: string): Promise<string | null> {
  const hit = memory.get(key);
  if (hit) return hit;
  const db = await openDb();
  if (!db) return null;
  const blob = await idb<Blob>(db, 'readonly', (s) => s.get(key));
  db.close();
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  memory.set(key, url);
  return url;
}

async function store(key: string, blob: Blob): Promise<string> {
  const url = URL.createObjectURL(blob);
  memory.set(key, url);
  const db = await openDb();
  if (db) {
    await idb(db, 'readwrite', (s) => s.put(blob, key) as IDBRequest<IDBValidKey>);
    db.close();
  }
  return url;
}

export type SpeakState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'playing' }
  /** 한도 소진 — 고장이 아니므로 버튼을 숨기고 넘어간다 */
  | { kind: 'exhausted' }
  | { kind: 'error'; message: string };

export function useSpeak() {
  const [state, setState] = useState<SpeakState>({ kind: 'idle' });

  const stop = useCallback(() => {
    audio?.pause();
    audio = null;
    setState({ kind: 'idle' });
  }, []);

  const speak = useCallback(async (text: string) => {
    const key = text.trim();
    if (!key) return;

    // 이미 나고 있으면 멈춘다 — 같은 버튼이 재생/정지가 된다
    if (audio && !audio.paused) {
      audio.pause();
      audio = null;
      setState({ kind: 'idle' });
      return;
    }

    setState({ kind: 'loading' });

    let url = await cached(key);
    if (!url) {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: key }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as {
            error?: string;
            quota?: boolean;
          };
          setState(
            j.quota
              ? { kind: 'exhausted' }
              : { kind: 'error', message: j.error ?? '읽어 드리지 못했어요.' },
          );
          return;
        }
        url = await store(key, await res.blob());
      } catch {
        setState({ kind: 'error', message: '연결하지 못했어요.' });
        return;
      }
    }

    audio = new Audio(url);
    audio.onended = () => setState({ kind: 'idle' });
    audio.onerror = () => setState({ kind: 'error', message: '소리를 재생하지 못했어요.' });
    try {
      await audio.play();
      setState({ kind: 'playing' });
    } catch {
      setState({ kind: 'error', message: '소리를 재생하지 못했어요.' });
    }
  }, []);

  return { state, speak, stop };
}
