'use client';

import { songTag } from './songStore';

/**
 * 그림을 이 기기에 둔다.
 *
 * 곡과 같은 방식이다(lib/songStore) — 회기·어르신에 묶어 두고, 화면은 항상
 * 기기에서 읽는다. 그림은 한 장에 1MB 안팎이라 회기 상태(localStorage)에
 * 넣을 수 없다. 거기 넣으면 저장 한도를 넘겨 회기 전체가 저장되지 않는다.
 *
 * 그림마다 **어느 문장에서 나왔는지**를 함께 둔다. 이 값이 없으면 그림은
 * 근거 없는 그림이 되고, 이 서비스에서 근거 없는 것은 남기지 않는다.
 */

const DB_NAME = 'toktok-scene';
const DB_VERSION = 1;
const STORE = 'scenes';

export type Scene = {
  /** `${ownerId}::${sessionId}::${factId}` */
  key: string;
  ownerId: string;
  sessionId: string;
  /** 이 그림이 나온 사실 문장의 id */
  factId: string;
  /** 그 문장 그대로. 화면과 인쇄물이 그림 옆에 이 문장을 적는다. */
  text: string;
  /** data:image/png;base64,… */
  image: string;
  madeAt: number;
  /**
   * 복지사가 이 그림을 쓰기로 했는가.
   *
   * AI 가 만든 것은 초안이다(원칙 3). 확정 전에는 인쇄물과 책에 들어가지
   * 않는다 — 어르신 이야기를 잘못 그린 그림이 가족에게 건네지면 되돌릴 수 없다.
   */
  approved: boolean;
};

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      // 비밀 모드처럼 저장소를 못 여는 기기가 있다. 그림이 없다고 회기를
      // 막지는 않는다.
      resolve(null);
    }
  });
}

function run<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

const keyOf = (ownerId: string, sessionId: string, factId: string) =>
  `${ownerId}::${sessionId}::${factId}`;

/**
 * 이 어르신의 그림 전부 — 지난 회기까지.
 *
 * 예전에는 이번 회기 것만 읽는 함수 하나뿐이었다. 그래서 회기가 끝나고 새
 * 회기를 시작하면 지난 그림이 기기 안에 그대로 있는데도 볼 화면이 없었다.
 * 곡은 어르신 단위로 보관함에 남는데(songStore.readSongShelf) 그림만 그렇지
 * 않았다.
 */
export async function readElderScenes(): Promise<Scene[]> {
  const db = await openDb();
  if (!db) return [];
  const all = (await run<Scene[]>(db, 'readonly', (s) => s.getAll())) ?? [];
  db.close();
  const tag = songTag();
  return all
    .filter((x) => x.ownerId === tag.ownerId)
    .sort((a, b) => b.madeAt - a.madeAt);
}

/**
 * 기관 저장소에서 내려받은 그림을 이 기기에도 둔다.
 *
 * 다음에 열 때 통신을 기다리지 않게 하려는 것이다. 실패해도 막지 않는다 —
 * 기기가 꽉 찼다고 서버에 있는 그림을 못 보게 할 이유가 없다.
 */
export async function cacheServerScene(scene: Scene): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await run(db, 'readwrite', (s) => s.put(scene));
  db.close();
}

/** 이번 회기의 그림들. 만든 순서대로. */
export async function readScenes(): Promise<Scene[]> {
  const db = await openDb();
  if (!db) return [];
  const all = (await run<Scene[]>(db, 'readonly', (s) => s.getAll())) ?? [];
  db.close();
  const tag = songTag();
  return all
    .filter((x) => x.ownerId === tag.ownerId && x.sessionId === tag.sessionId)
    .sort((a, b) => a.madeAt - b.madeAt);
}

/** 새로 만든 그림을 둔다. 같은 문장으로 다시 그리면 앞의 것을 대신한다. */
export async function saveScene(
  factId: string,
  text: string,
  image: string,
): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  const tag = songTag();
  const out = await run(db, 'readwrite', (s) =>
    s.put({
      key: keyOf(tag.ownerId, tag.sessionId, factId),
      ownerId: tag.ownerId,
      sessionId: tag.sessionId,
      factId,
      text,
      image,
      madeAt: Date.now(),
      // 새로 만든 그림은 늘 미확정이다. 다시 그렸으면 다시 봐야 한다.
      approved: false,
    } satisfies Scene),
  );
  db.close();
  return out !== null;
}

/** 복지사가 쓰기로 했는가를 표시한다. */
export async function approveScene(key: string, approved: boolean): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const one = await run<Scene>(db, 'readonly', (s) => s.get(key));
  if (one) await run(db, 'readwrite', (s) => s.put({ ...one, approved }));
  db.close();
}

/** 이 회기의 그림 하나를 지운다. */
export async function deleteScene(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await run(db, 'readwrite', (s) => s.delete(key) as unknown as IDBRequest<undefined>);
  db.close();
}
