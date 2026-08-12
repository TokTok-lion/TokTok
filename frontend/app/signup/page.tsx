'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthFrame, Field, FormError, SubmitButton } from '@/components/AuthForm';
import { useAccount } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';

/**
 * 복지사 가입.
 *
 * ── 왜 기관 가입에서 복지사 가입으로 바뀌었나
 *
 * 예전에는 가입이 곧 기관 생성이었다. 무소속 계정을 없애려는 선택이었는데,
 * 팔면서 두 가지가 어긋났다.
 *
 * 하나. 똑똑은 찾아가서 계약하고 계정을 만들어 드리는 방식으로 판다. 누구나
 * 기관을 만들 수 있으면 요금·한도·보관정책을 함께 정하는 앞단이 건너뛰어진다.
 *
 * 둘, 이쪽이 더 나빴다. 같은 센터의 두 번째 복지사가 가입하면 **새 기관**이
 * 만들어졌다. 한 센터가 tenant 두 개로 갈라지고 어르신도 회기도 서로 안 보인다.
 * 되돌릴 길도 없다 — 이미 소속이 있는 사람은 다른 기관에 못 들어간다.
 *
 * 그래서 복지사는 자기 계정을 만들고 **기관 코드**로 합류한다. 어르신은
 * tenant 단위 RLS 라 같은 기관이면 저절로 공유된다.
 *
 * 기관을 새로 만드는 화면은 /signup/center 로 옮겼다. 계약 자리에서 운영자가
 * 주소로 직접 연다.
 */
export default function WorkerSignupPage() {
  const router = useRouter();
  const { account } = useAccount();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (account.status === 'local') {
    return (
      <AuthFrame title="복지사 가입">
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
      </AuthFrame>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;

    setBusy(true);
    setError(null);

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

    /*
     * 메일 확인이 켜져 있으면 여기서 세션이 없다. 그러면 합류는 확인 뒤에
     * 해야 하는데, 그 길은 /join 에 있다 — 로그인만 하면 코드를 다시 물어본다.
     * 예전에는 그 길이 없어서 계정이 못 쓰는 상태로 굳었다.
     */
    if (!signUp.data.session) {
      setBusy(false);
      setError('메일로 보낸 확인 링크를 눌러 주세요. 로그인하시면 기관 코드를 다시 여쭤봅니다.');
      return;
    }

    const { error: rpcError } = await sb.rpc('join_tenant', { p_code: code.trim() });
    setBusy(false);

    if (rpcError) {
      // 계정은 이미 만들어졌다. 그 사실을 말해 줘야 다시 가입하려 하지 않는다.
      setError(
        `${rpcError.message || '기관에 합류하지 못했어요.'} 계정은 만들어졌으니, 코드를 확인하신 뒤 아래 「기관 코드 입력」에서 이어서 하실 수 있어요.`,
      );
      return;
    }
    router.push('/home');
  };

  const ready = email.trim().length > 0 && password.length >= 6 && code.trim().length >= 4;

  return (
    <AuthFrame title="복지사 가입">
      <p className="mt-2 text-center text-[0.9375rem] leading-relaxed text-ink-500">
        일하시는 센터의 <strong>기관 코드</strong>가 필요해요.
        <br />
        센터장님께 받으시면 됩니다.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field
          label="기관 코드"
          value={code}
          onChange={setCode}
          placeholder="ABCD2345"
          uppercase
          hint="8자리"
        />
        <Field label="이메일" type="email" value={email} onChange={setEmail} autoComplete="username" />
        <Field
          label="비밀번호"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hint="6자 이상"
        />

        <FormError>{error}</FormError>

        <SubmitButton busy={busy} ready={ready}>
          {busy ? '가입하는 중…' : '가입하고 시작하기'}
        </SubmitButton>
      </form>

      <p className="mt-5 text-center text-[0.9375rem] text-ink-500">
        이미 계정이 있으신가요?{' '}
        <Link href="/login" className="font-bold text-leaf-700 underline underline-offset-2">
          로그인
        </Link>
      </p>
      <div className="mt-3 text-center">
        <Link
          href="/join"
          className="inline-flex min-h-[44px] items-center px-2 text-[0.9375rem] font-bold text-ink-500 underline underline-offset-2"
        >
          기관 코드 입력
        </Link>
      </div>
      <div className="mt-1 text-center">
        <Link
          href="/home"
          className="inline-flex min-h-[44px] items-center px-2 text-[0.9375rem] font-bold text-ink-500 underline underline-offset-2"
        >
          가입 없이 둘러보기
        </Link>
      </div>
    </AuthFrame>
  );
}
