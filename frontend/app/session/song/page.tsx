'use client';

import { Art, ArtBox } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, NoteBar, PrimaryButton, Waveform } from '@/components/ui';
import { IconDoc, IconPlay, IconRefresh, IconShield } from '@/components/icons';
import { MUSIC_STYLES } from '@/lib/domain';
import { sceneForTopic, songTitleForTopic } from '@/lib/scenes';
import { useSession } from '@/lib/store';

/**
 * 노래 완성 (deck p.26)
 *
 * The deck draws this frame once per topic with matching album art, so both
 * the artwork and the title come from the session topic (lib/scenes.ts).
 */
export default function SongPage() {
  const { s } = useSession();
  const style = MUSIC_STYLES.find((m) => m.id === s.style)?.name ?? '따뜻한 발라드';
  const scene = sceneForTopic(s.topic);
  const title = songTitleForTopic(s.topic);

  const actions = [
    { key: 'save', art: 'icon_save_box' as const, label: '저장하기' },
    { key: 'share', art: 'icon_people_green' as const, label: '가족과 공유' },
    { key: 'again', art: null, label: '다시 듣기' },
  ];

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

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            aria-label="완성된 노래 재생"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white shadow-[0_6px_16px_rgba(216,88,12,0.28)]"
          >
            <IconPlay size={22} />
          </button>
          <div className="min-w-0 flex-1">
            <Waveform bars={40} height={30} tone="brand" seed={6} className="overflow-hidden" />
            <p className="mt-1 text-[0.875rem] font-semibold text-ink-500">
              <span className="text-brand-700">0:18</span> / 2:32
            </p>
          </div>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            className="flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-[18px] bg-surface px-2 shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
          >
            {a.art ? (
              <Art name={a.art} size={40} alt="" />
            ) : (
              <IconRefresh size={38} className="text-leaf-600" />
            )}
            <span className="text-[0.9375rem] font-bold text-ink-900">{a.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-4">
        <NoteBar tone="leaf" icon={<IconShield size={20} />}>
          확인된 이야기만 담아 안전하게 만들었어요
        </NoteBar>
      </div>

      <p className="mt-3 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
        가족과 공유는 어르신이 허용한 범위 안에서만 열려요. 시설 재생 범위와
        가족 공유 범위는 따로 관리됩니다.
      </p>
    </Screen>
  );
}
