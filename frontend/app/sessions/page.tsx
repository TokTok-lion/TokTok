'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Art } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, IconCircle, PrimaryButton } from '@/components/ui';
import {
  IconCalendar,
  IconClock,
  IconPlus,
} from '@/components/icons';
import { SEED_SCHEDULE } from '@/lib/seed';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const DAYS = [18, 19, 20, 21, 22, 23, 24];

// Row glyphs are the deck's own (p.17), cut by scripts/prepare-ui-icons.py
const KIND = {
  interview: { art: 'ui_people' as const, tone: 'leaf' as const, time: 'text-brand-700' },
  music: { art: 'ui_music' as const, tone: 'leaf' as const, time: 'text-amber-700' },
  log: { art: 'ui_pencil' as const, tone: 'leaf' as const, time: 'text-leaf-700' },
};

/** 회기 일정 (deck p.17) */
export default function SessionsPage() {
  const [selected, setSelected] = useState(21);

  return (
    <Screen
      title="회기 일정"
      subtitle="오늘의 세션 일정을 편하게 확인해요"
      decoration={<Ornaments variant="notes" />}
      footer={
        <PrimaryButton
          href="/session/checklist"
          leading={
            <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/90">
              <IconPlus size={16} />
            </span>
          }
        >
          새 일정 추가
        </PrimaryButton>
      }
    >
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="이전 달"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-700"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14.5 5 8 12l6.5 7" /></svg>
          </button>
          <p className="text-[1.25rem] font-extrabold text-ink-900">2025년 5월</p>
          <button
            type="button"
            aria-label="다음 달"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-700"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9.5 5 6.5 7-6.5 7" /></svg>
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1">
          {WEEK.map((w, i) => (
            <div
              key={w}
              className={`text-center text-[0.9375rem] font-bold ${
                i === 0 ? 'text-brand-700' : i === 6 ? 'text-[#1D4ED8]' : 'text-ink-700'
              }`}
            >
              {w}
            </div>
          ))}
          {DAYS.map((d, i) => {
            const on = d === selected;
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                aria-label={`5월 ${d}일`}
                onClick={() => setSelected(d)}
                className={`mx-auto mt-1.5 flex h-11 w-11 items-center justify-center rounded-full text-[1.1875rem] font-bold ${
                  on
                    ? 'tk-cta text-white'
                    : i === 0
                      ? 'text-brand-700'
                      : i === 6
                        ? 'text-[#1D4ED8]'
                        : 'text-ink-900'
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="mt-5 flex items-baseline justify-between">
        <h2 className="flex items-center gap-2 text-[1.125rem] font-extrabold text-ink-900">
          <IconCalendar size={22} className="text-brand-600" />
          오늘의 일정
        </h2>
        <p className="text-[0.9375rem] font-semibold text-ink-500">5월 {selected}일 (수)</p>
      </div>

      <ul className="mt-3 space-y-3">
        {SEED_SCHEDULE.map((item) => {
          const k = KIND[item.kind];
          return (
            <Card as="li" key={item.time} className="p-0">
              <Link
                href="/session/checklist"
                className="flex min-h-[86px] items-center gap-3.5 p-4"
              >
                <IconClock size={26} className={`shrink-0 ${k.time}`} />
                <span className={`text-[1.375rem] font-extrabold ${k.time}`}>
                  {item.time}
                </span>
                <span className="h-10 w-px shrink-0 bg-hairline" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[1.1875rem] font-extrabold text-ink-900">
                    {item.who} {item.what}
                  </span>
                  <span className="mt-0.5 block text-[0.9375rem] text-ink-500">
                    {item.detail}
                  </span>
                </span>
                <IconCircle tone={k.tone} size={44}>
                  <Art name={k.art} size={24} alt="" />
                </IconCircle>
              </Link>
            </Card>
          );
        })}
      </ul>

      <Card className="mt-4 flex items-center p-4">
        <div className="flex flex-1 items-center gap-3">
          <IconCircle tone="brand" size={48}>
            <Art name="ui_calendar_check" size={26} alt="" />
          </IconCircle>
          <p className="text-[0.9375rem] text-ink-500">
            오늘
            <span className="block text-[1.5rem] font-extrabold text-brand-700">
              3 <span className="text-[0.9375rem] font-semibold text-ink-500">건</span>
            </span>
          </p>
        </div>
        <span className="mx-2 h-12 w-px bg-hairline" />
        <div className="flex flex-1 items-center gap-3">
          <IconCircle tone="amber" size={48}>
            <Art name="ui_clipboard" size={26} alt="" />
          </IconCircle>
          <p className="text-[0.9375rem] text-ink-500">
            미완료
            <span className="block text-[1.5rem] font-extrabold text-amber-700">
              1 <span className="text-[0.9375rem] font-semibold text-ink-500">건</span>
            </span>
          </p>
        </div>
      </Card>
    </Screen>
  );
}
