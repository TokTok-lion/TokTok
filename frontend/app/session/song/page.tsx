'use client';

import Link from 'next/link';
import { ArtBox } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, PrimaryButton } from '@/components/ui';
import { IconBook, IconDoc, IconPause, IconPlay, IconRefresh } from '@/components/icons';
import { MUSIC_STYLES, formatDuration } from '@/lib/domain';
import { sceneFor, songTitleForTopic } from '@/lib/scenes';
import { SongProvenance } from '@/components/SongProvenance';
import { StaleLyricsNote } from '@/components/StaleLyricsNote';
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
  // 고른 분위기가 없으면 이름을 지어내지 않는다(/session/preview 와 같은 규칙).
  const styleName = MUSIC_STYLES.find((m) => m.id === s.style)?.name ?? null;
  const scene = sceneFor(s.topic, s.cover);
  const title = songTitleForTopic(s.topic);
  const player = useSongPlayer();

  /*
   * 제목과 부제도 곡의 유무를 따라간다.
   *
   * 예전에는 머리말이 늘 '노래 완성 / 어르신의 이야기가 한 곡의 노래가
   * 되었어요'였다. 그래서 곡이 없는 회기에서 바로 아래 카드가 '이 기기에는
   * 아직 곡 파일이 없어요'라고 말하는데도 화면 맨 위는 완성됐다고 했다.
   * 한 화면 안에서 서로 반대되는 말이라, 복지사는 둘 중 하나를 믿게 된다.
   *
   * 불러오는 중에는 어느 쪽도 단정하지 않는다 — '완성'이라고 먼저 말했다가
   * 없는 것으로 밝혀져 물리는 것은, 없다고 말했다가 뒤집는 것과 똑같이 나쁘다.
   * 그래서 제목은 곡을 확인하기 전까지 아무것도 주장하지 않는 말로 두고,
   * 확인된 뒤에만 '노래 완성'으로 올라간다. 내려가는 일은 없다.
   */
  const heading = player.ready
    ? { title: '노래 완성', subtitle: '어르신의 이야기가 한 곡의 노래가 되었어요' }
    : player.loading
      ? { title: '어르신의 노래', subtitle: '이 기기에 있는 곡을 불러오고 있어요' }
      : { title: '어르신의 노래', subtitle: '아직 곡이 없어요. 가사 카드는 그대로 보실 수 있어요' };

  return (
    <Screen
      title={heading.title}
      subtitle={heading.subtitle}
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
            {styleName ? (
              <p className="mt-2 flex items-center gap-1.5 text-[1rem] font-bold text-leaf-700">
                {styleName}
                <span className="text-brand-400">♫</span>
              </p>
            ) : null}
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

      <StaleLyricsNote where="song" />

      {/*
        이 노래가 무엇으로 만들어졌는지.

        예전에는 여기 '확인된 이야기 N가지만 담아 안전하게 만들었어요' 한 줄이
        있었다. 맞는 말이지만 세어 둔 것의 일부만 쓰고 있었다 — 출처가 몇 곳
        인지, 근거를 못 찾아 몇 개를 버렸는지, 어느 대목의 음성이었는지가 전부
        남아 있는데 아무도 못 봤다. 버린 수까지 함께 적는 것이 핵심이다.
        걸러 냈다는 사실이야말로 이 서비스가 하는 일이다.

        곡이 있을 때만 띄운다. 곡이 없는 화면에서 '이 노래는'으로 시작하면
        바로 위 카드와 정반대로 말하게 된다.
      */}
      {player.ready ? <SongProvenance /> : null}

      {/* 저장됐다는 안내도 곡이 있을 때의 이야기다. 곡이 없는 화면에서
          '이미 저장됐어요'는 바로 위 카드와 정반대로 말한다. */}
      {player.ready ? (
        <p className="mt-3 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
          노래는 만들어질 때 이 태블릿에 이미 저장됐어요. 가족에게 보내는 기능은
          아직 없습니다 — 동의 범위(가족 공유·시설 재생)는 따로 관리되고 있고,
          보내는 기능이 준비되면 그 범위 안에서만 열립니다.
        </p>
      ) : null}
    </Screen>
  );
}
