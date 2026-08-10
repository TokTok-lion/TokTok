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

/**
 * 소리 판 번호. 목소리 설정을 바꾸면 올린다.
 *
 * 캐시 키가 '질문 원문' 하나였다. 그래서 어르신께 더 천천히 들려 드리려고
 * 말하기 속도를 0.9 → 0.85 로 낮췄는데, 이미 그 질문을 한 번 들어 본 기기는
 * 옛 소리를 영영 그대로 들려줬다 — 질문 열두 개를 미리 눌러 본 시연·운영
 * 태블릿이 바로 그런 기기다. 고쳐서 배포해 놓고 정작 쓰는 기기에서는 아무것도
 * 안 바뀌는 일이 이 저장소에서 벌써 두 번째다.
 *
 * 판 번호를 키에 붙이면 설정이 바뀐 순간부터 새로 받는다. 옛 항목은 남지만
 * 아무도 찾지 않고, 지우려고 DB 버전을 올리면 그 사이 진행 중인 회기에서
 * 소리가 한 번 끊긴다 — 몇 킬로바이트를 아끼자고 어르신 앞에서 멈추게 할
 * 이유가 없다.
 */
const VOICE_REV = 'v2-rate085';

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
    const said = text.trim();
    if (!said) return;
    // 판 번호를 앞에 붙인다 — 목소리 설정이 바뀌면 옛 소리를 꺼내 오지 않는다.
    const key = `${VOICE_REV}:${said}`;

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
          // 보내는 것은 원문이다. key 에는 판 번호가 붙어 있어서, 그대로
          // 보내면 어르신께 "브이투 레이트 공팔오 콜론"까지 읽어 드린다.
          body: JSON.stringify({ text: said }),
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
