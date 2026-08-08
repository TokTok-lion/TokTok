/**
 * 설치 환경 판별.
 *
 * The realistic path for a centre is: a link arrives in KakaoTalk, someone
 * taps it, and it opens inside KakaoTalk's own browser — which cannot install
 * anything. So the first job is recognising that and handing the user off to
 * a real browser; only then does an install prompt make sense.
 *
 * User-agent sniffing is unreliable in general, but these in-app browsers
 * announce themselves clearly, and the cost of a wrong guess here is only a
 * dismissible hint.
 */

export type Platform = 'android' | 'ios' | 'desktop' | 'unknown';

export type InstallEnv = {
  platform: Platform;
  /** KakaoTalk / Instagram / … — cannot install, must be handed off */
  inAppBrowser: string | null;
  /** already running from the home screen */
  installed: boolean;
  /** Safari on iOS: install is possible but only via the share sheet */
  iosSafari: boolean;
};

const IN_APP: { id: string; label: string; test: RegExp }[] = [
  { id: 'kakao', label: '카카오톡', test: /KAKAOTALK/i },
  { id: 'instagram', label: '인스타그램', test: /Instagram/i },
  { id: 'facebook', label: '페이스북', test: /FBAN|FBAV|FB_IAB/i },
  { id: 'line', label: '라인', test: /\bLine\//i },
  { id: 'naver', label: '네이버', test: /NAVER\(inapp|whale/i },
  { id: 'daum', label: '다음', test: /DaumApps/i },
  { id: 'band', label: '밴드', test: /BAND\//i },
  { id: 'everytime', label: '에브리타임', test: /Everytime/i },
];

export function detectInstallEnv(): InstallEnv {
  if (typeof navigator === 'undefined') {
    return { platform: 'unknown', inAppBrowser: null, installed: false, iosSafari: false };
  }
  const ua = navigator.userAgent;

  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports as a Mac; the touch points give it away
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);

  const platform: Platform = isIOS
    ? 'ios'
    : isAndroid
      ? 'android'
      : /Mobi/i.test(ua)
        ? 'unknown'
        : 'desktop';

  const hit = IN_APP.find((b) => b.test.test(ua));

  const installed =
    (typeof window !== 'undefined' &&
      window.matchMedia?.('(display-mode: standalone)').matches) ||
    // iOS uses a non-standard flag
    (navigator as unknown as { standalone?: boolean }).standalone === true;

  // On iOS every browser is WebKit; only Safari proper exposes 홈 화면에 추가.
  const iosSafari =
    isIOS && !hit && !/CriOS|FxiOS|EdgiOS|OPiOS|Whale/i.test(ua);

  return { platform, inAppBrowser: hit?.label ?? null, installed, iosSafari };
}

/**
 * 카카오톡 등 인앱 브라우저에서 크롬으로 넘기는 주소.
 *
 * Android: intent: URL. Chrome이 없으면 아무 일도 일어나지 않는다.
 * iOS: googlechromes: 스킴. 크롬이 깔려 있으면 열리고, 없으면 조용히 실패한다.
 *
 * 두 경우 다 "무조건 열린다"고 보장할 수는 없다 — 크롬이 없을 수도 있고,
 * 인앱 브라우저가 외부 스킴을 막아 둘 수도 있다. 그래서 자동 이동을 시도하되
 * 화면에는 항상 직접 누를 수 있는 버튼과 주소 복사를 함께 남긴다.
 */
export function chromeUrl(href: string, platform: Platform): string | null {
  const stripped = href.replace(/^https?:\/\//, '');
  if (platform === 'android') {
    return `intent://${stripped}#Intent;scheme=https;package=com.android.chrome;end`;
  }
  if (platform === 'ios') {
    // googlechromes = https, googlechrome = http
    return `${href.startsWith('https') ? 'googlechromes' : 'googlechrome'}://${stripped}`;
  }
  return null;
}
