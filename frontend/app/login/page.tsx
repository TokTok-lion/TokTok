'use client';

import Link from 'next/link';
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
 * 복지사는 자기 계정으로 가입한다(/signup). 기관은 계약할 때 만들어 드리고,
 * 복지사는 센터장에게 받은 기관 코드로 그 기관에 합류한다 — 그래야 같은
 * 센터의 두 사람이 각자 가입해도 어르신이 공유된다.
 *
 * 소속 없이 로그인만 된 사람은 /join 으로 간다. 예전에는 그 상태가 로그아웃과
 * 구분되지 않아 빠져나올 수 없는 자리였다.
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

  if (account.status === 'noTenant') {
    return (
      <Frame>
        <p className="mt-6 text-center text-[1.0625rem] leading-relaxed text-ink-900">
          로그인은 되어 있어요. 아직 <strong>소속된 기관이 없습니다.</strong>
        </p>
        <p className="mt-1.5 text-center text-[0.9375rem] text-ink-500">{account.email}</p>
        <div className="mt-7 space-y-3">
          <PrimaryButton href="/join">기관 코드 입력</PrimaryButton>
          <button
            type="button"
            onClick={() => void signOut()}
            className="min-h-[52px] w-full rounded-[14px] border border-hairline bg-surface text-[1rem] font-bold text-ink-700"
          >
            다른 계정으로 로그인
          </button>
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

      {/*
        여기는 '무료로 시작하기'로 기관 등록을 내밀고 있었다. 로그인이 안 되는
        사람이 마지막으로 보는 화면이라 누를 이유가 가장 큰 자리인데, 누르면
        기관이 하나 더 만들어졌다 — 같은 센터의 두 번째 복지사가 정확히 그렇게
        한다. 이제 가는 곳은 복지사 가입이다.
      */}
      <div className="mt-6 rounded-[16px] border-2 border-brand-200 bg-brand-50 p-4 text-center">
        <p className="text-[0.9375rem] font-bold text-ink-900">
          아직 계정이 없으신가요?
        </p>
        <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-700">
          센터장님께 <strong>기관 코드</strong>를 받으신 뒤 가입해 주세요.
          기관 계정 자체는 계약하실 때 저희가 만들어 드립니다.
        </p>
        <Link
          href="/signup"
          className="mt-3 flex min-h-[52px] w-full items-center justify-center rounded-[14px] bg-brand-700 text-[1rem] font-extrabold text-white"
        >
          복지사 회원가입
        </Link>
      </div>

      <p className="mt-5 text-center text-[0.875rem] leading-relaxed text-ink-500">
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
