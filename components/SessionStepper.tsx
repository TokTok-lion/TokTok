'use client';

import Link from 'next/link';
import { STEPS, TOTAL_STEPS, isStepDone, type Step } from '@/lib/flow';
import { useSession } from '@/lib/store';

/**
 * 회기 진행 표시.
 *
 * Sits under the header on every screen that belongs to the session flow, so
 * a worker who put the tablet down mid-interview and came back tomorrow can
 * see where they are without guessing. Steps already finished are tappable —
 * going back to re-check something is normal work, not an error.
 */
export function SessionStepper({ current }: { current: Step }) {
  const { s } = useSession();

  return (
    <nav
      aria-label="회기 진행 단계"
      className="relative z-10 border-b border-hairline bg-surface-strong/80 px-5 py-2.5 backdrop-blur"
    >
      <div className="flex items-baseline justify-between">
        <p className="text-[0.9375rem] font-extrabold text-ink-900">
          <span className="text-brand-700">{current.index}</span>
          <span className="text-ink-500"> / {TOTAL_STEPS}</span>
          <span className="ml-2">{current.label}</span>
        </p>
        <Link
          href="/session"
          className="inline-flex min-h-[24px] items-center text-[0.8125rem] font-bold text-leaf-700 underline underline-offset-2"
        >
          전체 단계
        </Link>
      </div>

      <ol className="mt-2 flex items-center gap-1">
        {STEPS.map((st) => {
          const done = isStepDone(st.id, s);
          const active = st.id === current.id;
          const state = active ? '진행 중' : done ? '완료' : '예정';
          return (
            <li key={st.id} className="flex-1">
              <Link
                href={st.href}
                aria-current={active ? 'step' : undefined}
                aria-label={`${st.index}단계 ${st.label} · ${state}`}
                title={`${st.index}. ${st.label} (${state})`}
                // the visible bar is 6px, but the tap area must clear 24px
                className="flex min-h-[26px] items-center py-2.5"
              >
                <span
                  className={`block h-1.5 w-full rounded-full ${
                    active
                      ? 'bg-brand-500'
                      : done
                        ? 'bg-leaf-500'
                        : 'bg-track'
                  }`}
                />
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
