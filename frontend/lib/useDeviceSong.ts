'use client';

import { useEffect, useState } from 'react';
import { loadSong } from './songStore';

/**
 * 이 기기에 있는 곡의 재생 주소. 없으면 null.
 *
 * 보관함과 기록이 같은 답을 해야 한다. 한쪽은 "세 곡 완성", 다른 쪽은
 * "아직 없어요"라고 하면 둘 다 못 믿는다.
 */
export function useDeviceSong(): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let made: string | null = null;
    let alive = true;
    void loadSong().then((blob) => {
      if (!blob) return;
      made = URL.createObjectURL(blob);
      if (alive) setUrl(made);
      else URL.revokeObjectURL(made);
    });
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, []);

  return url;
}
