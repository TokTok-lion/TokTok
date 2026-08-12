'use client';

import { currentSession } from './store';

/**
 * 녹음본 보관 (IndexedDB).
 *
 * 메모리에만 두면 새로고침 한 번에 어르신이 한 시간 들려주신 이야기가
 * 사라진다. 그렇다고 서버로 올릴 수도 없다 — 어디에 얼마나 둘지 정해지기
 * 전에 음성을 밖으로 내보내면 되돌릴 수 없다. 그래서 기기 안 DB 에 둔다.
 *
 * 끝나고 한 번에 저장하지 않고 1초 조각이 들어올 때마다 이어 붙인다.
 * 처음엔 끝날 때 저장하게 만들었는데, 그러면 탭을 닫거나 주소를 옮기는
 * 순간 정리 코드가 돌지 못해 녹음 전체가 사라진다 — 실제로 그렇게 날렸다.
 * 어르신 앞에서 한 시간 들은 이야기를 창 닫기 한 번으로 잃을 수는 없다.
 *
 * 음성은 이 서비스가 다루는 것 중 가장 민감한 자료다. 그래서 보관에 두 가지
 * 규칙을 함께 넣었다. 저장만 만들고 지우는 길을 안 만들면, 지워야 할 때
 * 지울 수 없는 상태가 된다.
 *
 *   1. 보관기간이 지나면 스스로 지운다 (무기한 보관 금지)
 *   2. 녹음 동의를 거두면 즉시 지운다 (동의 철회가 말뿐이면 안 된다)
 *
 * ── 회기마다 한 칸 (판 2)
 *
 * 오래 칸이 하나였다. 'current' 한 자리에 마지막 녹음만 남고, 새로 녹음하면
 * 앞 녹음이 지워졌다. 그래서 2회기를 녹음하는 순간 1회기 녹음이 사라졌다.
 *
 * 그러면 1회기 이야기에 붙은 출처 — "어르신 음성 0:42" — 가 가리킬 소리가
 * 없어진다. 그 자리를 눌러 어르신과 가족에게 들려주는 것이 이 제품의 핵심
 * 장면인데, 회기 하나가 지나면 통째로 사라지는 셈이었다. 보관기간 30일도
 * 말뿐이었다 — 30일 전에 다음 회기가 오면 그때 지워지니까.
 *
 * 곡이 먼저 같은 문제를 겪고 고쳤다(songStore 의 '어르신마다 한 칸이었다').
 * 녹음도 같은 모양으로 옮긴다 — 회기 하나당 칸 하나.
 *
 * 조각 열쇠에 번호를 0 으로 채워 넣는 이유가 있다. 문자열로 정렬되므로
 * '…::10' 이 '…::2' 보다 앞에 온다. 채워 넣지 않으면 조각 순서가 뒤섞이고,
 * 그건 소리가 뒤죽박죽이 된다는 뜻이다.
 */

const DB_NAME = 'toktok';
const META = 'meta';
const CHUNKS = 'chunks';

/** 판 1 의 칸. 읽기만 하고 새로 쓰지 않는다 — 있던 녹음을 잃으면 안 된다. */
const LEGACY_KEY = 'current';

/** 기본 보관기간. 명세서의 보관정책이 정해지면 그 값으로 바꾼다. */
export const RETENTION_DAYS = 30;

type Meta = {
  seconds: number;
  mime: string;
  /** 마지막으로 조각이 들어온 시각 */
  savedAt: number;
  /** 정상적으로 끝났는지. false 면 중간에 끊긴 녹음이다. */
  finished: boolean;
  /** 누구의 어느 회기 것인가. 판 1 저장본에는 없다. */
  ownerId?: string;
  sessionId?: string;
};

export type StoredRecording = {
  blob: Blob;
  seconds: number;
  savedAt: number;
  /** 중간에 끊긴 녹음을 되살린 경우 */
  recovered: boolean;
};

/**
 * 이 회기의 녹음 칸 이름.
 *
 * 곡과 같은 근거를 쓴다(songStore.songTag) — 기관 회기면 서버 참가자 id,
 * 시연 기기면 어르신 id. 회기는 연 시각으로 가른다.
 */
export function recordingKey(): string {
  const s = currentSession();
  const owner = s.remoteParticipantId ?? s.elder.id;
  const session = s.remoteStartedAt ?? 'demo';
  return `r2:${owner}::${session}`;
}

/** 조각 열쇠. 번호를 채워 넣어야 문자열 정렬이 곧 조각 순서가 된다. */
const chunkKey = (key: string, index: number) => `${key}::${String(index).padStart(6, '0')}`;
const chunkRange = (key: string) => IDBKeyRange.bound(`${key}::`, `${key}::￿`);

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, 2);
    } catch {
      return resolve(null);
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      // 예전 판에서 쓰던 통짜 저장소는 버린다
      if (db.objectStoreNames.contains('recordings')) db.deleteObjectStore('recordings');
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
      if (!db.objectStoreNames.contains(CHUNKS)) db.createObjectStore(CHUNKS);
    };
    req.onsuccess = () => resolve(req.result);
    // 사파리 프라이빗 모드처럼 IndexedDB 가 막힌 곳이 있다. 그때는 저장을
    // 포기하되 녹음 자체는 계속되게 둔다.
    req.onerror = () => resolve(null);
  });
}

function run<T>(
  db: IDBDatabase,
  stores: string[],
  mode: IDBTransactionMode,
  body: (t: IDBTransaction) => IDBRequest<T>,
): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const t = db.transaction(stores, mode);
      const req = body(t);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** 저장된 모든 녹음의 칸 이름과 표. */
async function allMetas(db: IDBDatabase): Promise<{ key: string; meta: Meta }[]> {
  const keys = (await run<IDBValidKey[]>(db, [META], 'readonly', (t) =>
    t.objectStore(META).getAllKeys(),
  )) ?? [];
  const metas = (await run<Meta[]>(db, [META], 'readonly', (t) => t.objectStore(META).getAll())) ?? [];
  return keys.map((k, i) => ({ key: String(k), meta: metas[i] })).filter((x) => x.meta);
}

/** 한 칸을 지운다. 조각과 표를 함께. */
async function dropKey(db: IDBDatabase, key: string): Promise<void> {
  await run(db, [CHUNKS, META], 'readwrite', (t) => {
    if (key === LEGACY_KEY) t.objectStore(CHUNKS).clear();
    else t.objectStore(CHUNKS).delete(chunkRange(key));
    return t.objectStore(META).delete(key) as unknown as IDBRequest<undefined>;
  });
}

const expired = (m: Meta) => (Date.now() - m.savedAt) / 86_400_000 > RETENTION_DAYS;

/** 보관기간이 지난 녹음을 치운다. 읽는 김에 도므로 따로 청소가 필요 없다. */
async function prune(db: IDBDatabase): Promise<void> {
  for (const { key, meta } of await allMetas(db)) {
    if (expired(meta)) await dropKey(db, key);
  }
}

/**
 * 조각 하나를 이어 붙인다. 녹음 중 1초에 한 번 불린다.
 *
 * 칸 이름을 인자로 받는다. 녹음이 도는 동안 회기가 바뀌면(어르신을 옮기면)
 * 칸이 갈려서 한 녹음이 두 칸에 나뉜다 — 시작할 때 붙잡은 이름을 끝까지 쓴다.
 */
export async function appendChunk(
  key: string,
  index: number,
  blob: Blob,
  meta: Meta,
): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await run(db, [CHUNKS, META], 'readwrite', (t) => {
    t.objectStore(CHUNKS).put(blob, chunkKey(key, index));
    return t.objectStore(META).put(meta, key) as IDBRequest<IDBValidKey>;
  });
  db.close();
}

/**
 * 밖에서 녹음해 온 파일을 이 회기의 녹음으로 앉힌다.
 *
 * 별도 경로를 파지 않고 여기로 들여보내는 이유가 있다. 이 자리에 들어오면
 * 그 뒤가 전부 그대로 적용된다 — 전사, 출처 되짚어 듣기, 보관기간이 지나면
 * 스스로 지워지는 것, 녹음 동의를 거두면 즉시 지워지는 것.
 *
 * 이 회기의 앞 녹음만 지운다. 지난 회기 것은 그대로 둔다.
 */
export async function saveUploaded(blob: Blob, seconds: number): Promise<boolean> {
  const s = currentSession();
  const key = recordingKey();
  await deleteRecording();
  const db = await openDb();
  if (!db) return false;
  const ok = await run(db, [CHUNKS, META], 'readwrite', (t) => {
    t.objectStore(CHUNKS).put(blob, chunkKey(key, 0));
    return t.objectStore(META).put(
      {
        seconds: Math.round(seconds),
        mime: blob.type || 'audio/wav',
        savedAt: Date.now(),
        // 이미 다 있는 파일이다. 중간에 끊긴 녹음이 아니므로 되살린 것으로
        // 표시하지 않는다 — 화면이 '복구했어요'라고 말하면 거짓이 된다.
        finished: true,
        ownerId: s.remoteParticipantId ?? s.elder.id,
        sessionId: s.remoteStartedAt ?? 'demo',
      } satisfies Meta,
      key,
    ) as IDBRequest<IDBValidKey>;
  });
  db.close();
  return ok !== null;
}

/**
 * 판 1 의 'current' 칸에 든 녹음을 이 회기 것으로 옮겨 온다.
 *
 * 판올림 전에 저장된 녹음이 그냥 사라지면 어르신께는 녹음이 없어진 것이다.
 * 어느 회기 것인지는 알 수 없지만, 판 1 에서는 그것이 곧 '지금 녹음'이었으니
 * 지금 회기 것으로 본다.
 */
async function adoptLegacy(db: IDBDatabase, key: string): Promise<Meta | null> {
  const meta = await run<Meta>(db, [META], 'readonly', (t) => t.objectStore(META).get(LEGACY_KEY));
  if (!meta) return null;
  if (expired(meta)) {
    await dropKey(db, LEGACY_KEY);
    return null;
  }
  const parts = (await run<Blob[]>(db, [CHUNKS], 'readonly', (t) => t.objectStore(CHUNKS).getAll())) ?? [];
  if (!parts.length) return null;

  const s = currentSession();
  const next: Meta = {
    ...meta,
    ownerId: s.remoteParticipantId ?? s.elder.id,
    sessionId: s.remoteStartedAt ?? 'demo',
  };
  await run(db, [CHUNKS, META], 'readwrite', (t) => {
    parts.forEach((b, i) => t.objectStore(CHUNKS).put(b, chunkKey(key, i)));
    // 옛 조각은 번호 열쇠라 새 칸과 섞이지 않는다. 옮긴 뒤 통째로 치운다.
    return t.objectStore(META).put(next, key) as IDBRequest<IDBValidKey>;
  });
  await run(db, [CHUNKS, META], 'readwrite', (t) => {
    t.objectStore(CHUNKS).delete(IDBKeyRange.bound(-Infinity, Infinity));
    return t.objectStore(META).delete(LEGACY_KEY) as unknown as IDBRequest<undefined>;
  });
  return next;
}

/**
 * 이 회기의 녹음본을 읽어 하나로 잇는다. 보관기간이 지난 것은 읽는 김에 치운다.
 */
export async function loadRecording(): Promise<StoredRecording | null> {
  const db = await openDb();
  if (!db) return null;
  await prune(db);

  const key = recordingKey();
  let meta = await run<Meta>(db, [META], 'readonly', (t) => t.objectStore(META).get(key));
  if (!meta) meta = await adoptLegacy(db, key);
  if (!meta) {
    db.close();
    return null;
  }

  const parts = await run<Blob[]>(db, [CHUNKS], 'readonly', (t) =>
    t.objectStore(CHUNKS).getAll(chunkRange(key)),
  );
  db.close();
  if (!parts || !parts.length) return null;

  return {
    blob: new Blob(parts, { type: meta.mime || 'audio/webm' }),
    seconds: meta.seconds,
    savedAt: meta.savedAt,
    recovered: !meta.finished,
  };
}

/** 이 회기의 녹음만 지운다. 지난 회기 것은 건드리지 않는다. */
export async function deleteRecording(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await dropKey(db, recordingKey());
  db.close();
}

/**
 * 이 어르신의 녹음을 전부 지운다.
 *
 * 녹음 동의를 거두면 반드시 불려야 한다. 이번 회기 것만 지우고 지난 회기
 * 녹음을 남겨 두면 그 철회는 말뿐이다.
 */
export async function deleteRecordingsOf(ownerId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  for (const { key, meta } of await allMetas(db)) {
    // 판 1 저장본에는 주인이 적혀 있지 않다. 누구 것인지 모르는 음성을
    // 남겨 두는 쪽이 더 나쁘므로 함께 지운다.
    if (meta.ownerId === undefined || meta.ownerId === ownerId) await dropKey(db, key);
  }
  db.close();
}

/**
 * 이 어르신 것이 아닌 녹음을 치운다. 어르신을 바꿀 때 부른다.
 *
 * 예전에는 어르신을 바꾸면 기기의 녹음을 통째로 지웠다. 칸이 하나뿐이라 남의
 * 녹음이 이 회기 것으로 읽힐 수 있었기 때문이다. 이제 칸이 갈려 있어서 그
 * 사고는 일어나지 않지만, 기기에 다른 어르신의 음성을 들고 다닐 이유도 없다.
 * 지금 보고 있는 어르신 것만 남긴다.
 */
export async function deleteRecordingsExcept(ownerId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  for (const { key, meta } of await allMetas(db)) {
    if (meta.ownerId !== undefined && meta.ownerId !== ownerId) await dropKey(db, key);
  }
  db.close();
}

/** 기기에 남은 녹음 전부. '이 기기의 기록 지우기'가 부른다. */
export async function deleteAllRecordings(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await run(db, [CHUNKS, META], 'readwrite', (t) => {
    t.objectStore(CHUNKS).clear();
    return t.objectStore(META).clear() as unknown as IDBRequest<undefined>;
  });
  db.close();
}

/** 기기에 남은 녹음의 수와 용량. 화면이 '얼마나 쌓였는지' 말할 근거다. */
export async function recordingTotals(): Promise<{ count: number; bytes: number }> {
  const db = await openDb();
  if (!db) return { count: 0, bytes: 0 };
  await prune(db);
  const metas = await allMetas(db);
  let bytes = 0;
  for (const { key } of metas) {
    const parts = (await run<Blob[]>(db, [CHUNKS], 'readonly', (t) =>
      t.objectStore(CHUNKS).getAll(key === LEGACY_KEY ? undefined : chunkRange(key)),
    )) ?? [];
    for (const b of parts) bytes += b.size;
  }
  db.close();
  return { count: metas.length, bytes };
}

/** 화면에 "1.2MB · 3일 남음"으로 보여주기 위한 값. */
export function retentionLeftDays(savedAt: number): number {
  return Math.max(0, Math.ceil(RETENTION_DAYS - (Date.now() - savedAt) / 86_400_000));
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}
