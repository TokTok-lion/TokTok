'use client';

// 확장자를 붙인 이유: 이 파일은 node --test 도 읽는다(lib/audioConvert.test.ts).
// 노드의 해석기는 확장자 없는 상대 경로를 찾지 못하고, tsconfig 는
// allowImportingTsExtensions 로 이 형태를 허용한다.
import { audioConfigFor } from './providers/types.ts';

/**
 * 밖에서 녹음해 온 파일을 전사에 보낼 수 있는 모양으로 바꾼다.
 *
 * 왜 필요한가. 아이폰 음성 메모도, 안드로이드 기본 녹음기도 대개 m4a(AAC)를
 * 낸다. 사실상 표준이다. 그런데 우리가 쓰는 Google STT v1 이 아는 인코딩
 * 목록에 AAC 가 없다 — FLAC · LINEAR16 · MP3 · OGG_OPUS · WEBM_OPUS · AMR
 * 뿐이다.
 *
 * v2 로 가면 m4a 를 자동으로 알아보지만, 한국어 화자 분리를 잃는다. 그러면
 * 복지사 질문과 어르신 말씀을 못 가르고, 그 둘이 섞인 채로 사실 추출에
 * 들어간다. 그 거래는 할 수 없다. 그래서 형식을 바꾼다.
 *
 * 16kHz 모노 WAV 로 푼다. 44.1kHz 스테레오 그대로 풀지 않는 이유는 구글이
 * 어차피 16kHz 로 리샘플하기 때문이다 — 그 위의 정보는 전사에 쓰이지 않는데
 * 메모리만 네 배로 먹는다. 브라우저에서 30분짜리를 다루는 자리라 그 차이가
 * 태블릿이 버티느냐 마느냐를 가른다.
 */

/** 구글이 실제로 듣는 표본율. 이보다 높게 풀 이유가 없다. */
const TARGET_RATE = 16000;

/**
 * 브라우저에서 풀어 볼 최대 길이.
 *
 * 16kHz 모노로 풀면 1분에 약 3.8MB(float32)를 쓴다. 40분이면 154MB 이고,
 * 여기에 내보낼 WAV(1분당 1.9MB)와 원본까지 얹히면 최대 250MB 언저리다.
 * 요양기관 태블릿은 최신 기종이 아닌 경우가 많아서 이 위로는 올리지 않는다.
 *
 * 넘으면 막지 않고 사실대로 말한다 — '길어서 못 바꾼다, wav 나 mp3 로 바꿔
 * 오시면 그대로 쓴다'. 복지사가 다른 길을 고를 수 있어야 한다.
 */
export const CONVERT_MAX_SECONDS = 40 * 60;

export type ConvertResult =
  | {
      ok: true;
      blob: Blob;
      /**
       * 잰 길이. 못 쟀으면 null 이다.
       *
       * 예전에는 여기서 `seconds ?? 0` 으로 메웠다. 그 한 줄이 '모른다'를
       * '0초다'로 바꿔 놓는다 — 화면은 「0:00 녹음을 올렸어요」라고 적고,
       * 기기 표에도 0 이 실측처럼 앉는다. 파일 위쪽 readDuration 의 설명이
       * 바로 그것을 하지 말라는 것이었는데 정작 여기서 하고 있었다.
       */
      seconds: number | null;
      converted: boolean;
    }
  | { ok: false; reason: 'unsupported' | 'tooLong' | 'failed'; seconds: number | null };

/**
 * 파일 길이를 재 본다. 푸는 것보다 훨씬 싸다 — 머리말만 읽는다.
 *
 * 못 재면 null 이다. 그때는 길이를 0 으로 치지 않는다. 0 으로 치면 '짧으니까
 * 괜찮다'고 판단해 30분짜리를 그대로 풀게 된다.
 */
export function readDuration(file: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(null);
    const url = URL.createObjectURL(file);
    const el = document.createElement('audio');
    let settled = false;
    const done = (v: number | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      // 붙잡고 있으면 파일이 메모리에 남는다. 30분짜리를 다루는 자리다.
      el.removeAttribute('src');
      resolve(v);
    };
    /*
     * 시한을 둔다. 머리말이 잘린 파일에서는 loadedmetadata 도 error 도 오지
     * 않고 그대로 멈춘다 — 그러면 이 약속이 영영 안 끝나고, 부르는 쪽
     * (toTranscribable)이 첫 줄에서 기다리므로 화면이 '녹음을 읽고 있어요…'
     * 에 붙박인다. 오류도 없고 다시 누를 수도 없어서 새로고침 말고는 길이
     * 없었다.
     *
     * 시한이 지나면 null 이다. 그건 '길이를 모른다'는 뜻이고, 위쪽이 이미
     * 그 경우를 '못 읽는 파일'로 다루며 무엇을 가져오면 되는지 안내한다.
     */
    const timer = window.setTimeout(() => done(null), 15_000);
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      const d = el.duration;
      done(Number.isFinite(d) && d > 0 ? d : null);
    };
    el.onerror = () => done(null);
    el.src = url;
  });
}

/**
 * WAV 는 머리말만 읽어도 길이가 나온다 — 재생기를 거치지 않는다.
 *
 * 왜 따로 두는가. readDuration 은 <audio> 에게 물어보는데, 브라우저는 탭이
 * 화면에 없으면 미디어 읽기를 미룬다. 복지사가 파일을 고르고 다른 탭으로
 * 넘어가거나 태블릿을 잠그면 그 사이 metadata 가 오지 않고, 15초 뒤 시한이
 * 지나 '길이를 모르는 파일'이 된다. 실제로 그 상태를 재현해 봤다 — 멀쩡한
 * 16kHz 모노 WAV 도 숨은 탭에서는 loadedmetadata 가 끝내 오지 않는다.
 *
 * WAV 는 그럴 이유가 없다. data 조각의 크기를 초당 바이트로 나누면 그게 길이다.
 * 우리가 만들어 내는 변환 결과도 WAV 라(toWav), 이 길로 대개 답이 나온다.
 *
 * 머리말이 표준 모양이 아니면 null 이다 — 짐작하지 않는다.
 */
export function wavDuration(head: ArrayBuffer): number | null {
  if (head.byteLength < 44) return null;
  const v = new DataView(head);
  const tag = (at: number) => String.fromCharCode(v.getUint8(at), v.getUint8(at + 1), v.getUint8(at + 2), v.getUint8(at + 3));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;

  // 조각들을 훑는다. fmt 와 data 사이에 다른 조각이 끼어 있는 파일이 있다.
  let at = 12;
  let byteRate = 0;
  while (at + 8 <= head.byteLength) {
    const kind = tag(at);
    const size = v.getUint32(at + 4, true);
    if (kind === 'fmt ' && at + 20 <= head.byteLength) byteRate = v.getUint32(at + 16, true);
    if (kind === 'data') {
      if (!byteRate) return null;
      const seconds = size / byteRate;
      return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
    }
    // 조각 길이는 짝수로 맞춰진다. 홀수면 한 바이트가 덧대어 있다.
    at += 8 + size + (size % 2);
  }
  return null;
}

/** AudioBuffer → 16bit PCM WAV. 채널이 여럿이면 섞어서 하나로 만든다. */
function toWav(buf: AudioBuffer): Blob {
  const frames = buf.length;
  const chans = buf.numberOfChannels;

  /*
   * 모노로 섞는다. 회기 녹음은 한 방에서 마주 앉아 받은 소리라 좌우를
   * 나눠 둘 이유가 없고, 구글도 한 채널만 듣는다. 남겨 두면 파일만 두 배다.
   */
  const mixed = new Float32Array(frames);
  for (let c = 0; c < chans; c += 1) {
    const src = buf.getChannelData(c);
    for (let i = 0; i < frames; i += 1) mixed[i] += src[i] / chans;
  }

  const bytes = 44 + frames * 2;
  const out = new ArrayBuffer(bytes);
  const view = new DataView(out);
  const ascii = (at: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(at + i, s.charCodeAt(i));
  };

  ascii(0, 'RIFF');
  view.setUint32(4, bytes - 8, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM 헤더 길이
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // 채널 1
  view.setUint32(24, buf.sampleRate, true);
  view.setUint32(28, buf.sampleRate * 2, true); // 초당 바이트
  view.setUint16(32, 2, true); // 프레임당 바이트
  view.setUint16(34, 16, true); // 비트 깊이
  ascii(36, 'data');
  view.setUint32(40, frames * 2, true);

  let at = 44;
  for (let i = 0; i < frames; i += 1) {
    // 넘치는 값을 그대로 자르면 딱딱 끊기는 소리가 된다. 먼저 가둔다.
    const v = Math.max(-1, Math.min(1, mixed[i]));
    view.setInt16(at, v < 0 ? v * 0x8000 : v * 0x7fff, true);
    at += 2;
  }
  return new Blob([out], { type: 'audio/wav' });
}

/**
 * 전사에 보낼 수 있는 녹음으로 만든다.
 *
 * 이미 보낼 수 있는 형식(wav·mp3·webm·ogg·flac)이면 손대지 않는다. 다시 푸는
 * 것은 시간도 걸리고 얻을 것도 없다 — 그리고 손대지 않은 파일이 언제나 가장
 * 원본에 가깝다.
 */
export async function toTranscribable(file: File): Promise<ConvertResult> {
  const type = file.type || '';
  let seconds = await readDuration(file);

  // 재생기가 답하지 않았어도 WAV 라면 머리말에 답이 있다. 숨은 탭에서 파일을
  // 고른 경우가 실제로 여기로 온다.
  if (seconds === null && /wav|wave/i.test(type)) {
    seconds = wavDuration(await file.slice(0, 4096).arrayBuffer());
  }

  if (audioConfigFor(type)) {
    // 못 쟀으면 못 쟀다고 넘긴다. 0 으로 메우면 화면과 기기 표에 아무도 재지
    // 않은 '0초'가 실측처럼 남는다.
    return { ok: true, blob: file, seconds, converted: false };
  }

  // 우리가 풀 수 있는 것은 브라우저가 아는 형식뿐이다. 확장자만 보고
  // 짐작하지 않는다 — 이름이 .m4a 라고 내용이 AAC 라는 보장은 없다.
  const decodable = /^audio\/|^video\/mp4$|^video\/quicktime$/.test(type);
  if (!decodable) return { ok: false, reason: 'unsupported', seconds };

  // 길이를 못 쟀으면 풀어 보지 않는다. 30분짜리를 0초로 알고 풀다가 탭이
  // 죽으면 복지사는 무슨 일이 있었는지도 모른다.
  if (seconds === null) return { ok: false, reason: 'unsupported', seconds };
  if (seconds > CONVERT_MAX_SECONDS) return { ok: false, reason: 'tooLong', seconds };

  try {
    // 16kHz 로 만든 컨텍스트에 풀면 푸는 김에 리샘플된다. 44.1kHz 로 풀어
    // 놓고 우리가 줄이면 그 순간 메모리를 세 배 가까이 쓴다.
    const Ctx: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return { ok: false, reason: 'unsupported', seconds };

    const ctx = new Ctx({ sampleRate: TARGET_RATE });
    let buf: AudioBuffer;
    try {
      buf = await ctx.decodeAudioData(await file.arrayBuffer());
    } finally {
      void ctx.close();
    }
    return { ok: true, blob: toWav(buf), seconds: buf.duration, converted: true };
  } catch {
    // 브라우저가 그 코덱을 모르거나 메모리가 모자랐다. 어느 쪽이든 복지사가
    // 할 일은 같다 — 다른 형식으로 가져오기.
    return { ok: false, reason: 'failed', seconds };
  }
}
