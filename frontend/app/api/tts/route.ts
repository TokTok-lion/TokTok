import { NextResponse } from 'next/server';

/**
 * 문장을 소리로 읽어 주기 (ElevenLabs).
 *
 * 서버에서만 돈다. 키가 브라우저로 나가면 남이 우리 한도를 대신 써 버린다.
 *
 * 왜 붙였나: 어르신 중에는 글씨가 잘 안 보이는 분이 많고, 복지사가 매번 큰
 * 소리로 질문을 읽어 드리는 것도 한 시간이면 지친다. 화면의 질문을 눌러
 * 들을 수 있으면 두 사람 다 편해진다 (NFR-A11Y).
 *
 * 한도가 빠듯하다(무료 10,000자/월). 그래서 두 가지를 넣었다.
 *   - flash 모델을 기본으로 쓴다. 같은 글자 수에 크레딧이 절반이고,
 *     질문 한 줄 읽는 데는 품질 차이가 거의 없다.
 *   - 길이를 잘라 낸다. 실수로 긴 글이 통째로 넘어가면 한 번에 한 달치가
 *     날아간다.
 *
 * 캐시는 클라이언트가 한다(lib/tts.ts). 질문은 정해져 있어서 기기마다 한 번만
 * 만들면 그다음부터는 한도를 쓰지 않는다.
 */

export const runtime = 'nodejs';

/** 또렷한 여성 중년 음성. 난청이 있으신 분이 많아 따뜻함보다 명료함을 골랐다. */
const DEFAULT_VOICE = 'Xb7hH8MSUJpSbSDYk0k2'; // Alice - Clear, Engaging Educator

/** 한 번에 읽어 줄 수 있는 최대 길이. 사고로 한도가 통째로 날아가는 것을 막는다. */
const MAX_CHARS = 400;

export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: '이 배포에는 읽어주기 기능이 설정되어 있지 않습니다.' },
      { status: 503 },
    );
  }

  let text: string;
  try {
    const body = (await req.json()) as { text?: string };
    text = (body.text ?? '').trim();
  } catch {
    return NextResponse.json({ error: '요청을 읽지 못했습니다.' }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ error: '읽을 내용이 없습니다.' }, { status: 400 });
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `한 번에 ${MAX_CHARS}자까지 읽어 드릴 수 있어요.` },
      { status: 413 },
    );
  }

  const voice = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE;
  const model = process.env.ELEVENLABS_MODEL || 'eleven_flash_v2_5';

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 20_000);

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': key },
        body: JSON.stringify({
          text,
          model_id: model,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            // 어르신께 읽어 드리는 것이라 또박또박 쪽으로 둔다
            speed: 0.9,
          },
        }),
        signal: ac.signal,
      },
    );
    clearTimeout(timer);

    if (!res.ok) {
      // 한도 초과(401/429)는 고장이 아니다. 화면에서 조용히 꺼지면 된다.
      console.error('elevenlabs tts failed', res.status);
      const quota = res.status === 401 || res.status === 429;
      return NextResponse.json(
        {
          error: quota
            ? '이번 달 읽어주기 한도를 다 썼어요. 회기는 그대로 진행하시면 됩니다.'
            : '읽어 드리지 못했어요.',
          quota,
        },
        { status: quota ? 429 : 502 },
      );
    }

    const audio = await res.arrayBuffer();
    return new NextResponse(audio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        // 같은 문장은 다시 만들지 않는다
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return NextResponse.json(
      { error: aborted ? '소리를 만드는 데 오래 걸려 멈췄어요.' : '읽어 드리지 못했어요.' },
      { status: 504 },
    );
  }
}
