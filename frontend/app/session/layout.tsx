'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ElderCardSkeleton, NoElderCard } from '@/components/NoElderCard';
import { Ornaments, Screen } from '@/components/Shell';
import { stepForScreen } from '@/lib/flow';
import { useSession } from '@/lib/store';
import { useActiveElder } from '@/lib/useActiveElder';

/**
 * 회기 폴더 전체의 자물쇠.
 *
 * 잠금이 탭 루트(/home·/session·/sessions·/library·/elder/profile)에만
 * 걸려 있었다. 그래서 주소를 직접 치거나 북마크·뒤로가기로 /session/lyrics
 * 같은 개별 회기 화면에 들어오면, 어르신을 고르지 않은 채로 회기가 그대로
 * 진행됐다. 7단계에 이르면 참가자가 없어 곡 한도 검사가 통째로 건너뛰어지고,
 * 서버 사본도 못 찾아 곡을 다시 만든다 — 기관 계정에서 요금만 나가는 길이다.
 *
 * 화면마다 같은 가드를 복사하면 다음에 추가되는 화면에서 또 빠진다. 그래서
 * 자물쇠는 회기 화면 열여덟 개를 한 번에 덮는 이 자리 하나에만 둔다.
 * /session 도 여기에 포함되므로 그 화면이 들고 있던 자체 가드는 걷어냈다.
 *
 * 시연 기기(서버 미설정·로그아웃)는 useActiveElder 가 늘 'ok' 로 답한다.
 * 씨앗 어르신으로 둘러보는 길은 그대로 열려 있다.
 */
export default function SessionLayout({ children }: { children: ReactNode }) {
  const elder = useActiveElder();
  const { s } = useSession();
  const pathname = usePathname();

  if (elder === 'ok') return <>{children}</>;

  // /session 은 아래 탭이 바로 여는 화면이라 돌아갈 곳이 없다. 그 자리는
  // 뒤로가기가 아니라 글자 크기가 받는다(Screen 의 root).
  const root = pathname === '/session';
  const step = stepForScreen(pathname);

  return (
    <Screen
      root={root}
      title="오늘의 회기"
      subtitle={
        elder === 'checking'
          ? '회기를 불러오는 중이에요'
          : root
            ? '어르신을 고르면 아홉 단계가 여기 펼쳐져요'
            : '어르신을 고르면 이어서 진행할 수 있어요'
      }
      decoration={<Ornaments variant="leafRight" />}
    >
      {/* 확인이 끝나기 전에 기기에 남은 회기를 그리면 지워진 어르신 이름이
          1초쯤 떴다가 사라진다. 잠깐 비어 있는 편이 잠깐 틀린 것보다 낫다. */}
      {elder === 'checking' ? (
        <ElderCardSkeleton />
      ) : (
        <>
          <NoElderCard deleted={Boolean(s.remoteParticipantId)} />
          {/* 막았으면 어디로 가면 되는지를 같은 화면에서 말한다. 길은 위
              카드의 두 버튼(어르신 고르기·새 어르신 등록)이고, 이 줄은
              열려던 화면이 없어진 것이 아니라 잠겨 있을 뿐임을 알린다. */}
          {step ? (
            <p className="mt-3 px-1 text-center text-[0.875rem] leading-relaxed text-ink-500">
              {step.index}단계 {step.label} 화면은 어르신을 고른 뒤에 열려요.
            </p>
          ) : null}
        </>
      )}
    </Screen>
  );
}
