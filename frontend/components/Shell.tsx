'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { stepForScreen } from '@/lib/flow';
import { currentSession, useSession } from '@/lib/store';
import { SessionStepper } from './SessionStepper';
import {
  IconBack,
  IconBook,
  IconContent,
  IconHome,
  IconMore,
  IconPeople,
  IconTextSize,
} from './icons';

/**
 * 글자 크기 — 탭 루트 화면의 왼쪽 자리.
 *
 * 이 자리에는 원래 햄버거가 있었는데 눌러도 「더보기」로 갔다. 오른쪽 종도,
 * 아래 「더보기」 탭도 같은 곳이었다. 같은 방에 문이 셋이면 그중 둘은
 * 자리만 차지한다.
 *
 * 그 자리를 글자 크기가 받는다. 설정 안에 이미 있지만, 정작 필요한 순간은
 * 어르신께 화면을 보여 드리는 중이다. "안 보인다" 하실 때 설정까지 들어갔다
 * 나오면 그 사이에 이야기가 끊긴다.
 */
const SCALES = [1, 1.15, 1.3];
const SCALE_NAME: Record<string, string> = {
  '1': '보통',
  '1.15': '크게',
  '1.3': '더 크게',
};

function TextScaleButton() {
  const { s, set } = useSession();
  const at = SCALES.indexOf(s.textScale);
  const next = SCALES[(at + 1) % SCALES.length];
  const now = SCALE_NAME[String(s.textScale)] ?? '보통';

  /*
   * 다음 값은 누르는 순간의 저장소에서 고른다.
   *
   * 렌더 시점의 s 를 쓰면 빠르게 두 번 눌렀을 때 한 칸만 간다 — 두 번째
   * 클릭이 아직 갱신되지 않은 값을 보기 때문이다. 안 보인다고 하시는
   * 어르신 앞에서 두 번 눌렀는데 한 번만 커지면, 고장 난 것처럼 보인다.
   */
  const bump = () => {
    const at = SCALES.indexOf(currentSession().textScale);
    set('textScale', SCALES[(at + 1) % SCALES.length]);
  };

  return (
    <button
      type="button"
      aria-label={`글자 크기 ${now}. 누르면 ${SCALE_NAME[String(next)]}로 바뀝니다`}
      onClick={bump}
      className="relative flex h-11 w-11 items-center justify-center rounded-full text-ink-900"
    >
      <IconTextSize size={26} />
      {/* 지금 커져 있다는 것이 보여야 한다. 안 그러면 왜 글자가 큰지 모른다. */}
      {s.textScale > 1 ? (
        <span className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-brand-600" />
      ) : null}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Brand mark
 * ------------------------------------------------------------------ */

export function Logo({
  size = 'sm',
  withTagline = false,
}: {
  size?: 'sm' | 'md' | 'lg';
  withTagline?: boolean;
}) {
  const dims = { sm: 34, md: 52, lg: 132 } as const;
  const g = dims[size];

  if (size === 'lg') {
    return (
      <div className="flex flex-col items-center">
        <Image
          src="/brand/logo-lockup.webp"
          alt="똑똑 TokTok"
          width={357}
          height={560}
          priority
          className="h-auto w-[168px]"
        />
        {withTagline ? (
          <p className="mt-3 text-[0.9375rem] font-semibold text-ink-500">
            어르신의 삶을 노래로 남기는 따뜻한 기록
          </p>
        ) : null}
      </div>
    );
  }

  // compact header lockup: glyph + 똑똑 + TokTok on one line
  return (
    <span className="flex items-center gap-1.5">
      <Image
        src="/brand/logo-glyph.webp"
        alt=""
        width={512}
        height={480}
        aria-hidden
        className="h-auto"
        style={{ width: g }}
      />
      <Image
        src="/brand/wordmark-ko.webp"
        alt="똑똑"
        width={420}
        height={196}
        className="h-auto"
        style={{ width: g * 0.86 }}
      />
      <Image
        src="/brand/wordmark-en.webp"
        alt="TokTok"
        width={360}
        height={82}
        className="h-auto"
        style={{ width: g * 0.74 }}
      />
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Bottom tab bar
 *
 * The deck shows this five-item bar on 26 of its 29 screens (one frame
 * swaps 콘텐츠 for 회기 일정; that variant is treated as an earlier
 * iteration, and 회기 일정 lives under 홈 here so navigation stays fixed).
 * ------------------------------------------------------------------ */

/**
 * Five tabs, each answering one question, and every screen belongs to exactly
 * one of them:
 *
 *   오늘   지금 뭘 하지?      today's schedule, the next action, what's waiting
 *   어르신  이 분은 어떤 분?    profile, family, this elder's past sessions
 *   회기   지금 만드는 중      the linear flow from 준비 to 마무리
 *   기록   예전에 만든 것      finished songs, logs, lyric cards
 *   더보기  설정              consent, text size, data, help
 *
 * The line between 회기 and 기록 is tense, not topic: in progress vs. finished.
 */
const TABS = [
  { href: '/home', label: '오늘', Icon: IconHome, match: ['/home', '/sessions'] },
  { href: '/elder', label: '어르신', Icon: IconPeople, match: ['/elder', '/family'] },
  { href: '/session', label: '회기', Icon: IconContent, match: ['/session'] },
  { href: '/records', label: '기록', Icon: IconBook, match: ['/records', '/library'] },
  { href: '/more', label: '더보기', Icon: IconMore, match: ['/more', '/guide'] },
] as const;

function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[440px] border-t border-hairline bg-surface-strong/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex items-stretch">
        {TABS.map(({ href, label, Icon, match }) => {
          const active = match.some(
            (m) => pathname === m || pathname.startsWith(m + '/'),
          );
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                // The deck marks the active tab with colour alone — no pill
                // behind the icon. Adding one made the bar heavier than the
                // design and drew the eye away from the page.
                className={`flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 py-1.5 ${
                  active ? 'text-brand-600' : 'text-ink-300'
                }`}
              >
                <Icon size={25} />
                {/* The icon keeps the deck's vivid orange, but a 12px label
                    needs 4.5:1 — brand-600 only reaches 3.1 on this bar. */}
                <span
                  className={`text-[0.75rem] leading-none ${
                    active ? 'font-extrabold text-brand-700' : 'font-bold text-ink-500'
                  }`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ------------------------------------------------------------------ *
 * Screen frame
 * ------------------------------------------------------------------ */

export function Screen({
  children,
  title,
  subtitle,
  back = true,
  root = false,
  tabs = true,
  footer,
  decoration,
}: {
  children: ReactNode;
  /** Big page heading, as printed in the deck. */
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Left slot: back chevron (default), or nothing. */
  back?: boolean;
  /**
   * 아래 탭이 바로 여는 화면(오늘·어르신·회기·기록·더보기).
   *
   * 돌아갈 곳이 없으므로 뒤로가기를 두지 않는다. 대신 그 자리에 글자 크기를
   * 둔다 — 어르신 앞에서 화면을 보여 드리다 "안 보인다" 하실 때, 설정까지
   * 들어갔다 나오는 동안 이야기가 끊긴다.
   */
  root?: boolean;
  tabs?: boolean;
  /** Sticky action area pinned above the tab bar. */
  footer?: ReactNode;
  decoration?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const step = stepForScreen(pathname);

  // The action area is pinned, so main needs to reserve exactly its height —
  // which varies (one button, or a button plus secondary links).
  const footerRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const screen = el.closest<HTMLElement>('[data-screen]');
    const apply = () =>
      screen?.style.setProperty('--footer-h', `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [footer]);

  return (
    <div
      data-screen
      className="tk-page-bg relative mx-auto flex min-h-dvh max-w-[440px] flex-col"
    >
      {decoration}

      <header className="relative z-10 flex items-center gap-2 px-4 pt-4">
        <div className="flex w-11 justify-start">
          {root ? <TextScaleButton /> : back ? (
            <button
              type="button"
              aria-label="이전 화면으로"
              onClick={() => router.back()}
              className="flex h-11 w-11 items-center justify-center rounded-full text-ink-900"
            >
              <IconBack size={26} />
            </button>
          ) : null}
        </div>

        <div className="flex flex-1 justify-center">
          <Link href="/home" aria-label="똑똑 홈으로">
            <Logo size="sm" />
          </Link>
        </div>

        {/*
          오른쪽은 첫 화면으로 나가는 문이다.

          한동안 비워 두었다 — 종이 있었는데 눌러도 「더보기」로 갔고, 왼쪽
          햄버거와 아래 탭도 같은 곳이라 한 방에 문이 셋이었다. 그런데 정작
          없어서 불편한 문이 하나 있었다: 로그인하고 들어오면 첫 화면으로
          돌아갈 길이 없다. 가운데 로고는 「오늘」로 가고, 아래 탭 다섯 개도
          전부 앱 안이다. 주소를 직접 치는 수밖에 없었다.

          아이콘 대신 글자를 쓴다. 집 모양은 아래 탭의 「오늘」이 이미 쓰고
          있어서, 같은 그림이 두 곳을 가리키면 어느 쪽인지 알 수 없다.
          탭 루트에서만 내놓는다 — 회기 화면에서는 왼쪽 뒤로가기가 할 일이고,
          한 화면에 나가는 문이 둘이면 다시 셋이 된다.
        */}
        <div className="flex w-11 shrink-0 justify-end">
          {root ? (
            <Link
              href="/"
              aria-label="첫 화면으로"
              className="flex h-11 w-11 items-center justify-center rounded-full text-[0.8125rem] font-extrabold text-ink-700"
            >
              처음
            </Link>
          ) : null}
        </div>
      </header>

      {/* Any screen that is part of the session flow gets the step indicator
          automatically — no per-screen wiring to forget. */}
      {step ? (
        // 회기 단계 표시줄도 화면 장치다 — 종이에는 안 나간다.
        <div data-print-hide>
          <SessionStepper current={step} />
        </div>
      ) : null}

      {/*
        화면 제목은 종이에 나가지 않는다.
        
        인쇄 규칙이 main 바깥은 손대지 않아서, 활동일지를 뽑으면 종이 맨 위에
        「활동일지 편집 / 오늘의 기록을 정리하고 저장해보세요」가 같이 찍혔다.
        기관에 제출하는 서류에 앱 화면 안내문이 들어가는 셈이다. 종이에 나갈
        제목은 [data-print] 블록이 따로 들고 있다.
      */}
      {title ? (
        <div data-print-hide className="relative z-10 px-5 pt-3 text-center">
          <h1 className="tk-h1">{title}</h1>
          {subtitle ? (
            <p className="mt-2 text-[1rem] font-medium text-ink-500">{subtitle}</p>
          ) : null}
        </div>
      ) : null}

      <main
        id="main"
        className="relative z-10 flex-1 px-5 pt-5"
        style={{
          // leave room for the pinned action area and the tab bar
          paddingBottom: `calc(${footer ? 'var(--footer-h, 104px)' : '28px'} + ${
            tabs ? 'var(--tab-h)' : '0px'
          } + env(safe-area-inset-bottom))`,
        }}
      >
        {children}
      </main>

      {footer ? (
        <div
          ref={footerRef}
          data-print-hide
          className="fixed inset-x-0 z-20 mx-auto max-w-[440px] px-5 pb-4 pt-4"
          style={{
            bottom: `calc(${tabs ? 'var(--tab-h)' : '0px'} + env(safe-area-inset-bottom))`,
            background:
              'linear-gradient(180deg, rgba(253,243,231,0) 0%, rgba(253,243,231,0.94) 38%, rgba(253,243,231,1) 100%)',
          }}
        >
          {footer}
        </div>
      ) : null}

      {tabs ? <TabBar /> : null}
    </div>
  );
}

/* Soft leaf / note ornaments used in the corners of most frames. */
export function Ornaments({
  variant = 'both',
}: {
  variant?: 'both' | 'leafRight' | 'leafLeft' | 'notes';
}) {
  return (
    <div
      data-print-hide
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      {(variant === 'both' || variant === 'leafRight') && (
        <Image
          src="/art/leaf-branch-1.webp"
          alt=""
          width={560}
          height={480}
          loading="eager"
          className="absolute -right-7 top-12 w-[116px] opacity-55"
        />
      )}
      {variant === 'leafLeft' && (
        <Image
          src="/art/leaf-branch-2.webp"
          alt=""
          width={560}
          height={480}
          loading="eager"
          className="absolute -left-8 top-16 w-[104px] opacity-50"
        />
      )}
      {(variant === 'both' || variant === 'notes') && (
        <svg
          className="absolute right-8 top-24 text-brand-200"
          width="56"
          height="60"
          viewBox="0 0 56 60"
          fill="currentColor"
        >
          <path d="M40 4 20 9v28.5a7 7 0 1 0 4 6.3V20l12-3v18a7 7 0 1 0 4 6.3Z" />
        </svg>
      )}
    </div>
  );
}
