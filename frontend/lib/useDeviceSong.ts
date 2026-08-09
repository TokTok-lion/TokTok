'use client';

import { useEffect, useState } from 'react';
import { loadSong } from './songStore';

export type DeviceSong = {
  /** 이 기기에 있는 곡의 재생 주소. 없으면 null. */
  url: string | null;
  /** 아직 기기 보관함을 읽는 중. "곡이 없다"와는 다른 상태다. */
  loading: boolean;
};

/**
 * 이 기기에 있는 곡 — 읽는 중인지까지 알려준다.
 *
 * 보관함과 기록이 같은 답을 해야 한다. 한쪽은 "세 곡 완성", 다른 쪽은
 * "아직 없어요"라고 하면 둘 다 못 믿는다.
 *
 * loading 을 따로 두는 이유가 있다. IndexedDB 는 한 박자 늦게 답하는데 그
 * 사이를 "곡 없음"으로 그리면, 화면이 곡 없음 분기를 먼저 그렸다가 뒤늦게
 * 플레이어로 바뀐다. 미리듣기 화면에서는 그 찰나에 푸터 버튼이 통째로
 * 바뀌어서, 어르신 앞에서 손이 닿으면 곡이 있는데도 재생성 화면으로 튕겼다 —
 * 곡을 한 번 더 만드는 자리이니 요금이 걸린 사고다. 모르는 동안에는 모른다고
 * 말하게 한다.
 */
export function useDeviceSongState(): DeviceSong {
  const [song, setSong] = useState<DeviceSong>({ url: null, loading: true });

  useEffect(() => {
    let made: string | null = null;
    let alive = true;

    // 값은 오직 아래 콜백에서만 바뀐다. 이펙트 본문에서 미리 상태를 되돌려
    // 놓지 않는 이유: 이 훅의 시작 상태가 이미 '읽는 중'이고, 이펙트가 다시
    // 도는 경우(개발 모드 이중 마운트)에도 정리가 곧바로 이어지므로 그 사이에
    // IndexedDB 가 답할 틈이 없다 — made 가 null 이라 되돌릴 주소도 없다.
    void loadSong()
      .then((blob) => {
        if (!alive) return;
        if (!blob) {
          setSong({ url: null, loading: false });
          return;
        }
        made = URL.createObjectURL(blob);
        setSong({ url: made, loading: false });
      })
      .catch(() => {
        // 못 읽었으면 없는 것으로 본다. 계속 "불러오는 중"에 머무르면 화면이
        // 영영 끝나지 않고, 그게 어르신 앞에서는 고장이다.
        if (alive) setSong({ url: null, loading: false });
      });

    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, []);

  return song;
}

/** 재생 주소만 있으면 되는 화면용. */
export function useDeviceSong(): string | null {
  return useDeviceSongState().url;
}
