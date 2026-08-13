'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAccount, type Account } from '@/lib/auth';
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

/**
 * 헤더에 뜨는 기관 이름.
 *
 * 예전에는 '청주 햇살주야간보호센터'가 이 자리에 그대로 박혀 있었다. 그래서
 * 다른 기관으로 로그인해도 화면 맨 위는 남의 기관 이름이었고, 바로 아래
 * CenterLive 패널에는 서버에서 읽은 진짜 이름이 떠서 한 화면에 기관이 둘
 * 보였다. 삭제 승인·직원 권한·요금이 걸린 콘솔에서 "지금 누구 자료를 보고
 * 있는가"가 틀리면 나머지 숫자도 전부 못 믿는다.
 *
 * 그래서 기관 이름은 서버가 알려준 것만 쓴다. 모를 때는 지어내지 않고
 * 어떤 상태인지 적는다 — 이름이 없는 것보다 남의 이름이 더 나쁘다.
 */
function tenantLabel(account: Account): string {
  if (account.status === 'in') return account.tenantName;
  if (account.status === 'loading') return '기관 확인 중…';
  if (account.status === 'out') return '로그인 전 · 둘러보기';
  return '시연 모드 · 서버 미연결';
}

/**
 * 이 화면이 그리는 숫자가 어디서 왔는가.
 *
 * F-CM-DASH-008 은 파일럿 실측 전까지 운영지표를 샘플로 명시하라고 한다.
 * 예전에는 화면마다 배지 컴포넌트를 손으로 붙였고, 콘솔 10개 중 3개가
 * 빠졌다. 빠진 쪽이 오히려 더 위험하다 — 표시가 붙은 화면을 먼저 본 센터장은
 * '표시가 없으면 실제 값'으로 학습하기 때문이다.
 *
 * 그래서 표시를 콘솔 프레임으로 올리고 이 prop 을 필수로 만들었다. 화면을
 * 하나 더 만들면 출처를 적지 않고는 컴파일되지 않는다.
 *
 * 어느 화면이 무엇을 달았는지 세어 둔 목록은 주석 어디에도 두지 않는다.
 * 그 목록을 손으로 유지하려던 주석이 두 번 다 틀린 숫자를 말했고, 그게 이
 * 결함이 반복된 이유다. 지금 상태는 각 화면의 이 prop 값이 곧 답이다.
 */
export type ConsoleData =
  /** 로그인해도 이 숫자는 서버에서 오지 않는다. 언제나 예시 표시가 붙는다. */
  | { kind: 'seed'; what: ReactNode }
  /** 둘러보기에서만 씨앗을 그리고, 로그인한 기관에서는 화면이 스스로 감춘다. */
  | { kind: 'seedWhileBrowsing'; what: ReactNode }
  /** 지어낸 측정값이 아니라 기관이 조정하는 설정 기본값. 그래서 문구가 다르다. */
  | { kind: 'defaults'; what: ReactNode };

export function CenterShell({
  children,
  title,
  code,
  lead,
  actions,
  data,
}: {
  children: ReactNode;
  title: string;
  /** 기능명세서 화면 ID — 어떤 명세가 이 화면의 근거인지 보이게 둔다. */
  code: string;
  lead?: string;
  actions?: ReactNode;
  /** 이 화면의 숫자가 어디서 오는지. 필수 — 적지 않으면 화면을 띄울 수 없다. */
  data: ConsoleData;
}) {
  const pathname = usePathname();
  const { account } = useAccount();

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
                {account.status === 'out' ? (
                  <Link href="/login" className="underline">
                    {tenantLabel(account)}
                  </Link>
                ) : (
                  tenantLabel(account)
                )}
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
          <DataNotice data={data} account={account} />
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * 화면 맨 위의 출처 띠. 화면이 직접 부르지 않는다 — CenterShell 이 `data`
 * prop 을 보고 그린다. 밖으로 내보내지 않는 것도 그래서다. 손으로 붙일 수
 * 있으면 손으로 빠뜨릴 수 있다.
 *
 * 자리는 늘 같다. 센터장이 "맨 위 띠가 이 화면 숫자의 정체를 말해 준다"를
 * 한 번 익히면 열 화면에서 그대로 통해야 하기 때문이다.
 */
function DataNotice({ data, account }: { data: ConsoleData; account: Account }) {
  if (data.kind === 'defaults') {
    return (
      <NoticeStrip tone="neutral" label="기본값">
        {data.what}
      </NoticeStrip>
    );
  }

  if (data.kind === 'seed') {
    return (
      <NoticeStrip tone="sample" label="샘플 데이터">
        {data.what}
      </NoticeStrip>
    );
  }

  // seedWhileBrowsing — 로그인 확인이 끝나기 전에 어느 쪽으로도 기울지 않는다.
  // 실제 센터장이 화면을 여는 첫 순간에 남의 기관 값이 스치면, 그 순간을
  // 캡처하는 사람이 생긴다.
  if (account.status === 'loading') {
    return (
      <NoticeStrip tone="neutral" label="기관 확인 중">
        로그인한 기관인지 확인하고 있습니다. 확인이 끝날 때까지 이 화면은 예시도
        실제 값도 그리지 않습니다.
      </NoticeStrip>
    );
  }

  // 실기관에서도 띠를 비우지 않는다. 여기서 아무 표시가 없으면 '표시가 없으면
  // 실제 값'이라는 학습이 되살아나고, 그 학습이 씨앗 화면으로 옮겨 간다.
  if (account.status === 'in') {
    return (
      <NoticeStrip tone="live" label="이 기관의 자료">
        집계 숫자는 서버에 있는 값만 보여줍니다. 서버에 없는 항목은 예시로 채우지
        않고 비워 둡니다. 앱에 들어 있는 기본 목록(기억 카드·외부 제공자 같은
        것)에는 「앱 기본값」이라고 붙여 둡니다 — 이 기관의 자료가 아닙니다.
      </NoticeStrip>
    );
  }

  return (
    <NoticeStrip tone="sample" label="샘플 데이터">
      {data.what}
    </NoticeStrip>
  );
}

const NOTICE_TONES = {
  sample: 'border-amber-300 bg-amber-100/60 text-amber-700',
  neutral: 'border-hairline bg-surface-sunk text-ink-700',
  live: 'border-leaf-200 bg-leaf-50 text-leaf-800',
} as const;

function NoticeStrip({
  tone,
  label,
  children,
}: {
  tone: keyof typeof NOTICE_TONES;
  label: string;
  children: ReactNode;
}) {
  return (
    <p
      className={`mb-4 flex items-start gap-2 rounded-[12px] border px-3.5 py-2.5 text-[0.875rem] font-semibold leading-relaxed ${NOTICE_TONES[tone]}`}
    >
      <IconInfo size={17} className="mt-0.5 shrink-0" />
      <span>
        <strong className="font-extrabold">{label}</strong>
        {' — '}
        {children}
      </span>
    </p>
  );
}

/**
 * 로그인 확인이 끝나기 전에 패널 안에 두는 자리.
 *
 * 여기서 예시를 먼저 그려 놓고 로그인이 확인되면 지우는 방식은 안 된다.
 * 실제 센터장이 화면을 여는 첫 순간에 존재한 적 없는 삭제 요청이나 남의 기관
 * 일정이 스치기 때문이다. 삭제 승인·감사로그 화면에서는 그 한 순간의 스침도
 * 캡처되면 그대로 증빙처럼 쓰인다.
 *
 * 그렇다고 아무것도 그리지 않으면 화면 가운데가 통째로 비어 고장으로 보인다.
 * 그래서 지금 무엇을 기다리는 중인지만 적는다. 세 화면(기관 설정·운영 계획·
 * 데이터 거버넌스)이 같은 문구를 쓰도록 여기 한 곳에 둔다.
 */
export function Checking() {
  return <p className="text-[0.9375rem] text-ink-500">기관 확인 중…</p>;
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
