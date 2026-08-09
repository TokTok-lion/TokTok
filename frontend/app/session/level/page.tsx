'use client';

import { Art } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Chevron, NoteBar, PrimaryButton } from '@/components/ui';
import { IconLeaf } from '@/components/icons';
import { QUESTION_LEVELS, type QuestionLevel } from '@/lib/domain';
import { useSession } from '@/lib/store';
import type { ArtKey } from '@/lib/art';

const ART: Record<QuestionLevel, ArtKey> = {
  1: 'album_seaside',
  2: 'icon_speech_bubble',
  3: 'icon_book_open',
};

const DOT = {
  1: 'bg-brand-500 text-white',
  2: 'bg-amber-400 text-ink-900',
  3: 'bg-leaf-500 text-white',
} as const;

/** 질문 방식 선택 (deck p.12) */
export default function QuestionLevelPage() {
  const { s, set } = useSession();

  return (
    <Screen
      title="질문 방식 선택"
      subtitle="어르신 상태에 맞는 질문 단계를 고르세요"
      decoration={<Ornaments variant="leafRight" />}
      footer={
        <PrimaryButton
          href="/session/interview"
          trailing={<Chevron className="text-white" />}
        >
          이 질문 방식으로 진행
        </PrimaryButton>
      }
    >
      <fieldset>
        <legend className="sr-only">질문 단계 선택</legend>
        <ul className="space-y-3.5">
          {QUESTION_LEVELS.map((q) => {
            const on = s.questionLevel === q.level;
            return (
              <li key={q.level}>
                <label
                  className={`flex min-h-[128px] cursor-pointer items-center gap-3.5 rounded-[20px] p-4 transition-colors ${
                    on
                      ? 'bg-brand-50 ring-2 ring-brand-500'
                      : 'bg-surface shadow-[0_2px_10px_rgba(122,84,46,0.06)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="level"
                    checked={on}
                    onChange={() => set('questionLevel', q.level)}
                    className="sr-only"
                  />
                  <span
                    className={`flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full text-[1.375rem] font-extrabold ${
                      on ? 'bg-brand-500 text-white' : DOT[q.level]
                    }`}
                  >
                    {on ? (
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m5 13 4.5 4.5L19 7" />
                      </svg>
                    ) : (
                      q.level
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[1.375rem] font-extrabold text-ink-900">
                        <span className={on ? 'text-brand-700' : ''}>
                          {q.level}단계
                        </span>{' '}
                        {q.name}
                      </span>
                      {q.recommended ? (
                        // small badge text can't use the large-text exemption,
                        // so the fill darkens to keep white at 4.7:1
                        <span className="rounded-full bg-brand-700 px-2.5 py-1 text-[0.8125rem] font-bold text-white">
                          추천
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1.5 block text-[1rem] leading-snug text-ink-500">
                      {q.example}
                    </span>
                  </span>

                  <Art name={ART[q.level]} size={86} alt="" className="shrink-0" />
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className="mt-4">
        <NoteBar tone="leaf" icon={<IconLeaf size={20} className="text-leaf-600" />}>
          말문이 트이지 않으면 선택형부터 시작해요
        </NoteBar>
      </div>
    </Screen>
  );
}
