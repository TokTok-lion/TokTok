'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { stepForScreen } from '@/lib/flow';
import { SessionStepper } from './SessionStepper';
import {
  IconBack,
  IconBell,
  IconBook,
  IconContent,
  IconHome,
  IconMenu,
  IconMore,
  IconPeople,
} from './icons';

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
  menu = false,
  bell = false,
  tabs = true,
  footer,
  decoration,
}: {
  children: ReactNode;
  /** Big page heading, as printed in the deck. */
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Left slot: back chevron (default), hamburger, or nothing. */
  back?: boolean;
  menu?: boolean;
  bell?: boolean;
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
          {menu ? (
            <button
              type="button"
              aria-label="메뉴 열기"
              onClick={() => router.push('/more')}
              className="flex h-11 w-11 items-center justify-center rounded-full text-ink-900"
            >
              <IconMenu size={26} />
            </button>
          ) : back ? (
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

        <div className="flex w-11 justify-end">
          {bell ? (
            <Link
              href="/more"
              aria-label="알림"
              className="flex h-11 w-11 items-center justify-center rounded-full text-ink-900"
            >
              <IconBell size={26} />
            </Link>
          ) : null}
        </div>
      </header>

      {/* Any screen that is part of the session flow gets the step indicator
          automatically — no per-screen wiring to forget. */}
      {step ? <SessionStepper current={step} /> : null}

      {title ? (
        <div className="relative z-10 px-5 pt-3 text-center">
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
