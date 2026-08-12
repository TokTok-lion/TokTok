'use client';

import { useEffect, useState } from 'react';
import { Card } from './ui';
import { useAccount } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';

/**
 * 우리 기관 코드.
 *
 * 복지사는 이 코드로 자기 계정을 만들어 기관에 합류한다(/signup · /join).
 * 그런데 코드를 어디서도 볼 수 없으면 아무도 합류하지 못한다 — 기능을 만들고
 * 그 열쇠를 화면에 안 두면 없는 기능과 같다.
 *
 * 메일 초대가 아니라 코드인 이유: 센터장이 복지사 이메일을 전부 알고 있으리라는
 * 보장이 없고, 이 서비스에는 메일 발송 인프라도 없다. 코드는 카톡으로 보내면
 * 끝이고, 요양기관의 실제 업무 방식에 가깝다.
 *
 * 실제 기관으로 로그인했을 때만 그린다. 둘러보기에서 지어낸 코드를 보여 주면
 * 그걸 직원에게 보내는 일이 실제로 생긴다.
 */
export function JoinCodePanel() {
  const { account } = useAccount();
  const [code, setCode] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'none'>('loading');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (account.status !== 'in') return;
    let alive = true;
    // 실패도 결과다. 조용히 로딩에 머물면 왜 코드가 안 나오는지 알 수 없다.
    const done = (next: 'ok' | 'none', value: string | null) => {
      if (!alive) return;
      setCode(value);
      setState(next);
    };
    const sb = getSupabase();
    if (!sb) {
      // 이펙트 본문에서 곧장 setState 하지 않는다 — 렌더가 연쇄로 돈다.
      void Promise.resolve().then(() => done('none', null));
    } else {
      void sb
        .rpc('my_join_code')
        .then(({ data, error }) => done(error || !data ? 'none' : 'ok', data ?? null));
    }
    return () => {
      alive = false;
    };
  }, [account.status]);

  if (account.status !== 'in' || state === 'loading') return null;

  return (
    <>
      <h2 className="mt-7 text-[1.1875rem] font-extrabold text-ink-900">기관 코드</h2>
      <Card className="mt-3 p-4">
        {state === 'none' ? (
          /*
           * 코드를 못 읽었다. 마이그레이션(0005)을 아직 안 돌렸을 때 여기로
           * 온다 — 화면이 조용히 비어 있으면 왜 직원이 합류를 못 하는지
           * 아무도 모른다.
           */
          <p className="text-[0.9375rem] leading-relaxed text-ink-700">
            아직 이 기관의 코드가 없어요. 서버 준비가 끝나면 여기에 나옵니다.
          </p>
        ) : (
          <>
            <p className="text-[0.9375rem] leading-relaxed text-ink-700">
              새로 오신 복지사께 이 코드를 알려 주세요. 앱에서 회원가입하실 때
              넣으시면 <strong>{account.tenantName}</strong> 소속이 되고, 어르신
              기록을 함께 보시게 됩니다.
            </p>
            <p className="mt-3 select-all rounded-[14px] bg-surface-sunk px-4 py-3 text-center text-[1.75rem] font-extrabold tracking-[0.22em] text-ink-900">
              {code}
            </p>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(code ?? '').then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                });
              }}
              className="mt-3 min-h-[52px] w-full rounded-[14px] border-2 border-brand-300 bg-surface-strong text-[1rem] font-bold text-brand-800"
            >
              {copied ? '복사했어요' : '코드 복사'}
            </button>
            {/* 낭독으로 듣는 사람에게도 복사 결과가 닿아야 한다. */}
            <span role="status" className="sr-only">
              {copied ? '기관 코드를 복사했어요' : ''}
            </span>
            <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-500">
              코드를 아는 사람은 누구나 이 기관의 복지사로 합류할 수 있어요.
              센터 밖으로 나가지 않게 해 주세요. 합류한 분은 모두 <strong>복지사</strong>
              권한이고, 센터장 권한은 따로 드립니다.
            </p>
          </>
        )}
      </Card>
    </>
  );
}
