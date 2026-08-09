'use client';

import { Art } from '@/components/Art';
import { ServerSaveNote } from '@/components/ServerSaveNote';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chip, OutlineButton, PrimaryButton } from '@/components/ui';
import { IconBulb, IconDoc, IconEdit, IconSmile } from '@/components/icons';
import { REACTIONS } from '@/lib/domain';
import { useSession } from '@/lib/store';
import type { ArtKey } from '@/lib/art';

/** 회기 마무리 (deck p.29) */
export default function WrapPage() {
  const { s, set } = useSession();
  const selected = REACTIONS.filter((r) => s.reactions.includes(r.id));

  return (
    <Screen
      bell
      title="회기 마무리"
      subtitle="오늘의 반응과 다음 주제를 함께 정리해요"
      decoration={<Ornaments variant="notes" />}
      footer={
        <>
          {/* 활동일지 저장은 이 화면으로 넘어오면서 뒤에서 끝난다.
              결과를 여기서 말해 주지 않으면 아무도 못 본다. */}
          <div className="mb-3 empty:mb-0">
            <ServerSaveNote retry />
          </div>
          <div className="mb-3">
            <OutlineButton href="/session/log" leading={<IconDoc size={22} />}>
              초안 다시 보기
            </OutlineButton>
          </div>
          <PrimaryButton
            href="/home"
            leading={
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/25">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 13 4.5 4.5L19 7" />
                </svg>
              </span>
            }
          >
            저장하고 종료
          </PrimaryButton>
        </>
      }
    >
      <Card className="flex items-center gap-3 p-3">
        <Art name={s.elder.avatar as ArtKey} size={68} alt="" className="shrink-0" />
        <div className="min-w-0">
          <p className="text-[1.25rem] font-extrabold text-ink-900">
            {s.elder.honorific}
          </p>
          <p className="mt-0.5 text-[1.0625rem] text-ink-500">{s.topic}</p>
        </div>
      </Card>

      <Card className="mt-4 p-4">
        <div className="flex items-center gap-3">
          <StepDot n={1} />
          <h2 className="flex-1 text-[1.1875rem] font-extrabold text-ink-900">
            오늘의 반응
          </h2>
          <IconSmile size={24} className="text-brand-600" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {selected.map((r) => (
            <Chip key={r.id} tone="leaf">
              {r.label}
            </Chip>
          ))}
          {selected.length === 0 ? (
            <p className="text-[0.9375rem] text-ink-500">기록된 반응이 없어요.</p>
          ) : null}
        </div>
      </Card>

      <Card className="mt-3.5 p-4">
        <div className="flex items-center gap-3">
          <StepDot n={2} />
          <h2 className="flex-1 text-[1.1875rem] font-extrabold text-ink-900">
            다음 추천 주제
          </h2>
          <IconBulb size={24} className="text-amber-700" />
        </div>
        <p className="mt-3 flex items-center justify-center gap-2 rounded-[14px] bg-amber-100 py-3.5 text-[1.25rem] font-extrabold text-brand-700">
          <SparkGlyph />
          {s.nextTopic}
        </p>
      </Card>

      <Card className="mt-3.5 p-4">
        <div className="flex items-center gap-3">
          <StepDot n={3} />
          <h2 className="flex-1 text-[1.1875rem] font-extrabold text-ink-900">
            한 줄 메모
          </h2>
          <IconEdit size={22} className="text-leaf-600" />
        </div>
        <div className="mt-3 flex items-start gap-3 rounded-[14px] bg-surface-strong p-3.5">
          <Art name="leaf_branch_2" size={40} alt="" className="mt-0.5 shrink-0" />
          <label htmlFor="wrapNote" className="sr-only">
            회기 한 줄 메모
          </label>
          <textarea
            id="wrapNote"
            rows={2}
            value={s.wrapNote}
            onChange={(e) => set('wrapNote', e.target.value)}
            className="flex-1 resize-none bg-transparent text-[1.0625rem] font-medium leading-relaxed text-ink-900 outline-none"
          />
        </div>
      </Card>
    </Screen>
  );
}

function StepDot({ n }: { n: number }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[1.0625rem] font-extrabold text-brand-800">
      {n}
    </span>
  );
}

function SparkGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="m12 2.6 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" />
    </svg>
  );
}
