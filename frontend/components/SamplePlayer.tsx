'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArtBox } from './Art';
import { Card } from './ui';
import { IconMusicNote, IconPlay } from './icons';
import { SAMPLE_SONGS, samplesFor, sampleLength } from '@/lib/samples';
import { useSession } from '@/lib/store';
import type { ArtKey } from '@/lib/art';

/**
 * 예시 곡 재생.
 *
 * 오디오 하나만 두고 돌려 쓴다. 카드마다 따로 만들면 두 곡이 겹쳐 흐르는데,
 * 어르신 앞에서 그런 일이 나면 회기가 흐트러진다.
 *
 * preload 는 none 이다. 예시 파일은 합쳐 3MB가 넘고, 센터 와이파이에서
 * 아무도 듣지 않을 파일을 미리 받아 두는 건 그냥 손해다.
 */
function useSamplePlayer() {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  const toggle = useCallback(
    (id: string, src: string) => {
      let a = ref.current;
      if (!a) {
        a = new Audio();
        a.preload = 'none';
        a.addEventListener('ended', () => setPlaying(null));
        ref.current = a;
      }
      if (playing === id) {
        a.pause();
        setPlaying(null);
        return;
      }
      a.pause();
      a.src = src;
      a.currentTime = 0;
      void a
        .play()
        .then(() => setPlaying(id))
        .catch(() => setPlaying(null));
    },
    [playing],
  );

  // 화면을 떠나면 소리도 함께 멎어야 한다.
  useEffect(
    () => () => {
      ref.current?.pause();
      ref.current = null;
    },
    [],
  );

  return { playing, toggle };
}

function PlayGlyph({ on }: { on: boolean }) {
  if (!on) return <IconPlay size={24} />;
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1.4" />
      <rect x="14" y="5" width="4" height="14" rx="1.4" />
    </svg>
  );
}

/**
 * 보관함에 놓는 예시 선반.
 *
 * 어르신 곡과 같은 목록에 섞지 않는다. 섞이는 순간, 어느 것이 우리
 * 어르신 것인지 확인하려면 하나씩 눌러 봐야 한다.
 */
export function SampleShelf() {
  const { playing, toggle } = useSamplePlayer();

  return (
    <section className="mt-7">
      <h2 className="text-[1.1875rem] font-extrabold text-ink-900">예시로 들어보기</h2>
      <p className="mt-1.5 rounded-[12px] bg-surface-sunk px-3.5 py-2.5 text-[0.875rem] leading-relaxed text-ink-700">
        <strong>예시입니다.</strong> 어르신의 곡이 아니라, 같은 방식으로 미리
        만들어 둔 결과물이에요. 몇 번을 들으셔도 이번 달 곡 한도는 줄지 않아요.
      </p>

      <ul className="mt-3 space-y-3.5">
        {SAMPLE_SONGS.map((song) => {
          const on = playing === song.id;
          return (
            <Card as="li" key={song.id} className="p-3.5">
              <div className="flex items-center gap-3.5">
                <ArtBox
                  name={song.art as ArtKey}
                  alt=""
                  className="h-[76px] w-[76px] shrink-0 rounded-[16px] object-cover"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="text-[1.0625rem] font-extrabold leading-tight text-ink-900">
                    {song.title}
                  </h3>
                  <span className="mt-1 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-[0.8125rem] font-bold text-amber-700">
                    예시
                  </span>
                  <p className="mt-1.5 flex items-center gap-1.5 text-[0.9375rem] text-ink-500">
                    <IconMusicNote size={17} className="text-brand-400" />
                    {song.style} · {sampleLength(song.seconds)}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`${song.title} ${on ? '멈추기' : '재생'}`}
                  onClick={() => toggle(song.id, song.src)}
                  className={`flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full shadow-[0_4px_12px_rgba(122,84,46,0.14)] ${
                    on ? 'tk-cta text-white' : 'bg-surface-strong text-brand-600'
                  }`}
                >
                  <PlayGlyph on={on} />
                </button>
              </div>
            </Card>
          );
        })}
      </ul>

      <p className="mt-3 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
        네 곡 모두 같은 가사로 만들고 분위기만 다르게 한 결과예요. 같은
        이야기라도 어떤 분위기로 만드느냐에 따라 이만큼 달라집니다.
      </p>
    </section>
  );
}

/**
 * 스타일 고르기 화면의 미리듣기.
 *
 * 예전에는 눌러도 아무 소리가 안 났다. 어떤 소리가 나올지 모른 채 분위기를
 * 고르게 하는 셈이었는데, 그 다음 버튼이 요금이 나가는 버튼이라 더 나빴다.
 *
 * 그 다음에는 소리는 났는데 셋 다 발라드였다. 트로트를 고른 사람에게 발라드
 * 세 개를 들려주면 고르는 데 아무 도움이 안 되고, 화면도 "위에서 고른
 * 분위기와는 다를 수 있어요"라고 미리 발뺌해야 했다. 지금은 네 스타일에 한
 * 곡씩이라 고른 분위기를 그대로 들어 볼 수 있다 — 고른 것이 맨 앞에 온다.
 */
export function SamplePreviewRow() {
  const { playing, toggle } = useSamplePlayer();
  const { s } = useSession();
  const list = samplesFor(s.style);

  return (
    <>
      <ul className="mt-3 space-y-2">
        {list.map((song) => {
          const on = playing === song.id;
          const chosen = song.styleId === s.style;
          return (
            <li key={song.id}>
              <button
                type="button"
                onClick={() => toggle(song.id, song.src)}
                aria-label={`${song.style} 예시 ${on ? '멈추기' : '들어보기'}`}
                className={`flex min-h-[64px] w-full items-center gap-3 rounded-[16px] px-3 text-left shadow-[0_2px_10px_rgba(122,84,46,0.06)] ${
                  on ? 'bg-brand-100' : 'bg-surface'
                } ${chosen ? 'border-2 border-brand-400' : ''}`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${
                    on
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-brand-400 text-brand-600'
                  }`}
                >
                  {on ? (
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                      <rect x="6" y="5" width="4" height="14" rx="1.4" />
                      <rect x="14" y="5" width="4" height="14" rx="1.4" />
                    </svg>
                  ) : (
                    <IconPlay size={15} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[1rem] font-bold text-ink-900">
                    {song.style}
                    {/* 고른 분위기를 글자로도 밝힌다. 테두리만으로는 색을
                        구별하기 어려운 분이 알 수 없다. */}
                    {chosen ? (
                      <span className="ml-1.5 text-[0.8125rem] font-extrabold text-brand-700">
                        고르신 분위기
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-[0.8125rem] text-ink-500">
                    {sampleLength(song.seconds)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-2.5 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
        미리 만들어 둔 예시 곡이라 들어도 요금이 들지 않아요. 네 곡 모두 같은
        가사로 만든 것이라, 분위기에 따라 어떻게 달라지는지 견줘 보실 수 있어요.
        어르신의 곡이 아니라 <strong>예시</strong>입니다.
      </p>
    </>
  );
}

