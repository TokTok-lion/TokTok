'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { Art } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chip, NoteBar, PrimaryButton } from '@/components/ui';
import {
  IconBack,
  IconMusicNote,
  IconPause,
  IconPlay,
  IconRefresh,
} from '@/components/icons';
import { MUSIC_STYLES, formatDuration } from '@/lib/domain';
import { useSession } from '@/lib/store';
import { useLyricCue, useSongPlayer } from '@/lib/useMusic';

/**
 * 함께 부르기 활동 (deck p.23)
 *
 * The spec (v1.6, F-SW-KAR-003) makes the karaoke experience app-complete:
 * everything needed to run the session lives on the tablet, with TV/beam
 * output demoted to an optional P2 extra.
 *
 * 회기에서 어르신 여러 분이 함께 보는 화면인데, 여기가 통째로 연출이었다.
 * 주제는 '가족에게 남기는 노래' 고정, 후렴은 씨앗 두 줄(SEED_CHORUS), 재생은
 * setInterval 로 2:10 까지 숫자만 올리는 타이머였다. 방금 만든 어르신 노래
 * 대신 남의 가사가 가장 큰 글씨로 떴고, 스피커에서는 아무 소리도 안 났다.
 *
 * 이제 셋 다 회기에서 온다 — 주제는 s.topic, 소리와 시간은 기기에 저장된
 * 실제 곡이다. 곡이나 가사가 없을 때는 없다고 적는다. 있는 척하는 것보다
 * 낫다.
 *
 * 가사도 후렴 한 절에서 전체로 늘렸다. 예전에는 후렴만 크게 띄워 놓고 2분
 * 내내 그대로였다 — 함께 부르는 화면에서 지금 어디를 부르는지 알 수 없었다.
 * 줄별 시각은 우리에게 없으므로(useMusic.useLyricCue) 지금 줄은 어림이고,
 * 어림이라는 것과 손으로 맞추는 길을 화면이 같이 내놓는다.
 */

/*
 * 줄 하나의 옷.
 *
 *   now  지금 부르는 줄 — 34px. 70~90대 어르신이 여럿이서 태블릿 하나를
 *        건너다보는 자리라, 지시대로 2rem 밑으로는 내려가지 않는다.
 *   near 바로 앞뒤 줄 — 다음에 뭐가 오는지 미리 보인다.
 *   far  나머지 — 흐리게. 다만 ink-500 은 배경 대비 5.1:1 이라, 흐려도
 *        읽으려면 읽힌다. 여기서 더 연하게 하면 AA 아래로 내려간다.
 *   flat 곡이 없어 '지금 줄'이라는 것이 아예 없는 경우. 아무 줄도 크게
 *        고르지 않고 전부 같은 크기로 둔다 — 고를 근거가 없다.
 */
const LINE_SKIN = {
  now: 'rounded-[16px] bg-brand-100 px-3 py-3 text-[2.125rem] font-extrabold leading-[1.35] tracking-[-0.02em] text-ink-900',
  near: 'px-3 text-[1.375rem] font-bold leading-snug text-ink-700',
  far: 'px-3 text-[1.125rem] font-semibold leading-snug text-ink-500',
  flat: 'px-3 text-[1.375rem] font-bold leading-relaxed text-ink-900',
} as const;

export default function SingPage() {
  const { s, set } = useSession();
  // 고른 적 없는 분위기를 이름 대어 말하지 않는다. 예전에는 폴백이 '따뜻한
  // 발라드'라, 스타일 화면에 들어가 본 적도 없는 회기가 발라드를 고른 것처럼
  // 보였다. 없으면 줄 자체를 그리지 않는다 (preview·song 과 같은 규칙).
  const style = MUSIC_STYLES.find((m) => m.id === s.style)?.name ?? null;
  const player = useSongPlayer();
  const cue = useLyricCue(s.lyrics, player);

  /*
   * 지금 줄을 짚는 것은 곡이 있을 때의 이야기다.
   *
   * 소리가 안 나는 기기에서 어느 줄을 크게 띄우면, 그 줄이 지금 부르는
   * 자리라고 말하는 셈이 된다. 짚을 근거가 없으면 짚지 않는다 — 가사는
   * 그대로 다 보이고, 아래 조작들도 통째로 감춘다.
   */
  const active = player.ready ? cue.index : -1;

  // 길이를 못 읽는 파일이 있다. 그때는 눈금 없는 막대를 그리는 대신 위치
  // 조절을 아예 감춘다 — 어디로 가는지 모르는 손잡이는 없느니만 못하다.
  const total = Math.round(player.total);

  /*
   * 지금 줄이 접혀 있으면 노래방이 아니다.
   *
   * scrollIntoView 는 창까지 함께 굴린다. 복지사가 아래 '다음 줄'에 손을
   * 얹고 있는데 페이지가 통째로 튀면 손이 엉뚱한 곳을 누른다. 그래서 가사
   * 상자의 scrollTop 만 직접 옮긴다. 부드럽게 굴리는 것은 CSS(scroll-smooth)
   * 에 맡긴다 — 전역 prefers-reduced-motion 규칙이 그때는 알아서 끈다.
   */
  const boxRef = useRef<HTMLDivElement | null>(null);
  const nowRef = useRef<HTMLParagraphElement | null>(null);
  useEffect(() => {
    const box = boxRef.current;
    const el = nowRef.current;
    if (!box || !el) return;
    box.scrollTop = el.offsetTop - (box.clientHeight - el.offsetHeight) / 2;
  }, [active]);

  /*
   * pressed 는 "켜져 있는 상태가 있는 버튼"에만 붙인다.
   *
   * 예전에는 두 버튼 모두 aria-pressed 를 받았다. '처음부터 듣기'는 누르면
   * 그때 한 번 일어나는 동작이지 켜고 끄는 스위치가 아닌데, 보조기기는 이
   * 버튼을 '눌리지 않은 토글'로 읽어 준다 — 아직 켜야 할 것이 남은 것처럼
   * 들린다. 상태가 없는 버튼은 상태를 말하지 않는 편이 맞다.
   */
  const tools = [
    {
      key: 'slow',
      art: 'icon_turtle_slow' as const,
      label: '천천히\n재생',
      onClick: player.toggleSlow,
      pressed: player.slow,
    },
    {
      key: 'again',
      art: null,
      label: '처음부터\n듣기',
      onClick: player.restart,
      pressed: undefined,
    },
  ];

  return (
    <Screen
      title="함께 부르기 활동"
      subtitle={
        cue.lines.length === 0
          ? '가사를 먼저 만들어 주세요'
          : player.ready
            ? '지금 부르는 줄이 크게 보여요'
            : '완성된 가사를 모두 함께 따라 불러요'
      }
      decoration={<Ornaments variant="leafRight" />}
      footer={
        <PrimaryButton
          href="/session/reactions"
          onClick={() => set('sangTogether', true)}
        >
          활동 마무리
        </PrimaryButton>
      }
    >
      <Card className="flex items-center gap-3.5 p-3.5">
        <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[18px] bg-brand-100">
          <IconMusicNote size={38} className="text-brand-500" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] font-bold text-leaf-700">주제</p>
          {/* 기관 어르신 기록에는 주제 칸이 없어 대개 비어 있다. 라벨만 남고
              값이 빈 줄은 화면이 무엇을 못 채운 것처럼 보이므로 그렇게 적는다. */}
          <p className="text-[1.25rem] font-extrabold leading-tight text-ink-900">
            {s.topic || (
              <span className="font-bold text-ink-500">주제 없이 진행한 회기예요</span>
            )}
          </p>
          {style ? (
            <p className="mt-1.5 flex items-center gap-2 text-[0.9375rem] font-bold text-leaf-700">
              스타일 <Chip tone="brand" size="sm">{style}</Chip>
            </p>
          ) : null}
        </div>
      </Card>

      <Card className="relative mt-4 overflow-hidden px-4 py-6">
        <Art
          name="leaf_branch_1"
          size={76}
          alt=""
          className="absolute -right-3 top-2 opacity-70"
        />

        {cue.lines.length > 0 ? (
          /* 가사 상자만 굴러가고 카드 밖은 가만히 있는다. relative 는
             scrollTop 계산의 기준(offsetParent)이기도 하다.

             높이를 260px 로 묶은 것은 아래 '이전 줄/다음 줄'을 화면 안으로
             끌어올리기 위해서다. 지금 줄이 아무리 크게 떠 있어도 맞추는
             버튼이 화면 밖에 있으면 아무도 못 맞춘다. */
          <div
            ref={boxRef}
            className="relative max-h-[260px] scroll-smooth overflow-y-auto"
          >
            {cue.lines.map((line, i) => {
              const now = i === active;
              const skin = now
                ? LINE_SKIN.now
                : active < 0
                  ? LINE_SKIN.flat
                  : Math.abs(i - active) === 1
                    ? LINE_SKIN.near
                    : LINE_SKIN.far;
              return (
                <div key={`${i}-${line.text}`}>
                  {line.opensSection ? (
                    <p
                      className={`text-center text-[0.9375rem] font-bold text-brand-700 ${
                        i === 0 ? '' : 'mt-5'
                      }`}
                    >
                      · {line.label} ·
                    </p>
                  ) : null}
                  {/* aria-live 는 일부러 두지 않았다. 줄이 넘어갈 때마다 읽어
                      주면 지금 나오고 있는 노래 위에 목소리가 겹친다. */}
                  <p
                    ref={now ? nowRef : undefined}
                    aria-current={now ? 'true' : undefined}
                    className={`mt-2 text-center ${skin}`}
                  >
                    {line.text}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          /* 막다른 길을 두지 않는다 — 가사를 만드는 화면으로 바로 보낸다. */
          <div className="text-center">
            <p className="text-[1.125rem] font-bold leading-relaxed text-ink-900">
              아직 이 회기의 가사가 없어요.
            </p>
            <Link
              href="/session/lyrics"
              className="mt-3 inline-flex min-h-[48px] items-center border-b-2 border-brand-300 px-1 text-[1.0625rem] font-bold text-brand-700"
            >
              가사 검수 화면으로 가기
            </Link>
          </div>
        )}

        {player.ready ? (
          <>
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                aria-label={player.playing ? '일시정지' : '재생'}
                onClick={player.toggle}
                className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-brand-500 text-white shadow-[0_8px_20px_rgba(216,88,12,0.3)]"
              >
                {player.playing ? <IconPause size={28} /> : <IconPlay size={28} />}
              </button>
            </div>

            <div className="mt-4">
              {total > 0 ? (
                <>
                  <label htmlFor="seek" className="sr-only">
                    재생 위치
                  </label>
                  {/* The visual track stays slim, but the control itself is 28px
                      tall so the pointer target clears WCAG 2.2 (NFR-A11Y-002). */}
                  <input
                    id="seek"
                    type="range"
                    min={0}
                    max={total}
                    value={Math.min(Math.round(player.at), total)}
                    onChange={(e) => player.seek(Number(e.target.value))}
                    className="h-7 w-full cursor-pointer appearance-none bg-transparent
                      [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full
                      [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-brand-500 [&::-webkit-slider-thumb]:shadow
                      [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full
                      [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:border-0
                      [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-brand-500"
                    style={
                      {
                        '--fill': `linear-gradient(90deg,#fb7328 ${(player.at / total) * 100}%,#f7e6d2 ${(player.at / total) * 100}%)`,
                      } as React.CSSProperties
                    }
                  /><style>{`
                    #seek::-webkit-slider-runnable-track { background: var(--fill); }
                    #seek::-moz-range-track { background: var(--fill); }
                  `}</style>
                </>
              ) : null}
              <p className="mt-2 text-center text-[1.0625rem] font-bold tabular-nums text-ink-500">
                <span className="text-brand-700">{formatDuration(player.at)}</span>
                {total > 0 ? ` / ${formatDuration(player.total)}` : ''}
              </p>
            </div>
          </>
        ) : player.loading ? (
          /* 아직 읽는 중이다. 이때 "곡이 없다"고 적으면, 여러 분이 함께 보는
             화면에서 없다는 말이 먼저 뜨고 뒤늦게 재생 버튼이 나타난다. */
          <p
            role="status"
            className="mt-5 rounded-[14px] bg-surface-sunk px-3.5 py-3 text-center text-[1rem] font-bold leading-relaxed text-ink-900"
          >
            곡을 불러오는 중이에요. 잠시만 기다려 주세요.
          </p>
        ) : (
          <p className="mt-5 rounded-[14px] bg-surface-sunk px-3.5 py-3 text-center text-[1rem] font-bold leading-relaxed text-ink-900">
            이 기기에 곡 파일이 없어 소리는 나오지 않아요. 가사를 보면서 함께
            부르실 수 있어요.
          </p>
        )}
      </Card>

      {/* 줄 맞춤 — 곡이 있을 때만. 소리가 없으면 맞출 대상도 없다. */}
      {player.ready && cue.lines.length > 0 ? (
        <Card className="mt-4 p-3.5">
          {/* 어림이라는 말을 화면이 먼저 한다. 이 문장이 없으면 이 표시는
              우리가 재지 않은 것을 잰 것처럼 내놓는 것이 된다. */}
          <p className="rounded-[12px] bg-amber-100/70 px-3.5 py-2.5 text-[0.875rem] font-semibold leading-relaxed text-amber-700">
            지금 줄은 글자 수로 어림잡은 자리예요. 실제 노래와 어긋날 수 있어요.
            어긋나면 아래 버튼으로 맞춰 주세요 — 한 번 맞추면 그 자리를 기준으로
            다음 줄들이 다시 잡혀요.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={cue.toPrev}
              disabled={!cue.canPrev}
              className="flex min-h-[68px] items-center justify-center gap-2 rounded-[16px] border-2 border-brand-300 bg-surface-strong text-[1.1875rem] font-extrabold text-brand-700 disabled:border-hairline disabled:bg-surface-sunk disabled:text-ink-500"
            >
              <IconBack size={24} />
              이전 줄
            </button>
            <button
              type="button"
              onClick={cue.toNext}
              disabled={!cue.canNext}
              className="flex min-h-[68px] items-center justify-center gap-2 rounded-[16px] border-2 border-brand-300 bg-surface-strong text-[1.1875rem] font-extrabold text-brand-700 disabled:border-hairline disabled:bg-surface-sunk disabled:text-ink-500"
            >
              다음 줄
              <IconBack size={24} className="rotate-180" />
            </button>
          </div>

          {cue.timed ? (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-[14px] bg-surface-sunk px-3.5 py-3">
              <span className="min-w-0">
                <span className="block text-[1rem] font-bold text-ink-900">
                  자동으로 줄 넘기기
                </span>
                <span className="mt-0.5 block text-[0.875rem] leading-snug text-ink-500">
                  {cue.auto
                    ? '곡 길이에 맞춰 저절로 넘어가요'
                    : '이전·다음 줄 버튼으로만 넘어가요'}
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={cue.auto}
                aria-label="자동으로 줄 넘기기"
                onClick={() => cue.setAuto(!cue.auto)}
                className={`relative h-[38px] w-[68px] shrink-0 rounded-full transition-colors ${
                  cue.auto ? 'bg-leaf-600' : 'bg-ink-300'
                }`}
              >
                <span
                  className={`absolute top-1 h-[30px] w-[30px] rounded-full bg-white transition-[left] ${
                    cue.auto ? 'left-[34px]' : 'left-1'
                  }`}
                />
              </button>
            </div>
          ) : (
            /* 길이를 못 읽는 파일에는 자동으로 넘길 근거가 아예 없다. 스위치를
               내놓고 아무 일도 안 일어나게 두는 대신, 못 한다고 적고 대신 할
               수 있는 것을 같은 자리에서 알린다. */
            <p className="mt-3 rounded-[12px] bg-surface-sunk px-3.5 py-2.5 text-[0.875rem] font-semibold leading-relaxed text-ink-700">
              이 곡은 길이를 읽지 못해 저절로 넘기지는 못해요. 위 버튼으로
              한 줄씩 넘겨 주세요.
            </p>
          )}
        </Card>
      ) : null}

      {player.ready ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {tools.map((tool) => (
            <button
              key={tool.key}
              type="button"
              aria-pressed={tool.pressed}
              onClick={tool.onClick}
              className={`flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-[18px] px-2 ${
                tool.pressed
                  ? 'bg-leaf-100 ring-2 ring-leaf-500'
                  : 'bg-surface shadow-[0_2px_10px_rgba(122,84,46,0.06)]'
              }`}
            >
              {tool.art ? (
                <Art name={tool.art} size={40} alt="" />
              ) : (
                <IconRefresh size={38} className="text-leaf-600" />
              )}
              <span className="whitespace-pre-line text-center text-[0.875rem] font-bold leading-tight text-ink-900">
                {tool.label}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4">
        <NoteBar tone="leaf" icon={<IconMusicNote size={19} className="text-leaf-600" />}>
          어르신이 편하게 따라 부를 수 있게 천천히 진행해요
        </NoteBar>
      </div>
    </Screen>
  );
}
