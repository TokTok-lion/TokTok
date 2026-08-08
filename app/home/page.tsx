'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArtBox } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Chevron, Chip, PrimaryButton } from '@/components/ui';
import { IconBulb, IconClock, IconDoc, IconPlus, IconChat } from '@/components/icons';
import { SEED_RESUME } from '@/lib/seed';
import { useSession } from '@/lib/store';
import type { ArtKey } from '@/lib/art';

const FILTERS = ['전체', '진행 중', '완료'] as const;

const STATUS_ICON = {
  brand: IconClock,
  amber: IconChat,
  leaf: IconDoc,
} as const;

/** 이전 회기 이어보기 (deck p.28) — 홈 */
export default function HomePage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('전체');
  const { set } = useSession();
  const router = useRouter();

  const cards = SEED_RESUME.filter((c) =>
    filter === '전체' ? true : filter === '완료' ? c.done : !c.done,
  );

  /**
   * Resuming a session makes its story the active topic, which is what every
   * downstream screen keys off — including the artwork on 노래 만드는 중 and
   * 노래 완성 (lib/scenes.ts).
   */
  const resume = (title: string, href: string) => {
    set('topic', title);
    router.push(href);
  };

  return (
    <Screen
      back={false}
      menu
      bell
      title="이전 회기 이어보기"
      subtitle="중간에 멈춘 기록을 다시 이어갈 수 있어요"
      decoration={<Ornaments variant="leafRight" />}
      footer={
        <PrimaryButton
          href="/sessions"
          leading={
            <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/90">
              <IconPlus size={16} />
            </span>
          }
        >
          새 회기 시작
        </PrimaryButton>
      }
    >
      {/* filter pills */}
      <div className="flex gap-2.5" role="tablist" aria-label="회기 상태 필터">
        {FILTERS.map((f) => {
          const on = filter === f;
          return (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setFilter(f)}
              // 19px/800 keeps white-on-orange in WCAG "large text", where the
              // deck's vivid fill clears the 3:1 bar. Bigger type also suits
              // the audience, so this is a win either way.
              className={`min-h-[46px] flex-1 rounded-full px-3 text-[1.1875rem] font-extrabold transition-colors ${
                on
                  ? 'tk-cta text-white'
                  : 'border border-hairline bg-surface-strong text-ink-700'
              }`}
            >
              {f}
            </button>
          );
        })}
      </div>

      <ul className="mt-4 space-y-3.5">
        {cards.map((c) => {
          const StatusIcon = STATUS_ICON[c.statusTone];
          return (
            <li
              key={c.id}
              className="rounded-[20px] bg-surface p-3.5 shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
            >
              <div className="flex gap-3.5">
                <ArtBox
                  name={c.art as ArtKey}
                  className="h-[92px] w-[92px] shrink-0 rounded-[14px] object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-[1.1875rem] font-extrabold leading-tight text-ink-900">
                      {c.title}
                    </h2>
                    <Chevron className="mt-0.5 text-ink-300" />
                  </div>

                  <p className="mt-1.5">
                    <Chip tone={c.statusTone} size="sm">
                      <StatusIcon size={14} className="mr-1.5" />
                      {c.status}
                    </Chip>
                  </p>

                  <p className="mt-1.5 flex items-start gap-1.5 text-[0.875rem] font-medium leading-snug text-ink-500">
                    <IconBulb size={16} className="mt-0.5 shrink-0 text-leaf-600" />
                    {c.detail}
                  </p>
                </div>
              </div>

              <div className="-mt-1 flex justify-end">
                {c.cta === '이어하기' ? (
                  <button
                    type="button"
                    onClick={() => resume(c.title, '/session/checklist')}
                    className="tk-cta flex min-h-[44px] items-center gap-1 rounded-full px-5 text-[1.1875rem] font-extrabold text-white"
                  >
                    이어하기
                    <Chevron className="text-white" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => resume(c.title, '/session/wrap')}
                    className="flex min-h-[44px] items-center rounded-full border-2 border-brand-300 bg-surface-strong px-6 text-[1rem] font-bold text-brand-700"
                  >
                    보기
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {cards.length === 0 ? (
        <p className="mt-10 text-center text-[1rem] font-semibold text-ink-500">
          해당하는 회기가 없어요.
        </p>
      ) : null}
    </Screen>
  );
}
