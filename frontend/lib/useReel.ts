'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadSong, loadSongAt, readSongShelf } from './songStore';
import type { Scene } from './sceneStore';

/**
 * 사연 그림을 노래에 맞춰 넘기고, 되는 기기에서는 영상으로 담는다.
 *
 * ── 왜
 *
 * 관장님이 "노래만 만들지 말고 사연이 담긴 그림이나 숏츠 제작까지 되면
 * 좋겠다, 링크로 가족까지 공유되면 베스트"라고 하셨다.
 *
 * ── 두 가지를 갈라 둔다
 *
 * 1. **재생**은 어디서나 된다. 노래가 흐르고 그림이 넘어간다. 어르신 앞에서
 *    바로 쓸 수 있고, 태블릿 기본 화면 녹화로도 숏츠를 뽑을 수 있다.
 * 2. **영상 저장**은 되는 기기에서만 된다. 브라우저마다 녹화 기능 지원이
 *    갈린다. 안 되는 기기에서 버튼만 띄워 두면 복지사는 눌러 보고 아무 일도
 *    일어나지 않는 것을 겪는다 — 그래서 미리 재 보고, 안 되면 안 된다고 적는다.
 *
 * ── 한 장이 얼마나 머무나
 *
 * 처음에는 곡 길이를 그림 수로 나눴다. 백 초짜리 곡에 그림 석 장이면 한 장이
 * 삼십삼 초씩 서 있었다. 그건 숏츠가 아니라 정지화면이다.
 *
 * 그래서 한 장은 **다섯 초**로 못 박고, 곡이 남으면 그림을 처음부터 다시
 * 돌린다. 같은 그림이 두 번 나오는 편이 한 장이 삼십 초 서 있는 것보다 낫다.
 *
 * ── 소리까지 담는 이유
 *
 * 그림만 담긴 영상은 숏츠가 아니다. 노래 소리를 함께 담아야 하는데, 그러려면
 * 재생 중인 소리를 갈래 하나로 따로 뽑아야 한다(AudioContext). 그 과정에서
 * 스피커로 나가는 소리가 끊기지 않도록 원래 출력에도 그대로 이어 둔다.
 *
 * 그 갈래는 **오디오 하나에 한 번만** 만들 수 있다(createMediaElementSource).
 * 예전 판은 담기 시작할 때마다 새로 만들어서, 두 번째 「영상 담기」는 예외가
 * 나고 조용히 아무 일도 일어나지 않았다. 복지사에게는 버튼이 고장 난 것으로
 * 보인다. 그래서 한 번 만들어 두고 계속 쓴다.
 */

export type ReelState = {
  /** 지금 화면에 떠 있는 그림 번호. 그림이 없으면 -1 */
  index: number;
  /** 다음 그림으로 넘어가는 중일 때 0→1. 겹쳐 그리는 데 쓴다. */
  fade: number;
  playing: boolean;
  /** 곡 길이(초). 아직 모르면 0 */
  total: number;
  at: number;
  /** 이 영상이 실제로 흐르는 길이(초). */
  length: number;
  toggle: () => void;
  /** 곡이 이 기기에 없으면 false — 그림만 넘겨 볼 수 있다. */
  hasSong: boolean;
  /** 영상으로 담을 수 있는 기기인가. */
  canRecord: boolean;
  recording: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  /** 담긴 영상. 저장 버튼이 이걸 내려받는다. */
  video: { url: string; type: string } | null;
  /**
   * 담기가 안 된 이유. 눌러도 아무 일이 없는 단추를 두지 않기 위해서다 —
   * 예전에는 여기서 난 오류를 조용히 삼켜서, 복지사에게는 고장 난 단추로 보였다.
   */
  problem: string | null;
  /** 짧게 담기 — 켜면 삼십 초에서 끊는다. */
  short: boolean;
  setShort: (v: boolean) => void;
};

/** 그림 한 장이 화면에 머무는 시간(초). */
export const HOLD = 5;
/** 넘어가는 데 걸리는 시간(초). 뚝 바뀌면 눈이 놀란다. */
export const FADE = 0.6;
/** 짧게 담기를 켰을 때의 길이(초). */
export const SHORT_LEN = 30;
/** 앞뒤에 두는 표지·맺음 시간(초). */
export const CARD = 3;

export function useReel(
  scenes: Scene[],
  canvas: HTMLCanvasElement | null,
  /** 누구의 노래를 걸 것인가. 회기 곡이 없으면 이분의 최근 곡을 찾는다. */
  ownerId?: string,
): ReelState {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [hasSong, setHasSong] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [total, setTotal] = useState(0);
  const [recording, setRecording] = useState(false);
  const [video, setVideo] = useState<{ url: string; type: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [short, setShort] = useState(true);
  const recRef = useRef<MediaRecorder | null>(null);
  /** 지금 흐른 시각. 담기를 끊을 때가 됐는지 재는 데 쓴다. */
  const atRef = useRef(0);
  /** 여기 닿으면 담기를 끝낸다. 담는 중이 아니면 끝이 없다. */
  const endAtRef = useRef(Infinity);

  /*
   * 담기를 끝낸다.
   *
   * 이펙트에서 시각을 지켜보다 멈추면 렌더가 연쇄로 돈다. 그래서 소리 쪽이
   * 알려 주는 신호(timeupdate)에서 부른다 — 바깥 장치가 알려 줄 때 받는 것이
   * 이펙트가 할 일이다.
   */
  const finish = useCallback(() => {
    endAtRef.current = Infinity;
    if (recRef.current?.state === 'recording') recRef.current.stop();
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  /*
   * 소리 갈래는 한 번만 만든다. 오디오 하나에 두 번 부르면 예외가 난다.
   */
  const tapRef = useRef<{ ctx: AudioContext; stream: MediaStream } | null>(null);

  /**
   * 이 기기가 화면과 소리를 담을 수 있는가. 눌러 보기 전에 잰다.
   */
  const [canRecord] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.MediaRecorder !== 'undefined' &&
      typeof HTMLCanvasElement.prototype.captureStream === 'function',
  );

  /*
   * 곡을 읽는다.
   *
   * 이번 회기 곡이 먼저다. 없으면 이 어르신의 가장 최근 곡을 건다 — 지난
   * 회기 그림으로 숏츠를 만드는 자리에서는 회기 곡이 아예 없다.
   */
  useEffect(() => {
    let url: string | null = null;
    let alive = true;

    const pick = async (): Promise<Blob | null> => {
      const here = await loadSong().catch(() => null);
      if (here) return here;
      const shelf = await readSongShelf(ownerId).catch(() => null);
      const newest = shelf?.songs.find((m) => m.madeAt !== null) ?? shelf?.songs[0];
      return newest ? await loadSongAt(newest.key).catch(() => null) : null;
    };

    void pick().then((blob) => {
      if (!alive || !blob) return;
      url = URL.createObjectURL(blob);
      const a = new Audio(url);
      a.preload = 'metadata';
      /*
       * ── 시계를 하나만 믿지 않는다
       *
       * 처음에는 파일을 받자마자 이 오디오를 시계로 삼았다. 그런데 브라우저가
       * 곡 길이를 늦게 읽거나 아예 안 읽는 경우가 있다. 그때는 아무 신호도
       * 안 오고, 화면은 「이 기기의 노래와 함께」라고 적어 놓은 채 표지에서
       * 멈춰 있었다. 재생을 눌러도 아무 일이 없다.
       *
       * 그다음에는 길이를 알려 준 뒤에만 시계로 삼게 했다. 이번에는 반대로,
       * 멀쩡한 곡인데도 브라우저가 길이를 늦게 주면 「곡이 없어요」가 됐다.
       *
       * 그래서 시계는 우리가 돌리고, 소리가 실제로 흐르고 있으면 그 시각을
       * 따라간다(아래 시계 이펙트). 어느 쪽이 고장 나도 그림은 넘어간다 —
       * 어르신 앞에서 화면이 멎는 일만은 없어야 한다.
       */
      a.addEventListener('loadedmetadata', () => {
        if (Number.isFinite(a.duration) && a.duration > 0) setTotal(a.duration);
      });
      a.addEventListener('ended', () => setPlaying(false));
      a.addEventListener('play', () => setPlaying(true));
      a.addEventListener('pause', () => setPlaying(false));
      // 못 여는 파일이었다. 그림만 넘긴다.
      a.addEventListener('error', () => setHasSong(false));
      audioRef.current = a;
      setHasSong(true);
      a.load();
    });

    return () => {
      alive = false;
      audioRef.current?.pause();
      audioRef.current = null;
      if (url) URL.revokeObjectURL(url);
    };
  }, [ownerId]);

  /*
   * 이 영상이 흐르는 길이.
   *
   * 짧게 담기를 켜면 삼십 초, 아니면 곡 길이다. 곡이 없으면 그림 수만큼.
   * 표지와 맺음이 앞뒤에 붙는다.
   */
  const full = total || scenes.length * HOLD + CARD * 2;
  const length = short ? Math.min(SHORT_LEN, full) : full;

  /*
   * 곡이 없으면 시계를 우리가 돌린다.
   */
  const limit = length;

  /*
   * 시계.
   *
   * 소리가 실제로 흐르고 있으면 그 시각을 따르고, 아니면 우리가 민다. 곡이
   * 없는 회기도 있고(아직 안 만들었거나 다른 태블릿에서 만들었거나), 곡이
   * 있어도 이 브라우저가 못 여는 경우가 있다. 어느 쪽이든 그림은 넘어간다.
   */
  useEffect(() => {
    if (!playing) return;
    /*
     * 시각은 더하지 않고 잰다.
     *
     * 예전에는 한 번 돌 때마다 0.05초씩 더했다. 그런데 브라우저는 화면이
     * 안 보이면 시계를 늦춘다 — 초당 스무 번 돌 것이 한 번만 돈다. 그러면
     * 더하기가 스무 배 느려져서, 소리는 제대로 흐르는데 그림만 기어간다.
     *
     * 시작한 때를 적어 두고 지금과의 차이를 재면, 시계가 늦어져도 그림이
     * 늦어지지는 않는다. 건너뛸 뿐이다.
     */
    const from = performance.now() - atRef.current * 1000;
    const id = setInterval(() => {
      const a = audioRef.current;
      if (a && !a.paused && a.currentTime > 0) atRef.current = a.currentTime;
      else atRef.current = (performance.now() - from) / 1000;
      setAt(atRef.current);
      // 정한 길이에 닿으면 담기를 끊는다. 복지사가 멈춤을 누르지 않아도
      // 파일이 나온다 — 백 초짜리 곡 앞에 서 있게 하지 않는다.
      if (atRef.current >= endAtRef.current) finish();
      // 끝까지 갔으면 멈춘다.
      else if (atRef.current >= limit) setPlaying(false);
    }, 50);
    return () => clearInterval(id);
  }, [playing, finish, limit]);

  /*
   * 지금 몇 번째 그림인가.
   *
   * 표지가 끝난 뒤부터 다섯 초씩. 그림이 모자라면 처음부터 다시 돈다 —
   * 한 장을 삼십 초 세워 두지 않기 위해서다.
   */
  const shown = Math.max(0, at - CARD);
  const step = Math.floor(shown / HOLD);
  const index = scenes.length ? step % scenes.length : -1;
  // 넘어가는 순간 0 에서 1 로. 그리는 쪽이 이 값으로 겹쳐 그린다.
  const into = shown - step * HOLD;
  const fade = at < CARD || !scenes.length ? 1 : Math.min(1, into / FADE);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) {
      setPlaying((v) => {
        if (!v && at >= length) {
          atRef.current = 0;
          setAt(0);
        }
        return !v;
      });
      return;
    }
    if (a.paused) {
      // 끝까지 갔으면 처음으로. 우리 시계도 같이 되감는다 — 소리가 안 흐르는
      // 기기에서는 이 시계가 그림을 민다.
      if (a.ended || a.currentTime >= (a.duration || 0) || at >= length) {
        a.currentTime = 0;
        atRef.current = 0;
        setAt(0);
      }
      /*
       * 못 트는 곡이면 소리는 포기하고 그림만 넘긴다. 여기서 멈춰 버리면
       * 어르신 앞에서 눌러도 아무 일이 없는 단추가 된다.
       */
      void a.play().catch(() => {
        setHasSong(false);
        audioRef.current = null;
        atRef.current = 0;
        setAt(0);
        setPlaying(true);
      });
    } else {
      a.pause();
    }
  }, [at, length]);

  const startRecording = useCallback(() => {
    if (!canvas || !canRecord) return;
    try {
      /*
       * 시각을 먼저 되감는다.
       *
       * 두 번째 담기가 900바이트짜리 빈 파일로 나왔다. 앞 담기가 끝나면 시각이
       * 끝(21초)에 머물러 있는데, 다시 담기를 누르면 끝 시각을 21초로 정해 놓고
       * 시작한다 — 첫 박자에 이미 끝을 지나 있으니 곧바로 멈춘다.
       *
       * 소리가 잘 흐르는 기기에서는 currentTime 을 되감는 것으로 따라왔지만,
       * 소리가 안 흐르는 경우에는 우리 시계가 그대로 21초에 있었다. 어느
       * 쪽이든 여기서 한 번 되감는다.
       */
      atRef.current = 0;
      setAt(0);
      setProblem(null);
      const stream = canvas.captureStream(30);

      /*
       * 소리를 갈래로 뽑아 영상에 붙인다. 한 번 만든 갈래를 계속 쓴다.
       * 스피커 출력도 그대로 살려 둔다 — 안 그러면 담는 동안 어르신 앞에서
       * 소리가 사라진다.
       */
      const a = audioRef.current;
      if (a) {
        if (!tapRef.current) {
          const Ctx =
            window.AudioContext ??
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext;
          if (Ctx) {
            const ctx = new Ctx();
            const src = ctx.createMediaElementSource(a);
            const tap = ctx.createMediaStreamDestination();
            src.connect(tap);
            src.connect(ctx.destination);
            tapRef.current = { ctx, stream: tap.stream };
          }
        }
        const tap = tapRef.current;
        if (tap) {
          // 담기 사이에 잠들어 있으면 소리가 안 실린다.
          void tap.ctx.resume().catch(() => undefined);
          for (const t of tap.stream.getAudioTracks()) stream.addTrack(t);
        }
      }

      // 기기가 받아 주는 형식을 골라 쓴다. 안드로이드는 webm, 사파리는 mp4.
      const type = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: rec.mimeType || 'video/webm' });
        setVideo({ url: URL.createObjectURL(blob), type: rec.mimeType || 'video/webm' });
        setRecording(false);
      };
      recRef.current = rec;
      // 담을 길이를 여기서 못 박는다. 담는 도중에 값이 바뀌어도 끝은 안 옮긴다.
      endAtRef.current = length;
      // 앞의 영상은 여기서 놓는다. 두 번 담고 나면 첫 번째는 아무도 안 쓴다.
      setVideo((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return null;
      });
      rec.start();
      setRecording(true);

      // 처음부터 담는다. 중간부터 담긴 영상은 쓸 데가 없다.
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        void audio.play().catch(() => undefined);
      } else {
        atRef.current = 0;
        setAt(0);
        setPlaying(true);
      }
    } catch (e) {
      setRecording(false);
      setProblem(e instanceof Error ? `${e.name}: ${e.message}` : '알 수 없는 오류');
    }
  }, [canvas, canRecord, length]);

  return {
    index,
    fade,
    playing,
    total,
    at,
    length,
    toggle,
    hasSong,
    canRecord,
    recording,
    startRecording,
    stopRecording: finish,
    video,
    problem,
    short,
    setShort,
  };
}
