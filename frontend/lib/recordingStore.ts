'use client';

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
 */

const DB_NAME = 'toktok';
const META = 'meta';
const CHUNKS = 'chunks';
const META_KEY = 'current';

/** 기본 보관기간. 명세서의 보관정책이 정해지면 그 값으로 바꾼다. */
export const RETENTION_DAYS = 30;

type Meta = {
  seconds: number;
  mime: string;
  /** 마지막으로 조각이 들어온 시각 */
  savedAt: number;
  /** 정상적으로 끝났는지. false 면 중간에 끊긴 녹음이다. */
  finished: boolean;
};

export type StoredRecording = {
  blob: Blob;
  seconds: number;
  savedAt: number;
  /** 중간에 끊긴 녹음을 되살린 경우 */
  recovered: boolean;
};

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

/** 조각 하나를 이어 붙인다. 녹음 중 1초에 한 번 불린다. */
export async function appendChunk(index: number, blob: Blob, meta: Meta): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await run(db, [CHUNKS, META], 'readwrite', (t) => {
    t.objectStore(CHUNKS).put(blob, index);
    return t.objectStore(META).put(meta, META_KEY) as IDBRequest<IDBValidKey>;
  });
  db.close();
}

/**
 * 밖에서 녹음해 온 파일을 이 회기의 녹음으로 앉힌다.
 *
 * 별도 경로를 파지 않고 여기로 들여보내는 이유가 있다. 이 자리에 들어오면
 * 그 뒤가 전부 그대로 적용된다 — 전사, 출처 되짚어 듣기, 보관기간이 지나면
 * 스스로 지워지는 것, 녹음 동의를 거두면 즉시 지워지는 것. 올린 녹음이라고
 * 해서 그 규칙들이 느슨해질 이유가 없고, 따로 만들면 반드시 하나를 빠뜨린다.
 *
 * 앞 녹음은 지운다. 남겨 두면 앞 조각이 새 파일 앞에 이어 붙어 엉뚱한 소리가
 * 된다(startRecording 과 같은 이유).
 */
export async function saveUploaded(blob: Blob, seconds: number): Promise<boolean> {
  await deleteRecording();
  const db = await openDb();
  if (!db) return false;
  const ok = await run(db, [CHUNKS, META], 'readwrite', (t) => {
    t.objectStore(CHUNKS).put(blob, 0);
    return t.objectStore(META).put(
      {
        seconds: Math.round(seconds),
        mime: blob.type || 'audio/wav',
        savedAt: Date.now(),
        // 이미 다 있는 파일이다. 중간에 끊긴 녹음이 아니므로 되살린 것으로
        // 표시하지 않는다 — 화면이 '복구했어요'라고 말하면 거짓이 된다.
        finished: true,
      } satisfies Meta,
      META_KEY,
    ) as IDBRequest<IDBValidKey>;
  });
  db.close();
  return ok !== null;
}

/**
 * 저장된 녹음본을 읽어 하나로 잇는다. 보관기간이 지났으면 지우고 없다고 한다 —
 * 읽는 김에 정리하므로 따로 청소하는 작업이 필요 없다.
 */
export async function loadRecording(): Promise<StoredRecording | null> {
  const db = await openDb();
  if (!db) return null;

  const meta = await run<Meta>(db, [META], 'readonly', (t) =>
    t.objectStore(META).get(META_KEY),
  );
  if (!meta) {
    db.close();
    return null;
  }

  const ageDays = (Date.now() - meta.savedAt) / 86_400_000;
  if (ageDays > RETENTION_DAYS) {
    db.close();
    await deleteRecording();
    return null;
  }

  const parts = await run<Blob[]>(db, [CHUNKS], 'readonly', (t) =>
    t.objectStore(CHUNKS).getAll(),
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

export async function deleteRecording(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await run(db, [CHUNKS, META], 'readwrite', (t) => {
    t.objectStore(CHUNKS).clear();
    return t.objectStore(META).clear() as unknown as IDBRequest<undefined>;
  });
  db.close();
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
