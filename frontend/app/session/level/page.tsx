'use client';

import { Art } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Chevron, NoteBar, PrimaryButton } from '@/components/ui';
import { IconLeaf } from '@/components/icons';
import { INTERVIEW_TRACKS, QUESTION_LEVELS, type QuestionLevel } from '@/lib/domain';
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
      {/*
        무엇을 여쭐 것인가 — 단계보다 앞에 놓는다.

        단계는 '어떻게' 묻느냐이고 갈래는 '무엇을' 묻느냐다. 복지사가 먼저
        정해야 하는 것은 뒤쪽이다. 장수복지관 관장님 지적에서 나온 축이다 —
        지난 이야기만 물으면 남는 것이 추억이고, 그분이 오늘 무엇을 하실 수
        있는 분인지는 아무 데도 안 남는다.
      */}
      <fieldset className="mb-6">
        <legend className="text-[1.0625rem] font-extrabold text-ink-900">
          오늘 무엇을 여쭐까요
        </legend>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {INTERVIEW_TRACKS.map((t) => {
            const on = s.track === t.id;
            return (
              <li key={t.id}>
                <label
                  className={`flex min-h-[112px] cursor-pointer flex-col justify-center rounded-[18px] border-2 p-4 ${
                    on ? 'border-brand-500 bg-brand-50' : 'border-hairline bg-surface'
                  }`}
                >
                  <input
                    type="radio"
                    name="track"
                    className="sr-only"
                    checked={on}
                    onChange={() => set('track', t.id)}
                  />
                  <span className="text-[1.125rem] font-extrabold text-ink-900">
                    {t.name}
                  </span>
                  <span className="mt-1 text-[0.875rem] leading-relaxed text-ink-700">
                    {t.what}
                  </span>
                  <span className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-500">
                    예) {t.example}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {s.track === 'strength' ? (
          <p className="mt-2.5 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
            강점 갈래는 기억 카드를 쓰지 않아요. 지금도 잘하시는 것 → 그 요령 →
            하고 싶으신 것 → 누군가에게 힘이 된 일 순으로 여쭙고, 마지막에
            부탁과 감사로 마칩니다.
          </p>
        ) : null}
      </fieldset>

      <fieldset>
        <legend className="text-[1.0625rem] font-extrabold text-ink-900">
          어떻게 여쭐까요
        </legend>
        <ul className="mt-3 space-y-3.5">
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
