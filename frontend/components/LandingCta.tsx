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

  /*
   * 로그인은 됐는데 소속이 없다. 이 사람에게 필요한 것은 로그인도 가입도
   * 아니고 기관 코드다. 예전에는 이 상태가 'out' 과 같아서 로그인 버튼을
   * 다시 내밀었고, 눌러도 같은 자리로 돌아왔다.
   */
  if (account.status === 'noTenant') {
    return (
      <>
        <PrimaryButton href="/join" trailing={<Chevron className="text-white" />}>
          기관 코드 입력
        </PrimaryButton>
        <p className="mt-3 text-center text-[0.875rem] font-semibold text-ink-500">
          로그인은 됐어요. 아직 소속된 기관이 없습니다
        </p>
      </>
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

  /*
   * 기관 '등록'은 내밀지 않는다. 복지사 '가입'을 내민다.
   *
   * 똑똑은 찾아가서 계약하고 계정을 만들어 드리는 방식으로 판다. 그런데 첫
   * 화면이 '기관 등록하기'를 크게 내밀면 두 가지가 어긋난다.
   *
   *   · 계약하지 않은 곳이 스스로 계정을 만든다. 요금·한도·보관정책을 함께
   *     정하고 시작해야 하는 서비스인데 그 앞단이 통째로 건너뛰어진다.
   *   · 같은 센터의 두 번째 복지사가 이 버튼을 누른다. create_my_tenant 는
   *     새 기관을 만들므로 한 센터가 tenant 두 개로 갈라지고, 그러면 어르신도
   *     회기도 서로 안 보인다. 되돌릴 길도 없다 — 이미 소속이 있는 사람은
   *     다른 기관에 들어갈 수 없다.
   *
   * /signup 자체는 남겨 둔다. 계약 자리에서 운영자가 주소로 직접 연다.
   * 숨긴 것이지 잠근 것이 아니므로, 아무나 만들면 곤란해지는 때가 오면
   * 그때는 서버에서 막아야 한다(create_my_tenant 쪽).
   */
  return (
    <>
      <PrimaryButton href="/signup" trailing={<Chevron className="text-white" />}>
        복지사 회원가입
      </PrimaryButton>
      <p className="mt-2 text-center text-[0.875rem] font-semibold text-ink-500">
        일하시는 센터의 기관 코드가 필요해요
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          href="/login"
          className="flex min-h-[52px] items-center justify-center rounded-[14px] border-2 border-brand-300 bg-surface-strong text-[1rem] font-bold text-brand-800"
        >
          로그인
        </Link>
        {/* 가입하지 않고도 볼 수 있어야 한다. 어떤 서비스인지 모르는 채로
            코드부터 적으라고 하면 대부분 그냥 나간다. */}
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
