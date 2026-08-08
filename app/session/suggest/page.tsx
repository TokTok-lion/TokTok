'use client';

import { Art } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chevron, IconCircle, NoteBar, PrimaryButton } from '@/components/ui';
import { IconEdit, IconInfo } from '@/components/icons';
import { lyricInputs } from '@/lib/domain';
import { SEED_SUGGESTED_QUESTIONS } from '@/lib/seed';
import { useSession } from '@/lib/store';

/** AI 질문 추천 (deck p.22) */
export default function SuggestPage() {
  const { s } = useSession();
  // 추천 질문은 확인된 이야기에서만 파생된다 (NFR-AI-003)
  const verified = lyricInputs(s.story);
  const summary = verified.at(-2)?.text ?? verified[0]?.text ?? '';

  return (
    <Screen
      bell
      title="AI 질문 추천"
      subtitle="앞선 답변을 바탕으로 다음 질문을 골라요"
      decoration={<Ornaments variant="notes" />}
      footer={<PrimaryButton href="/session/interview">이 질문으로 진행</PrimaryButton>}
    >
      <Card className="flex items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[1rem] font-bold text-amber-700">
            <SparkGlyph />앞선 답변 요약
          </p>
          <p className="mt-1.5 text-[1.1875rem] font-extrabold leading-snug text-ink-900">
            {summary}
          </p>
        </div>
        <Art name="avatar_daughter" size={92} alt="" className="shrink-0" />
      </Card>

      <ul className="mt-4 space-y-3">
        {SEED_SUGGESTED_QUESTIONS.map((q, i) => (
          <li key={q}>
            <button
              type="button"
              className="flex min-h-[76px] w-full items-center gap-3.5 rounded-[20px] bg-surface px-4 text-left shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[1.25rem] font-extrabold text-brand-700">
                {i + 1}
              </span>
              <span className="flex-1 text-[1.125rem] font-bold leading-snug text-ink-900">
                {q}
              </span>
              <Chevron className="text-ink-300" />
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            className="flex min-h-[76px] w-full items-center gap-3.5 rounded-[20px] bg-surface-sunk px-4 text-left"
          >
            <IconCircle tone="leaf" size={44}>
              <IconEdit size={22} className="text-leaf-600" />
            </IconCircle>
            <span className="flex-1 text-[1.125rem] font-bold text-ink-900">
              직접 질문 바꾸기
            </span>
            <Chevron className="text-ink-300" />
          </button>
        </li>
      </ul>

      <div className="mt-4">
        <NoteBar tone="leaf" icon={<IconInfo size={20} className="text-leaf-600" />}>
          확인된 이야기만 바탕으로 질문을 추천해요
        </NoteBar>
      </div>
    </Screen>
  );
}

function SparkGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
      <path d="m12 2.6 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" />
    </svg>
  );
}
