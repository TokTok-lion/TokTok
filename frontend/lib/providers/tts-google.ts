import { fail, type TtsProvider } from './types';
import { googleConfigured, googleToken } from './google';

/**
 * 문장을 소리로 읽어 주기 (Google Cloud Text-to-Speech).
 *
 * 왜 붙였나: 어르신 중에는 글씨가 잘 안 보이는 분이 많고, 복지사가 매번 큰
 * 소리로 질문을 읽어 드리는 것도 한 시간이면 지친다. 화면의 질문을 눌러
 * 들을 수 있으면 두 사람 다 편해진다 (NFR-A11Y).
 *
 * 목소리는 또렷함을 먼저 본다. 난청이 있으신 분이 많아, 따뜻하지만 웅얼거리는
 * 소리보다 명료한 쪽이 낫다. 말 속도도 조금 늦춘다.
 *
 * 캐시는 클라이언트가 한다(lib/tts.ts). 질문은 정해져 있어서 기기마다 한 번만
 * 만들면 그다음부터는 요금이 들지 않는다.
 */

/** 한 번에 읽어 줄 최대 길이. 사고로 긴 글이 통째로 넘어가는 것을 막는다. */
const MAX_CHARS = 400;

/** 한국어 여성 음성. Neural2 가 또렷하고 값도 감당할 만하다. */
const DEFAULT_VOICE = 'ko-KR-Neural2-A';

export const googleTts: TtsProvider = {
  name: 'google',

  async speak(text) {
    if (!googleConfigured()) {
      return fail('이 배포에는 읽어주기 기능이 설정되어 있지 않습니다.', 503);
    }
    const body = text.trim();
    if (!body) return fail('읽을 내용이 없습니다.', 400);
    if (body.length > MAX_CHARS) {
      return fail(`한 번에 ${MAX_CHARS}자까지 읽어 드릴 수 있어요.`, 413);
    }

    const token = await googleToken();
    if (!token) return fail('구글 인증에 실패했어요.', 503);

    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 20_000);
      const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: body },
          voice: {
            languageCode: 'ko-KR',
            name: process.env.GOOGLE_TTS_VOICE || DEFAULT_VOICE,
          },
          audioConfig: {
            audioEncoding: 'MP3',
            // 어르신께 읽어 드리는 소리라 조금 늦추고 조금 낮춘다.
            speakingRate: 0.9,
            pitch: -1,
          },
        }),
        signal: ac.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        console.error('google tts failed', res.status);
        const quota = res.status === 429;
        return fail(
          quota ? '이번 달 읽어주기 한도를 다 썼어요.' : '읽어 드리지 못했어요.',
          quota ? 429 : 502,
          { quota },
        );
      }

      const { audioContent } = (await res.json()) as { audioContent?: string };
      if (!audioContent) return fail('읽어 드리지 못했어요.', 502);

      const bytes = Buffer.from(audioContent, 'base64');
      return {
        ok: true,
        audio: bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer,
        contentType: 'audio/mpeg',
      };
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError';
      return fail(aborted ? '읽어 드리는 데 시간이 오래 걸렸어요.' : '읽어 드리지 못했어요.', 504);
    }
  },
};
