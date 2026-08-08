import Link from 'next/link';
import type { ReactNode } from 'react';

/* ------------------------------------------------------------------ *
 * Primitives shared by every screen. Sizes follow the design deck;
 * interactive targets are never smaller than 44px (NFR-A11Y-002 asks
 * for 24px minimum and "고령자 핵심 CTA는 더 크게").
 * ------------------------------------------------------------------ */

export function Card({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'article';
}) {
  return (
    <Tag
      className={`rounded-[20px] bg-surface shadow-[0_2px_10px_rgba(122,84,46,0.06)] ${className}`}
    >
      {children}
    </Tag>
  );
}

export function SectionLabel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`text-[1.0625rem] font-bold text-ink-900 leading-snug ${className}`}
    >
      {children}
    </h2>
  );
}

/** The big orange button at the bottom of nearly every screen. */
export function PrimaryButton({
  children,
  href,
  onClick,
  disabled,
  type = 'button',
  trailing,
  leading,
  className = '',
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  trailing?: ReactNode;
  leading?: ReactNode;
  className?: string;
}) {
  // 20px/700 keeps the white label in WCAG "large text" territory, where
  // the deck's vivid orange clears the 3:1 requirement.
  const base =
    'flex min-h-[60px] w-full items-center justify-center gap-2 rounded-[16px] px-5 ' +
    'text-[1.25rem] font-extrabold tracking-[-0.01em] transition-[filter,transform] ' +
    'active:scale-[0.995]';

  // A dimmed orange button still reads as "press me". Unavailable actions get
  // their own flat, un-button-like treatment instead.
  const skin = disabled
    ? 'pointer-events-none bg-surface-sunk text-ink-500'
    : 'tk-cta text-white';

  const inner = (
    <>
      {leading}
      <span>{children}</span>
      {trailing}
    </>
  );

  if (href && !disabled) {
    // A CTA that both records something and navigates is the norm here
    // ("수정 완료", "이 가사 확정"). Dropping onClick on the link branch would
    // silently lose the save, so it is forwarded.
    return (
      <Link href={href} onClick={onClick} className={`${skin} ${base} ${className}`}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      className={`${skin} ${base} ${className}`}
    >
      {inner}
    </button>
  );
}

/** Outlined secondary action (예: "복사하기", "다시 생성"). */
export function OutlineButton({
  children,
  href,
  onClick,
  tone = 'brand',
  className = '',
  leading,
  trailing,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  tone?: 'brand' | 'leaf';
  className?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  const tones = {
    brand: 'border-brand-300 text-brand-700',
    leaf: 'border-leaf-300 text-leaf-700',
  };
  const cls =
    `flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[16px] border-2 ` +
    `bg-surface-strong px-5 text-[1.125rem] font-bold ${tones[tone]} ${className}`;

  if (href) {
    return (
      <Link href={href} onClick={onClick} className={cls}>
        {leading}
        {children}
        {trailing}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {leading}
      {children}
      {trailing}
    </button>
  );
}

/** Small rounded tag: 트로트 · 전쟁 이야기 · 확인됨 … */
export function Chip({
  children,
  tone = 'leaf',
  size = 'md',
}: {
  children: ReactNode;
  tone?: 'leaf' | 'brand' | 'amber' | 'neutral';
  size?: 'sm' | 'md';
}) {
  const tones = {
    leaf: 'bg-leaf-100 text-leaf-700',
    brand: 'bg-brand-100 text-brand-800',
    amber: 'bg-amber-100 text-amber-700',
    neutral: 'bg-surface-sunk text-ink-500',
  };
  const sizes = {
    sm: 'px-3 py-1 text-[0.875rem]',
    md: 'px-4 py-2 text-[1rem]',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${tones[tone]} ${sizes[size]}`}
    >
      {children}
    </span>
  );
}

/**
 * The pale info strip that appears near the bottom of most screens,
 * carrying the safety / consent message.
 */
export function NoteBar({
  children,
  tone = 'leaf',
  icon,
}: {
  children: ReactNode;
  tone?: 'leaf' | 'brand' | 'amber';
  icon?: ReactNode;
}) {
  const tones = {
    leaf: 'bg-leaf-50 text-leaf-800',
    brand: 'bg-brand-50 text-brand-800',
    amber: 'bg-amber-100/70 text-amber-700',
  };
  return (
    <p
      className={`flex items-start gap-3 rounded-[16px] px-4 py-3.5 text-[0.9375rem] font-semibold leading-relaxed ${tones[tone]}`}
    >
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <span>{children}</span>
    </p>
  );
}

/** Row with a leading round icon, title/subtitle and a chevron. */
export function NavRow({
  href,
  icon,
  title,
  children,
  onClick,
}: {
  href?: string;
  icon: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[1.125rem] font-bold text-ink-900">{title}</span>
        {children ? (
          <span className="mt-1 block text-[0.9375rem] text-ink-500">{children}</span>
        ) : null}
      </span>
      <Chevron />
    </>
  );
  const cls =
    'flex w-full min-h-[76px] items-center gap-4 rounded-[20px] bg-surface px-4 py-4 ' +
    'shadow-[0_2px_10px_rgba(122,84,46,0.06)]';
  if (href) {
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

/** Pale circular backdrop behind an illustration or glyph. */
export function IconCircle({
  children,
  tone = 'leaf',
  size = 52,
}: {
  children: ReactNode;
  tone?: 'leaf' | 'brand' | 'amber' | 'neutral';
  size?: number;
}) {
  const tones = {
    leaf: 'bg-leaf-100',
    brand: 'bg-brand-100',
    amber: 'bg-amber-100',
    neutral: 'bg-surface-sunk',
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${tones[tone]}`}
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  );
}

export function Chevron({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 text-brand-600 ${className}`}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function CheckCircle({
  size = 40,
  tone = 'leaf',
}: {
  size?: number;
  tone?: 'leaf' | 'brand';
}) {
  const bg = tone === 'leaf' ? 'bg-leaf-600' : 'bg-brand-500';
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${bg}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size * 0.56}
        height={size * 0.56}
        fill="none"
        stroke="#fff"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m5 13 4.5 4.5L19 7" />
      </svg>
    </span>
  );
}

/** Static waveform bars — a picture of audio, not a live meter. */
export function Waveform({
  bars = 46,
  tone = 'brand',
  height = 34,
  className = '',
  seed = 7,
}: {
  bars?: number;
  tone?: 'brand' | 'leaf' | 'muted';
  height?: number;
  className?: string;
  seed?: number;
}) {
  const colors = {
    brand: 'bg-brand-400',
    leaf: 'bg-leaf-400',
    muted: 'bg-brand-200',
  };
  // deterministic pseudo-random so server and client render identically
  const h = (i: number) => {
    const v = Math.abs(Math.sin((i + 1) * seed * 1.37)) * 0.78 + 0.18;
    return Math.round(v * height);
  };
  return (
    <span
      className={`flex items-center gap-[3px] ${className}`}
      style={{ height }}
      aria-hidden="true"
    >
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full ${colors[tone]}`}
          style={{ height: h(i) }}
        />
      ))}
    </span>
  );
}

export function Divider() {
  return <hr className="border-0 border-t border-hairline" />;
}
