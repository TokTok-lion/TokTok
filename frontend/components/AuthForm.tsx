'use client';

import { Logo } from '@/components/Shell';

/**
 * 가입·합류 화면이 함께 쓰는 껍데기와 입력칸.
 *
 * 세 화면(복지사 가입 · 기관 합류 · 기관 등록)이 같은 모양이어야 한다.
 * 복지사가 코드를 잘못 넣어 합류 화면으로 돌아왔을 때, 방금 본 가입 화면과
 * 입력칸이 다르게 생겼으면 다른 서비스에 온 것처럼 읽힌다.
 */

export function AuthFrame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="tk-page-bg mx-auto flex min-h-dvh max-w-[440px] flex-col px-6 pb-10 pt-12">
      <main id="main" className="flex-1">
        <div className="flex justify-center">
          <Logo size="md" />
        </div>
        <h1 className="mt-5 text-center text-[1.5rem] font-extrabold text-ink-900">{title}</h1>
        {children}
      </main>
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  placeholder,
  hint,
  uppercase,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  hint?: string;
  /** 기관 코드처럼 대문자로만 이루어진 값. 소문자로 쳐도 알아본다. */
  uppercase?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[0.9375rem] font-bold text-ink-700">
        {label}
        {hint ? <span className="ml-1.5 font-medium text-ink-500">{hint}</span> : null}
      </span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(uppercase ? e.target.value.toUpperCase() : e.target.value)}
        // 코드는 받아 적어 옮기는 값이라 글자를 벌려 놓는다. 'O' 와 '0' 을
        // 뺐지만 그래도 한 글자씩 짚어 가며 치게 된다.
        className={`mt-1.5 min-h-[56px] w-full rounded-[14px] border-2 border-hairline bg-surface-strong px-4 text-[1.0625rem] text-ink-900 placeholder:text-ink-300 focus:border-brand-500 focus:outline-none ${
          uppercase ? 'font-bold tracking-[0.18em]' : ''
        }`}
      />
    </label>
  );
}

/** 오류는 낭독으로 듣는 사람에게도 닿아야 한다. */
export function FormError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="rounded-[12px] bg-surface-sunk px-4 py-3 text-[0.9375rem] font-bold leading-relaxed text-danger-600"
    >
      {children}
    </p>
  );
}

export function SubmitButton({
  busy,
  ready,
  children,
}: {
  busy: boolean;
  ready: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={busy || !ready}
      className={`tk-cta flex min-h-[56px] w-full items-center justify-center rounded-[16px] text-[1.125rem] font-extrabold text-white ${
        busy || !ready ? 'pointer-events-none bg-surface-sunk text-ink-500' : ''
      }`}
    >
      {children}
    </button>
  );
}
