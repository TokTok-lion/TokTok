'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadSong } from './songStore';
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
 * ── 소리까지 담는 이유
 *
 * 그림만 담긴 영상은 숏츠가 아니다. 노래 소리를 함께 담아야 하는데, 그러려면
 * 재생 중인 소리를 갈래 하나로 따로 뽑아야 한다(AudioContext). 그 과정에서
 * 스피커로 나가는 소리가 끊기지 않도록 원래 출력에도 그대로 이어 둔다.
 */

export type ReelState = {
  /** 지금 화면에 떠 있는 그림 번호. 그림이 없으면 -1 */
  index: number;
  playing: boolean;
  /** 곡 길이(초). 아직 모르면 0 */
  total: number;
  at: number;
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
};

/** 그림 한 장이 화면에 머무는 최소 시간(초). 너무 빨리 넘기면 못 보신다. */
const MIN_HOLD = 3;

export function useReel(scenes: Scene[], canvas: HTMLCanvasElement | null): ReelState {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [hasSong, setHasSong] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [total, setTotal] = useState(0);
  const [recording, setRecording] = useState(false);
  const [video, setVideo] = useState<{ url: string; type: string } | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);

  /**
   * 이 기기가 화면과 소리를 담을 수 있는가. 눌러 보기 전에 잰다.
   *
   * 첫 그림을 그릴 때 재고 그대로 둔다. 이펙트에서 setState 하면 렌더가 한 번
   * 더 도는데, 이 값은 기기가 정해 놓은 것이라 바뀌지 않는다.
   */
  const [canRecord] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.MediaRecorder !== 'undefined' &&
      typeof HTMLCanvasElement.prototype.captureStream === 'function',
  );

  // 곡을 이 기기에서 읽는다. 없으면 그림만 넘긴다.
  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    void loadSong().then((blob) => {
      if (!alive || !blob) return;
      url = URL.createObjectURL(blob);
      const a = new Audio(url);
      a.preload = 'metadata';
      a.addEventListener('timeupdate', () => setAt(a.currentTime));
      a.addEventListener('loadedmetadata', () => {
        if (Number.isFinite(a.duration)) setTotal(a.duration);
      });
      a.addEventListener('ended', () => setPlaying(false));
      a.addEventListener('play', () => setPlaying(true));
      a.addEventListener('pause', () => setPlaying(false));
      audioRef.current = a;
      setHasSong(true);
    });
    return () => {
      alive = false;
      audioRef.current?.pause();
      audioRef.current = null;
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  /*
   * 곡이 없으면 시계를 우리가 돌린다.
   *
   * 그림만 넘겨 보는 회기도 있다 — 곡을 아직 안 만들었거나, 다른 태블릿에서
   * 만든 곡이 이 기기에 없을 때다. 그때도 넘어가긴 해야 한다.
   */
  useEffect(() => {
    if (!playing || hasSong) return;
    const id = setInterval(() => setAt((v) => v + 0.25), 250);
    return () => clearInterval(id);
  }, [playing, hasSong]);

  const span = Math.max(MIN_HOLD, (total || scenes.length * 6) / Math.max(1, scenes.length));
  const index = scenes.length ? Math.min(scenes.length - 1, Math.floor(at / span)) : -1;

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) {
      // 곡이 없으면 우리 시계만 돌린다. 끝까지 가면 처음으로.
      setPlaying((v) => {
        if (!v && index >= scenes.length - 1) setAt(0);
        return !v;
      });
      return;
    }
    if (a.paused) {
      if (a.ended || a.currentTime >= (a.duration || 0)) a.currentTime = 0;
      void a.play().catch(() => setPlaying(false));
    } else {
      a.pause();
    }
  }, [index, scenes.length]);

  const startRecording = useCallback(() => {
    if (!canvas || !canRecord) return;
    try {
      const stream = canvas.captureStream(30);

      /*
       * 소리를 갈래로 뽑아 영상에 붙인다.
       *
       * 스피커 출력도 그대로 살려 둔다(destination 에도 잇는다) — 안 그러면
       * 녹화하는 동안 어르신 앞에서 소리가 사라진다.
       */
      const a = audioRef.current;
      if (a) {
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
      rec.start();
      setRecording(true);

      // 처음부터 담는다. 중간부터 담긴 영상은 쓸 데가 없다.
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        void audio.play().catch(() => undefined);
      } else {
        setAt(0);
        setPlaying(true);
      }
    } catch {
      setRecording(false);
    }
  }, [canvas, canRecord]);

  const stopRecording = useCallback(() => {
    recRef.current?.stop();
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  /*
   * 곡이 끝나면 녹화도 끝낸다. 복지사가 멈춤을 누르지 않아도 파일이 나온다.
   *
   * 시각을 보고 판단하지 않고 소리가 끝났다는 신호를 듣는다 — 이펙트 안에서
   * 매 프레임 재고 멈추면 렌더가 연쇄로 돈다.
   */
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const end = () => {
      if (recRef.current?.state === 'recording') recRef.current.stop();
    };
    a.addEventListener('ended', end);
    return () => a.removeEventListener('ended', end);
  }, [hasSong]);

  return {
    index,
    playing,
    total,
    at,
    toggle,
    hasSong,
    canRecord,
    recording,
    startRecording,
    stopRecording,
    video,
  };
}
