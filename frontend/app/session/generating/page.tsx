'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArtBox } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card } from '@/components/ui';
import { IconHeart, IconMusicNote } from '@/components/icons';
import { sceneForTopic } from '@/lib/scenes';
import { useSession } from '@/lib/store';

/**
 * 노래 만드는 중 (deck p.8)
 *
 * The deck draws this frame four times, once per story topic, each with its
 * own illustration (spec v1.5, 생애 장면 일러스트). The picture is therefore
 * chosen from what the elder actually talked about — see lib/scenes.ts — and
 * is not a slideshow.
 *
 * Music generation is asynchronous by requirement (NFR-PERF-004), so this
 * screen owns progress, and offers no dead-end: the step trail stays visible.
 */
const STEPS = [
  { label: '이야기\n확인 완료', done: true },
  { label: '음악 스타일\n선택 완료', done: true },
  { label: '곡 생성 중', done: false },
];

export default function GeneratingPage() {
  const { s, set } = useSession();
  const router = useRouter();
  const [pct, setPct] = useState(81);
  const scene = sceneForTopic(s.topic);

  useEffect(() => {
    set('songStatus', 'generating');
    const t = setInterval(() => {
      setPct((p) => (p >= 100 ? 100 : p + 1));
    }, 400);
    return () => clearInterval(t);
  }, [set]);

  useEffect(() => {
    if (pct < 100) return;
    set('songStatus', 'ready');
    const t = setTimeout(() => router.push('/session/preview'), 900);
    return () => clearTimeout(t);
  }, [pct, router, set]);

  const R = 54;
  const C = 2 * Math.PI * R;

  return (
    <Screen
      back={false}
      title="노래 만드는 중"
      decoration={<Ornaments variant="notes" />}
      footer={
        <div className="flex min-h-[60px] items-center justify-center gap-2.5 rounded-[16px] bg-surface-sunk text-[1.125rem] font-bold text-ink-500">
          <span
            className="h-5 w-5 rounded-full border-[3px] border-brand-200 border-t-brand-500 motion-safe:animate-spin"
            aria-hidden
          />
          {pct >= 100 ? '노래가 완성됐어요' : '노래 생성 중'}
        </div>
      }
    >
      <Card className="flex justify-center overflow-hidden p-3">
        <ArtBox
          key={scene.id}
          name={scene.art}
          alt={`${s.topic} — ${scene.alt}`}
          className="h-[214px] w-auto object-contain"
          fit="contain"
          priority
        />
      </Card>
      <p className="mt-2 text-center text-[0.875rem] font-semibold text-ink-500">
        {s.topic} 이야기로 그림을 그리고 있어요
      </p>

      <div
        className="mt-5 flex justify-center"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="노래 생성 진행률"
      >
        <div className="relative">
          <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
            <circle cx="70" cy="70" r={R} fill="none" stroke="#f7e6d2" strokeWidth="14" />
            <circle
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke="#fb7328"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - pct / 100)}
              transform="rotate(-90 70 70)"
              style={{ transition: 'stroke-dashoffset .4s linear' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-[2.125rem] font-extrabold leading-none text-ink-900">
              {pct}
              <span className="text-[1.125rem]">%</span>
            </p>
            <p className="mt-1 text-[0.8125rem] font-semibold text-ink-500">
              노래 생성 중...
            </p>
          </div>
        </div>
      </div>

      <ol className="mt-5 flex items-center justify-center gap-1.5">
        {STEPS.map((st, i) => (
          <li key={st.label} className="flex items-center gap-1.5">
            <div
              className={`flex h-[104px] w-[100px] flex-col items-center justify-center gap-2 rounded-[16px] px-1 text-center ${
                st.done ? 'bg-leaf-50' : 'bg-brand-50 ring-1 ring-brand-200'
              }`}
            >
              {st.done ? (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-leaf-600">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 13 4.5 4.5L19 7" />
                  </svg>
                </span>
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-[0.9375rem] font-extrabold text-white">
                  3
                </span>
              )}
              <span
                className={`whitespace-pre-line text-[0.8125rem] font-bold leading-tight ${
                  st.done ? 'text-leaf-700' : 'text-brand-700'
                }`}
              >
                {st.label}
              </span>
            </div>
            {i < STEPS.length - 1 ? (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="text-ink-300" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            ) : null}
          </li>
        ))}
      </ol>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[0.9375rem] font-semibold text-ink-700">
        잠시만 기다리면 어르신의 노래가 완성돼요
        <IconHeart size={17} className="text-brand-500" />
      </p>

      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={() => history.back()}
          className="inline-flex min-h-[44px] items-center gap-1 border-b-2 border-leaf-300 px-1 text-[1rem] font-bold text-leaf-700"
        >
          <IconMusicNote size={16} />
          이전 단계 보기
        </button>
      </div>
    </Screen>
  );
}
