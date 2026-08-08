'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Logo } from '@/components/Shell';
import { PrimaryButton } from '@/components/ui';
import { useAccount } from '@/lib/auth';

/**
 * 기관 로그인.
 *
 * 서버를 쓸 때만 의미가 있다. RLS 가 auth.uid() 로 걸려 있어서, 로그인하지
 * 않으면 어떤 표도 0건이다 — 즉 로그인은 "기능 잠금"이 아니라 데이터가
 * 보이기 위한 최소 조건이다.
 *
 * 계정은 센터장이 만들어 나눠 준다. 여기에 가입 버튼을 두지 않는 이유는,
 * 누구나 계정을 만들 수 있으면 어느 기관에도 속하지 않은 계정이 쌓이고
 * 그중 하나가 실수로 어느 기관에 붙는 사고가 생기기 때문이다.
 */
export default function LoginPage() {
  const router = useRouter();
  const { account, signIn, signOut } = useAccount();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (account.status === 'local') {
    return (
      <Frame>
        <p className="mt-6 text-center text-[1rem] leading-relaxed text-ink-700">
          이 기기는 <strong>서버 없이</strong> 동작하도록 설정되어 있어요.
          기록은 이 기기에만 저장되고, 로그인은 필요하지 않습니다.
        </p>
        <div className="mt-7">
          <PrimaryButton href="/home">오늘 화면으로</PrimaryButton>
        </div>
      </Frame>
    );
  }

  if (account.status === 'in') {
    return (
      <Frame>
        <p className="mt-6 text-center text-[1.0625rem] leading-relaxed text-ink-900">
          <strong>{account.tenantName}</strong> 소속으로 로그인되어 있어요.
        </p>
        <p className="mt-1.5 text-center text-[0.9375rem] text-ink-500">{account.email}</p>
        <div className="mt-7 space-y-3">
          <PrimaryButton href="/home">오늘 화면으로</PrimaryButton>
          <button
            type="button"
            onClick={() => void signOut()}
            className="min-h-[52px] w-full rounded-[14px] border border-hairline bg-surface text-[1rem] font-bold text-ink-700"
          >
            로그아웃
          </button>
        </div>
      </Frame>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signIn(email.trim(), password);
    setBusy(false);
    if (res.error) setError(res.error);
    else router.push('/home');
  };

  return (
    <Frame>
      <form onSubmit={submit} className="mt-7 space-y-4">
        <Field
          label="이메일"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="username"
        />
        <Field
          label="비밀번호"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />

        {/* danger-600 on surface-sunk = 6.3:1 — 본문 크기라 AA 를 넘겨야 한다 */}
        {error ? (
          <p
            role="alert"
            className="rounded-[12px] bg-surface-sunk px-4 py-3 text-[0.9375rem] font-bold text-danger-600"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy || !email || !password}
          className={`tk-cta flex min-h-[56px] w-full items-center justify-center rounded-[16px] text-[1.125rem] font-extrabold text-white ${
            busy || !email || !password
              ? 'pointer-events-none bg-surface-sunk text-ink-500'
              : ''
          }`}
        >
          {busy ? '확인하는 중…' : '로그인'}
        </button>
      </form>

      <p className="mt-6 text-center text-[0.875rem] leading-relaxed text-ink-500">
        계정은 센터장이 만들어 드립니다.
        <br />
        로그인하지 않아도 이 기기에서 회기는 진행할 수 있어요.
      </p>
      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={() => router.push('/home')}
          className="min-h-[44px] px-2 text-[0.9375rem] font-bold text-leaf-700 underline underline-offset-2"
        >
          로그인 없이 계속하기
        </button>
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="tk-page-bg mx-auto flex min-h-dvh max-w-[440px] flex-col px-6 pb-10 pt-14">
      <main id="main" className="flex-1">
        <div className="flex justify-center">
          <Logo size="md" />
        </div>
        <h1 className="mt-6 text-center text-[1.5rem] font-extrabold text-ink-900">
          기관 로그인
        </h1>
        {children}
      </main>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  return (
    <label className="block">
      <span className="block text-[0.9375rem] font-bold text-ink-700">{label}</span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 min-h-[56px] w-full rounded-[14px] border-2 border-hairline bg-surface-strong px-4 text-[1.0625rem] text-ink-900 focus:border-brand-500 focus:outline-none"
      />
    </label>
  );
}
