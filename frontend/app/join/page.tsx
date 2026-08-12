'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthFrame, Field, FormError, SubmitButton } from '@/components/AuthForm';
import { useAccount } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';

/**
 * 기관 합류 — 로그인은 됐는데 아직 어느 기관에도 속하지 않은 사람의 자리.
 *
 * 이 화면이 없던 동안, 그 상태는 빠져나올 수 없는 막다른 길이었다. 앱이
 * '로그인 안 함'과 구분하지 못해 로그아웃 화면을 보여 줬고, 다시 가입하려
 * 하면 '이미 가입된 이메일'이고, 로그인하면 다시 여기로 돌아왔다. 계정이
 * 영영 못 쓰는 상태로 굳는다.
 *
 * 여기 오는 경로는 셋이다.
 *   · 가입할 때 코드를 잘못 넣었다
 *   · 메일 확인이 켜진 배포에서 확인 뒤 처음 로그인했다
 *   · 센터장이 소속을 내렸다가 다시 넣는 중이다
 *
 * 셋 다 필요한 것은 같다 — 기관 코드 한 번 더.
 */
export default function JoinPage() {
  const router = useRouter();
  const { account, signOut } = useAccount();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (account.status === 'loading') {
    return (
      <AuthFrame title="기관 합류">
        <p className="mt-6 text-center text-[1rem] text-ink-500">불러오는 중이에요…</p>
      </AuthFrame>
    );
  }

  if (account.status === 'local') {
    return (
      <AuthFrame title="기관 합류">
        <p className="mt-6 text-center text-[1rem] leading-relaxed text-ink-700">
          이 기기는 서버 없이 동작하도록 설정되어 있어요. 합류할 기관이 없습니다.
        </p>
      </AuthFrame>
    );
  }

  if (account.status === 'out') {
    return (
      <AuthFrame title="기관 합류">
        <p className="mt-6 text-center text-[1rem] leading-relaxed text-ink-700">
          먼저 로그인해 주세요. 로그인하신 계정을 기관에 넣어 드립니다.
        </p>
        <Link
          href="/login"
          className="tk-cta mt-7 flex min-h-[56px] items-center justify-center rounded-[16px] text-[1.125rem] font-extrabold text-white"
        >
          로그인
        </Link>
      </AuthFrame>
    );
  }

  if (account.status === 'in') {
    return (
      <AuthFrame title="기관 합류">
        <p className="mt-6 text-center text-[1rem] leading-relaxed text-ink-700">
          이미 <strong>{account.tenantName}</strong> 소속이세요.
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
    const { error: rpcError } = await sb.rpc('join_tenant', { p_code: code.trim() });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message || '기관에 합류하지 못했어요.');
      return;
    }
    // 소속이 생겼으니 계정 상태를 다시 읽어야 화면들이 기관 모드로 바뀐다.
    router.push('/home');
    router.refresh();
  };

  return (
    <AuthFrame title="기관 합류">
      <p className="mt-2 text-center text-[0.9375rem] leading-relaxed text-ink-500">
        <strong>{account.email ?? '이 계정'}</strong> 으로 로그인돼 있어요.
        <br />
        아직 소속된 기관이 없습니다 — 센터장님께 받으신 코드를 넣어 주세요.
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
        <FormError>{error}</FormError>
        <SubmitButton busy={busy} ready={code.trim().length >= 4}>
          {busy ? '합류하는 중…' : '기관에 합류하기'}
        </SubmitButton>
      </form>

      {/*
        나갈 문을 둔다. 코드를 못 구했거나 계정을 잘못 만든 사람이 여기서
        막히면 할 수 있는 일이 아무것도 없다 — 그게 예전의 그 막다른 길이었다.
      */}
      <div className="mt-5 text-center">
        <button
          type="button"
          onClick={() => void signOut()}
          className="inline-flex min-h-[44px] items-center px-2 text-[0.9375rem] font-bold text-ink-500 underline underline-offset-2"
        >
          다른 계정으로 로그인
        </button>
      </div>
      <div className="mt-1 text-center">
        <Link
          href="/home"
          className="inline-flex min-h-[44px] items-center px-2 text-[0.9375rem] font-bold text-ink-500 underline underline-offset-2"
        >
          기관 없이 둘러보기
        </Link>
      </div>
    </AuthFrame>
  );
}
