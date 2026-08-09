'use client';

/**
 * 만들어진 곡 보관.
 *
 * 녹음과 같은 이유로 기기에 둔다 — 서버 보관 위치와 기간이 정해지기 전에
 * 올릴 수 없고, 메모리에만 두면 새로고침 한 번에 사라진다. 어르신께 들려
 * 드리려고 만든 곡이 화면을 옮겼다고 없어지면 안 된다.
 *
 * 녹음과 달리 보관기간을 두지 않았다. 이건 어르신께 드리는 결과물이지
 * 원자료가 아니고, 지우는 것은 어르신 뜻이어야 한다.
 */

const DB_NAME = 'toktok-song';
const STORE = 'songs';
const KEY = 'current';

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

export async function saveSong(blob: Blob): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await idb(db, 'readwrite', (s) => s.put(blob, KEY) as IDBRequest<IDBValidKey>);
  db.close();
}

export async function loadSong(): Promise<Blob | null> {
  const db = await openDb();
  if (!db) return null;
  const blob = await idb<Blob>(db, 'readonly', (s) => s.get(KEY));
  db.close();
  return blob ?? null;
}

export async function deleteSong(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await idb(db, 'readwrite', (s) => s.delete(KEY) as unknown as IDBRequest<undefined>);
  db.close();
}
