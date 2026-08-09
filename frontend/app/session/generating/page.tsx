'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArtBox } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card } from '@/components/ui';
import { IconHeart, IconMusicNote } from '@/components/icons';
import { sceneForTopic } from '@/lib/scenes';
import { useMusic } from '@/lib/useMusic';
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
  const { s } = useSession();
  const router = useRouter();
  const [pct, setPct] = useState(6);
  const scene = sceneForTopic(s.topic);
  const music = useMusic();
  const started = useRef(false);
  const failed =
    music.state.kind === 'error' ||
    music.state.kind === 'needsPaidPlan' ||
    music.state.kind === 'quotaSpent';

  // 곡 만들기는 한 번만 시작한다. 이중 마운트에서 두 번 부르면 요금이 두 번
  // 나가고, 둘 중 어느 결과가 남는지도 알 수 없다.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void music.generate();
    // music 은 렌더마다 새 객체라 의존성에 넣으면 매번 다시 돈다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 진행률은 실제 값이 아니라 경과 시간이다. 서버가 중간 상태를 주지 않으므로
  // 멈춰 보이지만 않게 올리고, 100%는 진짜 끝났을 때만 준다. 다 됐다고
  // 해 놓고 안 끝나는 것이 제일 나쁘다.
  useEffect(() => {
    if (music.state.kind !== 'working') return;
    const t = setInterval(() => setPct((p) => (p >= 96 ? 96 : p + 1)), 900);
    return () => clearInterval(t);
  }, [music.state.kind]);

  useEffect(() => {
    if (music.state.kind !== 'done') return;
    const t = setTimeout(() => router.push('/session/preview'), 900);
    return () => clearTimeout(t);
  }, [music.state.kind, router]);

  // 끝났을 때의 100%는 상태에서 바로 나온다. 따로 담아 두면 둘이 어긋난다.
  const shown = music.state.kind === 'done' ? 100 : pct;

  const R = 54;
  const C = 2 * Math.PI * R;

  return (
    <Screen
      back={false}
      title="노래 만드는 중"
      decoration={<Ornaments variant="notes" />}
      footer={
        failed ? (
          /* 막다른 길을 두지 않는다. 곡이 안 나와도 가사 카드까지는
             어르신께 드릴 수 있고, 그 길을 여기서 열어 준다. */
          <>
            <p
              role="alert"
              className="mb-2.5 rounded-[12px] bg-surface-sunk px-3.5 py-3 text-[0.9375rem] font-bold leading-relaxed text-ink-900"
            >
              {music.state.kind === 'needsPaidPlan' ||
              music.state.kind === 'error' ||
              music.state.kind === 'quotaSpent'
                ? music.state.message
                : ''}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPct(6);
                  void music.generate(true);
                }}
                className="min-h-[56px] rounded-[14px] border border-hairline bg-surface text-[1rem] font-bold text-ink-700"
              >
                다시 시도
              </button>
              <button
                type="button"
                onClick={() => router.push('/session/lyric-card')}
                className="tk-cta min-h-[56px] rounded-[14px] text-[1rem] font-extrabold text-white"
              >
                가사 카드로 진행
              </button>
            </div>
          </>
        ) : (
          <div className="flex min-h-[60px] items-center justify-center gap-2.5 rounded-[16px] bg-surface-sunk text-[1.125rem] font-bold text-ink-500">
            <span
              className="h-5 w-5 rounded-full border-[3px] border-brand-200 border-t-brand-500 motion-safe:animate-spin"
              aria-hidden
            />
            {shown >= 100 ? '노래가 완성됐어요' : '노래 생성 중'}
          </div>
        )
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
        aria-valuenow={shown}
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
              strokeDashoffset={C * (1 - shown / 100)}
              transform="rotate(-90 70 70)"
              style={{ transition: 'stroke-dashoffset .4s linear' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-[2.125rem] font-extrabold leading-none text-ink-900">
              {shown}
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
