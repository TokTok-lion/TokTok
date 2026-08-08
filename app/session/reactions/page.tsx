'use client';

import Link from 'next/link';
import { Art } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chevron, IconCircle, PrimaryButton } from '@/components/ui';
import { IconEdit, IconInfo } from '@/components/icons';
import { REACTIONS } from '@/lib/domain';
import { useSession } from '@/lib/store';
import type { ArtKey } from '@/lib/art';

/**
 * 관찰 반응 기록 (deck p.18)
 *
 * Only observable behaviour is recordable. There is deliberately no field
 * for mood, cognition, or clinical state — the spec forbids the product
 * from inferring those (원칙 7 · 비의료적 문화·인지활동).
 */
export default function ReactionsPage() {
  const { s, set, toggleReaction } = useSession();

  return (
    <Screen
      menu
      back={false}
      bell
      title="관찰 반응 기록"
      subtitle="오늘 보인 반응을 빠르게 남겨요"
      decoration={<Ornaments variant="leafRight" />}
      footer={<PrimaryButton href="/session/log">반응 기록 저장</PrimaryButton>}
    >
      <Card className="flex items-center gap-3.5 p-3.5">
        <Art name={s.elder.avatar as ArtKey} size={84} alt="" className="shrink-0" />
        <div className="min-w-0">
          <p className="text-[1.4375rem] font-extrabold text-ink-900">
            {s.elder.honorific}
          </p>
          <p className="mt-1 text-[1rem] text-ink-500">
            프로그램:{' '}
            <span className="font-bold text-leaf-700">가족에게 남기는 노래</span>
          </p>
        </div>
      </Card>

      <fieldset className="mt-5">
        <legend className="flex items-center gap-2 text-[1.0625rem] font-bold text-ink-900">
          오늘 보인 반응을 선택해 주세요
          <IconInfo size={19} className="text-brand-600" />
        </legend>

        <div className="mt-3 grid grid-cols-3 gap-3">
          {REACTIONS.map((r) => {
            const on = s.reactions.includes(r.id);
            return (
              <label
                key={r.id}
                className={`relative flex min-h-[132px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[16px] p-2 text-center transition-colors ${
                  on
                    ? 'bg-brand-50 ring-2 ring-brand-500'
                    : 'bg-surface shadow-[0_2px_10px_rgba(122,84,46,0.06)]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggleReaction(r.id)}
                  className="sr-only"
                />
                {on ? (
                  <span className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-brand-500">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m5 13 4.5 4.5L19 7" />
                    </svg>
                  </span>
                ) : null}
                <Art name={r.art as ArtKey} size={62} alt="" />
                <span className="text-[0.875rem] font-bold leading-tight text-ink-900">
                  {r.label}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-5">
        <label
          htmlFor="note"
          className="block text-[1.0625rem] font-bold text-ink-900"
        >
          짧은 메모
        </label>
        <div className="relative mt-2">
          <textarea
            id="note"
            rows={2}
            value={s.reactionNote}
            onChange={(e) => set('reactionNote', e.target.value)}
            placeholder="짧은 메모를 남겨보세요"
            className="w-full resize-none rounded-[16px] border border-hairline bg-surface-strong p-4 pr-12 text-[1rem] text-ink-900 placeholder:text-ink-500"
          />
          <IconEdit
            size={22}
            className="pointer-events-none absolute bottom-4 right-4 text-ink-300"
          />
        </div>
      </div>

      <Link
        href="/session/wrap"
        className="mt-4 flex min-h-[76px] items-center gap-3.5 rounded-[16px] bg-leaf-50 px-4"
      >
        <IconCircle tone="leaf" size={50}>
          <Art name="ui_next_topic" size={26} alt="" />
        </IconCircle>
        <span className="flex-1">
          <span className="block text-[0.9375rem] font-bold text-leaf-700">
            다음 추천
          </span>
          <span className="block text-[1.1875rem] font-extrabold text-ink-900">
            {s.nextTopic}
          </span>
        </span>
        <Chevron className="text-ink-300" />
      </Link>

      <p className="mt-3 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
        눈으로 본 행동만 기록해요. 기분이나 건강 상태를 자동으로 판단하지
        않습니다.
      </p>
    </Screen>
  );
}
