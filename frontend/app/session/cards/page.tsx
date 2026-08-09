'use client';

import Link from 'next/link';
import { Art, ArtBox } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chevron, IconCircle, PrimaryButton } from '@/components/ui';
import { IconPeople } from '@/components/icons';
import { SEED_MEMORY_CARDS } from '@/lib/seed';
import { useSession } from '@/lib/store';
import type { ArtKey } from '@/lib/art';

/** 기억 카드 선택 (deck p.11) */
export default function MemoryCardsPage() {
  const { s, set } = useSession();

  return (
    <Screen
      title="기억 카드 선택"
      subtitle="어떤 기억부터 시작해볼까요?"
      decoration={<Ornaments variant="leafRight" />}
      footer={
        <PrimaryButton
          href="/session/level"
          disabled={!s.memoryCard}
          leading={
            <IconCircle tone="neutral" size={30}>
              <Art name="ui_heart" size={17} alt="" />
            </IconCircle>
          }
          trailing={<Chevron className="text-white" />}
        >
          이 카드로 질문 시작
        </PrimaryButton>
      }
    >
      <Card className="flex items-center gap-3.5 p-3.5">
        <Art name={s.elder.avatar as ArtKey} size={64} alt="" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[1.25rem] font-extrabold text-ink-900">
            {s.elder.honorific}
          </p>
          {/* 주제는 이 회기의 실제 값이다. 예전에는 '어린 시절 가장 행복했던
              순간'이 박혀 있어서, 직전 체크리스트 화면이 보여준 주제와 두 화면
              연속으로 어긋났다.
              실제 기관 회기는 주제 없이 시작한다(lib/useElders.ts). 그때
              '주제: —'를 적는 대신, 이 화면에서 무엇을 하면 되는지 적는다 —
              여기서 고른 카드가 곧 오늘의 질문이 된다. */}
          <p className="mt-1 text-[0.9375rem] text-ink-500">
            {s.topic ? (
              <>
                <span className="font-bold text-leaf-700">주제:</span> {s.topic}
              </>
            ) : (
              '오늘 주제는 없어요. 아래에서 고른 기억 카드가 질문이 됩니다.'
            )}
          </p>
        </div>
        {/* 주제는 어르신 목록에서 회기를 시작할 때 정해진다 — 앱 안에 따로
            고치는 화면이 없으므로 그 자리로 보낸다. 예전에는 아무 데도 가지
            않는 버튼이었다. */}
        <Link
          href="/elder"
          aria-label="어르신과 오늘 주제 바꾸기"
          className="flex h-[54px] w-[54px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-full bg-leaf-100 text-leaf-700"
        >
          <IconPeople size={19} />
          <span className="text-[0.75rem] font-bold">변경</span>
        </Link>
      </Card>

      <fieldset className="mt-4">
        <legend className="sr-only">기억 카드 선택</legend>
        <div className="grid grid-cols-2 gap-3">
          {SEED_MEMORY_CARDS.map((c, i) => {
            const on = s.memoryCard === c.id;
            const wide = i === SEED_MEMORY_CARDS.length - 1;
            return (
              <label
                key={c.id}
                className={`relative cursor-pointer overflow-hidden rounded-[18px] bg-surface shadow-[0_2px_10px_rgba(122,84,46,0.06)] transition-shadow ${
                  wide ? 'col-span-2' : ''
                } ${on ? 'ring-2 ring-brand-500' : ''}`}
              >
                <input
                  type="radio"
                  name="memoryCard"
                  value={c.id}
                  checked={on}
                  onChange={() => set('memoryCard', c.id)}
                  className="sr-only"
                />
                {on ? (
                  <span className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-brand-500">
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m5 13 4.5 4.5L19 7" />
                    </svg>
                  </span>
                ) : null}
                <span
                  className={`block pt-3.5 text-center text-[1.3125rem] font-extrabold ${
                    on ? 'text-brand-700' : 'text-ink-900'
                  } ${wide ? 'text-left pl-5' : ''}`}
                >
                  {c.label}
                </span>
                <ArtBox
                  name={c.art as ArtKey}
                  className={`${wide ? 'ml-auto h-[112px] w-auto pr-2' : 'h-[116px] w-full'} object-contain`}
                  fit="contain"
                  // the first row and the wide 명절 tile are the largest paint
                  priority={i < 2 || wide}
                />
              </label>
            );
          })}
        </div>
      </fieldset>

      <Card className="mt-4 flex items-center gap-3 p-4">
        <IconCircle tone="amber" size={48}>
          <Art name="ui_bulb" size={26} alt="" />
        </IconCircle>
        <p className="text-[1rem] leading-snug text-ink-700">
          카드를 먼저 보여드리면
          <br />
          기억을 <span className="font-bold text-brand-700">더 쉽게</span> 떠올릴
          수 있어요
        </p>
      </Card>
    </Screen>
  );
}
