import type { Metadata, Viewport } from 'next';
import { SessionProvider } from '@/lib/store';
import './globals.css';

export const metadata: Metadata = {
  title: '똑똑 TokTok · 생애여정 음악지도',
  description:
    '어르신의 삶을 노래로 남기는 따뜻한 기록. 주야간보호센터 사회복지사를 위한 생애 인터뷰·가사·노래·활동일지 도구입니다.',
  applicationName: '똑똑 TokTok',
  appleWebApp: { capable: true, title: '똑똑', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#fdf3e7',
  // Zooming stays enabled — pinch-zoom is an accessibility requirement,
  // not a nuisance (WCAG 2.2 / NFR-A11Y-003).
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="antialiased">
        {/* Keyboard users land here first (WCAG 2.4.1). */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:text-[1rem] focus:font-bold focus:text-ink-900 focus:shadow-lg"
        >
          본문으로 건너뛰기
        </a>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
