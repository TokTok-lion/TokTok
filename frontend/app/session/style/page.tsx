'use client';

import { Art, ArtBox } from '@/components/Art';
import { SamplePreviewRow } from '@/components/SamplePlayer';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chevron, PrimaryButton } from '@/components/ui';
import { IconMusicNote } from '@/components/icons';
import { MUSIC_STYLES } from '@/lib/domain';
import { sceneForTopic, songTitleForTopic } from '@/lib/scenes';
import { useSession } from '@/lib/store';
import type { ArtKey } from '@/lib/art';

/** 음악 스타일 선택 (deck p.14) */
export default function StylePage() {
  const { s, set } = useSession();

  // 만들려는 곡의 제목·그림은 회기 주제에서 나온다(형제 화면 /session/song 과
  // 같은 해석기). 예전에는 '우리 가족의 탄생' + 부부 그림이 박혀 있어서,
  // 첫 월급 이야기를 만드는 중에도 다른 곡을 만드는 것처럼 보였다.
  //
  // 주제가 없는 회기는 제목이 '오늘의 노래', 그림은 기본 장면이 된다
  // (lib/scenes.ts). 서버에서 온 어르신에게 '—'가 붙던 시절에는 이 자리에
  // '— 이야기'가 곡 제목으로 떴는데, 이제 주제는 비어서 온다(lib/useElders.ts).
  const scene = sceneForTopic(s.topic);
  const title = songTitleForTopic(s.topic);
  const styleName = MUSIC_STYLES.find((m) => m.id === s.style)?.name;

  return (
    <Screen
      title="음악 스타일 선택"
      subtitle="이야기에 어울리는 분위기를 골라요"
      decoration={<Ornaments variant="leafRight" />}
      footer={
        <PrimaryButton
          href="/session/generating"
          disabled={!s.style}
          trailing={<Chevron className="text-white" />}
        >
          이 스타일로 노래 만들기
        </PrimaryButton>
      }
    >
      <Card className="flex items-center gap-3 p-3.5">
        {/* 주제마다 그림 비율이 달라(가로 560x193 ~ 세로 464x560) 폭만 잡으면
            카드 높이가 주제에 따라 널뛴다. 상자를 고정하고 안에서 맞춘다. */}
        <ArtBox
          key={scene.id}
          name={scene.art}
          alt={scene.alt}
          className="h-[92px] w-[124px] shrink-0"
          fit="contain"
        />
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[1.3125rem] font-extrabold text-ink-900">{title}</p>
          {/* 고른 분위기와 "아직 안 골랐다"는 안내가 같은 굵기·같은 색이면,
              읽는 사람에게는 둘 다 답으로 보인다. 아직 값이 아닌 자리는
              흐리게 둔다 — 골라야 채워지는 칸이라는 것이 눈에 보이도록. */}
          {styleName ? (
            <p className="mt-1 text-[1.0625rem] font-bold text-brand-700">{styleName}</p>
          ) : (
            <p className="mt-1 text-[1.0625rem] text-ink-500">분위기를 골라 주세요</p>
          )}
        </div>
      </Card>

      <h2 className="mt-5 flex items-center gap-2 text-[1.125rem] font-extrabold text-ink-900">
        <IconMusicNote size={20} className="text-brand-400" />
        분위기를 선택해 주세요
      </h2>

      <fieldset className="mt-3">
        <legend className="sr-only">음악 스타일</legend>
        <div className="grid grid-cols-2 gap-3">
          {MUSIC_STYLES.map((m) => {
            const on = s.style === m.id;
            return (
              <label
                key={m.id}
                className={`relative flex cursor-pointer flex-col items-center rounded-[18px] p-3.5 text-center transition-colors ${
                  on
                    ? 'bg-brand-50 ring-2 ring-amber-400'
                    : 'bg-surface shadow-[0_2px_10px_rgba(122,84,46,0.06)]'
                }`}
              >
                <input
                  type="radio"
                  name="style"
                  checked={on}
                  onChange={() => set('style', m.id)}
                  className="sr-only"
                />
                {on ? (
                  <span className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-brand-500">
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m5 13 4.5 4.5L19 7" />
                    </svg>
                  </span>
                ) : null}
                <Art name={m.art as ArtKey} size={126} alt="" />
                <span className="mt-2 text-[1.25rem] font-extrabold text-ink-900">
                  {m.name}
                </span>
                <span className="mt-1 whitespace-pre-line text-[0.875rem] leading-snug text-ink-500">
                  {m.description}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <h2 className="mt-5 flex items-center gap-2 text-[1.125rem] font-extrabold text-ink-900">
        <IconMusicNote size={20} className="text-brand-400" />
        미리 들어보기
      </h2>
      <SamplePreviewRow />

      <p className="mt-3 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
        특정 가수의 목소리나 창법을 따라 만들지 않아요. 분위기만 참고합니다.
      </p>
    </Screen>
  );
}
