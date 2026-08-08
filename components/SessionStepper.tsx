'use client';

import Link from 'next/link';
import { STEPS, TOTAL_STEPS, isStepDone, type Step } from '@/lib/flow';
import { useSession } from '@/lib/store';

/**
 * 회기 진행 표시.
 *
 * Deliberately quiet. An earlier version sat on a near-white band with nine
 * chunky segments; it broke the warm gradient, cost 79px of the screen, and
 * shouted louder than the page title it sat above. The deck has no such bar at
 * all, so anything added here has to earn its space.
 *
 * What it must do: tell a worker who put the tablet down yesterday where they
 * are, and get out of the way. One line of text, one hairline track, no
 * background of its own. Jumping between steps lives on 전체 단계.
 */
export function SessionStepper({ current }: { current: Step }) {
  const { s } = useSession();
  const done = STEPS.filter((st) => isStepDone(st.id, s)).length;
  const pct = (current.index - 1) / (TOTAL_STEPS - 1);

  return (
    <nav
      aria-label="회기 진행 단계"
      className="relative z-10 px-5 pb-1 pt-1.5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[0.8125rem] font-bold text-ink-500">
          <span className="text-brand-700">{current.index}</span>
          <span> / {TOTAL_STEPS}</span>
          <span className="ml-1.5 text-ink-700">{current.label}</span>
        </p>
        <Link
          href="/session"
          className="inline-flex min-h-[24px] shrink-0 items-center text-[0.8125rem] font-bold text-leaf-700"
        >
          전체 단계 ›
        </Link>
      </div>

      {/* one hairline, not nine bars: position at a glance, no visual weight */}
      <div
        className="relative mt-1.5 h-[3px] rounded-full bg-track"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={TOTAL_STEPS}
        aria-valuetext={`${TOTAL_STEPS}단계 중 ${done}단계 완료, 현재 ${current.label}`}
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-leaf-500"
          style={{ width: `${(done / TOTAL_STEPS) * 100}%` }}
        />
        <span
          className="absolute top-1/2 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500 ring-2 ring-page"
          style={{ left: `${pct * 100}%` }}
        />
      </div>
    </nav>
  );
}
