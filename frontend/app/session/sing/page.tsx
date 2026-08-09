'use client';

import Link from 'next/link';
import { Art } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chip, NoteBar, PrimaryButton } from '@/components/ui';
import { IconMusicNote, IconPause, IconPlay, IconRefresh } from '@/components/icons';
import { MUSIC_STYLES, formatDuration } from '@/lib/domain';
import { useSession } from '@/lib/store';
import { useSongPlayer } from '@/lib/useMusic';

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
 * 이제 셋 다 회기에서 온다 — 주제는 s.topic, 후렴은 이번에 확정한 s.lyrics 의
 * 후렴 절, 소리와 시간은 기기에 저장된 실제 곡이다. 곡이나 가사가 없을 때는
 * 없다고 적는다. 있는 척하는 것보다 낫다.
 */
export default function SingPage() {
  const { s, set } = useSession();
  const style = MUSIC_STYLES.find((m) => m.id === s.style)?.name ?? '따뜻한 발라드';
  const player = useSongPlayer();

  // 함께 부르는 부분은 후렴이다. 후렴이 없는 가사면 첫 절을 쓴다.
  const chorus = s.lyrics.find((sec) => sec.tone === 'chorus') ?? s.lyrics[0] ?? null;

  // 길이를 못 읽는 파일이 있다. 그때는 눈금 없는 막대를 그리는 대신 위치
  // 조절을 아예 감춘다 — 어디로 가는지 모르는 손잡이는 없느니만 못하다.
  const total = Math.round(player.total);

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
        chorus ? '완성된 후렴을 모두 함께 따라 불러요' : '가사를 먼저 만들어 주세요'
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
          <p className="text-[1.25rem] font-extrabold leading-tight text-ink-900">
            {s.topic}
          </p>
          <p className="mt-1.5 flex items-center gap-2 text-[0.9375rem] font-bold text-leaf-700">
            스타일 <Chip tone="brand" size="sm">{style}</Chip>
          </p>
        </div>
      </Card>

      <Card className="relative mt-4 overflow-hidden px-4 py-6">
        <Art
          name="leaf_branch_1"
          size={76}
          alt=""
          className="absolute -right-3 top-2 opacity-70"
        />

        {chorus ? (
          <>
            <p className="text-center text-[1.0625rem] font-bold text-brand-700">
              · {chorus.label} ·
            </p>
            <p className="mt-3 text-center text-[1.6875rem] font-extrabold leading-[1.5] tracking-[-0.02em] text-ink-900">
              {chorus.lines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </p>
          </>
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
