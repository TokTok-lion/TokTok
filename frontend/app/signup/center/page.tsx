'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Logo } from '@/components/Shell';
import { useAccount } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';

/**
 * 기관 가입.
 *
 * 개인 가입이 아니라 기관 가입이다. 가입하면 그 자리에서 기관이 만들어지고
 * 가입자가 그 기관의 센터장이 된다. 개인 가입을 열면 어느 기관에도 속하지
 * 않은 계정이 쌓이고, 그중 하나가 남의 기관 데이터에 붙는 사고가 난다.
 *
 * 기관을 만드는 것은 DB 함수(create_my_tenant)만 할 수 있다. 앱이 tenants 에
 * 직접 쓸 수 없게 막아 둔 것을 유지하기 위해서다 — 그 함수 안에서 "만든
 * 사람만 센터장이 된다"를 강제한다.
 */
export default function SignupPage() {
  const router = useRouter();
  const { account } = useAccount();
  const [org, setOrg] = useState('');
  const [region, setRegion] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (account.status === 'local') {
    return (
      <Frame>
        <p className="mt-6 text-center text-[1rem] leading-relaxed text-ink-700">
          이 기기는 <strong>서버 없이</strong> 동작하도록 설정되어 있어요.
          가입 없이 바로 쓰실 수 있습니다.
        </p>
        <Link
          href="/home"
          className="tk-cta mt-7 flex min-h-[56px] items-center justify-center rounded-[16px] text-[1.125rem] font-extrabold text-white"
        >
          오늘 화면으로
        </Link>
      </Frame>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;

    setBusy(true);
    setError(null);

    // 1) 계정을 만든다
    const signUp = await sb.auth.signUp({ email: email.trim(), password });
    if (signUp.error) {
      setBusy(false);
      setError(
        signUp.error.message.includes('already')
          ? '이미 가입된 이메일이에요. 로그인해 주세요.'
          : '가입하지 못했어요. 잠시 뒤 다시 시도해 주세요.',
      );
      return;
    }

    // 메일 확인이 켜져 있으면 여기서 세션이 없다. 그러면 기관은 확인 뒤에
    // 만들어야 하므로, 지금은 안내만 하고 멈춘다.
    if (!signUp.data.session) {
      setBusy(false);
      setError('메일로 보낸 확인 링크를 눌러 주세요. 그다음 로그인하시면 됩니다.');
      return;
    }

    // 2) 기관을 만든다 (이 함수만이 유일한 통로)
    const { error: rpcError } = await sb.rpc('create_my_tenant', {
      p_name: org.trim(),
      p_region: region.trim() || undefined,
    });
    setBusy(false);

    if (rpcError) {
      setError(
        rpcError.message.includes('이미 소속')
          ? '이미 소속된 기관이 있어요. 로그인해 주세요.'
          : rpcError.message || '기관을 만들지 못했어요.',
      );
      return;
    }
    router.push('/home');
  };

  const ready = org.trim().length >= 2 && email.trim() && password.length >= 6;

  return (
    <Frame>
      <p className="mt-2 text-center text-[0.9375rem] leading-relaxed text-ink-500">
        기관을 등록하면 바로 쓰실 수 있어요.
        <br />
        무료로 <strong>어르신 3분, 노래 3곡</strong>까지 만들어 보실 수 있습니다.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="기관 이름" value={org} onChange={setOrg} placeholder="○○주야간보호센터" />
        <Field label="지역 (선택)" value={region} onChange={setRegion} placeholder="충청북도 청주시" />
        <Field label="이메일" type="email" value={email} onChange={setEmail} autoComplete="username" />
        <Field
          label="비밀번호"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hint="6자 이상"
        />

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
          disabled={busy || !ready}
          className={`tk-cta flex min-h-[56px] w-full items-center justify-center rounded-[16px] text-[1.125rem] font-extrabold text-white ${
            busy || !ready ? 'pointer-events-none bg-surface-sunk text-ink-500' : ''
          }`}
        >
          {/* 첫 화면의 "무료로 시작하기"를 눌러 온 자리다. 여기서 또 같은
              말이면 누르면 어디로 또 가는 줄 안다. 이 버튼이 하는 일은 등록이다. */}
          {busy ? '등록하는 중…' : '기관 등록하기'}
        </button>
      </form>

      <p className="mt-5 text-center text-[0.9375rem] text-ink-500">
        이미 계정이 있으신가요?{' '}
        <Link href="/login" className="font-bold text-leaf-700 underline underline-offset-2">
          로그인
        </Link>
      </p>
      <div className="mt-3 text-center">
        <Link
          href="/home"
          className="inline-flex min-h-[44px] items-center px-2 text-[0.9375rem] font-bold text-ink-500 underline underline-offset-2"
        >
          가입 없이 둘러보기
        </Link>
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="tk-page-bg mx-auto flex min-h-dvh max-w-[440px] flex-col px-6 pb-10 pt-12">
      <main id="main" className="flex-1">
        <div className="flex justify-center">
          <Logo size="md" />
        </div>
        <h1 className="mt-5 text-center text-[1.5rem] font-extrabold text-ink-900">
          기관 등록
        </h1>
        {children}
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  hint?: string;
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
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 min-h-[56px] w-full rounded-[14px] border-2 border-hairline bg-surface-strong px-4 text-[1.0625rem] text-ink-900 placeholder:text-ink-300 focus:border-brand-500 focus:outline-none"
      />
    </label>
  );
}
