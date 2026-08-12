'use client';

import Link from 'next/link';
import { PrimaryButton, Chevron } from './ui';
import { useAccount } from '@/lib/auth';

/**
 * 첫 화면의 시작 버튼.
 *
 * 누구에게 무엇을 보여줄지가 상태마다 다르다. 가입 화면을 만들어 두고
 * 첫 화면에서 거기로 가는 길을 내지 않으면, 새로 온 사람은 그 화면이 있는 줄도
 * 모른다 — 실제로 그렇게 만들어 놨었다.
 *
 *   서버 없음   시작하기 하나. 가입이라는 개념 자체가 없다.
 *   로그인 전   무료로 시작하기 · 로그인 · 둘러보기
 *   로그인 후   시작하기 하나. 이미 들어온 사람에게 가입을 권할 이유가 없다.
 */
export function LandingCta() {
  const { account, signOut } = useAccount();

  // 아직 확인 중이면 기본 버튼만. 버튼이 깜빡이며 바뀌는 것보다 낫다.
  if (account.status === 'local' || account.status === 'loading') {
    return (
      <PrimaryButton href="/home" trailing={<Chevron className="text-white" />}>
        시작하기
      </PrimaryButton>
    );
  }

  if (account.status === 'in') {
    return (
      <>
        <PrimaryButton href="/home" trailing={<Chevron className="text-white" />}>
          시작하기
        </PrimaryButton>
        {/*
          기관 이름만 적어 두고 나갈 문을 안 두었었다.

          로그아웃은 더보기 안에 있는데, 이 화면에서 거기까지 가려면 시작하기 →
          홈 → 더보기 를 거쳐야 한다. 그런데 계정을 바꾸려는 사람은 바로 이
          화면에서 그 생각을 한다 — 앱을 열었더니 남의 기관 이름이 적혀 있는
          순간이다. 태블릿을 여럿이 돌려 쓰는 자리라 드문 일이 아니다.

          "이 기관으로 들어와 있다"는 사실과 나가는 문을 같이 둔다.
        */}
        <p className="mt-3 text-center text-[0.875rem] font-semibold text-ink-500">
          {account.tenantName}(으)로 로그인돼 있어요
        </p>
        <div className="mt-1 text-center">
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex min-h-[44px] items-center border-b-2 border-leaf-300 px-1 text-[0.9375rem] font-bold text-leaf-700"
          >
            다른 기관으로 로그인
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {/* 버튼은 다음 화면에서 할 일을 말해야 한다. 누르면 기관 이름을 적는
          화면이 나오는데 "무료로 시작하기"는 그 일을 가리키지 않아서, 눌러
          놓고 여기가 맞나 싶어진다. 무료라는 사실은 버튼 아래에서 말한다. */}
      <PrimaryButton href="/signup" trailing={<Chevron className="text-white" />}>
        기관 등록하기
      </PrimaryButton>
      <p className="mt-2 text-center text-[0.875rem] font-semibold text-ink-500">
        무료로 시작할 수 있어요 · 카드 등록 없음
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          href="/login"
          className="flex min-h-[52px] items-center justify-center rounded-[14px] border-2 border-brand-300 bg-surface-strong text-[1rem] font-bold text-brand-800"
        >
          로그인
        </Link>
        {/* 가입하지 않고도 볼 수 있어야 한다. 어떤 서비스인지 모르는 채로
            기관 이름부터 적으라고 하면 대부분 그냥 나간다. */}
        <Link
          href="/home"
          className="flex min-h-[52px] items-center justify-center rounded-[14px] border border-hairline bg-surface text-[1rem] font-bold text-ink-700"
        >
          둘러보기
        </Link>
      </div>
    </>
  );
}
