'use client';

import Link from 'next/link';
import { ArtBox } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, NoteBar, PrimaryButton } from '@/components/ui';
import { IconBook, IconDoc, IconPause, IconPlay, IconRefresh, IconShield } from '@/components/icons';
import { MUSIC_STYLES, formatDuration } from '@/lib/domain';
import { sceneForTopic, songTitleForTopic } from '@/lib/scenes';
import { useSession } from '@/lib/store';
import { useSongPlayer } from '@/lib/useMusic';

/**
 * 노래 완성 (deck p.26)
 *
 * The deck draws this frame once per topic with matching album art, so both
 * the artwork and the title come from the session topic (lib/scenes.ts).
 *
 * 어르신께 완성된 노래를 처음 들려드리는 화면인데, 여기서 소리가 안 났다.
 * 재생 버튼에 핸들러가 없었고 '0:18 / 2:32' 는 그냥 적어 둔 글자였다. 곡은
 * 기기에 들어와 있었으므로(useMusic → saveSong), 없던 기능을 만든 게 아니라
 * 이미 있는 곡을 이 화면에 연결한 것이다.
 *
 * 아래 버튼도 정리했다. '저장하기'는 곡이 만들어질 때 이미 저장되므로 누를
 * 것이 없었고, '가족과 공유'는 앱에 공유 기능 자체가 없다. 동의 범위만
 * 있고 보내는 길이 없는데 버튼을 두면 복지사는 보냈다고 믿는다.
 */
export default function SongPage() {
  const { s } = useSession();
  const style = MUSIC_STYLES.find((m) => m.id === s.style)?.name ?? '따뜻한 발라드';
  const scene = sceneForTopic(s.topic);
  const title = songTitleForTopic(s.topic);
  const player = useSongPlayer();

  return (
    <Screen
      title="노래 완성"
      subtitle="어르신의 이야기가 한 곡의 노래가 되었어요"
      decoration={<Ornaments variant="notes" />}
      footer={
        <PrimaryButton href="/session/lyric-card" leading={<IconDoc size={22} />}>
          가사 카드 보기
        </PrimaryButton>
      }
    >
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <ArtBox
            key={scene.id}
            name={scene.art}
            alt={`${title} 앨범 그림 — ${scene.alt}`}
            className="h-[112px] w-[112px] shrink-0 rounded-[16px] object-cover"
            priority
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-[1.4375rem] font-extrabold leading-tight text-ink-900">
              {title}
            </h2>
            <p className="mt-2 flex items-center gap-1.5 text-[1rem] font-bold text-leaf-700">
              {style}
              <span className="text-brand-400">♫</span>
            </p>
          </div>
        </div>

        {player.ready ? (
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              aria-label={player.playing ? '노래 일시정지' : '완성된 노래 재생'}
              onClick={player.toggle}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white shadow-[0_6px_16px_rgba(216,88,12,0.28)]"
            >
              {player.playing ? <IconPause size={22} /> : <IconPlay size={22} />}
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
              <p className="mt-1.5 text-[0.9375rem] font-semibold tabular-nums text-ink-500">
                <span className="text-brand-700">{formatDuration(player.at)}</span>
                {player.total ? ` / ${formatDuration(player.total)}` : ''}
              </p>
            </div>
          </div>
        ) : player.loading ? (
          /* 읽는 중과 없는 것은 다르다. 한 박자 늦게 오는 답을 "없어요"로
             먼저 그리면, 곡이 있는 회기에서도 어르신 앞에 없다는 문장이
             떴다가 사라진다. */
          <p
            role="status"
            className="mt-4 rounded-[14px] bg-surface-sunk px-3.5 py-3 text-[1rem] font-bold leading-relaxed text-ink-900"
          >
            곡을 불러오는 중이에요. 잠시만 기다려 주세요.
          </p>
        ) : (
          <p className="mt-4 rounded-[14px] bg-surface-sunk px-3.5 py-3 text-[1rem] font-bold leading-relaxed text-ink-900">
            이 기기에는 아직 곡 파일이 없어요. 가사 카드는 그대로 보실 수 있어요.
          </p>
        )}
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={player.restart}
          disabled={!player.ready}
          className="flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-[18px] bg-surface px-2 shadow-[0_2px_10px_rgba(122,84,46,0.06)] disabled:bg-surface-sunk disabled:text-ink-500 disabled:shadow-none"
        >
          <IconRefresh size={38} className="text-leaf-600" />
          <span className="text-[0.9375rem] font-bold">처음부터 듣기</span>
        </button>
        <Link
          href="/library"
          className="flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-[18px] bg-surface px-2 shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
        >
          <IconBook size={38} className="text-brand-500" />
          <span className="text-[0.9375rem] font-bold text-ink-900">보관함에서 듣기</span>
        </Link>
      </div>

      <div className="mt-4">
        <NoteBar tone="leaf" icon={<IconShield size={20} />}>
          확인된 이야기만 담아 안전하게 만들었어요
        </NoteBar>
      </div>

      <p className="mt-3 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
        노래는 만들어질 때 이 태블릿에 이미 저장됐어요. 가족에게 보내는 기능은
        아직 없습니다 — 동의 범위(가족 공유·시설 재생)는 따로 관리되고 있고,
        보내는 기능이 준비되면 그 범위 안에서만 열립니다.
      </p>
    </Screen>
  );
}
