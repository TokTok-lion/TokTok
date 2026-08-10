'use client';

import { useEffect } from 'react';
import { isCapturing } from '@/lib/recorder';
import { isTranscribing } from '@/lib/transcribeJob';

/**
 * 서비스 워커 등록 · 새 판 받아오기.
 *
 * 설치 안내 팝업 안에 있던 것을 밖으로 뺐다. 팝업은 첫 화면에만 뜨는데,
 * 링크를 받아 /home 으로 바로 들어오는 사람도 있다 — 그러면 서비스 워커가
 * 영영 등록되지 않아 설치도 오프라인도 되지 않는다. 레이아웃에 두면
 * 어느 화면으로 들어오든 한 번은 등록된다.
 *
 * 첫 화면이 그려진 뒤에 등록하도록 조금 미룬다. 등록은 급하지 않고,
 * 어르신 앞에서 첫 화면이 늦게 뜨는 것이 더 나쁘다.
 *
 * 새 판을 받아오는 일이 여기 붙어 있는 이유:
 *
 * 이 앱은 태블릿에 설치해 놓고 하루 종일 열어 두는 물건이다. 그런데 한 번
 * 뜬 화면은 그때 받은 자바스크립트를 계속 쓴다 — 탭 안에서 화면을 옮겨
 * 다니는 것만으로는 새 판이 오지 않는다. 그래서 고쳐서 배포해 놓고도
 * "그대로인데요?"라는 말을 두 번 들었다. 서버에는 고친 것이 올라가 있고
 * 기기만 옛것을 붙들고 있었다.
 *
 * 다시 여는 일은 아무 때나 하면 안 된다. 어르신이 말씀하시는 중이거나
 * 그 목소리를 옮기는 중이면 미룬다 — 새 글자보다 지금 듣고 있는 이야기가
 * 중요하다. 미뤄도 다음에 앱을 열 때 적용된다.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let done = false;
    /** 새 워커가 화면을 넘겨받았다 = 새 판이 준비됐다. */
    const swap = () => {
      if (done) return;
      if (isCapturing() || isTranscribing()) return;
      done = true;
      window.location.reload();
    };

    const id = window.setTimeout(() => {
      void navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          // 첫 설치일 때는 controller 가 없다. 그때 다시 열면 방금 연 화면을
          // 이유 없이 한 번 더 여는 셈이라, 이미 쓰던 기기에서만 넘긴다.
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.addEventListener('controllerchange', swap);
          }
          // 탭을 며칠씩 열어 두므로, 다시 앞으로 나올 때마다 물어본다.
          const check = () => {
            if (document.visibilityState === 'visible') void reg.update();
          };
          document.addEventListener('visibilitychange', check);
        })
        .catch(() => {
          /* 오프라인 지원은 덤이지 조건이 아니다 */
        });
    }, 1200);

    return () => window.clearTimeout(id);
  }, []);

  return null;
}
