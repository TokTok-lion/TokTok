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
 *
 * 칸은 어르신마다 따로 둔다. 예전에는 'current' 한 칸뿐이라 김 어르신 곡이
 * 남아 있는 채로 박 어르신 회기를 열면 보관함이 그 곡을 박 어르신 것으로
 * 보여 줬다. 곡에는 어르신의 생애가 담겨 있어서, 그건 남의 이야기를 다른
 * 분 앞에서 트는 사고다. 화면상으로는 정상 동작과 구분되지 않아 더 나쁘다.
 */

import { currentSession } from './store';

const DB_NAME = 'toktok-song';
const STORE = 'songs';

/**
 * 주인 표시가 없던 시절의 칸.
 *
 * 읽기만 하고 새로 쓰지는 않는다. 이 판으로 올리기 전에 만든 곡이 그냥
 * 사라지면 어르신께는 노래가 없어진 것이다.
 */
const LEGACY_KEY = 'current';

/**
 * 이 곡의 주인.
 *
 * 기관 회기면 서버 participants.id, 시연 기기면 어르신 id 를 쓴다. 둘 다
 * 어르신 한 분을 가리키므로 곡이 섞이지 않는다.
 */
function slotKey(): string {
  const s = currentSession();
  return `song:${s.remoteParticipantId ?? s.elder.id}`;
}

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
  await idb(db, 'readwrite', (s) => s.put(blob, slotKey()) as IDBRequest<IDBValidKey>);
  db.close();
}

export async function loadSong(): Promise<Blob | null> {
  const db = await openDb();
  if (!db) return null;

  const key = slotKey();
  const mine = await idb<Blob>(db, 'readonly', (s) => s.get(key));
  if (mine) {
    db.close();
    return mine;
  }

  // 옛 칸은 주인이 적혀 있지 않다. 아무 때나 읽으면 앞 어르신 곡이 다음
  // 어르신 화면에서 나온다 — 고치려던 그 사고 그대로다.
  //
  // songKey 는 어르신을 바꿀 때(beginSession) 반드시 null 이 된다. 그러니
  // songKey 가 남아 있다는 것은 그 곡이 지금 이 회기에서 만들어졌다는 뜻이고,
  // 그때만 옛 칸을 내 곡으로 인정한다. 인정하는 김에 주인이 있는 칸으로
  // 옮기고 옛 칸을 비워, 주인 모를 곡이 두 번 다시 안 남게 한다.
  if (!currentSession().songKey) {
    db.close();
    return null;
  }

  const legacy = await idb<Blob>(db, 'readonly', (s) => s.get(LEGACY_KEY));
  if (legacy) {
    await idb(db, 'readwrite', (s) => s.put(legacy, key) as IDBRequest<IDBValidKey>);
    await idb(
      db,
      'readwrite',
      (s) => s.delete(LEGACY_KEY) as unknown as IDBRequest<undefined>,
    );
  }
  db.close();
  return legacy ?? null;
}

/**
 * 지금 어르신의 곡을 지운다.
 *
 * 회기를 새로 열 때 불린다. 다른 어르신 칸은 건드리지 않는다 — 그분 노래는
 * 그분 것이고, 칸이 나뉘어 있으니 새 회기 화면에 새어 나오지도 않는다.
 * 대신 지금 어르신의 지난 곡은 지운다. 보관함은 곡에 '이번 회기 주제'를
 * 붙여 보여 주므로, 지난 회기 곡을 그대로 두면 다른 주제의 노래가 오늘
 * 만든 것처럼 보인다.
 *
 * 주인 없는 옛 칸도 함께 비운다. 남겨 두면 다음 어르신 화면에서 나온다.
 */
export async function deleteSong(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await idb(db, 'readwrite', (s) => s.delete(slotKey()) as unknown as IDBRequest<undefined>);
  await idb(db, 'readwrite', (s) => s.delete(LEGACY_KEY) as unknown as IDBRequest<undefined>);
  db.close();
}
