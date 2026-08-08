'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  IconBook,
  IconCalendar,
  IconDoc,
  IconExport,
  IconHome,
  IconInfo,
  IconPeople,
  IconShield,
} from './icons';

/* ------------------------------------------------------------------ *
 * 센터장 콘솔 프레임
 *
 * The 복지사 app is a 390px tablet/phone surface used beside an elder.
 * This is desk work — 직원 권한, 정책, 청구, 삭제 승인 — so it gets a wide
 * two-column console. Same palette, denser type, no bottom tab bar.
 * ------------------------------------------------------------------ */

const NAV = [
  { href: '/center', label: '운영 콘솔', code: 'CM-DASH', Icon: IconHome, exact: true },
  { href: '/center/staff', label: '직원 관리', code: 'CM-STAFF', Icon: IconPeople },
  { href: '/center/calendar', label: '운영 계획', code: 'CM-CAL', Icon: IconCalendar },
  { href: '/center/analytics', label: '운영·ROI 분석', code: 'CM-ANL', Icon: IconExport },
  { href: '/center/policy', label: '개인정보 운영', code: 'CM-POL', Icon: IconShield },
  { href: '/center/data', label: '데이터 거버넌스', code: 'CM-DATA', Icon: IconDoc },
  { href: '/center/usage', label: '요금·쿼터', code: 'CM-USE', Icon: IconExport },
  { href: '/center/library', label: '프로그램 템플릿', code: 'CM-LIB', Icon: IconBook },
  { href: '/center/org', label: '기관 설정', code: 'CM-ORG', Icon: IconInfo },
  { href: '/center/support', label: '운영 지원', code: 'CM-SUP', Icon: IconInfo },
];

export function CenterShell({
  children,
  title,
  code,
  lead,
  actions,
}: {
  children: ReactNode;
  title: string;
  /** 기능명세서 화면 ID — 어떤 명세가 이 화면의 근거인지 보이게 둔다. */
  code: string;
  lead?: string;
  actions?: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-page lg:flex">
      {/* sidebar */}
      <aside className="border-b border-hairline bg-surface-strong lg:min-h-dvh lg:w-[248px] lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 px-5 py-4">
          <Image src="/brand/logo-glyph.webp" alt="" width={512} height={480} className="w-8" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-[0.9375rem] font-extrabold leading-tight text-ink-900">
              센터장 콘솔
            </p>
            <p className="truncate text-[0.75rem] text-ink-500">똑똑 TokTok</p>
          </div>
        </div>

        <nav aria-label="콘솔 메뉴" className="px-3 pb-4">
          <ul className="flex gap-1 overflow-x-auto lg:block lg:space-y-0.5 lg:overflow-visible">
            {NAV.map((n) => {
              const active = n.exact
                ? pathname === n.href
                : pathname === n.href || pathname.startsWith(n.href + '/');
              return (
                <li key={n.href} className="shrink-0">
                  <Link
                    href={n.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-[44px] items-center gap-2.5 whitespace-nowrap rounded-[10px] px-3 text-[0.9375rem] font-bold ${
                      active
                        ? 'bg-brand-100 text-brand-800'
                        : 'text-ink-700 hover:bg-surface-sunk'
                    }`}
                  >
                    <n.Icon size={19} className={active ? 'text-brand-700' : 'text-ink-500'} />
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="hidden px-5 pb-6 lg:block">
          <Link
            href="/home"
            className="flex min-h-[44px] items-center justify-center rounded-[10px] border border-hairline bg-surface px-3 text-[0.875rem] font-bold text-ink-700"
          >
            복지사 앱으로
          </Link>
        </div>
      </aside>

      {/* content */}
      <div className="min-w-0 flex-1">
        <header className="border-b border-hairline bg-surface-strong px-5 py-4 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[0.8125rem] font-bold text-ink-500">
                <span className="rounded bg-surface-sunk px-1.5 py-0.5 font-mono text-[0.6875rem] text-ink-500">
                  {code}
                </span>
                청주 햇살주야간보호센터
              </p>
              <h1 className="mt-1 text-[1.625rem] font-extrabold tracking-[-0.02em] text-ink-900">
                {title}
              </h1>
              {lead ? (
                <p className="mt-1 max-w-[70ch] text-[0.9375rem] text-ink-500">{lead}</p>
              ) : null}
            </div>
            {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
          </div>
        </header>

        <main id="main" className="px-5 py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * F-CM-DASH-008 · 파일럿 실측 전에는 운영지표를 샘플로 명시해야 한다.
 * Every screen that shows operating figures carries this.
 */
export function SampleBadge({ children }: { children?: ReactNode }) {
  return (
    <p className="mb-4 flex items-start gap-2 rounded-[12px] border border-amber-300 bg-amber-100/60 px-3.5 py-2.5 text-[0.875rem] font-semibold text-amber-700">
      <IconInfo size={17} className="mt-0.5 shrink-0" />
      <span>
        <strong className="font-extrabold">샘플 데이터</strong>
        {' — '}
        {children ??
          '파일럿 실측 전까지 표시되는 예시 값입니다. 실제 청구·성과 수치가 아닙니다.'}
      </span>
    </p>
  );
}

export function Panel({
  title,
  code,
  desc,
  children,
  actions,
  className = '',
}: {
  title: string;
  code?: string;
  desc?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[16px] border border-hairline bg-surface-strong ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-hairline px-4 py-3.5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[1.0625rem] font-extrabold text-ink-900">
            {title}
            {code ? (
              <span className="rounded bg-surface-sunk px-1.5 py-0.5 font-mono text-[0.6875rem] font-semibold text-ink-500">
                {code}
              </span>
            ) : null}
          </h2>
          {desc ? <p className="mt-1 text-[0.875rem] text-ink-500">{desc}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Kpi({
  label,
  value,
  unit,
  tone = 'neutral',
  note,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: 'neutral' | 'brand' | 'leaf' | 'amber' | 'danger';
  note?: string;
}) {
  const tones = {
    neutral: 'text-ink-900',
    brand: 'text-brand-700',
    leaf: 'text-leaf-700',
    amber: 'text-amber-700',
    danger: 'text-danger-600',
  };
  return (
    <div className="rounded-[14px] border border-hairline bg-surface-strong p-4">
      <p className="text-[0.875rem] font-semibold text-ink-500">{label}</p>
      <p className={`mt-1.5 text-[1.75rem] font-extrabold leading-none ${tones[tone]}`}>
        {value}
        {unit ? (
          <span className="ml-1 text-[0.9375rem] font-bold text-ink-500">{unit}</span>
        ) : null}
      </p>
      {note ? <p className="mt-2 text-[0.8125rem] leading-snug text-ink-500">{note}</p> : null}
    </div>
  );
}

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'leaf' | 'amber' | 'danger';
}) {
  const tones = {
    neutral: 'bg-surface-sunk text-ink-700',
    brand: 'bg-brand-100 text-brand-800',
    leaf: 'bg-leaf-100 text-leaf-700',
    amber: 'bg-amber-100 text-amber-700',
    danger: 'bg-[#fbe3dd] text-danger-600',
  };
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[0.8125rem] font-bold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Console buttons: compact, unlike the elder-facing 60px CTAs. */
export function CBtn({
  children,
  onClick,
  href,
  tone = 'ghost',
  disabled,
  type = 'button',
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  tone?: 'ghost' | 'solid' | 'danger';
  disabled?: boolean;
  type?: 'button' | 'submit';
  title?: string;
}) {
  const tones = {
    ghost: 'border border-hairline bg-surface text-ink-700',
    solid: 'bg-brand-700 text-white',
    danger: 'bg-danger-600 text-white',
  };
  const cls = `inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-[10px] px-3.5 text-[0.875rem] font-bold ${
    disabled ? 'cursor-not-allowed bg-surface-sunk text-ink-500' : tones[tone]
  }`;
  if (href && !disabled) {
    return (
      <Link href={href} className={cls} title={title}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls} title={title}>
      {children}
    </button>
  );
}

/**
 * Horizontal-scrolling table wrapper so wide data never breaks the page.
 * `min` is the width below which the table starts scrolling — keep it small
 * for tables that sit inside a half-width grid column.
 */
export function TableWrap({
  children,
  min = 560,
}: {
  children: ReactNode;
  min?: number;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table
        className="w-full border-collapse text-left text-[0.9375rem]"
        style={{ minWidth: min }}
      >
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap border-b border-hairline pb-2 pr-4 text-[0.8125rem] font-bold text-ink-500 ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <td className={`border-b border-hairline py-3 pr-4 align-middle text-ink-900 ${className}`}>
      {children}
    </td>
  );
}

/**
 * The note that explains why the console withholds something. Used wherever
 * the permission matrix limits the director rather than the UI being lazy.
 */
export function LimitNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-[12px] bg-leaf-50 px-3.5 py-2.5 text-[0.875rem] leading-relaxed text-leaf-800">
      <IconShield size={17} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
