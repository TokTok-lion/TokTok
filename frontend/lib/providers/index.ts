import { googleStt } from './stt-google';
import { googleSttV2 } from './stt-google-v2';
import { googleTts } from './tts-google';
import { apiframeMusic } from './music-apiframe';
import { sunoMusic } from './music-suno';
import { trebloMusic } from './music-treblo';
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

/*
 * 전사 제공자.
 *
 * google   — v1 latest_long. 한국어 화자 분리가 안 된다(재서 확인).
 * googleV2 — v2 chirp_3. 화자 분리가 되고 m4a 도 읽는다. 다만 지금은 `eu`
 *            지역에서만 되므로 어르신 음성이 유럽으로 간다.
 *
 * 기본은 아직 v1 이다. 바꾸는 판단은 실제 회기 녹음 하나를 두 쪽으로 돌려
 * 보고 내려야 한다 — 합성음으로 정할 일이 아니다.
 */
export const stt: SttProvider = pick(
  process.env.STT_PROVIDER,
  { google: googleStt, googleV2: googleSttV2 },
  googleStt,
);
export const tts: TtsProvider = pick(process.env.TTS_PROVIDER, { google: googleTts }, googleTts);
/*
 * 곡은 Treblo 가 기본이다.
 *
 * Suno 로 가려 했지만 공개 API 가 없어서, 중계 서버가 헤드리스 브라우저로
 * 사람인 척 접속하고 hCaptcha 를 대행 서비스로 푸는 구조였다(2025년 1월부터).
 * 기관에 파는 서비스가 그 위에 설 수는 없다 — 계정이 막히면 그날로 멎고,
 * 어르신 이름이 붙은 결과물의 권리 관계를 설명할 수 없다.
 *
 * Treblo 는 열쇠 하나로 부르고 상업적 이용권을 함께 준다. 길이도 정할 수
 * 있어서 "회상용 노래는 120초"라는 결정을 지킬 수 있다.
 *
 * 지금 기본은 apiframe(Suno 경유)이다. 한국어 보컬 품질이 눈에 띄게 낫다.
 * 다만 그 회사는 Suno 와 제휴 관계가 아니라고 스스로 밝히므로, 권리 관계는
 * 그쪽 약관에 기대는 셈이다 — 기관과 계약하기 전에 확인해야 할 것이 하나
 * 남아 있다는 뜻이다.
 *
 * treblo 는 공식 API 에 상업권이 명확하고 길이도 정할 수 있다. 위험을
 * 낮추고 싶으면 이쪽이다.
 *
 * suno 는 직접 띄운 중계 서버용으로 남겨 둔다. 공식 파트너 API 가 열리면
 * 그 파일만 고치면 된다.
 */
export const music: MusicProvider = pick(
  process.env.MUSIC_PROVIDER,
  { apiframe: apiframeMusic, treblo: trebloMusic, suno: sunoMusic },
  apiframeMusic,
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
