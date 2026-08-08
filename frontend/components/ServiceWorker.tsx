'use client';

import { useEffect } from 'react';

/**
 * 서비스 워커 등록.
 *
 * 설치 안내 팝업 안에 있던 것을 밖으로 뺐다. 팝업은 첫 화면에만 뜨는데,
 * 링크를 받아 /home 으로 바로 들어오는 사람도 있다 — 그러면 서비스 워커가
 * 영영 등록되지 않아 설치도 오프라인도 되지 않는다. 레이아웃에 두면
 * 어느 화면으로 들어오든 한 번은 등록된다.
 *
 * 첫 화면이 그려진 뒤에 등록하도록 조금 미룬다. 등록은 급하지 않고,
 * 어르신 앞에서 첫 화면이 늦게 뜨는 것이 더 나쁘다.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const id = window.setTimeout(() => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* 오프라인 지원은 덤이지 조건이 아니다 */
      });
    }, 1200);
    return () => window.clearTimeout(id);
  }, []);

  return null;
}
