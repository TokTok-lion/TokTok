'use client';

import { ArtBox } from '@/components/Art';
import { SampleShelf } from '@/components/SamplePlayer';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, PrimaryButton } from '@/components/ui';
import { IconMusicNote, IconPlus } from '@/components/icons';
import { MUSIC_STYLES } from '@/lib/domain';
import { useDeviceSong } from '@/lib/useDeviceSong';
import { useSession } from '@/lib/store';
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
 */
export default function LibraryPage() {
  const { s } = useSession();
  const mine = useDeviceSong();

  const styleName =
    MUSIC_STYLES.find((m) => m.id === s.style)?.name ?? '만든 분위기';

  return (
    <Screen
      menu
      back={false}
      bell
      title="내 노래 보관함"
      subtitle="기억을 담은 나만의 노래들을 만나보세요"
      decoration={<Ornaments variant="leafRight" />}
      footer={
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
      }
    >
      <h2 className="text-[1.1875rem] font-extrabold text-ink-900">만든 노래</h2>

      {mine ? (
        <Card className="mt-3 p-3.5">
          <div className="flex items-center gap-3.5">
            <ArtBox
              name={'album_briefcase_coins' as ArtKey}
              alt=""
              className="h-[76px] w-[76px] shrink-0 rounded-[16px] object-cover"
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-[1.0625rem] font-extrabold leading-tight text-ink-900">
                {s.topic}
              </h3>
              <span className="mt-1 inline-block rounded-full bg-leaf-100 px-2.5 py-0.5 text-[0.8125rem] font-bold text-leaf-700">
                이 기기에 있음
              </span>
              <p className="mt-1.5 flex items-center gap-1.5 text-[0.9375rem] text-ink-500">
                <IconMusicNote size={17} className="text-brand-400" />
                {styleName}
              </p>
            </div>
          </div>
          <audio src={mine} controls preload="metadata" className="mt-3 w-full" />
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
