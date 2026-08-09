'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArtBox } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chevron, NoteBar, OutlineButton, PrimaryButton } from '@/components/ui';
import { IconHeart, IconPause, IconPlay, IconRefresh } from '@/components/icons';
import { MUSIC_STYLES, formatDuration } from '@/lib/domain';
import { sceneForTopic, songTitleForTopic } from '@/lib/scenes';
import { useSession } from '@/lib/store';
import { askRegenerate, useSongPlayer } from '@/lib/useMusic';

/**
 * 노래 미리듣기 (deck p.15)
 *
 * 예전에는 A·B·C 세 버전을 고르게 했다. 그런데 곡은 한 번에 하나만 만들어
 * 진다 — 이름과 파형 seed 만 다른 상수 세 줄이었고, 재생 버튼에는 핸들러가
 * 없었으며, 고른 값(previewChoice)은 그 화면 밖 어디에서도 읽히지 않았다.
 * 어르신과 복지사가 '가장 편안한 버전'을 고르는 의식을 치르지만 무엇을
 * 골라도 결과가 같았고, 씨앗값이 'B' 라 아무것도 안 골라도 고른 것처럼
 * 보였다.
 *
 * 세 버전을 진짜로 만들려면 곡값이 세 배로 든다(한 곡 1,125크레딧). 그래서
 * 고르는 화면을 없애고, 만들어진 그 한 곡을 실제로 들려주는 화면으로 바꿨다.
 * 여기서 정할 것은 "이 곡으로 갈까요, 다시 만들까요" 하나다.
 */
export default function PreviewPage() {
  const { s, set } = useSession();
  const router = useRouter();
  const player = useSongPlayer();
  const [asking, setAsking] = useState(false);

  const style = MUSIC_STYLES.find((m) => m.id === s.style)?.name ?? '따뜻한 발라드';
  const scene = sceneForTopic(s.topic);
  const title = songTitleForTopic(s.topic);

  const remake = () => {
    askRegenerate();
    router.push('/session/generating');
  };

  return (
    <Screen
      title="노래 미리듣기"
      subtitle={
        player.loading
          ? '이 기기에 있는 곡을 불러오고 있어요'
          : player.ready
            ? '만들어진 노래를 함께 들어보세요'
            : '곡을 아직 받지 못했어요'
      }
      decoration={<Ornaments variant="notes" />}
      footer={
        /* 곡을 다 읽기 전에는 버튼을 내밀지 않는다. 예전에는 이 자리가 곧바로
           '곡 없음' 쪽으로 그려졌다가 한 박자 뒤에 통째로 바뀌었다. 어르신
           앞에서 그 찰나에 손이 닿으면, 곡이 멀쩡히 있는데도 다시 만들기로
           튕겨 요금이 한 번 더 나갔다. */
        player.loading ? (
          <div
            role="status"
            className="flex min-h-[60px] items-center justify-center gap-2.5 rounded-[16px] bg-surface-sunk text-[1.125rem] font-bold text-ink-500"
          >
            <span
              className="h-5 w-5 rounded-full border-[3px] border-brand-200 border-t-brand-500 motion-safe:animate-spin"
              aria-hidden
            />
            곡을 불러오는 중
          </div>
        ) : player.ready ? (
          <>
            <PrimaryButton
              href="/session/song"
              onClick={() => set('songStatus', 'complete')}
              trailing={<Chevron className="text-white" />}
            >
              이 곡으로 진행
            </PrimaryButton>

            {/* 다시 만들기는 실제로 곡을 한 번 더 만든다 = 요금이 한 번 더
                나간다. 손이 스쳐서 나갈 돈이 아니므로 한 번 더 여쭙는다. */}
            <div className="mt-3">
              {asking ? (
                <div className="rounded-[16px] bg-surface-sunk p-3.5">
                  <p className="text-[1rem] font-bold leading-relaxed text-ink-900">
                    같은 가사로 노래를 한 곡 더 만듭니다. 만드는 데 1~3분이
                    걸리고, 곡 이용 요금이 한 번 더 나가요.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAsking(false)}
                      className="min-h-[56px] rounded-[14px] border border-hairline bg-surface text-[1rem] font-bold text-ink-700"
                    >
                      그만두기
                    </button>
                    <button
                      type="button"
                      onClick={remake}
                      className="tk-cta min-h-[56px] rounded-[14px] text-[1rem] font-extrabold text-white"
                    >
                      다시 만들기
                    </button>
                  </div>
                </div>
              ) : (
                <OutlineButton
                  onClick={() => setAsking(true)}
                  trailing={<IconRefresh size={22} />}
                >
                  다시 만들기
                </OutlineButton>
              )}
            </div>
          </>
        ) : (
          /* 막다른 길을 두지 않는다. 곡이 없어도 가사 카드는 드릴 수 있다. */
          <>
            <PrimaryButton href="/session/generating" trailing={<IconRefresh size={22} />}>
              다시 만들어 보기
            </PrimaryButton>
            <div className="mt-3">
              {/* 곡 없이 가사 카드로 가는 것도 이 단계를 끝내는 한 가지
                  방법이다. 여기서 표시를 남기지 않으면 7단계가 영원히
                  미완료로 남아, 오늘 화면이 '다음 할 일: 노래 만들기'를
                  계속 내밀고 회기가 9/9 로 끝나지 못한다. */}
              <OutlineButton
                href="/session/lyric-card"
                onClick={() => set('songStatus', 'complete')}
              >
                가사 카드로 진행
              </OutlineButton>
            </div>
          </>
        )
      }
    >
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <ArtBox
            key={scene.id}
            name={scene.art}
            alt={`${title} 앨범 그림 — ${scene.alt}`}
            className="h-[96px] w-[96px] shrink-0 rounded-[16px] object-cover"
            priority
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-[1.3125rem] font-extrabold leading-tight text-ink-900">
              {title}
            </h2>
            <p className="mt-1.5 flex items-center gap-1.5 text-[1rem] font-bold text-leaf-700">
              {style}
              <span className="text-brand-400">♫</span>
            </p>
          </div>
        </div>

        {player.ready ? (
          <div className="mt-4 flex items-center gap-3.5">
            <button
              type="button"
              aria-label={player.playing ? '노래 일시정지' : '노래 재생'}
              onClick={player.toggle}
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white shadow-[0_6px_16px_rgba(216,88,12,0.28)]"
            >
              {player.playing ? <IconPause size={26} /> : <IconPlay size={26} />}
            </button>
            <div className="min-w-0 flex-1">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-brand-100" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{
                    width: player.total ? `${(player.at / player.total) * 100}%` : '0%',
                  }}
                />
              </div>
              <p className="mt-1.5 text-[1rem] font-bold tabular-nums text-ink-500">
                <span className="text-brand-700">{formatDuration(player.at)}</span>
                {player.total ? ` / ${formatDuration(player.total)}` : ''}
              </p>
            </div>
          </div>
        ) : player.loading ? (
          <p
            role="status"
            className="mt-4 rounded-[14px] bg-surface-sunk px-3.5 py-3 text-[1rem] font-bold leading-relaxed text-ink-900"
          >
            곡을 불러오는 중이에요. 잠시만 기다려 주세요.
          </p>
        ) : (
          <p className="mt-4 rounded-[14px] bg-surface-sunk px-3.5 py-3 text-[1rem] font-bold leading-relaxed text-ink-900">
            이 기기에 곡이 아직 없어요. 곡 만들기가 끝나지 않았거나 실패했을 수
            있어요.
          </p>
        )}
      </Card>

      <div className="mt-4">
        <NoteBar tone="brand" icon={<IconHeart size={19} className="text-brand-400" />}>
          노래는 회기마다 한 곡을 만들어요. 마음에 안 드시면 다시 만들 수 있어요
        </NoteBar>
      </div>
    </Screen>
  );
}
