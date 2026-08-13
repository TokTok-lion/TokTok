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
 *
 * ------------------------------------------------------------------
 * 그런데 어르신마다 '한 칸'이었다.
 *
 * 그래서 같은 어르신의 2회기 곡이 1회기 곡을 덮어썼다. 회기는 반복되는 것이
 * 정상이고, "지난번 노래 다시 들려드릴게요"는 이 제품이 하려는 일 그 자체다.
 * 판을 올리면서 칸을 **곡 하나당 하나**로 바꿨다. 어느 어르신의 어느 회기
 * 것인지는 키가 아니라 meta 저장소가 들고 있다.
 *
 * 회기 식별자는 remoteStartedAt(회기를 연 시각)을 쓴다. 서버 회기 번호
 * (remoteSessionId)가 더 자연스러워 보이지만 쓸 수 없다 — 그 값은 9단계에서
 * 서버에 저장할 때 비로소 생기는데 곡은 7단계에서 만들어진다. 곡을 만들 때는
 * null 이고 나중에 채워지므로, 그걸 키로 삼으면 회기 도중에 곡의 주소가 바뀌어
 * 방금 만든 곡을 못 찾는다(그 자리는 요금이 다시 나가는 자리다). remoteStartedAt
 * 은 beginSession 이 회기 시작 때 한 번 찍고 그 회기 동안 변하지 않는다.
 * 서버를 안 쓰는 기기에서도 값이 있으므로 둘러보기 회기도 갈린다.
 *
 * 회기를 아예 연 적 없는 상태(앱을 처음 열었을 때의 씨앗 회기)는 시작 시각이
 * 없다. 그때만 'demo' 한 칸으로 묶는다 — 화면(보관함)이 그 곡에 '둘러보기'
 * 라고 적고, 새로 만들면 덮어쓴다는 것도 미리 적는다.
 *
 * ------------------------------------------------------------------
 * 용량 정책: 자동으로 지우지 않는다.
 *
 * 곡이 쌓이면 기기 용량이 문제가 된다. 그래도 오래된 것부터 지우기·개수
 * 상한은 두지 않기로 했다. 그 규칙이 지우는 것은 정확히 "지난번 노래"이고,
 * 그건 이 제품이 하려는 일을 스스로 깨는 것이다. 어느 곡이 덜 중요한지는
 * 우리가 알 수 없다 — 어르신과 복지사가 안다.
 *
 * 대신 세 가지를 한다.
 *   1. 얼마나 쌓였는지 보관함 화면에 곡 수와 용량으로 보여 준다.
 *   2. 지우는 길을 그 자리에 둔다(deleteSongAt · deleteAllSongs). 한 곡씩,
 *      사람이 고른 것만.
 *   3. 자리가 없어 저장하지 못하면 그 사실을 그대로 말한다(SaveOutcome).
 *      요금을 내고 만든 곡이라, 저장 실패를 조용히 삼키면 화면은 곡이 있다고
 *      하고 실제로는 없다.
 * 말없이 지우는 것만은 하지 않는다. 어르신 노래다.
 */

import type { MusicStyleId } from './domain';
import { currentSession } from './store';

const DB_NAME = 'toktok-song';
/** 곡 파일. 판 1부터 쓰던 이름 그대로다 — 바꾸면 들어 있던 곡을 잃는다. */
const BLOBS = 'songs';
/** 이 곡이 누구의 어느 회기 것인지. 판 2에서 생겼다. */
const METAS = 'meta';
const DB_VERSION = 2;

/**
 * 주인 표시가 없던 시절의 칸.
 *
 * 읽기만 하고 새로 쓰지는 않는다. 이 판으로 올리기 전에 만든 곡이 그냥
 * 사라지면 어르신께는 노래가 없어진 것이다.
 */
const LEGACY_KEY = 'current';
/** 어르신 한 분당 한 칸이던 시절의 칸 이름. `song:<어르신>` */
const OWNER_PREFIX = 'song:';
/** 지금 쓰는 칸 이름. 곡 하나당 하나이고, 뜻은 meta 가 들고 있다. */
const SLOT_PREFIX = 's2:';

/** 회기를 연 적 없는 상태(씨앗 회기)에서 만든 곡이 묶이는 칸. */
export const DEMO_SESSION = 'demo';
/** 판올림 전에 저장돼 있어서 어느 회기 것인지 알 수 없는 곡. */
export const LEGACY_SESSION = 'legacy';
/**
 * 다른 기기에서 만들어 기관 저장소를 통해 온 곡.
 *
 * 이 기기가 연 회기가 아니므로 회기 식별자를 지어 붙이지 않는다. 마침 이
 * 값은 어떤 실제 회기(remoteStartedAt 은 시각 문자열이다)와도 같아질 수
 * 없어서, loadSong 이 이런 곡을 '이번 회기에 만든 곡'으로 집어 드는 일도
 * 없다 — 그렇게 집히면 곡 만들기 화면이 남의 회기 곡을 오늘 곡으로 내밀게
 * 된다.
 */
export const SERVER_SESSION = 'server';

/** 지금 회기의 신원 — 곡을 저장할 때 이 값이 그대로 곡에 붙는다. */
export type SongTag = {
  /** 기관 회기면 서버 participants.id, 시연 기기면 어르신 id */
  ownerId: string;
  sessionId: string;
  /** 회기 주제. 없으면 null — 목록이 제목을 지어내지 않게 한다. */
  topic: string | null;
  /**
   * 복지사가 고른 앨범 그림(Scene.id). 안 골랐으면 null.
   *
   * 곡에 같이 붙여 둬야 보관함에서도 고른 그림이 나온다. 이게 없으면
   * 복지사가 그림을 바꿔 노래를 만들고, 며칠 뒤 보관함을 열었을 때 주제에서
   * 다시 계산된 옛 그림이 붙어 있다 — 바꾼 적이 없는 것처럼.
   */
  cover: string | null;
  style: MusicStyleId | null;
};

export type SongMeta = {
  /** BLOBS 에서 이 곡을 찾는 이름 */
  key: string;
  ownerId: string;
  sessionId: string;
  /**
   * 만든 시각(ms). 모르면 null.
   *
   * 판올림 전에 저장된 곡에는 이 값이 없다. 그럴듯한 시각을 지어 넣지
   * 않는다 — 목록이 날짜를 말하면 그건 잰 값이어야 한다.
   */
  madeAt: number | null;
  topic: string | null;
  /** 곡을 만들 때 복지사가 고른 그림. 판올림 전 곡에는 없어서 optional. */
  cover?: string | null;
  style: MusicStyleId | null;
  bytes: number;
  /**
   * 이 곡을 만든 가사의 지문(songSync.lyricsHash). 모르면 없다.
   *
   * 서버 목록과 기기 목록을 합칠 때 "이 둘이 같은 곡인가"를 이것으로 가린다.
   * 서버 행에도 같은 값이 lyrics_hash 로 들어 있어서, 둘이 맞으면 한 줄로
   * 접는다. 이 값이 붙기 전에 저장된 곡은 짝을 못 찾아 목록에 두 번 나올 수
   * 있다 — 보기 싫은 정도이고, 잘못 접어서 다른 곡을 감추는 쪽이 훨씬 나쁘다.
   */
  hash?: string | null;
  /**
   * 가사 줄이 곡의 몇 초에서 시작하는지 — 줄마다 하나(lib/align).
   *
   * 곡마다 한 번만 재고 여기 붙여 둔다. 함께 부르기 화면이 이 값을 쓰면
   * "지금 이 줄"이 어림이 아니라 잰 값이 된다. 없으면 예전 어림으로 돌아간다.
   *
   * 어느 가사에 맞춘 것인지 함께 둔다(cueHash). 가사를 고치면 이 시각은
   * 남의 가사의 시각이 되므로, 맞지 않으면 안 쓴다.
   */
  cues?: number[] | null;
  cueHash?: string | null;
};

export type SongShelf = {
  /**
   * 보관함을 읽을 수 있었는가.
   *
   * false 는 "곡이 없다"가 아니라 "못 읽었다"다. 둘을 같은 화면으로 그리면
   * 곡이 멀쩡히 있는 기기에서 "노래가 없어요"라고 말하게 된다.
   */
  available: boolean;
  /** 지금 어르신의 곡. 이번 회기 → 최근 순. */
  songs: SongMeta[];
  /** 이 기기에 있는 모든 곡(다른 어르신 것 포함)의 수와 용량 */
  total: number;
  totalBytes: number;
  /** 지금 회기 — 목록이 '이번 회기'를 가려내는 근거 */
  sessionId: string;
};

/** 저장 결과. 'full' 은 기기에 자리가 없다는 뜻이다. */
export type SaveOutcome = 'ok' | 'full' | 'unavailable';

/** 지금 회기의 신원. 곡을 만들기 시작할 때 붙잡아 두고 끝까지 그걸 쓴다. */
export function songTag(): SongTag {
  const s = currentSession();
  const topic = s.topic?.trim();
  return {
    ownerId: s.remoteParticipantId ?? s.elder.id,
    sessionId: s.remoteStartedAt ?? DEMO_SESSION,
    // 서버에서 온 어르신은 주제가 '—'로 온다(useElders.toSummary). 그건 주제가
    // 아니라 '아직 없음' 표시라, 목록에 '— 이야기'라는 제목이 생기지 않게 비운다.
    topic: !topic || topic === '—' ? null : topic,
    cover: s.cover,
    style: s.style,
  };
}

/** 곡 하나에 붙일 새 칸 이름. 같은 밀리초에 두 번 저장돼도 겹치지 않게 한다. */
let mint = 0;
function newKey(at: { ownerId: string; sessionId: string }, madeAt: number): string {
  mint += 1;
  return `${SLOT_PREFIX}${at.ownerId}::${at.sessionId}::${madeAt}-${mint}`;
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      return resolve(null);
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      // 있던 저장소는 건드리지 않는다. 여기서 지우면 그 안의 곡이 사라진다.
      if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS);
      if (!db.objectStoreNames.contains(METAS)) db.createObjectStore(METAS, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    // 옛 판을 연 탭이 남아 있으면 판올림이 막힌다. 그때는 기다리지 않고
    // 포기한다 — 화면이 영영 '불러오는 중'에 머무는 것이 더 나쁘다.
    req.onblocked = () => resolve(null);
  });
}

function idb<T>(
  db: IDBDatabase,
  store: string,
  mode: IDBTransactionMode,
  body: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const r = body(db.transaction(store, mode).objectStore(store));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * 곡과 그 신원을 한 트랜잭션에 함께 쓴다.
 *
 * 나뉘면 둘이 어긋난다 — 파일만 남으면 목록에 안 뜨는 곡이 되고(지울 수도
 * 없다), 표만 남으면 목록에는 있는데 눌러도 안 나는 곡이 된다.
 *
 * 자리가 없어 실패한 경우를 따로 돌려준다. 요금을 내고 만든 곡이라
 * '그냥 실패'와 '기기가 꽉 참'은 사람이 할 일이 다르다.
 */
function writeSong(db: IDBDatabase, meta: SongMeta, blob: Blob): Promise<SaveOutcome> {
  return new Promise((resolve) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction([BLOBS, METAS], 'readwrite');
    } catch {
      return resolve('unavailable');
    }
    let full = false;
    tx.oncomplete = () => resolve('ok');
    tx.onabort = () => resolve(full || tx.error?.name === 'QuotaExceededError' ? 'full' : 'unavailable');
    tx.onerror = () => resolve(full ? 'full' : 'unavailable');
    try {
      const r = tx.objectStore(BLOBS).put(blob, meta.key);
      r.onerror = () => {
        if (r.error?.name === 'QuotaExceededError') full = true;
      };
      tx.objectStore(METAS).put(meta);
    } catch {
      // 여기서 던지면 트랜잭션이 abort 되고 위 핸들러가 답한다.
    }
  });
}

function putMeta(db: IDBDatabase, meta: SongMeta): Promise<void> {
  return idb(db, METAS, 'readwrite', (s) => s.put(meta) as IDBRequest<IDBValidKey>).then(
    () => undefined,
  );
}

async function allMetas(db: IDBDatabase): Promise<SongMeta[]> {
  return (await idb<SongMeta[]>(db, METAS, 'readonly', (s) => s.getAll())) ?? [];
}

/* ------------------------------------------------------------------ *
 * 판올림 전에 저장된 곡 되찾기
 *
 * 판 1 의 칸(`song:<어르신>`)에는 실제 기기에 곡이 들어 있다. 새 판이 그
 * 칸을 안 보면 어르신 노래가 판올림 한 번에 사라진 것과 같다. 그래서 파일은
 * 그 자리에 그대로 두고 표(meta)만 새로 달아 목록에 올린다 — 파일을 옮기지
 * 않으므로 옮기다 잃을 일도 없다.
 *
 * 주제·분위기·만든 시각은 그때 저장하지 않았으니 모른다. 모르는 채로 둔다.
 * ------------------------------------------------------------------ */
let migrated: Promise<void> | null = null;

function ensureMigrated(db: IDBDatabase): Promise<void> {
  if (!migrated) migrated = migrateOnce(db).catch(() => undefined);
  return migrated;
}

async function migrateOnce(db: IDBDatabase): Promise<void> {
  const keys = (await idb<IDBValidKey[]>(db, BLOBS, 'readonly', (s) => s.getAllKeys())) ?? [];
  if (!keys.length) return;
  const known = new Set((await allMetas(db)).map((m) => m.key));

  /*
   * 이 옛 곡이 '지금 진행 중인 회기'의 곡인가.
   *
   * 판올림 직전에 만든 곡이면 그렇다. 그걸 못 알아보면 곡 만들기 화면이
   * "기기에 곡이 없다"고 보고 한 번 더 만든다 — 판올림 한 번에 요금이 한 번
   * 더 나가는 길이다.
   *
   * 근거는 songKey 다. 어르신을 바꿀 때(beginSession) 반드시 null 이 되므로,
   * 남아 있다는 것은 그 곡이 지금 이 회기에서 만들어졌다는 뜻이다.
   *
   * 이 판단은 판올림 때 딱 한 번만 한다. loadSong 이 부를 때마다 다시 하면,
   * 한참 뒤의 회기가 파일을 잃었을 때 몇 해 전 곡을 '이번 회기 곡'으로 끌어
   * 오게 된다 — 그건 목록에 없는 날짜를 지어 붙이는 것과 같다.
   */
  const tag = songTag();
  const claiming = Boolean(currentSession().songKey);
  const ownedKey = `${OWNER_PREFIX}${tag.ownerId}`;
  const hasOwned = keys.some((k) => String(k) === ownedKey);

  for (const raw of keys) {
    const key = String(raw);
    if (known.has(key)) continue;
    if (key.startsWith(SLOT_PREFIX)) continue;

    const ownerId = key.startsWith(OWNER_PREFIX) ? key.slice(OWNER_PREFIX.length) : null;
    if (key !== LEGACY_KEY && !ownerId) continue;

    // 주인이 적혀 있지 않은 칸('current')은 이번 회기가 인수할 때만 목록에
    // 올린다. 누구 곡인지 모르는 채로 지금 어르신 보관함에 놓으면, 고치려던
    // 그 사고(남의 노래를 다른 분 앞에서 트는 일)를 목록으로 다시 하는 것이다.
    // 주인이 적힌 칸이 함께 있으면 그쪽이 이번 회기 곡이다.
    const claimed = ownerId
      ? claiming && ownerId === tag.ownerId
      : claiming && !hasOwned;
    if (!ownerId && !claimed) continue;

    const blob = await idb<Blob>(db, BLOBS, 'readonly', (s) => s.get(key));
    if (!blob) continue;

    await putMeta(db, {
      key,
      ownerId: claimed ? tag.ownerId : ownerId!,
      sessionId: claimed ? tag.sessionId : LEGACY_SESSION,
      // 이번 회기 곡인 것은 맞아도 몇 시에 만들었는지는 남아 있지 않다.
      // 지금 시각을 적으면 재지 않은 값을 적는 것이 된다.
      madeAt: null,
      topic: claimed ? tag.topic : null,
      cover: claimed ? tag.cover : null,
      style: claimed ? tag.style : null,
      bytes: blob.size,
    });
  }
}

/* ------------------------------------------------------------------ *
 * 저장 · 읽기
 * ------------------------------------------------------------------ */

/**
 * 곡을 이 회기의 것으로 저장한다.
 *
 * tag 를 인자로 받는 이유: 곡 만들기는 1~3분이 걸려서, 그 사이에 복지사가
 * 다른 어르신으로 넘어갈 수 있다. 저장할 때 현재 회기를 다시 읽으면 방금
 * 만든 곡이 다음 어르신의 보관함으로 들어간다. 곡은 그것을 주문한 회기의
 * 것이므로, 만들기 시작할 때 붙잡아 둔 신원을 그대로 쓴다.
 */
export async function saveSong(
  blob: Blob,
  tag: SongTag = songTag(),
  // 가사 지문. 이게 붙어 있어야 나중에 서버 목록과 합칠 때 같은 곡을 한 줄로
  // 접을 수 있다(SongMeta.hash).
  hash: string | null = null,
): Promise<SaveOutcome> {
  const db = await openDb();
  if (!db) return 'unavailable';
  const madeAt = Date.now();
  const out = await writeSong(
    db,
    {
      key: newKey(tag, madeAt),
      ownerId: tag.ownerId,
      sessionId: tag.sessionId,
      madeAt,
      topic: tag.topic,
      cover: tag.cover,
      style: tag.style,
      bytes: blob.size,
      hash,
    },
    blob,
  );
  db.close();
  return out;
}

/**
 * 기관 저장소에서 내려받은 곡을 이 기기에도 둔다.
 *
 * 다음에 같은 곡을 누를 때 통신을 기다리지 않게 하려는 것이다. 어르신 앞에서
 * 재생 버튼을 눌렀는데 센터 와이파이를 기다리는 일이 없어야 한다.
 *
 * 만든 시각·주제·그림은 서버 행에 적힌 그대로 옮긴다. 지금 시각을 적으면
 * 몇 달 전 노래에 오늘 날짜가 붙는다.
 *
 * 실패해도 재생은 막지 않는다 — 부르는 쪽이 결과를 안 기다린다. 기기가 꽉
 * 찼거나 비밀 모드일 때 여기서 멈추면, 서버에 멀쩡히 있는 곡을 못 듣는다.
 */
export async function cacheServerSong(
  blob: Blob,
  meta: Omit<SongMeta, 'key' | 'bytes'>,
): Promise<SaveOutcome> {
  const db = await openDb();
  if (!db) return 'unavailable';
  const out = await writeSong(
    db,
    {
      ...meta,
      key: newKey(meta, meta.madeAt ?? 0),
      bytes: blob.size,
    },
    blob,
  );
  db.close();
  return out;
}

/** 이 회기에서 만든 곡 중 가장 최근 것. 없으면 null. */
export async function loadSong(): Promise<Blob | null> {
  const db = await openDb();
  if (!db) return null;
  await ensureMigrated(db);

  const tag = songTag();
  const mine = (await allMetas(db))
    .filter((m) => m.ownerId === tag.ownerId && m.sessionId === tag.sessionId)
    .sort(newestFirst);

  for (const m of mine) {
    const blob = await idb<Blob>(db, BLOBS, 'readonly', (s) => s.get(m.key));
    if (blob) {
      db.close();
      return blob;
    }
    // 표는 있는데 파일이 없다. 목록에 눌러도 안 나는 곡을 남기지 않는다.
    await idb(db, METAS, 'readwrite', (s) => s.delete(m.key) as unknown as IDBRequest<undefined>);
  }

  // 판올림 직전에 만든 곡은 위 ensureMigrated 가 이미 이 회기 것으로 표를
  // 달아 두므로 여기서 따로 찾지 않는다.
  db.close();
  return null;
}

/**
 * 이 회기의 곡에 붙은 표. 곡이 없으면 null.
 *
 * loadSong 은 소리만 돌려주는데, 맞춘 시각은 표 쪽에 붙어 있다. 둘을 같은
 * 규칙으로 찾아야 "지금 듣고 있는 곡"과 "지금 쓰는 시각"이 어긋나지 않는다.
 */
export async function currentSongMeta(): Promise<SongMeta | null> {
  const db = await openDb();
  if (!db) return null;
  await ensureMigrated(db);
  const tag = songTag();
  const mine = (await allMetas(db))
    .filter((m) => m.ownerId === tag.ownerId && m.sessionId === tag.sessionId)
    .sort(newestFirst);
  db.close();
  return mine[0] ?? null;
}

/**
 * 맞춘 시각을 곡에 붙인다.
 *
 * 실패해도 아무것도 막지 않는다 — 다음에 또 맞추면 될 뿐이다. 기기가 꽉
 * 찼다고 노래를 못 부르게 할 이유가 없다.
 */
export async function saveCues(
  key: string,
  cues: number[],
  cueHash: string | null,
): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  const meta = await idb<SongMeta>(db, METAS, 'readonly', (s) => s.get(key));
  if (!meta) {
    db.close();
    return false;
  }
  const out = await idb(db, METAS, 'readwrite', (s) =>
    s.put({ ...meta, cues, cueHash }) as unknown as IDBRequest<undefined>,
  );
  db.close();
  return out !== null;
}

/** 목록에서 고른 곡 하나. */
export async function loadSongAt(key: string): Promise<Blob | null> {
  const db = await openDb();
  if (!db) return null;
  const blob = await idb<Blob>(db, BLOBS, 'readonly', (s) => s.get(key));
  db.close();
  return blob ?? null;
}

/** 이번 회기 → 최근 순. 만든 시각을 모르는 곡은 맨 뒤로 둔다. */
function newestFirst(a: SongMeta, b: SongMeta): number {
  if (a.madeAt === null && b.madeAt === null) return 0;
  if (a.madeAt === null) return 1;
  if (b.madeAt === null) return -1;
  return b.madeAt - a.madeAt;
}

/**
 * 보관함 한 장.
 *
 * 목록에는 지금 어르신의 곡만 담는다. 기기 전체 수와 용량은 숫자로만 알려
 * 준다 — 다른 어르신의 곡을 이 화면에서 열지 않기 위해서다. 그래도 얼마나
 * 쌓였는지는 알아야 지울 수 있다.
 */
export async function readSongShelf(): Promise<SongShelf> {
  const tag = songTag();
  const db = await openDb();
  if (!db) {
    return { available: false, songs: [], total: 0, totalBytes: 0, sessionId: tag.sessionId };
  }
  await ensureMigrated(db);
  const all = await allMetas(db);
  db.close();

  const songs = all
    .filter((m) => m.ownerId === tag.ownerId)
    .sort((a, b) => {
      // 이번 회기 곡이 맨 위에 온다. 오늘 만든 곡을 찾으러 스크롤하지 않게.
      const at = a.sessionId === tag.sessionId ? 0 : 1;
      const bt = b.sessionId === tag.sessionId ? 0 : 1;
      return at !== bt ? at - bt : newestFirst(a, b);
    });

  return {
    available: true,
    songs,
    total: all.length,
    totalBytes: all.reduce((sum, m) => sum + (m.bytes || 0), 0),
    sessionId: tag.sessionId,
  };
}

/* ------------------------------------------------------------------ *
 * 지우기
 * ------------------------------------------------------------------ */

async function removeKeys(db: IDBDatabase, keys: string[]): Promise<void> {
  for (const key of keys) {
    await idb(db, BLOBS, 'readwrite', (s) => s.delete(key) as unknown as IDBRequest<undefined>);
    await idb(db, METAS, 'readwrite', (s) => s.delete(key) as unknown as IDBRequest<undefined>);
  }
}

/** 사람이 목록에서 고른 곡 하나를 지운다. 부르는 화면이 먼저 여쭤야 한다. */
export async function deleteSongAt(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await removeKeys(db, [key]);
  db.close();
}

/**
 * 지금 회기의 곡을 지운다.
 *
 * 회기를 새로 열 때(store.beginSession) 불린다. 새 회기는 방금 만들어진
 * 시각을 달고 있어서 이 자리에서 지워질 곡은 없다 — 그게 맞다. 지난 회기의
 * 곡은 지우지 않는다. 어르신께 "지난번 노래 다시 들려드릴게요" 하는 것이
 * 이 제품이 하려는 일이고, 예전에는 바로 여기서 그 곡이 사라졌다.
 *
 * 주인 없는 옛 칸('current')만은 함께 비운다. 누구 곡인지 알 수 없어 목록에
 * 올릴 수도 없고, 남겨 두면 다음 어르신 회기에서 인수될 수 있다.
 */
export async function deleteSong(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const tag = songTag();
  const metas = await allMetas(db);
  const mine = metas
    .filter((m) => m.ownerId === tag.ownerId && m.sessionId === tag.sessionId)
    .map((m) => m.key);

  /*
   * 주인 없는 옛 칸은 표가 붙어 있지 않을 때만 지운다.
   *
   * loadSong 이 그 칸을 어느 회기의 곡으로 인수하면 표가 생긴다. 표가 생긴
   * 뒤에도 여기서 이름만 보고 지우면, 다음 회기를 여는 순간 지난 회기의
   * 노래가 사라진다 — 고치려던 바로 그 사고를 옛 칸에서 되풀이하는 것이다.
   */
  const orphan = metas.some((m) => m.key === LEGACY_KEY) ? [] : [LEGACY_KEY];

  await removeKeys(db, [...mine, ...orphan]);
  db.close();
}

/**
 * 이 기기의 노래를 전부 지운다.
 *
 * 「이 기기의 기록 지우기」가 약속하는 삭제가 이것이다. 곡이 회기별로 쌓이게
 * 되면서, 지금 회기 칸만 비우는 것으로는 그 약속이 지켜지지 않는다.
 * 지웠다고 말한 뒤에 남아 있는 것이 가장 나쁘다.
 */
export async function deleteAllSongs(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await idb(db, BLOBS, 'readwrite', (s) => s.clear() as unknown as IDBRequest<undefined>);
  await idb(db, METAS, 'readwrite', (s) => s.clear() as unknown as IDBRequest<undefined>);
  db.close();
}
