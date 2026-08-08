'use client';

import { Art, ArtBox } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chevron, PrimaryButton } from '@/components/ui';
import { IconMusicNote, IconPlay } from '@/components/icons';
import { MUSIC_STYLES } from '@/lib/domain';
import { useSession } from '@/lib/store';
import type { ArtKey } from '@/lib/art';

/** 음악 스타일 선택 (deck p.14) */
export default function StylePage() {
  const { s, set } = useSession();

  return (
    <Screen
      bell
      title="음악 스타일 선택"
      subtitle="이야기에 어울리는 분위기를 골라요"
      decoration={<Ornaments variant="leafRight" />}
      footer={
        <PrimaryButton
          href="/session/generating"
          disabled={!s.style}
          trailing={<Chevron className="text-white" />}
        >
          이 스타일로 노래 만들기
        </PrimaryButton>
      }
    >
      <Card className="flex items-center gap-3 p-3.5">
        <ArtBox
          name="scene_couple_reading"
          className="w-[124px] shrink-0"
          fit="contain"
        />
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[1.3125rem] font-extrabold text-ink-900">
            우리 가족의 탄생
          </p>
          <p className="mt-1 text-[1.0625rem] font-bold text-brand-700">따뜻한 이야기</p>
        </div>
      </Card>

      <h2 className="mt-5 flex items-center gap-2 text-[1.125rem] font-extrabold text-ink-900">
        <IconMusicNote size={20} className="text-brand-400" />
        분위기를 선택해 주세요
      </h2>

      <fieldset className="mt-3">
        <legend className="sr-only">음악 스타일</legend>
        <div className="grid grid-cols-2 gap-3">
          {MUSIC_STYLES.map((m) => {
            const on = s.style === m.id;
            return (
              <label
                key={m.id}
                className={`relative flex cursor-pointer flex-col items-center rounded-[18px] p-3.5 text-center transition-colors ${
                  on
                    ? 'bg-brand-50 ring-2 ring-amber-400'
                    : 'bg-surface shadow-[0_2px_10px_rgba(122,84,46,0.06)]'
                }`}
              >
                <input
                  type="radio"
                  name="style"
                  checked={on}
                  onChange={() => set('style', m.id)}
                  className="sr-only"
                />
                {on ? (
                  <span className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-brand-500">
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m5 13 4.5 4.5L19 7" />
                    </svg>
                  </span>
                ) : null}
                <Art name={m.art as ArtKey} size={126} alt="" />
                <span className="mt-2 text-[1.25rem] font-extrabold text-ink-900">
                  {m.name}
                </span>
                <span className="mt-1 whitespace-pre-line text-[0.875rem] leading-snug text-ink-500">
                  {m.description}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <h2 className="mt-5 flex items-center gap-2 text-[1.125rem] font-extrabold text-ink-900">
        <IconMusicNote size={20} className="text-brand-400" />
        미리 들어보기
      </h2>
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {(['A', 'B', 'C'] as const).map((v) => (
          <button
            key={v}
            type="button"
            className="flex min-h-[64px] items-center gap-2 rounded-[16px] bg-surface px-2.5 text-left shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-brand-400 text-brand-600">
              <IconPlay size={14} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[0.875rem] font-bold text-ink-900">
                미리듣기 {v}
              </span>
              <span className="block text-[0.8125rem] text-ink-500">0:30</span>
            </span>
          </button>
        ))}
      </div>

      <p className="mt-3 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
        특정 가수의 목소리나 창법을 따라 만들지 않아요. 분위기만 참고합니다.
      </p>
    </Screen>
  );
}
