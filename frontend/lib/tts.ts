'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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

/**
 * 지금 나고 있는 읽어주기 소리와 그 주인.
 *
 * 예전에는 audio 가 그냥 모듈 전역이었다. 그래서 두 가지가 한꺼번에 틀렸다.
 *   · SpeakButton 이 언마운트돼도 소리가 이어졌다. 0.85배속이라 한 문장이
 *     5~8초씩 가는데, 다음 화면에서 어디에도 없는 목소리가 계속 났다.
 *   · 돌아오면 새 훅의 state 는 'idle' 이라 버튼은 '읽어주기'인데 실제로는
 *     재생 중이었다. 눌러 보면 라벨과 반대로 동작한다.
 *
 * 그렇다고 언마운트에서 전역을 무조건 끊으면, 마침 다른 버튼이 내고 있던
 * 소리까지 끊긴다. 그래서 소리에 주인(훅 인스턴스)을 붙였다. 끊는 것은
 * 주인일 때만이고, 남의 소리를 멈출 때는 그쪽 버튼도 함께 '읽어주기'로
 * 되돌린다(reset) — 화면에 남은 표시가 실제 소리와 어긋나지 않게.
 */
type Live = { owner: object; el: HTMLAudioElement; reset: () => void };
let live: Live | null = null;

/** only 를 주면 그 주인의 소리일 때만 멈춘다. 안 주면 누구 것이든 멈춘다. */
function stopLive(only?: object) {
  const it = live;
  if (!it) return;
  if (only && it.owner !== only) return;
  live = null;
  it.el.onended = null;
  it.el.onerror = null;
  it.el.pause();
  it.reset();
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
  /** 이 훅 인스턴스의 신원. 소리의 주인이 나인지 가리는 유일한 근거다. */
  const owner = useRef<object>({});
  const alive = useRef(true);
  /**
   * 요청 일련번호. 소리 하나를 받아 오는 데 몇 초가 걸리고, 그 사이에
   * 멈추거나 화면을 떠날 수 있다. 늦게 돌아온 응답이 그 뒤의 표시를 덮으면
   * 버튼이 실제 소리와 어긋난다 — 이 훅에서 고치려는 것이 바로 그 어긋남이다.
   */
  const seq = useRef(0);

  /** 일련번호가 아직 최신이고 화면에 남아 있을 때만 표시를 바꾼다. */
  const show = useCallback((n: number, next: SpeakState) => {
    if (n !== seq.current || !alive.current) return;
    setState(next);
  }, []);

  /** 남이 내 소리를 멈췄을 때 버튼도 함께 '읽어주기'로 되돌린다. */
  const reset = useCallback(() => {
    seq.current += 1; // 받는 중이던 소리가 뒤늦게 '재생 중'으로 켜지지 않게
    if (alive.current) setState({ kind: 'idle' });
  }, []);

  // 화면을 떠나면 내 소리는 끊는다. 주인이 나일 때만이라 다른 인스턴스가
  // 내고 있는 소리는 그대로 둔다.
  useEffect(() => {
    const me = owner.current;
    alive.current = true;
    return () => {
      alive.current = false;
      stopLive(me);
    };
  }, []);

  const stop = useCallback(() => {
    stopLive(owner.current);
    seq.current += 1;
    if (alive.current) setState({ kind: 'idle' });
  }, []);

  const speak = useCallback(
    async (text: string) => {
      const said = text.trim();
      if (!said) return;
      // 판 번호를 앞에 붙인다 — 목소리 설정이 바뀌면 옛 소리를 꺼내 오지 않는다.
      const key = `${VOICE_REV}:${said}`;

      const me = owner.current;

      // 내 소리가 나고 있으면 멈춘다 — 같은 버튼이 재생/정지가 된다
      if (live && live.owner === me) {
        stopLive(me);
        return;
      }
      // 다른 버튼이 내던 소리는 멈추고 자리를 넘겨받는다. 한 화면에서 두
      // 문장이 겹쳐 나면 어느 쪽도 알아들을 수 없다.
      stopLive();

      const n = ++seq.current;
      setState({ kind: 'loading' });

      let url = await cached(key);
      // 받아 오는 사이에 멈췄거나 화면을 떠났다면 여기서 끝낸다.
      if (n !== seq.current || !alive.current) return;

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
            show(
              n,
              j.quota
                ? { kind: 'exhausted' }
                : { kind: 'error', message: j.error ?? '읽어 드리지 못했어요.' },
            );
            return;
          }
          url = await store(key, await res.blob());
        } catch {
          show(n, { kind: 'error', message: '연결하지 못했어요.' });
          return;
        }
      }
      if (n !== seq.current || !alive.current) return;

      const el = new Audio(url);
      const mine: Live = { owner: me, el, reset };
      el.onended = () => {
        if (live === mine) live = null;
        show(n, { kind: 'idle' });
      };
      el.onerror = () => {
        if (live === mine) live = null;
        show(n, { kind: 'error', message: '소리를 재생하지 못했어요.' });
      };
      live = mine;
      try {
        await el.play();
        show(n, { kind: 'playing' });
      } catch {
        // 언마운트가 pause() 를 불러 play() 가 깨진 경우도 여기로 온다.
        // 그때는 n 이 이미 낡아 show 가 아무것도 하지 않는다.
        if (live === mine) live = null;
        show(n, { kind: 'error', message: '소리를 재생하지 못했어요.' });
      }
    },
    [show, reset],
  );

  return { state, speak, stop };
}
