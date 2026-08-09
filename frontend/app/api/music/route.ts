import { NextResponse } from 'next/server';

/**
 * 가사로 곡 만들기 (ElevenLabs Music).
 *
 * 가사에는 어르신의 생애가 들어 있다. 그래서 외부 AI 전송 동의(C-02)가
 * 있을 때만 부르며, 그 확인은 화면에서 한다.
 *
 * 특정 가수나 실존 곡을 흉내 내는 요청은 만들지 않는다 (원칙 14 · NFR-AI-007).
 * 스타일 목록 자체에 그런 항목이 없고, 여기서도 장르만 말한다. 어르신께
 * 드리는 곡이 남의 노래를 베낀 것이면 그건 선물이 아니다.
 */

export const runtime = 'nodejs';
export const maxDuration = 300;

/** 스타일 → 영어 지시문. 모델이 한국어 장르명을 정확히 못 알아듣는다. */
const STYLE_PROMPT: Record<string, string> = {
  folkTrad:
    'traditional Korean folk (minyo), warm and homely, acoustic — nylon ' +
    'guitar, daegeum flute and light janggu, around 76 BPM, gentle ' +
    'pentatonic melody',
  folkBright:
    'bright acoustic Korean folk, warm and cheerful — acoustic guitar, ' +
    'brushed snare and a little glockenspiel, around 92 BPM, easy ' +
    'singalong melody',
  ballad:
    'soft Korean ballad, tender and comforting — upright piano with a small ' +
    'string section, around 68 BPM, sparse arrangement',
  trot:
    'slow Korean trot (teuroteu), sentimental and nostalgic — electric organ, ' +
    'clean guitar and brushed drums, around 84 BPM, classic arrangement',
};

/**
 * 소리에서 "기계 티"를 줄이는 지시.
 *
 * 이 모델의 약점은 반주가 아니라 보컬이다. 호흡이 고르고 비브라토가 일정해서
 * 몇 초만 들어도 사람이 아니라는 걸 안다. 프롬프트로 없앨 수는 없지만, 어디서
 * 티가 나는지는 분명하다 — 굴리는 창법, 한 글자에 여러 음, 빈틈 없이 꽉 찬
 * 편곡, 지나치게 깨끗한 디지털 질감.
 *
 * 그래서 그 넷을 직접 금지한다. 한 글자에 한 음, 줄 사이에 숨, 악기는 적게,
 * 녹음은 따뜻하게. 목표가 음원이 아니라 어르신이 따라 부를 수 있는 노래라서,
 * 이 방향은 소리와 쓰임이 같은 곳을 본다.
 */
const VOICE_DIRECTION = [
  'Vocal: one warm mid-range voice, mature and unhurried, plain and',
  'conversational — not a pop belt, not breathy.',
  'Clear Korean diction: every word must be intelligible to an older listener.',
  'One note per syllable. No melisma, no runs, no heavy vibrato.',
  'Keep the melody within one octave, simple and hymn-like, so an 80-year-old',
  'can sing it back after hearing it once.',
  'Leave natural breaths between lines. Sparse arrangement — do not fill every bar.',
  'Warm analog recording character with a little room, no bright digital sheen.',
].join(' ');

/**
 * 곡 길이. 회상용 노래는 짧아야 한다 — 길면 어르신이 끝까지 듣기 어렵다.
 *
 * 요금이 길이에 정확히 비례한다(실측: 60초 750크레딧, 30초 378크레딧,
 * 초당 12.5). 즉 이 값이 원가를 그대로 정한다. 예산이 빠듯하면 여기부터
 * 줄이면 되고, 품질을 깎지 않고 조절할 수 있는 유일한 손잡이다.
 *
 * 90초로 잡은 이유: 만들어지는 가사가 3절 12줄인데 60초에 넣으면 한 줄에
 * 5초라 발라드로는 너무 빠르고, 모델이 내용을 뭉개거나 버린다. 어르신이
 * 본인 이야기를 듣는 노래에서 이야기가 잘려 나가면 곡을 만든 뜻이 없다.
 * 곡 수보다 이쪽이 먼저다 — 곡 수는 요금제로 늘릴 수 있지만 잘린 가사는
 * 되돌릴 수 없다.
 */
const LENGTH_MS = Number(process.env.MUSIC_LENGTH_MS) || 90_000;

export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: '이 배포에는 곡 만들기가 설정되어 있지 않습니다.' },
      { status: 503 },
    );
  }

  let style: string;
  let lyrics: string;
  let title: string;
  try {
    const body = (await req.json()) as {
      style?: string;
      lyrics?: string;
      title?: string;
    };
    style = body.style ?? 'ballad';
    lyrics = (body.lyrics ?? '').trim();
    title = (body.title ?? '').trim();
  } catch {
    return NextResponse.json({ error: '요청을 읽지 못했습니다.' }, { status: 400 });
  }

  if (!lyrics) {
    return NextResponse.json(
      { error: '가사가 없어 곡을 만들 수 없습니다.' },
      { status: 400 },
    );
  }

  const prompt = [
    `A gentle Korean song for an elderly person's life story.`,
    `Style: ${STYLE_PROMPT[style] ?? STYLE_PROMPT.ballad}.`,
    VOICE_DIRECTION,
    `Do not imitate any specific artist or existing song.`,
    title ? `Title: ${title}.` : '',
    `Lyrics:`,
    lyrics,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const ac = new AbortController();
    // 곡 생성은 오래 걸린다. 화면은 그동안 진행률을 보여 준다.
    const timer = setTimeout(() => ac.abort(), 240_000);

    const res = await fetch('https://api.elevenlabs.io/v1/music', {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        music_length_ms: LENGTH_MS,
        model_id: 'music_v1',
      }),
      signal: ac.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.error('elevenlabs music failed', res.status);
      // 402 는 고장이 아니라 요금제 문제다. 다른 실패와 구분해서 알린다 —
      // 원인이 다르면 할 일도 다르다.
      if (res.status === 402) {
        return NextResponse.json(
          {
            error:
              '곡 만들기는 유료 요금제에서만 됩니다. 지금은 가사까지 만들고 ' +
              '곡은 나중에 붙이실 수 있어요.',
            needsPaidPlan: true,
          },
          { status: 402 },
        );
      }
      const quota = res.status === 401 || res.status === 429;
      return NextResponse.json(
        {
          error: quota
            ? '이번 달 곡 만들기 한도를 다 썼어요.'
            : '곡을 만들지 못했어요. 가사는 그대로 남아 있습니다.',
          quota,
        },
        { status: quota ? 429 : 502 },
      );
    }

    const audio = await res.arrayBuffer();
    return new NextResponse(audio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        // 길이는 서버가 정한다. 곡을 기관 저장소에 기록할 때 필요하므로
        // 클라이언트가 되짚어 계산하지 않도록 함께 내려 준다.
        'X-Music-Length-Ms': String(LENGTH_MS),
      },
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return NextResponse.json(
      {
        error: aborted
          ? '곡 만들기에 시간이 오래 걸려 멈췄어요. 가사는 남아 있으니 다시 시도하실 수 있어요.'
          : '곡을 만들지 못했어요.',
      },
      { status: 504 },
    );
  }
}
