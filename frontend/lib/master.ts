'use client';

/**
 * 곡 다듬기 (브라우저 마스터링).
 *
 * 만들어진 곡을 들은 사람들이 "기계음이 난다"고 한다. 그 인상은 두 층에서
 * 온다 — 부르는 방식(호흡·비브라토가 고름)과 소리의 질감(지나치게 깨끗하고
 * 평평하고 차가움). 앞의 것은 여기서 못 고친다. 뒤의 것은 고칠 수 있다.
 *
 * 하는 일은 옛날 녹음실이 하던 일과 같다: 저역을 정리하고, 가슴통을 조금
 * 채우고, 디지털 특유의 쨍한 고역을 덜어내고, 아주 약하게 포화시켜 균일함을
 * 흐트러뜨리고, 방 울림을 조금 얹고, 눌러서 붙인다. 그러면 "생성된 것"보다
 * "녹음된 것"에 가깝게 들린다.
 *
 * 서버가 없다. Web Audio 의 OfflineAudioContext 로 브라우저가 직접 렌더한다.
 * 외부 파일도, 라이브러리도, 요금도 없다 — 방 울림에 쓰는 임펄스까지 여기서
 * 만들어 쓴다.
 */

/** 다듬기 세기. 과하면 곡이 뭉개진다 — 이 값들은 일부러 얌전하다. */
const HP_HZ = 70; // 저역 웅웅거림
const WARM_HZ = 320; // 가슴통
const WARM_DB = 1.2;
/*
 * 깎는 대역을 고를 때 듣는 사람이 누구인지가 걸린다.
 *
 * 노인성 난청은 고역부터 온다. 그런데 말이 또렷하게 들리는 것도 2~4kHz 라,
 * 흔히 "쨍하다"고 깎는 그 자리가 어르신께는 자음이 살아 있는 자리다.
 * 처음엔 2.9kHz 를 깎았는데 그건 방향이 반대였다.
 *
 * 그래서 거슬리는 대역만 위로 올려 잡고(4.2kHz), 그 위 공기감은 덜어내되
 * 과하지 않게 둔다. 덜 기계 같게 만들자고 알아듣기 어렵게 만들면 진다.
 */
const HARSH_HZ = 4200;
const HARSH_DB = -1.2;
const SHEEN_HZ = 8000; // 디지털 쨍함 — AI 곡의 "차가움"이 대체로 여기 있다
const SHEEN_DB = -1.8;
const DRIVE = 1.35; // 새추레이션. 1 이면 거의 선형
const ROOM_SEC = 0.55; // 방 울림 길이
const ROOM_WET = 0.11;
const PEAK = 0.89; // 최종 피크 (-1dBFS 근처)

/** 아주 약한 소프트 새추레이션. tanh 곡선이라 각지지 않는다. */
function driveCurve(k: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i += 1) {
    const x = (i * 2) / (n - 1) - 1;
    curve[i] = Math.tanh(k * x) / norm;
  }
  return curve;
}

/**
 * 방 울림 임펄스를 만든다.
 *
 * 파일로 들고 다니면 용량이고, 센터 와이파이에서 임펄스 하나 받자고 기다릴
 * 이유가 없다. 잡음을 지수적으로 줄이면 작은 방과 충분히 비슷하다.
 */
function roomImpulse(ctx: OfflineAudioContext, seconds: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch += 1) {
    const data = buf.getChannelData(ch);
    // 좌우를 조금 다르게 해야 방이 넓게 들린다.
    const decay = ch === 0 ? 3.2 : 3.0;
    for (let i = 0; i < len; i += 1) {
      const t = i / len;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }
  return buf;
}

function biquad(
  ctx: OfflineAudioContext,
  type: BiquadFilterType,
  hz: number,
  db?: number,
  q?: number,
): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = hz;
  if (db !== undefined) f.gain.value = db;
  if (q !== undefined) f.Q.value = q;
  return f;
}

function gain(buf: AudioBuffer, g: number): void {
  if (g === 1) return;
  for (let ch = 0; ch < buf.numberOfChannels; ch += 1) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i += 1) d[i] *= g;
  }
}

function rms(buf: AudioBuffer): number {
  let sum = 0;
  let n = 0;
  for (let ch = 0; ch < buf.numberOfChannels; ch += 1) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i += 1) sum += d[i] * d[i];
    n += d.length;
  }
  return n ? Math.sqrt(sum / n) : 0;
}

function peakOf(buf: AudioBuffer): number {
  let peak = 0;
  for (let ch = 0; ch < buf.numberOfChannels; ch += 1) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i += 1) {
      const v = Math.abs(d[i]);
      if (v > peak) peak = v;
    }
  }
  return peak;
}

/** 목소리가 사는 대역만 떼어 크기를 잰다. */
async function voiceRms(buf: AudioBuffer): Promise<number> {
  const ctx = new OfflineAudioContext(buf.numberOfChannels, buf.length, buf.sampleRate);
  const node = ctx.createBufferSource();
  node.buffer = buf;
  const lo = biquad(ctx, 'highpass', 1000, undefined, 0.7);
  const hi = biquad(ctx, 'lowpass', 5000, undefined, 0.7);
  node.connect(lo);
  lo.connect(hi);
  hi.connect(ctx.destination);
  node.start();
  return rms(await ctx.startRendering());
}

/**
 * 다듬은 소리를 원본과 같은 크기로 맞춘다.
 *
 * EQ 로 올린 저역과 새추레이션은 그것만으로 평균 음량을 밀어 올린다. 처음
 * 렌더한 것이 원본보다 5LU 더 컸는데, 그걸 나란히 들으면 사람은 예외 없이
 * "큰 쪽이 낫다"고 답한다. 그러면 질감을 고쳤는지 아닌지를 영영 알 수 없다.
 *
 * 크기는 전체가 아니라 목소리 대역(1~5kHz)으로 맞춘다. 전체로 맞추면 저역을
 * 채운 만큼 나머지가 통째로 내려가서, 따뜻해진 대신 말이 2dB 멀어졌다.
 * 어르신은 고역 청력이 먼저 떨어지므로 그 2dB 는 그냥 2dB 가 아니다.
 * 목소리를 제자리에 두고, 더한 것은 더한 것으로만 들리게 한다.
 */
async function levelToSource(
  src: AudioBuffer,
  out: AudioBuffer,
  ceiling: number,
): Promise<void> {
  const a = await voiceRms(src);
  const b = await voiceRms(out);
  if (a > 0 && b > 0) gain(out, a / b);
  const peak = peakOf(out);
  if (peak > ceiling) gain(out, ceiling / peak);
}

/** 곡 하나를 다듬어 돌려준다. 원본은 건드리지 않는다. */
export async function masterAudio(input: ArrayBuffer): Promise<AudioBuffer> {
  // decodeAudioContext 는 온라인 컨텍스트가 필요하다. 디코드에만 쓰고 닫는다.
  const AC: typeof AudioContext =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const decoder = new AC();
  let src: AudioBuffer;
  try {
    src = await decoder.decodeAudioData(input.slice(0));
  } finally {
    void decoder.close();
  }

  const ctx = new OfflineAudioContext(
    Math.max(src.numberOfChannels, 2),
    // 방 울림이 곡 끝에서 잘리지 않게 꼬리를 남긴다.
    src.length + Math.floor(src.sampleRate * ROOM_SEC),
    src.sampleRate,
  );

  const node = ctx.createBufferSource();
  node.buffer = src;

  const hp = biquad(ctx, 'highpass', HP_HZ, undefined, 0.7);
  const warm = biquad(ctx, 'lowshelf', WARM_HZ, WARM_DB);
  const harsh = biquad(ctx, 'peaking', HARSH_HZ, HARSH_DB, 1.1);
  const sheen = biquad(ctx, 'highshelf', SHEEN_HZ, SHEEN_DB);

  const shaper = ctx.createWaveShaper();
  shaper.curve = driveCurve(DRIVE);
  shaper.oversample = '4x';

  // 방 울림은 원음과 섞는다. 통째로 통과시키면 곡이 멀어진다.
  const dry = ctx.createGain();
  dry.gain.value = 1 - ROOM_WET;
  const wet = ctx.createGain();
  wet.gain.value = ROOM_WET;
  const room = ctx.createConvolver();
  room.buffer = roomImpulse(ctx, ROOM_SEC);

  /*
   * 붙이는 정도는 아주 얕게 잡는다.
   *
   * 처음에 -18dB / 2.5:1 로 걸고 뒤에서 1.25배 올렸더니, 원본보다 5LU 더
   * 크고 다이내믹은 8.4LU 에서 5.1LU 로 눌린 소리가 나왔다. 그건 따뜻해진
   * 게 아니라 그냥 커진 것이다. 크게 만들면 처음 몇 초는 좋아진 것 같지만
   * 30분짜리 회기에서는 귀가 먼저 지친다. 목표는 질감이지 음량이 아니다.
   */
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -12;
  glue.knee.value = 10;
  glue.ratio.value = 1.8;
  glue.attack.value = 0.02;
  glue.release.value = 0.3;

  const out = ctx.createGain();
  out.gain.value = 1.0;

  node.connect(hp);
  hp.connect(warm);
  warm.connect(harsh);
  harsh.connect(sheen);
  sheen.connect(shaper);
  shaper.connect(dry);
  shaper.connect(room);
  room.connect(wet);
  dry.connect(glue);
  wet.connect(glue);
  glue.connect(out);
  out.connect(ctx.destination);

  node.start();
  const rendered = await ctx.startRendering();
  await levelToSource(src, rendered, PEAK);
  return rendered;
}

/** 렌더 결과를 <audio> 가 읽을 수 있는 형태로. 16비트 WAV 면 충분하다. */
export function bufferToWav(buf: AudioBuffer): Blob {
  const chans = buf.numberOfChannels;
  const frames = buf.length;
  const bytes = 44 + frames * chans * 2;
  const view = new DataView(new ArrayBuffer(bytes));

  const ascii = (at: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(at + i, s.charCodeAt(i));
  };

  ascii(0, 'RIFF');
  view.setUint32(4, bytes - 8, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, chans, true);
  view.setUint32(24, buf.sampleRate, true);
  view.setUint32(28, buf.sampleRate * chans * 2, true);
  view.setUint16(32, chans * 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, frames * chans * 2, true);

  const data = Array.from({ length: chans }, (_, c) => buf.getChannelData(c));
  let at = 44;
  for (let i = 0; i < frames; i += 1) {
    for (let c = 0; c < chans; c += 1) {
      const v = Math.max(-1, Math.min(1, data[c][i]));
      view.setInt16(at, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      at += 2;
    }
  }
  return new Blob([view.buffer], { type: 'audio/wav' });
}

/**
 * 주소 하나를 받아 다듬은 소리의 주소를 돌려준다.
 *
 * 한 번 다듬은 것은 들고 있는다. 90초 곡을 렌더하는 데 1~2초가 걸리는데,
 * 재생 버튼을 누를 때마다 그만큼 기다리게 할 수는 없다.
 */
const cache = new Map<string, string>();

export async function masteredUrl(src: string): Promise<string> {
  const hit = cache.get(src);
  if (hit) return hit;
  const res = await fetch(src);
  const url = URL.createObjectURL(bufferToWav(await masterAudio(await res.arrayBuffer())));
  cache.set(src, url);
  return url;
}
