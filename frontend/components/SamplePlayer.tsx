'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArtBox } from './Art';
import { Card } from './ui';
import { IconMusicNote, IconPlay } from './icons';
import { SAMPLE_SONGS, samplesFor, sampleLength } from '@/lib/samples';
import { useSession } from '@/lib/store';
import type { ArtKey } from '@/lib/art';

/**
 * 이 화면에서 소리를 내고 있는 쪽.
 *
 * 소리를 내는 주체가 둘 이상인데 서로를 모르면, 어르신 곡과 예시가 동시에
 * 흐른다. 그러면 어느 쪽이 우리 어르신 것인지 귀로 가릴 수 없다 —
 * 보관함에서 실제로 그랬다(위 '만든 노래'는 기본 <audio controls>,
 * 아래 예시 선반은 자체 플레이어라 서로 남의 재생을 몰랐다).
 *
 * 그래서 '지금 소리를 내는 하나'만 등록해 둔다. 새로 시작하는 쪽이
 * claimSound 로 앞사람을 멈추고 자리를 넘겨받는다. 소유자가 나일 때만
 * 놓는(releaseSound) 것이 중요하다 — 남의 재생을 내 정리 코드가 끊으면
 * 처음 문제와 방향만 반대인 같은 사고가 된다.
 *
 * 모듈 전역이라 화면 하나에 하나다. 라우트를 옮기면 각자 언마운트에서
 * 자기 것을 놓고 나가므로 다음 화면에 남지 않는다.
 */
type StopSound = () => void;
let soundOwner: StopSound | null = null;

/** 남이 내던 소리를 멈추고 소유권을 가져온다. */
export function claimSound(stop: StopSound) {
  if (soundOwner && soundOwner !== stop) soundOwner();
  soundOwner = stop;
}

/** 내가 소유자일 때만 놓는다. 남의 재생은 건드리지 않는다. */
export function releaseSound(stop: StopSound) {
  if (soundOwner === stop) soundOwner = null;
}

/**
 * 예시 곡 재생.
 *
 * 소리는 한 번에 하나만 살려 둔다. 카드마다 플레이어를 두면 두 곡이 겹쳐
 * 흐르는데, 어르신 앞에서 그런 일이 나면 회기가 흐트러진다.
 *
 * preload 는 none 이다. 예시 파일은 한 곡이 3.9~4.4MB고, 센터 와이파이에서
 * 아무도 듣지 않을 파일을 미리 받아 두는 건 그냥 손해다.
 *
 * 그런데 preload='none' 이라 play() 프라미스는 파일을 다 받은 뒤에야 풀린다.
 * 예전에는 그 프라미스가 풀린 다음에만 setPlaying 을 불렀다. 그래서
 *   · 누른 곡은 몇 초 동안 아무 표시도 안 났고(고장으로 보인다),
 *   · 그 사이 다른 곡을 누르면 먼저 누른 곡의 프라미스가 뒤늦게 풀리면서
 *     엉뚱한 곡에 '재생 중' 표시를 붙였다.
 * 그래서 loading 과 playing 을 나누고, 요청마다 일련번호를 매겨 늦게 온
 * 응답이 최신 표시를 덮지 못하게 한다. 실패도 화면에 내놓는다 — 아무 소리도
 * 안 나는데 화면이 조용하면 복지사는 태블릿을 의심한다.
 */
type SampleSound =
  | { kind: 'idle' }
  | { kind: 'loading'; id: string }
  | { kind: 'playing'; id: string }
  | { kind: 'error'; id: string };

function useSamplePlayer() {
  const elRef = useRef<HTMLAudioElement | null>(null);
  const [sound, setSound] = useState<SampleSound>({ kind: 'idle' });
  /** 요청 일련번호 — 늦게 도착한 프라미스를 가려내는 유일한 근거다. */
  const seq = useRef(0);
  const alive = useRef(true);

  /** 일련번호가 아직 최신일 때만 화면을 바꾼다. */
  const settle = useCallback((n: number, next: SampleSound) => {
    if (n !== seq.current || !alive.current) return;
    setSound(next);
  }, []);

  /** 소리 주인 자리에 등록해 두는 정지 함수. 신원이 곧 소유권이라 고정이다. */
  const halt = useCallback(() => {
    seq.current += 1; // 받는 중이던 곡이 뒤늦게 '재생 중'으로 켜지지 않게
    elRef.current?.pause();
    if (alive.current) setSound({ kind: 'idle' });
  }, []);

  const toggle = useCallback(
    (id: string, src: string) => {
      // 같은 곡을 다시 누르면 멈춘다. 아직 받는 중이어도 멈출 수 있어야 한다 —
      // 몇 초씩 걸리는 동안 취소할 길이 없으면 그건 막다른 길이다.
      if ((sound.kind === 'playing' || sound.kind === 'loading') && sound.id === id) {
        halt();
        releaseSound(halt);
        return;
      }

      // 어르신 곡이 흐르고 있으면 그쪽을 먼저 멈추고 자리를 넘겨받는다.
      claimSound(halt);
      // 내가 내던 앞 곡도 멎게 한다. claimSound 는 주인이 이미 나면 아무것도
      // 하지 않으므로, 곡을 바꿔 누르는 경우는 여기서 처리된다.
      halt();

      // 일련번호는 halt 뒤에 딴다 — halt 이 번호를 올리므로 순서를 바꾸면
      // 방금 딴 번호가 그 자리에서 낡아 버린다.
      const n = ++seq.current;

      // 곡마다 element 를 새로 만든다. 하나를 돌려 쓰며 src 만 갈아 끼우면
      // 앞 곡에 걸어 둔 이벤트가 새 곡 위로 떨어진다. 살아 있는 element 는
      // 여전히 하나뿐이라(앞 것은 위에서 멎었다) 두 곡이 겹치지 않는다.
      const el = document.createElement('audio');
      el.preload = 'none';
      el.onended = () => settle(n, { kind: 'idle' });
      el.onerror = () => settle(n, { kind: 'error', id });
      el.src = src;
      elRef.current = el;

      setSound({ kind: 'loading', id });
      void el.play().then(
        () => settle(n, { kind: 'playing', id }),
        () => settle(n, { kind: 'error', id }),
      );
    },
    [sound, halt, settle],
  );

  // 화면을 떠나면 소리도 함께 멎어야 한다. 자리도 비워 준다 — 안 비우면
  // 다음에 재생하는 쪽이 이미 사라진 플레이어를 멈추려 든다.
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      elRef.current?.pause();
      elRef.current = null;
      releaseSound(halt);
    };
  }, [halt]);

  return { sound, toggle };
}

/** 준비 중 표시. 소리가 없는 몇 초 동안 화면이 조용하지 않게. */
function LoadingRing({ size }: { size: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="rounded-full border-[3px] border-brand-200 border-t-brand-600 motion-safe:animate-spin"
    />
  );
}

function PlayGlyph({ state }: { state: 'idle' | 'loading' | 'playing' }) {
  if (state === 'loading') return <LoadingRing size={22} />;
  if (state === 'idle') return <IconPlay size={24} />;
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1.4" />
      <rect x="14" y="5" width="4" height="14" rx="1.4" />
    </svg>
  );
}

/** 버튼 라벨과 화면 문구를 한 곳에서 정한다 — 둘이 어긋나면 그게 거짓말이다. */
function stateOf(sound: SampleSound, id: string): 'idle' | 'loading' | 'playing' | 'error' {
  return sound.kind !== 'idle' && sound.id === id ? sound.kind : 'idle';
}

/**
 * 보관함에 놓는 예시 선반.
 *
 * 어르신 곡과 같은 목록에 섞지 않는다. 섞이는 순간, 어느 것이 우리
 * 어르신 것인지 확인하려면 하나씩 눌러 봐야 한다.
 */
export function SampleShelf() {
  const { sound, toggle } = useSamplePlayer();

  return (
    <section className="mt-7">
      <h2 className="text-[1.1875rem] font-extrabold text-ink-900">예시로 들어보기</h2>
      <p className="mt-1.5 rounded-[12px] bg-surface-sunk px-3.5 py-2.5 text-[0.875rem] leading-relaxed text-ink-700">
        <strong>예시입니다.</strong> 어르신의 곡이 아니라, 같은 방식으로 미리
        만들어 둔 결과물이에요. 몇 번을 들으셔도 이번 달 곡 한도는 줄지 않아요.
      </p>

      <ul className="mt-3 space-y-3.5">
        {SAMPLE_SONGS.map((song) => {
          const st = stateOf(sound, song.id);
          const on = st === 'playing';
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
                  aria-label={`${song.title} ${
                    on ? '멈추기' : st === 'loading' ? '소리 준비 중, 눌러서 취소' : '재생'
                  }`}
                  aria-busy={st === 'loading'}
                  onClick={() => toggle(song.id, song.src)}
                  className={`flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full shadow-[0_4px_12px_rgba(122,84,46,0.14)] ${
                    on ? 'tk-cta text-white' : 'bg-surface-strong text-brand-600'
                  }`}
                >
                  <PlayGlyph state={st === 'error' ? 'idle' : st} />
                </button>
              </div>

              {/* 소리가 나기까지 몇 초가 빈다. 그 사이 화면이 조용하면
                  복지사는 한 번 더 누르거나 태블릿을 의심한다. */}
              {st === 'loading' ? (
                <p role="status" className="mt-2.5 text-[0.875rem] font-bold text-ink-700">
                  소리를 준비하고 있어요… 잠시만 기다려 주세요.
                </p>
              ) : null}
              {st === 'error' ? (
                <p role="alert" className="mt-2.5 text-[0.875rem] font-bold text-danger-600">
                  소리를 불러오지 못했어요. 다시 눌러 보시겠어요?
                </p>
              ) : null}
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
  const { sound, toggle } = useSamplePlayer();
  const { s } = useSession();
  const list = samplesFor(s.style);

  return (
    <>
      <ul className="mt-3 space-y-2">
        {list.map((song) => {
          const st = stateOf(sound, song.id);
          const on = st === 'playing';
          const chosen = song.styleId === s.style;
          return (
            <li key={song.id}>
              <button
                type="button"
                onClick={() => toggle(song.id, song.src)}
                aria-label={`${song.style} 예시 ${
                  on ? '멈추기' : st === 'loading' ? '소리 준비 중, 눌러서 취소' : '들어보기'
                }`}
                aria-busy={st === 'loading'}
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
                  {st === 'loading' ? (
                    <LoadingRing size={16} />
                  ) : on ? (
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
                  {/* 재생 상태를 글자로도 밝힌다 — 준비 중과 실패는 아이콘만
                      봐서는 구분되지 않고, 실패는 특히 조용히 지나간다. */}
                  <span className="block text-[0.8125rem] text-ink-500">
                    {st === 'loading' ? '소리를 준비하고 있어요…' : sampleLength(song.seconds)}
                  </span>
                  {st === 'error' ? (
                    <span role="alert" className="block text-[0.8125rem] font-bold text-danger-600">
                      소리를 불러오지 못했어요. 다시 눌러 보시겠어요?
                    </span>
                  ) : null}
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

