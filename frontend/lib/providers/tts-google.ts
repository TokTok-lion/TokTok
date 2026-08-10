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

/**
 * 한국어 여성 음성. Neural2 가 또렷하고 값도 감당할 만하다.
 *
 * "낮고 차분한 쪽이 낫지 않냐"는 말을 듣고 남성 음성(ko-KR-Neural2-C)으로
 * 바꿀지 따져 봤다. 바꾸지 않기로 했다.
 *
 * 노인성 난청은 높은 소리부터 가져간다. 그래서 낮은 목소리가 유리한 것은
 * 맞는데, 그때 낮아져야 하는 것은 '기본 주파수'이지 '자음'이 아니다. 말을
 * 알아듣게 만드는 것은 높은 데 실린 자음(ㅅ·ㅊ·ㅋ)이고, 그건 낮은 목소리에서
 * 오히려 묻히기 쉽다. Neural2-A 는 그 자음이 또렷한 쪽이라 남겨 두고,
 * 기본 주파수만 아래 pitch 로 조금 내린다 — 두 가지를 다 가져가는 방향.
 *
 * 다만 이건 표로 정할 값이 아니다. 센터마다 기기도 방 크기도 다르니, 현장에서
 * 들어 보고 남성 음성이 낫다면 GOOGLE_TTS_VOICE=ko-KR-Neural2-C 로 바꾸면
 * 된다. 코드를 고칠 일이 아니다.
 */
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
            /*
             * 어르신께 읽어 드리는 소리라 늦추고 낮춘다.
             *
             * 0.9 였다. 0.85 로 더 내린다 — 나이가 들면 소리가 귀에 닿는 것과
             * 그것을 말로 알아듣는 것 사이의 시간이 길어진다. 잘 들리는데도
             * 되묻는 일이 생기는 이유가 그것이다. 0.85 는 보통 속도보다 15%
             * 느린 정도이고, 한 문장 안에서 앞말을 붙잡을 여유가 생긴다.
             *
             * 여기서 더 내리지 않는 이유도 적어 둔다. 0.8 아래로 가면 억양이
             * 평평해지고 낱말 사이가 벌어져서, 천천히 말하는 소리가 아니라
             * 늘어진 소리가 된다. 질문 한 줄을 듣는 데 오래 걸리면 그 사이에
             * 다른 데를 보신다. 느린 것과 지루한 것은 다르다.
             *
             * pitch 는 반음 단위다. -1 에서 -2 로. 노인성 난청은 높은 소리부터
             * 가져가므로 목소리의 바탕 높이를 조금 내리면 더 오래 남는 대역에
             * 걸린다. 여기서 더 내리면 성대의 울림새가 밀려 자음이 뭉개진다 —
             * 정작 알아듣게 해 주는 것이 그 자음이라 손해가 더 크다.
             *
             * 두 값 다 현장에서 들어 보고 바꿀 값이다. 다만 되돌릴 때는
             * 왜 되돌리는지 여기에 같이 적어라.
             */
            speakingRate: 0.85,
            pitch: -2,
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
