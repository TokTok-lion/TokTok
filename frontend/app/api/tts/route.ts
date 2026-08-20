import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/apiAuth';
import { tts } from '@/lib/providers';

/**
 * 문장을 소리로 읽어 주기.
 *
 * 서버에서만 돈다. 키가 브라우저로 나가면 남이 우리 한도를 대신 써 버린다.
 *
 * 왜 붙였나: 어르신 중에는 글씨가 잘 안 보이는 분이 많고, 복지사가 매번 큰
 * 소리로 질문을 읽어 드리는 것도 한 시간이면 지친다. 화면의 질문을 눌러
 * 들을 수 있으면 두 사람 다 편해진다 (NFR-A11Y).
 *
 * 캐시는 클라이언트가 한다(lib/tts.ts). 질문은 정해져 있어서 기기마다 한 번만
 * 만들면 그다음부터는 요금을 쓰지 않는다.
 */

export const runtime = 'nodejs';

export async function POST(req: Request) {
  /*
   * 로그인 없이는 부르지 못한다.
   *
   * 시연 자리에 다른 분들이 함께 들어온다. 둘러보기만으로도 화면은 다
   * 돌아가는데, 그 상태에서 이 주소를 부르면 우리 계정에서 요금이 나갔다.
   * 기관 한도(song_quota)는 로그인한 계정에만 걸려서, 로그인 안 한 쪽에는
   * 한도가 아예 없었다.
   *
   * 기관·복지사 로그인은 그대로다. 막는 것은 계정 없는 호출뿐이다.
   */
  // 읽어 주기도 글자 수만큼 요금이 나간다.
  const who = await requireUser(req);
  if (!who.ok) return NextResponse.json({ error: who.error }, { status: 401 });

  let text: string;
  try {
    const body = (await req.json()) as { text?: string };
    text = (body.text ?? '').trim();
  } catch {
    return NextResponse.json({ error: '요청을 읽지 못했습니다.' }, { status: 400 });
  }

  const out = await tts.speak(text);
  if (!out.ok) {
    return NextResponse.json({ error: out.error }, { status: out.status });
  }

  return new NextResponse(out.audio, {
    headers: {
      'Content-Type': out.contentType,
      // 같은 문장은 같은 소리다. 기기와 CDN 이 들고 있게 둔다.
      'Cache-Control': 'public, max-age=604800, immutable',
    },
  });
}
