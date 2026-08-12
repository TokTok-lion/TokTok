'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArtBox } from '@/components/Art';
import { ConsentGate, missingConsents } from '@/components/ConsentGate';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, PrimaryButton } from '@/components/ui';
import { IconDoc, IconHeart, IconMusicNote } from '@/components/icons';
import { MUSIC_STYLES } from '@/lib/domain';
import { sceneFor } from '@/lib/scenes';
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
export default function GeneratingPage() {
  const { s, set } = useSession();
  const router = useRouter();
  const [pct, setPct] = useState(6);
  const scene = sceneFor(s.topic, s.cover);
  const music = useMusic();
  const started = useRef(false);
  const state = music.state;
  const failed =
    state.kind === 'error' ||
    state.kind === 'needsPaidPlan' ||
    state.kind === 'quotaSpent';

  /*
   * 이미 있던 곡을 그대로 쓰는 경우.
   *
   * 예전에는 이때도 진행률이 6% → 100% 로 뛰고 '노래가 완성됐어요'가 떴다.
   * 만든 적이 없는데 방금 만든 것처럼 보이는 화면이었다 — 복지사는 요금이
   * 나갔다고 믿고, 어르신께는 1~3분 걸린다고 말해 놓고 1초 만에 끝난다.
   * 있는 곡을 쓰는 것은 좋은 일이니 그렇다고 적으면 된다.
   */
  const reused = state.kind === 'reused';
  const finished = state.kind === 'done' || reused;

  /*
   * 동의가 없어 막힌 경우는 고장이 아니다.
   *
   * 회기를 시작하면 동의는 전부 unset 으로 서므로(store.beginSession), 실제
   * 기관 회기는 대부분 여기서 먼저 막힌다. 그런데 이 화면은 그것을 다른
   * 실패와 똑같이 '다시 시도'로 안내했다 — 다시 눌러도 똑같이 막히니 그건
   * 막다른 길이다. 왜 막혔는지, 대신 무엇을 할 수 있는지, 동의를 여쭈러
   * 어디로 가면 되는지는 공통 조각이 말해 준다.
   */
  const missing = missingConsents(s.elder.consents, ['externalAi']);
  const blocked = missing.length > 0;

  // 곡 없이 이 단계를 닫고 가사 카드로 간다. 표시를 남기지 않으면 7단계가
  // 영원히 미완료로 남아 오늘 화면이 '다음 할 일: 노래 만들기'를 계속
  // 내밀고, 회기가 9/9 로 끝나지 못한다(lib/flow.ts).
  const goLyricCard = () => {
    set('songStatus', 'complete');
    router.push('/session/lyric-card');
  };

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
    if (state.kind !== 'working') return;
    const t = setInterval(() => setPct((p) => (p >= 96 ? 96 : p + 1)), 900);
    return () => clearInterval(t);
  }, [state.kind]);

  useEffect(() => {
    if (state.kind !== 'done' && state.kind !== 'reused') return;
    // 이미 있는 곡이라는 안내는 한 줄 더 읽어야 하니 조금 더 머문다.
    const wait = state.kind === 'reused' ? 1600 : 900;
    const t = setTimeout(() => router.push('/session/preview'), wait);
    return () => clearTimeout(t);
  }, [state.kind, router]);

  // 끝났을 때의 100%는 상태에서 바로 나온다. 따로 담아 두면 둘이 어긋난다.
  const shown = state.kind === 'done' ? 100 : pct;

  /*
   * 앞의 두 칸은 done:true 로 박혀 있었다.
   *
   * 그래서 확인된 이야기가 0건이고 스타일도 고르지 않은 회기에서 "이야기 확인
   * 완료 / 음악 스타일 선택 완료"가 초록 체크로 떴다 — 복지사가 하지 않은 일을
   * 했다고 말하는 화면이었다. 두 칸도 나머지 하나처럼 실제 값을 본다.
   *
   * 스타일은 특정 기본값과 비교하지 않고 MUSIC_STYLES 에서 찾히는지로만
   * 판단한다. 회기 시작 시의 style 값이 바뀌는 중이라(lib/store), 그 값을
   * 직접 알고 있는 코드를 여기 두면 곧 어긋난다.
   */
  const chosenStyle = MUSIC_STYLES.find((m) => m.id === s.style);

  /** 세 번째 칸은 지금 실제로 무슨 일이 있었는지에 따라 문구가 달라진다. */
  const trail = [
    {
      label: s.storyConfirmed ? '이야기\n확인 완료' : '이야기\n확인 전',
      done: s.storyConfirmed,
    },
    {
      label: chosenStyle ? '음악 스타일\n선택 완료' : '음악 스타일\n고르기 전',
      done: Boolean(chosenStyle),
    },
    {
      label: blocked
        ? '동의가 없어\n만들지 않음'
        : reused
          ? '이미 있는 곡\n확인'
          : finished
            ? '곡 생성 완료'
            : '곡 생성 중',
      done: finished,
    },
  ];

  const R = 54;
  const C = 2 * Math.PI * R;

  return (
    <Screen
      back={false}
      /* 제목도 사실을 따라간다. 만들지 않은 화면이 '만드는 중'이면 안 된다. */
      title={blocked ? '노래를 만들지 않았어요' : reused ? '이미 만들어 둔 노래' : '노래 만드는 중'}
      decoration={<Ornaments variant="notes" />}
      footer={
        blocked ? (
          <PrimaryButton onClick={goLyricCard} leading={<IconDoc size={22} />}>
            가사 카드로 진행
          </PrimaryButton>
        ) : failed ? (
          /* 막다른 길을 두지 않는다. 곡이 안 나와도 가사 카드까지는
             어르신께 드릴 수 있고, 그 길을 여기서 열어 준다. */
          <>
            <p
              role="alert"
              className="mb-2.5 rounded-[12px] bg-surface-sunk px-3.5 py-3 text-[0.9375rem] font-bold leading-relaxed text-ink-900"
            >
              {state.kind === 'needsPaidPlan' ||
              state.kind === 'error' ||
              state.kind === 'quotaSpent'
                ? state.message
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
                onClick={goLyricCard}
                className="tk-cta min-h-[56px] rounded-[14px] text-[1rem] font-extrabold text-white"
              >
                가사 카드로 진행
              </button>
            </div>
          </>
        ) : (
          <div
            role="status"
            className="flex min-h-[60px] items-center justify-center gap-2.5 rounded-[16px] bg-surface-sunk text-[1.125rem] font-bold text-ink-500"
          >
            {reused ? null : (
              <span
                className="h-5 w-5 rounded-full border-[3px] border-brand-200 border-t-brand-500 motion-safe:animate-spin"
                aria-hidden
              />
            )}
            {reused
              ? '이미 있는 곡을 불러왔어요'
              : shown >= 100
                ? '노래가 완성됐어요'
                : '노래 생성 중'}
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
      {/* 그림은 이 이야기에 맞춰 고른 것이지 지금 그리는 것이 아니다.
          그리고 있다고 적으면 없는 기능을 있다고 하는 셈이 된다. */}
      <p className="mt-2 text-center text-[0.875rem] font-semibold text-ink-500">
        {s.topic} 이야기에 어울리는 그림이에요
      </p>

      {blocked ? (
        <ConsentGate
          className="mt-5"
          missing={missing}
          title="아직 곡을 만들 수 없어요"
          why="가사를 외부 음악 생성 사업자에 보내야 곡이 나와요. 어르신 생애가 담긴 문장이라 동의 없이는 보내지 않아요."
        />
      ) : reused ? (
        /* 만들지 않았으므로 진행률을 그리지 않는다. 0%에서 100%로 뛰는 원은
           그 자체가 "방금 만들었다"는 말이 된다. */
        <Card className="mt-5 p-4 text-center">
          <p className="text-[1.125rem] font-extrabold leading-relaxed text-ink-900">
            이 가사로 만든 노래가 이미 있어요
          </p>
          <p className="mt-2 text-[0.9375rem] font-semibold leading-relaxed text-ink-700">
            {state.kind === 'reused' && state.where === 'server'
              ? '다른 태블릿에서 만든 곡을 받아왔어요. 새로 만들지 않았으니 요금도 다시 나가지 않아요.'
              : '이 태블릿에 저장해 둔 곡이에요. 새로 만들지 않고 그대로 들려드려요.'}
          </p>
          <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-500">
            다른 느낌으로 바꾸고 싶으시면 미리듣기에서 다시 만들 수 있어요.
          </p>
        </Card>
      ) : (
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
                {shown >= 100 ? '곡 생성 완료' : '노래 생성 중...'}
              </p>
            </div>
          </div>
        </div>
      )}

      <ol className="mt-5 flex items-center justify-center gap-1.5">
        {trail.map((st, i) => (
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
                // 미완료 칸에는 3이 박혀 있었다. 세 번째 칸만 미완료일 수
                // 있다고 본 것인데, 이제 앞의 두 칸도 미완료로 설 수 있어
                // 1·2번 칸에 3이 뜬다. 자기 순번을 적는다.
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-[0.9375rem] font-extrabold text-white">
                  {i + 1}
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
            {i < trail.length - 1 ? (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="text-ink-300" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            ) : null}
          </li>
        ))}
      </ol>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[0.9375rem] font-semibold text-ink-700">
        {blocked
          ? '동의를 받으시면 여기서 바로 만들 수 있어요'
          : reused
            ? '바로 어르신께 들려드릴 수 있어요'
            : '잠시만 기다리면 어르신의 노래가 완성돼요'}
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
