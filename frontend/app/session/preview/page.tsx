'use client';

import { Ornaments, Screen } from '@/components/Shell';
import { Chevron, NoteBar, OutlineButton, PrimaryButton, Waveform } from '@/components/ui';
import { IconHeart, IconPlay, IconRefresh } from '@/components/icons';
import { useSession } from '@/lib/store';

const VERSIONS = [
  { id: 'A', name: '잔잔한 발라드', tone: 'brand' as const, seed: 3 },
  { id: 'B', name: '조금 더 경쾌하게', tone: 'brand' as const, seed: 8 },
  { id: 'C', name: '후렴 강조', tone: 'leaf' as const, seed: 14 },
] as const;

/** 노래 미리듣기 (deck p.15) */
export default function PreviewPage() {
  const { s, set } = useSession();

  return (
    <Screen
      menu
      back={false}
      bell
      title="노래 미리듣기"
      subtitle="마음에 드는 버전을 골라보세요"
      decoration={<Ornaments variant="notes" />}
      footer={
        <>
          <PrimaryButton
            href="/session/song"
            onClick={() => set('songStatus', 'complete')}
            trailing={<Chevron className="text-white" />}
          >
            이 버전으로 확정
          </PrimaryButton>
          <div className="mt-3">
            <OutlineButton
              href="/session/generating"
              trailing={<IconRefresh size={22} />}
            >
              다시 생성
            </OutlineButton>
          </div>
        </>
      }
    >
      <fieldset>
        <legend className="sr-only">노래 버전 선택</legend>
        <ul className="space-y-3.5">
          {VERSIONS.map((v) => {
            const on = s.previewChoice === v.id;
            return (
              <li key={v.id}>
                <label
                  className={`relative flex cursor-pointer items-center gap-3.5 rounded-[20px] p-4 transition-colors ${
                    on
                      ? 'bg-brand-50 ring-2 ring-brand-500'
                      : 'bg-surface shadow-[0_2px_10px_rgba(122,84,46,0.06)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="version"
                    checked={on}
                    onChange={() => set('previewChoice', v.id)}
                    className="sr-only"
                  />
                  <span
                    className={`flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full text-[1.5rem] font-extrabold ${
                      on
                        ? 'bg-brand-500 text-white'
                        : v.tone === 'leaf'
                          ? 'bg-leaf-100 text-leaf-700'
                          : 'bg-brand-100 text-brand-800'
                    }`}
                  >
                    {v.id}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.9375rem] font-bold text-brand-700">
                      버전 {v.id}
                    </span>
                    <span className="block text-[1.3125rem] font-extrabold leading-tight text-ink-900">
                      {v.name}
                    </span>

                    <span className="mt-2 flex items-center gap-2.5">
                      <button
                        type="button"
                        aria-label={`버전 ${v.id} 재생`}
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                          on
                            ? 'bg-brand-500 text-white'
                            : v.tone === 'leaf'
                              ? 'bg-white text-leaf-600 shadow'
                              : 'bg-white text-brand-600 shadow'
                        }`}
                      >
                        <IconPlay size={18} />
                      </button>
                      <Waveform
                        bars={30}
                        height={26}
                        tone={on ? 'brand' : v.tone === 'leaf' ? 'leaf' : 'muted'}
                        seed={v.seed}
                        className="flex-1 overflow-hidden"
                      />
                      <span className="shrink-0 text-[1rem] font-bold text-ink-500">
                        0:45
                      </span>
                    </span>
                  </span>

                  {on ? (
                    <span className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-brand-500">
                      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m5 13 4.5 4.5L19 7" />
                      </svg>
                    </span>
                  ) : null}
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className="mt-4">
        <NoteBar tone="brand" icon={<IconHeart size={19} className="text-brand-400" />}>
          어르신과 함께 가장 편안한 버전을 선택해요
        </NoteBar>
      </div>
    </Screen>
  );
}
