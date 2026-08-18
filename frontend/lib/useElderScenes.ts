'use client';

import { useCallback, useEffect, useState } from 'react';
import { readElderScenes, type Scene } from './sceneStore';
import { listServerScenes, syncPending } from './sceneSync';

/**
 * 이 어르신의 사연 그림 — 기기와 계정을 합쳐서.
 *
 * ── 왜 한 곳으로 모으나
 *
 * 그림 보관함·이야기 책·사연 숏츠가 저마다 다르게 읽고 있었다. 보관함만
 * 어르신 전체를 계정에서 읽었고, 책과 숏츠는 **이 기기 + 이번 회기**만
 * 읽었다(readScenes). 그래서 계정에 그림이 석 장 있는데도 책은 "그림이
 * 아직 없어요"였다. 회기가 끝나면 그 회기의 책은 다시 열 수 없었다.
 *
 * 같은 어르신의 같은 그림을 세 화면이 다르게 말하면 셋 다 못 믿는다.
 *
 * ── 계정이 원본이다
 *
 * 겹치는 그림은 계정 쪽 글과 확정 여부를 따른다. 그림 파일은 기기 것을
 * 쓴다 — 같은 그림이고, 바꿔 끼우면 화면이 한 번 더 깜빡인다.
 *
 * ── 못 읽음과 없음을 나눈다
 *
 * shared 가 'off' 인 것은 "그림이 없다"가 아니라 "계정을 못 읽었다"다.
 * 둘을 같게 그리면 계정에 있는 그림을 없다고 말하게 되고, 그러면 복지사가
 * 같은 그림을 한 번 더 그린다 — 그리기는 요금이 나가는 자리다.
 */
export type ElderScenes = {
  /** null 은 아직 읽는 중. 빈 배열과 다르다. */
  scenes: Scene[] | null;
  /** 계정 저장소를 읽었는가. */
  shared: 'loading' | 'ok' | 'off';
  /** 계정에만 있던 그림이 목록에 섞였는가. */
  fromServer: boolean;
  reload: () => void;
};

export function useElderScenes(
  /** 누구의 그림인가. 없으면 지금 회기의 어르신(lib/viewElder). */
  ownerId?: string,
  opts?: {
    /** 확정한 그림만. 책과 숏츠가 그렇다 — 초안은 가족에게 가지 않는다. */
    approvedOnly?: boolean;
    /**
     * 못 올라간 그림을 올릴 것인가.
     *
     * 보는 어르신이 회기와 다르면 올리지 않는다 — 남의 기록을 대신 올리는
     * 셈이고, 지금 회기에서 확정한 것도 아니다.
     */
    push?: boolean;
  },
): ElderScenes {
  const approvedOnly = opts?.approvedOnly ?? false;
  const push = opts?.push ?? false;

  const [nonce, setNonce] = useState(0);
  const [scenes, setScenes] = useState<Scene[] | null>(null);
  const [shared, setShared] = useState<'loading' | 'ok' | 'off'>('loading');
  const [fromServer, setFromServer] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const all = await readElderScenes(ownerId);
      if (!alive) return;
      const mine = approvedOnly ? all.filter((x) => x.approved) : all;
      // 기기 것을 먼저 그린다. 통신을 기다리느라 이미 손에 있는 그림을 못
      // 보여 주는 일이 없어야 한다.
      setScenes(mine);

      // 확정해 놓고 못 올라간 그림을 먼저 마저 올린다. 그러고 나서 계정을
      // 읽어야, 방금 올린 것이 목록에 두 번 뜨지 않는다.
      if (push) await syncPending(all);
      if (!alive) return;

      const remote = await listServerScenes(ownerId);
      if (!alive) return;
      if (!remote) {
        setShared('off');
        return;
      }
      setShared('ok');
      if (!remote.length) return;

      const byFact = new Map(remote.map((r) => [r.factId, r]));
      const merged = mine.map((m) => {
        const r = byFact.get(m.factId);
        return r ? { ...m, text: r.text, approved: r.approved, madeAt: r.madeAt } : m;
      });

      const seen = new Set(mine.map((x) => x.factId));
      const add = remote.filter((r) => !seen.has(r.factId));
      setScenes([...merged, ...add].sort((a, b) => b.madeAt - a.madeAt));
      if (add.length) setFromServer(true);
    })();
    return () => {
      alive = false;
    };
  }, [ownerId, approvedOnly, push, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { scenes, shared, fromServer, reload };
}

/** 회기별로 묶는다. 최근 회기가 앞에 온다. */
export function bySession(scenes: Scene[]): [string, Scene[]][] {
  const map = new Map<string, Scene[]>();
  for (const sc of scenes) {
    const list = map.get(sc.sessionId) ?? [];
    list.push(sc);
    map.set(sc.sessionId, list);
  }
  return [...map.entries()];
}
