'use client';

import { useState } from 'react';
import { ArtBox } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, PrimaryButton } from '@/components/ui';
import { IconCalendar, IconMusicNote, IconPlay, IconPlus } from '@/components/icons';
import { formatDate } from '@/lib/domain';
import { SEED_LIBRARY } from '@/lib/seed';
import type { ArtKey } from '@/lib/art';

const FILTERS = ['전체', '최근', '즐겨찾기'] as const;

/** 내 노래 보관함 (deck p.9) */
export default function LibraryPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('전체');

  const songs =
    filter === '최근'
      ? SEED_LIBRARY.filter((s) => s.badge === '최근 재생')
      : SEED_LIBRARY;

  return (
    <Screen
      menu
      back={false}
      bell
      title="내 노래 보관함"
      subtitle="기억을 담은 나만의 노래들을 만나보세요"
      decoration={<Ornaments variant="leafRight" />}
      footer={
        <PrimaryButton
          href="/session/checklist"
          leading={
            <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/90">
              <IconPlus size={16} />
            </span>
          }
        >
          새 노래 만들기
        </PrimaryButton>
      }
    >
      <div className="flex gap-2.5" role="tablist" aria-label="보관함 필터">
        {FILTERS.map((f) => {
          const on = filter === f;
          return (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setFilter(f)}
              // 19px/800 -> WCAG "large text", so white on the vivid fill passes
              className={`min-h-[48px] flex-1 rounded-full px-3 text-[1.1875rem] font-extrabold ${
                on ? 'tk-cta text-white' : 'bg-brand-100 text-ink-700'
              }`}
            >
              {f}
            </button>
          );
        })}
      </div>

      <ul className="mt-4 space-y-3.5">
        {songs.map((song) => (
          <Card as="li" key={song.id} className="p-3.5">
            <div className="flex items-center gap-3.5">
              <ArtBox
                name={song.art as ArtKey}
                alt={`${song.title} 앨범 그림`}
                className="h-[96px] w-[96px] shrink-0 rounded-[16px] object-cover"
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <h2 className="min-w-0 flex-1 text-[1.3125rem] font-extrabold leading-tight text-ink-900">
                    {song.title}
                  </h2>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[0.8125rem] font-bold ${
                      song.badge === '최근 재생'
                        ? 'bg-leaf-100 text-leaf-700'
                        : 'bg-leaf-100 text-leaf-700'
                    }`}
                  >
                    {song.badge}
                  </span>
                </div>
                <p className="mt-1.5 flex items-center gap-1.5 text-[1rem] text-ink-500">
                  <IconMusicNote size={17} className="text-brand-400" />
                  {song.style}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[1rem] text-ink-500">
                  <IconCalendar size={17} className="text-ink-300" />
                  {formatDate(song.date)}
                </p>
              </div>

              <button
                type="button"
                aria-label={`${song.title} 재생`}
                className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full bg-surface-strong text-brand-600 shadow-[0_4px_12px_rgba(122,84,46,0.14)]"
              >
                <IconPlay size={24} />
              </button>
            </div>
          </Card>
        ))}
      </ul>

      {songs.length === 0 ? (
        <p className="mt-10 text-center text-[1rem] font-semibold text-ink-500">
          해당하는 노래가 없어요.
        </p>
      ) : null}
    </Screen>
  );
}
