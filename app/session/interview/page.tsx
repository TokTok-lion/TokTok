'use client';

import { useEffect, useRef, useState } from 'react';
import { Art } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chip, IconCircle, NoteBar, PrimaryButton, Waveform } from '@/components/ui';
import { IconMic, IconSave, IconShield, IconSkip } from '@/components/icons';
import { hasConsent } from '@/lib/domain';
import { SEED_INTERVIEW_PROMPTS } from '@/lib/seed';
import { useSession } from '@/lib/store';

// the deck's own glyphs (p.21), cut by scripts/prepare-ui-icons.py
const PROMPT_ART = { people: 'ui_people', smile: 'ui_reaction', gift: 'ui_gift' } as const;

/** 인터뷰 진행 중 (deck p.21) */
export default function InterviewPage() {
  const { s } = useSession();
  const [listening, setListening] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // 녹음 동의가 없으면 마이크는 시작조차 하지 않는다 (F-SW-INT-001)
  const canRecord = hasConsent(s.elder.consents, 'recording');

  useEffect(() => {
    if (!listening || !canRecord) return;
    timer.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [listening, canRecord]);

  return (
    <Screen
      bell
      title="인터뷰 진행 중"
      subtitle="질문을 천천히 읽고 이야기를 들어요"
      decoration={<Ornaments variant="notes" />}
      footer={
        <PrimaryButton href="/session/confirm" leading={<IconSave size={22} />}>
          이야기 저장
        </PrimaryButton>
      }
    >
      <div className="flex justify-center">
        <Chip tone="brand">
          <BagGlyph />
          <span className="ml-1.5">{s.topic}</span>
        </Chip>
      </div>

      <Card className="mt-3.5 px-4 pb-4 pt-5">
        <div className="flex justify-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-500 text-[1.25rem] font-black text-white">
            Q
          </span>
        </div>
        <h2 className="mt-3 text-center text-[1.5rem] font-extrabold leading-snug text-ink-900">
          첫 월급으로 무엇을 하셨나요?
        </h2>

        <ul className="mt-4 space-y-2.5">
          {SEED_INTERVIEW_PROMPTS.map((p) => {
            const art = PROMPT_ART[p.icon];
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex min-h-[64px] w-full items-center gap-3 rounded-[16px] border border-hairline bg-surface-strong px-3.5 text-left"
                >
                  <IconCircle tone={p.icon === 'smile' ? 'brand' : 'leaf'} size={42}>
                    <Art name={art} size={23} alt="" />
                  </IconCircle>
                  <span className="flex-1 text-[1.0625rem] font-bold text-ink-900">
                    {p.text}
                  </span>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-ink-300" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* mic */}
      <div className="mt-5 flex items-center justify-center gap-3">
        <Waveform bars={9} height={30} tone="muted" seed={3} />
        <button
          type="button"
          aria-pressed={listening}
          disabled={!canRecord}
          onClick={() => setListening((v) => !v)}
          className={`relative flex h-[124px] w-[124px] shrink-0 flex-col items-center justify-center gap-1 rounded-full text-white shadow-[0_10px_26px_rgba(216,88,12,0.35)] disabled:opacity-50 ${
            listening ? 'tk-cta' : 'bg-ink-500'
          }`}
        >
          {listening ? (
            <span
              className="absolute inset-[-12px] rounded-full bg-brand-500/20 motion-safe:animate-ping"
              aria-hidden
            />
          ) : null}
          <IconMic size={40} />
          {/* 19px/800 -> WCAG "large text" on the vivid orange fill */}
          <span className="text-[1.1875rem] font-extrabold">
            {!canRecord ? '녹음 불가' : listening ? '말씀 듣는 중' : '일시정지'}
          </span>
        </button>
        <Waveform bars={9} height={30} tone="muted" seed={11} />
      </div>

      <p className="mt-2 text-center text-[0.9375rem] font-semibold tabular-nums text-ink-500">
        {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} 녹음됨
      </p>

      <div className="mt-3 flex justify-center">
        <button
          type="button"
          className="flex min-h-[50px] items-center gap-2 rounded-full border-2 border-brand-300 bg-surface-strong px-6 text-[1.0625rem] font-bold text-brand-700"
        >
          질문 건너뛰기
          <IconSkip size={19} />
        </button>
      </div>

      <div className="mt-4">
        {canRecord ? (
          <NoteBar tone="leaf" icon={<IconShield size={20} />}>
            불편한 질문은 언제든 넘길 수 있어요
          </NoteBar>
        ) : (
          <NoteBar tone="brand" icon={<IconShield size={20} />}>
            녹음 동의가 없어 마이크를 켜지 않았어요. 복지사가 말씀을 받아 적어
            기록할 수 있어요.
          </NoteBar>
        )}
      </div>
    </Screen>
  );
}

function BagGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.4 8.2h15.2l-1 11.4H5.4Z" />
      <path d="M9 8.2V6.4a3 3 0 0 1 6 0v1.8" />
    </svg>
  );
}
