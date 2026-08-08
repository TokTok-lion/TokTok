'use client';

import { useEffect, useRef, useState } from 'react';
import { Art } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chip, NoteBar, PrimaryButton } from '@/components/ui';
import { IconHeart, IconMusicNote, IconPause, IconPlay, IconRefresh } from '@/components/icons';
import { MUSIC_STYLES, formatDuration } from '@/lib/domain';
import { SEED_CHORUS } from '@/lib/seed';
import { useSession } from '@/lib/store';

const TOTAL = 130; // 2:10

/**
 * 함께 부르기 활동 (deck p.23)
 *
 * The spec (v1.6, F-SW-KAR-003) makes the karaoke experience app-complete:
 * everything needed to run the session lives on the tablet, with TV/beam
 * output demoted to an optional P2 extra.
 */
export default function SingPage() {
  const { s } = useSession();
  const style = MUSIC_STYLES.find((m) => m.id === s.style)?.name ?? '따뜻한 발라드';
  const [playing, setPlaying] = useState(true);
  const [t, setT] = useState(42);
  const [slow, setSlow] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => setT((v) => (v >= TOTAL ? TOTAL : v + 1)), slow ? 1400 : 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, slow]);

  const tools = [
    {
      key: 'line',
      art: 'icon_mic_orange' as const,
      label: '한 줄씩\n따라부르기',
      onClick: () => setT(0),
    },
    {
      key: 'slow',
      art: 'icon_turtle_slow' as const,
      label: '천천히\n재생',
      onClick: () => setSlow((v) => !v),
      active: slow,
    },
    {
      key: 'again',
      art: null,
      label: '다시 듣기',
      onClick: () => setT(0),
    },
  ];

  return (
    <Screen
      bell
      title="함께 부르기 활동"
      subtitle="완성된 후렴을 모두 함께 따라 불러요"
      decoration={<Ornaments variant="leafRight" />}
      footer={<PrimaryButton href="/session/reactions">활동 마무리</PrimaryButton>}
    >
      <Card className="flex items-center gap-3.5 p-3.5">
        <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[18px] bg-brand-100">
          <IconMusicNote size={38} className="text-brand-500" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] font-bold text-leaf-700">주제</p>
          <p className="text-[1.25rem] font-extrabold leading-tight text-ink-900">
            가족에게 남기는 노래
          </p>
          <p className="mt-1.5 flex items-center gap-2 text-[0.9375rem] font-bold text-leaf-700">
            스타일 <Chip tone="brand" size="sm">{style}</Chip>
          </p>
        </div>
        <button
          type="button"
          aria-label="즐겨찾기"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-leaf-100 text-leaf-600"
        >
          <IconHeart size={22} />
        </button>
      </Card>

      <Card className="relative mt-4 overflow-hidden px-4 py-6">
        <Art
          name="leaf_branch_1"
          size={76}
          alt=""
          className="absolute -right-3 top-2 opacity-70"
        />
        <p className="text-center text-[1.0625rem] font-bold text-brand-700">· 후렴 ·</p>

        <p className="mt-3 text-center text-[1.6875rem] font-extrabold leading-[1.5] tracking-[-0.02em] text-ink-900">
          {SEED_CHORUS.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </p>

        <div className="mt-5 flex justify-center">
          <button
            type="button"
            aria-label={playing ? '일시정지' : '재생'}
            onClick={() => setPlaying((v) => !v)}
            className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-brand-500 text-white shadow-[0_8px_20px_rgba(216,88,12,0.3)]"
          >
            {playing ? <IconPause size={28} /> : <IconPlay size={28} />}
          </button>
        </div>

        <div className="mt-4">
          <label htmlFor="seek" className="sr-only">
            재생 위치
          </label>
          {/* The visual track stays slim, but the control itself is 28px tall
              so the pointer target clears WCAG 2.2 (NFR-A11Y-002). */}
          <input
            id="seek"
            type="range"
            min={0}
            max={TOTAL}
            value={t}
            onChange={(e) => setT(Number(e.target.value))}
            className="h-7 w-full cursor-pointer appearance-none bg-transparent
              [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full
              [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-brand-500 [&::-webkit-slider-thumb]:shadow
              [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full
              [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:border-0
              [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-brand-500"
            style={
              {
                '--fill': `linear-gradient(90deg,#fb7328 ${(t / TOTAL) * 100}%,#f7e6d2 ${(t / TOTAL) * 100}%)`,
              } as React.CSSProperties
            }
          /><style>{`
            #seek::-webkit-slider-runnable-track { background: var(--fill); }
            #seek::-moz-range-track { background: var(--fill); }
          `}</style>
          <p className="mt-2 text-center text-[1.0625rem] font-bold tabular-nums text-ink-500">
            <span className="text-brand-700">{formatDuration(t)}</span> /{' '}
            {formatDuration(TOTAL)}
          </p>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {tools.map((tool) => (
          <button
            key={tool.key}
            type="button"
            aria-pressed={tool.active}
            onClick={tool.onClick}
            className={`flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-[18px] px-2 ${
              tool.active
                ? 'bg-leaf-100 ring-2 ring-leaf-500'
                : 'bg-surface shadow-[0_2px_10px_rgba(122,84,46,0.06)]'
            }`}
          >
            {tool.art ? (
              <Art name={tool.art} size={40} alt="" />
            ) : (
              <IconRefresh size={38} className="text-leaf-600" />
            )}
            <span className="whitespace-pre-line text-center text-[0.875rem] font-bold leading-tight text-ink-900">
              {tool.label}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4">
        <NoteBar tone="leaf" icon={<IconMusicNote size={19} className="text-leaf-600" />}>
          어르신이 편하게 따라 부를 수 있게 천천히 진행해요
        </NoteBar>
      </div>
    </Screen>
  );
}
