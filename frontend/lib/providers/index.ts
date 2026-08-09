import { googleStt } from './stt-google';
import { googleTts } from './tts-google';
import { sunoMusic } from './music-suno';
import type { MusicProvider, SttProvider, TtsProvider } from './types';

/**
 * 어느 업체를 쓸지 정하는 한 곳.
 *
 * 화면도 라우트도 여기만 부른다. 업체를 바꾸는 일이 "파일 하나 쓰고 이 표에
 * 한 줄 더하기"가 되도록 두었다 — 특정 업체에 묶이면, 그 업체가 문을 닫거나
 * 약관을 바꿀 때 제품이 같이 멈춘다.
 *
 * 실제로 한 번 갈아 끼웠다. 처음에는 전사·읽어주기·곡 만들기가 모두
 * ElevenLabs 였고, 지금은 앞의 둘이 Google, 곡은 Suno 중계 서버다.
 */

export const stt: SttProvider = pick(process.env.STT_PROVIDER, { google: googleStt }, googleStt);
export const tts: TtsProvider = pick(process.env.TTS_PROVIDER, { google: googleTts }, googleTts);
export const music: MusicProvider = pick(
  process.env.MUSIC_PROVIDER,
  { suno: sunoMusic },
  sunoMusic,
);

function pick<T>(name: string | undefined, table: Record<string, T>, fallback: T): T {
  if (!name) return fallback;
  const hit = table[name];
  if (!hit) {
    console.error(`알 수 없는 제공자: ${name} — 기본값으로 돕니다`);
    return fallback;
  }
  return hit;
}

export type { Segment } from './types';
