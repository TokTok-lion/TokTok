'use client';

import Link from 'next/link';
import { ArtBox } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chevron, Chip, PrimaryButton } from '@/components/ui';
import { STEPS, flowState, isStepDone } from '@/lib/flow';
import { useSession } from '@/lib/store';
import type { ArtKey } from '@/lib/art';

/**
 * 회기 — 진행 중인 작업의 전체 지도.
 *
 * This is the only place the nine steps are listed. 오늘 shows just the next
 * one; 기록 shows what came out the other end. A step already finished stays
 * tappable, because going back to re-check something is normal work.
 *
 * 어르신 잠금은 여기 없다. 이 화면만 막으면 아래 단계 화면들이 그대로 열려
 * 있어서, 자물쇠는 회기 폴더 전체를 덮는 layout.tsx 한 곳에 뒀다. 여기까지
 * 그려졌다는 것은 가리킬 어르신이 있다는 뜻이다.
 */
export default function SessionFlowPage() {
  const { s } = useSession();
  const flow = flowState(s);

  return (
    <Screen
      root
      title="오늘의 회기"
      subtitle="준비부터 마무리까지 순서대로 진행해요"
      decoration={<Ornaments variant="leafRight" />}
      footer={
        <PrimaryButton href={flow.next.href}>
          {flow.complete
            ? '모든 단계 완료'
            : `${flow.next.index}단계 ${flow.next.label} 시작`}
        </PrimaryButton>
      }
    >
      <Card className="flex items-center gap-3.5 p-3.5">
        <ArtBox
          name={s.elder.avatar as ArtKey}
          className="h-[60px] w-[60px] shrink-0 rounded-full object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[1.1875rem] font-extrabold text-ink-900">
            {s.elder.honorific}
          </p>
          <p className="text-[0.9375rem] text-ink-500">{s.topic}</p>
        </div>
        <Chip tone="leaf" size="sm">
          {flow.done}/{flow.total}
        </Chip>
      </Card>

      <ol className="mt-4 space-y-2.5">
        {STEPS.map((st) => {
          const done = isStepDone(st.id, s);
          const isNext = !flow.complete && st.id === flow.next.id;
          return (
            <li key={st.id}>
              <Link
                href={st.href}
                aria-current={isNext ? 'step' : undefined}
                className={`flex min-h-[76px] items-center gap-3.5 rounded-[18px] px-3.5 ${
                  isNext
                    ? 'bg-brand-50 ring-2 ring-brand-500'
                    : 'bg-surface shadow-[0_2px_10px_rgba(122,84,46,0.06)]'
                }`}
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[1.0625rem] font-extrabold ${
                    done
                      ? 'bg-leaf-600 text-white'
                      : isNext
                        ? 'bg-brand-500 text-white'
                        : 'bg-surface-sunk text-ink-500'
                  }`}
                >
                  {done ? (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m5 13 4.5 4.5L19 7" />
                    </svg>
                  ) : (
                    st.index
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[1.125rem] font-extrabold text-ink-900">
                      {st.label}
                    </span>
                    {isNext ? (
                      <span className="rounded-full bg-brand-700 px-2 py-0.5 text-[0.75rem] font-bold text-white">
                        지금 할 일
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-[0.875rem] text-ink-500">
                    {done ? '완료' : st.action}
                  </span>
                </span>

                <Chevron />
              </Link>
            </li>
          );
        })}
      </ol>

      <p className="mt-4 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
        앞 단계를 건너뛰어도 막지 않아요. 현장 상황에 따라 순서가 바뀔 수
        있으니, 이 목록은 다음에 할 일을 알려줄 뿐 진행을 가로막지 않습니다.
      </p>
    </Screen>
  );
}
