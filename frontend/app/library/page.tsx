'use client';

import { useCallback, useEffect, useRef } from 'react';
import { ArtBox } from '@/components/Art';
import { SampleShelf, claimSound, releaseSound } from '@/components/SamplePlayer';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, PrimaryButton } from '@/components/ui';
import { IconMusicNote, IconPlus } from '@/components/icons';
import { MUSIC_STYLES } from '@/lib/domain';
import { sceneForTopic, songTitleForTopic } from '@/lib/scenes';
import { useDeviceSong } from '@/lib/useDeviceSong';
import { useSession } from '@/lib/store';
import { useActiveElder } from '@/lib/useActiveElder';
import type { ArtKey } from '@/lib/art';

/**
 * 내 노래 보관함 (deck p.9)
 *
 * 예전에는 예시 곡 세 개가 진짜 목록인 척 놓여 있었고, 재생 버튼은 눌러도
 * 아무 일이 없었다. 실제로 쓰는 서비스에서 그건 두 번 거짓말이다 — 만든
 * 적 없는 곡이 있다고 하고, 들려준다고 해 놓고 안 들려준다.
 *
 * 그래서 두 칸으로 나눴다. 위는 이 기기에 실제로 있는 곡, 아래는 예시라고
 * 밝힌 예시. 아래 것들은 진짜 소리가 난다.
 *
 * 두 칸이 소리까지 따로 놀았다. 위는 브라우저 기본 <audio controls>, 아래는
 * 자체 플레이어라 서로의 재생을 몰랐고, 어르신께 본인 노래를 들려드리는
 * 중에 예시를 누르면 둘이 겹쳐 흘렀다. 나눠 놓은 이유가 "어느 것이 우리
 * 어르신 것인지 알 수 있게"인데, 겹쳐 흐르면 그 이유가 무너진다.
 * 그래서 두 칸을 같은 소리 주인 자리(claimSound/releaseSound)에 묶었다.
 */
export default function LibraryPage() {
  const { s } = useSession();
  const mine = useDeviceSong();
  const elder = useActiveElder();

  const mineRef = useRef<HTMLAudioElement | null>(null);
  // 예시가 시작될 때 이 함수가 불려서 어르신 곡이 멎는다. 신원이 곧 소유권이라
  // 고정된 함수여야 한다 — 렌더마다 새로 만들면 releaseSound 가 남의 자리를
  // 비우거나 내 자리를 못 찾는다.
  const stopMine = useCallback(() => {
    mineRef.current?.pause();
  }, []);

  // 화면을 떠날 때 자리를 비운다. 내가 주인일 때만 비우므로, 이미 예시가
  // 주인이 된 뒤라면 그 재생은 건드리지 않는다.
  useEffect(() => () => releaseSound(stopMine), [stopMine]);

  // 분위기를 고르지 않은 회기도 있다(기관 회기는 비운 채로 시작한다). 그때는
  // '만든 분위기' 같은 자리표시를 넣지 않고 줄을 아예 그리지 않는다 —
  // 회기 화면(/session/preview·song)과 같은 규칙이다.
  const styleName = MUSIC_STYLES.find((m) => m.id === s.style)?.name ?? null;

  // 표지와 제목은 회기 화면(/session/song)과 같은 규칙(lib/scenes.ts)을 쓴다.
  // 여기만 서류가방 그림 한 장으로 고정돼 있어서, 같은 곡이 화면을 옮길 때마다
  // 다른 표지를 달고 나타났다.
  // 서버 어르신은 아직 주제가 '—'로 오므로(useElders.toSummary) 빈 값으로 본다.
  const topic = s.topic === '—' ? '' : s.topic;
  const scene = sceneForTopic(topic);
  const songTitle = songTitleForTopic(topic);

  return (
    <Screen
      title="내 노래 보관함"
      subtitle="기억을 담은 나만의 노래들을 만나보세요"
      decoration={<Ornaments variant="leafRight" />}
      footer={
        // 어르신을 고르지 않은 채로 이 문을 열면 회기 1단계가 참가자 없이
        // 시작된다. 그러면 7단계에서 songQuotaLeft() 가 null 을 돌려줘 곡
        // 한도 검사가 통째로 건너뛰어지고, uploadSong 도 실패해 서버 중복
        // 확인이 걸리지 않는다 — 기관 계정에서 크레딧만 계속 나간다.
        // /home·/session 과 같은 자물쇠를 여기에도 건다.
        elder === 'checking' ? (
          <PrimaryButton disabled>불러오는 중…</PrimaryButton>
        ) : elder === 'missing' ? (
          <PrimaryButton href="/elder">
            먼저 어르신을 골라 주세요
          </PrimaryButton>
        ) : (
          <PrimaryButton
            href="/session/checklist"
            leading={
              <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/90">
                <IconPlus size={16} />
              </span>
            }
          >
            새 노래 만들기
          </PrimaryButton>
        )
      }
    >
      <h2 className="text-[1.1875rem] font-extrabold text-ink-900">만든 노래</h2>

      {mine ? (
        <Card className="mt-3 p-3.5">
          <div className="flex items-center gap-3.5">
            <ArtBox
              name={scene.art as ArtKey}
              alt=""
              className="h-[76px] w-[76px] shrink-0 rounded-[16px] object-cover"
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-[1.0625rem] font-extrabold leading-tight text-ink-900">
                {songTitle}
              </h3>
              <span className="mt-1 inline-block rounded-full bg-leaf-100 px-2.5 py-0.5 text-[0.8125rem] font-bold text-leaf-700">
                이 기기에 있음
              </span>
              {styleName ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-[0.9375rem] text-ink-500">
                  <IconMusicNote size={17} className="text-brand-400" />
                  {styleName}
                </p>
              ) : null}
            </div>
          </div>
          <audio
            ref={mineRef}
            src={mine}
            controls
            preload="metadata"
            className="mt-3 w-full"
            // 어르신 곡이 시작되면 아래 예시를 멈춘다. 반대 방향은 예시
            // 플레이어가 claimSound 로 이 곡을 멈춘다.
            onPlay={() => claimSound(stopMine)}
            onPause={() => releaseSound(stopMine)}
            onEnded={() => releaseSound(stopMine)}
          />
        </Card>
      ) : (
        <Card className="mt-3 p-5 text-center">
          <p className="text-[1rem] font-bold text-ink-700">
            아직 이 기기에 저장된 곡이 없어요.
          </p>
          <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-500">
            회기를 마치고 노래를 만들면 여기에 남습니다. 어떤 소리가 나오는지
            먼저 보시려면 아래 예시를 들어 보세요.
          </p>
        </Card>
      )}

      <SampleShelf />
    </Screen>
  );
}
