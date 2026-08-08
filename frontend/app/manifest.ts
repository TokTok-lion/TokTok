import type { MetadataRoute } from 'next';

/**
 * 홈 화면에 설치했을 때의 앱 정보.
 *
 * display: 'standalone' — 주소창 없이 열려 태블릿을 어르신 쪽으로 돌려도
 * 브라우저 UI가 보이지 않는다. start_url을 /home으로 두어, 설치한 복지사는
 * 스플래시를 매번 거치지 않고 바로 오늘 할 일로 들어간다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '똑똑 TokTok · 생애여정 음악지도',
    short_name: '똑똑',
    description:
      '어르신의 삶을 노래로 남기는 따뜻한 기록. 주야간보호센터 사회복지사를 위한 생애 인터뷰·가사·노래·활동일지 도구입니다.',
    lang: 'ko',
    start_url: '/home',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fef7ee',
    theme_color: '#fdf3e7',
    categories: ['medical', 'productivity', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: '오늘 할 일', url: '/home' },
      { name: '어르신 목록', url: '/elder' },
      { name: '오늘의 회기', url: '/session' },
    ],
  };
}
