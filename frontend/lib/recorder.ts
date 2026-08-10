'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { appendChunk, deleteRecording, loadRecording } from './recordingStore';

/**
 * 실제 녹음.
 *
 * 브라우저의 MediaRecorder 만 쓴다. 외부 서비스가 필요 없고, 소리가 기기 밖으로
 * 나가지 않는다 — 전사 API 를 붙이기 전까지는 이 편이 오히려 안전하다.
 *
 * 녹음본은 회기가 도는 동안 메모리에만 둔다. localStorage 에는 못 넣고(용량),
 * 서버로 보내려면 저장 위치와 보관기간 정책이 먼저 정해져야 한다. 그래서
 * "새로고침하면 사라진다"를 화면에서도 숨기지 않는다.
 *
 * 이 녹음본이 있어야 이야기의 출처("어르신 음성 0:42")를 눌러 그 대목으로
 * 돌아갈 수 있다. 출처가 진짜 근거가 되려면 들어볼 수 있어야 한다.
 */

export type RecState = 'idle' | 'recording' | 'paused' | 'stopped' | 'denied' | 'unsupported';

type Snap = {
  state: RecState;
  /** 녹음된 길이(초). 일시정지 중에는 늘지 않는다. */
  seconds: number;
  /** 재생용 주소. 녹음이 끝나야 생긴다. */
  url: string | null;
  error: string | null;
  /** 기기 DB 에 저장된 시각. 없으면 저장본이 없다. */
  savedAt: number | null;
  bytes: number;
  /**
   * 이 녹음에서 사람 목소리만 한 소리가 한 번이라도 들어왔는가.
   *
   * 화면의 파형은 오래 장식이었다 — Math.sin 으로 그린 막대라, 마이크가
   * 무음을 담고 있어도 소리가 들어오는 것처럼 보였다. 실제로 50초를
   * 녹음하고 다음 화면까지 간 뒤에야 "말씀이 잡히지 않았어요"를 만났다.
   * 그때는 이미 어르신이 이야기를 다 하신 뒤다.
   *
   * 그래서 진짜 입력을 재고, 한 번도 안 들렸으면 녹음 중에 그 사실을
   * 말한다. 마이크를 고르는 일은 어르신 앞에서 다시 하기 어렵다.
   */
  heard: boolean;
};

const EMPTY: Snap = {
  state: 'idle',
  seconds: 0,
  url: null,
  error: null,
  savedAt: null,
  bytes: 0,
  heard: false,
};
let snap: Snap = EMPTY;
let restored = false;
const listeners = new Set<() => void>();

/*
 * 입력 세기는 따로 흘린다.
 *
 * 초당 여러 번 바뀌는 값이라 회기 상태에 섞으면 인터뷰 화면 전체가 그만큼
 * 다시 그려진다 — 질문 읽어주기 버튼과 카드까지 함께. 막대 하나만 다시
 * 그리면 되는 일이다.
 */
let level = 0;
const levelListeners = new Set<() => void>();
let meterTimer: number | null = null;
let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;

function emitLevel(next: number) {
  level = next;
  for (const l of levelListeners) l();
}

/** 0~1. 사람 목소리가 들어오면 대략 0.05 이상으로 올라온다. */
export function useMicLevel(): number {
  return useSyncExternalStore(
    (cb) => {
      levelListeners.add(cb);
      return () => levelListeners.delete(cb);
    },
    () => level,
    () => 0,
  );
}

/** 마이크가 담고 있는 소리의 세기. 무음이면 0 에 붙어 있다. */
const HEARD_AT = 0.02;

function startMeter(src: MediaStream) {
  stopMeter();
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new Ctx();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    audioCtx.createMediaStreamSource(src).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    meterTimer = window.setInterval(() => {
      if (!analyser) return;
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      const rms = Math.sqrt(sum / buf.length);
      emitLevel(Math.min(1, rms * 6));
      // 한 번이라도 들렸으면 그 사실을 회기 표시에 남긴다.
      if (rms >= HEARD_AT && !snap.heard) emit({ heard: true });
    }, 120);
  } catch {
    // 레벨을 못 재도 녹음은 계속되어야 한다. 재지 못했으면 heard 를
    // 건드리지 않는다 — 모르는 것을 '안 들렸다'로 적으면 안 된다.
    audioCtx = null;
    analyser = null;
  }
}

function stopMeter() {
  if (meterTimer !== null) window.clearInterval(meterTimer);
  meterTimer = null;
  analyser = null;
  void audioCtx?.close().catch(() => {});
  audioCtx = null;
  emitLevel(0);
}

/** 레벨을 잴 수 있었는가. 못 쟀으면 '안 들렸다'고 단정하면 안 된다. */
export function meterWorked(): boolean {
  return analyser !== null || snap.heard;
}

let recorder: MediaRecorder | null = null;
// MediaRecorder 는 언제나 Blob 을 준다. BlobPart 로 두면 조각을 DB 에
// 넣을 때 타입이 어긋난다.
let chunks: Blob[] = [];
let stream: MediaStream | null = null;
let ticker: number | null = null;

function emit(next: Partial<Snap>) {
  snap = { ...snap, ...next };
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  // 첫 구독자가 기기 DB 에서 지난 녹음본을 되살린다. 새로고침해도 출처를
  // 눌러 들을 수 있어야 하기 때문이다. 보관기간이 지난 것은 여기서 걸러진다.
  if (!restored) {
    restored = true;
    void loadRecording().then((rec) => {
      if (!rec || snap.url) return;
      emit({
        state: 'stopped',
        seconds: rec.seconds,
        url: URL.createObjectURL(rec.blob),
        savedAt: rec.savedAt,
        bytes: rec.blob.size,
        // 중간에 끊긴 녹음도 들려준다. 반쪽이라도 있는 편이 낫다.
        error: rec.recovered
          ? '지난 녹음이 중간에 끊겼어요. 거기까지는 남아 있습니다.'
          : null,
      });
    });
  }
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function startTicker() {
  stopTicker();
  ticker = window.setInterval(() => emit({ seconds: snap.seconds + 1 }), 1000);
}

function stopTicker() {
  if (ticker !== null) window.clearInterval(ticker);
  ticker = null;
}

/** 마이크를 열고 녹음을 시작한다. 권한 거부는 오류가 아니라 상태다. */
export async function startRecording(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    emit({ state: 'unsupported', error: '이 브라우저는 녹음을 지원하지 않아요.' });
    return;
  }
  if (snap.state === 'recording') return;

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    // 거부하셨을 수도, 마이크가 없을 수도 있다. 둘 다 "못 켠다"로 같다.
    emit({ state: 'denied', error: '마이크를 쓸 수 없어요. 받아 적기로 진행해 주세요.' });
    return;
  }

  chunks = [];
  if (snap.url) URL.revokeObjectURL(snap.url);
  // 새로 녹음하면 지난 녹음은 대체된다. 지우지 않으면 지난 조각이 앞에
  // 섞여 엉뚱한 소리가 이어 붙는다.
  await deleteRecording();

  // webm/opus 가 가장 널리 되지만 사파리는 mp4 를 준다. 브라우저가 고르게 둔다.
  const mime = ['audio/webm', 'audio/mp4', ''].find(
    (t) => !t || MediaRecorder.isTypeSupported(t),
  );
  recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);

  const mimeType = recorder.mimeType;

  // 조각이 들어올 때마다 기기 DB 에 이어 붙인다. 끝날 때 한 번에 저장하면
  // 탭을 닫거나 주소를 옮기는 순간 정리 코드가 못 돌아 전부 날아간다.
  recorder.ondataavailable = (e) => {
    if (e.data.size === 0) return;
    const index = chunks.length;
    chunks.push(e.data);
    void appendChunk(index, e.data, {
      seconds: snap.seconds,
      mime: mimeType || 'audio/webm',
      savedAt: Date.now(),
      finished: false,
    });
  };

  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    emit({
      state: 'stopped',
      url: URL.createObjectURL(blob),
      savedAt: Date.now(),
      bytes: blob.size,
    });
    // 정상 종료를 표시해 둔다. 이 표시가 없으면 다음에 열 때
    // "중간에 끊긴 녹음"으로 되살린다.
    if (chunks.length) {
      void appendChunk(chunks.length - 1, chunks[chunks.length - 1], {
        seconds: snap.seconds,
        mime: mimeType || 'audio/webm',
        savedAt: Date.now(),
        finished: true,
      });
    }
  };

  recorder.start(1000); // 1초마다 조각을 받아 둬야 중간에 죽어도 남는다
  emit({
    state: 'recording',
    seconds: 0,
    url: null,
    error: null,
    savedAt: null,
    bytes: 0,
    heard: false,
  });
  startTicker();
  // 진짜 입력을 잰다. 이게 없으면 무음을 담고 있는 것을 아무도 모른다.
  startMeter(stream);
}

export function pauseRecording() {
  if (recorder?.state === 'recording') {
    recorder.pause();
    stopTicker();
    // 멈춘 동안 막대가 흔들리면 아직 담고 있는 것처럼 보인다.
    emitLevel(0);
    emit({ state: 'paused' });
  }
}

export function resumeRecording() {
  if (recorder?.state === 'paused') {
    recorder.resume();
    startTicker();
    emit({ state: 'recording' });
  }
}

export function stopRecording() {
  stopTicker();
  stopMeter();
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  recorder = null;
}

/** 회기를 벗어날 때 마이크를 확실히 끈다. 켜진 채로 두면 안 된다. */
export function releaseRecording() {
  stopTicker();
  stopMeter();
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  recorder = null;
}

/** 녹음본이 있는지 — 출처 재생이 가능한지 판단에 쓴다. */
export function hasRecording(): boolean {
  return snap.url !== null;
}

/**
 * 지금 마이크가 열려 있는가.
 *
 * 새 판이 배포됐다고 화면을 다시 여는 일이, 어르신이 말씀하시는 중에
 * 일어나서는 안 된다. 조각은 1초마다 기기에 쌓이니 전부 날아가지는 않지만,
 * 이야기를 듣던 중에 화면이 깜빡이면 그 자리가 끊긴다.
 */
export function isCapturing(): boolean {
  return snap.state === 'recording' || snap.state === 'paused';
}

/**
 * 저장된 녹음본을 지운다.
 *
 * 녹음 동의를 거두면 반드시 불려야 한다. 동의를 거뒀는데 음성이 기기에
 * 남아 있으면 그 동의는 말뿐이다.
 */
export async function forgetRecording(): Promise<void> {
  if (snap.url) URL.revokeObjectURL(snap.url);
  await deleteRecording();
  emit({ state: 'idle', seconds: 0, url: null, savedAt: null, bytes: 0, heard: false });
}

export function recordingUrl(): string | null {
  return snap.url;
}

export function useRecorder() {
  const s = useSyncExternalStore(subscribe, () => snap, () => EMPTY);

  const toggle = useCallback(async () => {
    if (s.state === 'recording') pauseRecording();
    else if (s.state === 'paused') resumeRecording();
    else await startRecording();
  }, [s.state]);

  return { ...s, toggle, stop: stopRecording, release: releaseRecording };
}

export function mmss(total: number): string {
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
