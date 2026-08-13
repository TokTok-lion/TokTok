import { NextResponse } from 'next/server';
import { UNSUPPORTED_AUDIO } from '@/lib/providers/types';
import { stt } from '@/lib/providers';
import { requireUser } from '@/lib/apiAuth';
import { gcsSignedPutUrl, googleConfigured, GCS_BUCKET } from '@/lib/providers/google';

/**
 * 긴 녹음을 저장소로 바로 올릴 주소를 연다.
 *
 * 왜 이 라우트가 있나. 녹음이 우리 함수를 거쳐 가면 Vercel 의 요청 본문 한도
 * (4.5MB)에 걸린다. 그건 설정으로 못 올리는 인프라 제약이라, 지금까지는
 * 4MB 에서 잘랐다 — 5분 넘는 회기는 구글에 닿지도 못하고 413 이었고, 화면은
 * "20분 이내로 나눠서"라고 말했지만 20분은 그보다 네 배 크다.
 *
 * 그래서 바이트는 함수를 안 거치게 한다. 서버는 주소만 열고, 브라우저가
 * 저장소로 바로 올린다. 파일이 함수를 지나지 않으면 한도가 적용되지 않는다.
 *
 * 여기서 형식을 먼저 본다. 못 다루는 형식(m4a·aac)을 30분어치 올린 다음에
 * 거절하면, 어르신 목소리가 남의 저장소에 한 번 올라갔다 오는 셈이고
 * 복지사는 그 시간을 버린다. 올리기 전에 말하는 편이 낫다.
 */

export const runtime = 'nodejs';

export async function POST(req: Request) {
  /*
   * 누가 부르는지 먼저 확인한다.
   *
   * 이 라우트가 내주는 것은 '저장소에 바이트를 쓸 수 있는 주소'다. 크기
   * 제한도 없다 — 함수를 안 거치는 것이 이 길의 요점이라 걸 자리가 없다.
   * 그래서 확인이 앞에 있어야 한다. 안 그러면 버킷이 남의 저장소가 되고,
   * 이어서 전사를 걸면 그 달 한도가 마른다. 한도가 마르면 화면은 복지사에게
   * '받아 적어 진행해 주세요'라고 말한다.
   */
  const who = await requireUser(req);
  if (!who.ok) return NextResponse.json({ error: who.error }, { status: 401 });

  if (!googleConfigured() || !GCS_BUCKET) {
    return NextResponse.json(
      { error: '이 배포에는 전사 기능이 설정되어 있지 않습니다.' },
      { status: 503 },
    );
  }

  let contentType = '';
  try {
    const body = (await req.json()) as { contentType?: string };
    contentType = (body.contentType ?? '').trim();
  } catch {
    return NextResponse.json({ error: '요청을 읽지 못했습니다.' }, { status: 400 });
  }

  if (!contentType) {
    return NextResponse.json({ error: '녹음 형식이 없습니다.' }, { status: 400 });
  }
  // 무엇을 받을 수 있는지는 제공자가 안다(업체마다 다르다).
  if (!stt.accepts(contentType)) {
    return NextResponse.json({ error: UNSUPPORTED_AUDIO }, { status: 415 });
  }

  // 이름에 어르신 정보를 넣지 않는다. 하루면 사라지는 파일이지만 그동안에도
  // 이름은 로그에 남는다. 접두어는 전사 쪽이 "우리가 연 세션인지" 가리는
  // 근거이기도 하다(stt-google · startUploaded).
  const object = `stt/${crypto.randomUUID()}`;
  /*
   * 서명된 PUT 주소를 준다.
   *
   * 예전에는 서버가 재개형 업로드 세션을 열어 그 주소를 넘겼다. 브라우저가
   * 그 주소로 PUT 하면 응답을 아예 못 받는다 — 버킷 CORS 를 열어 준 뒤에도
   * 그랬다. 세션을 연 쪽과 쓰는 쪽이 다르면 그 세션은 브라우저 것이 아니다.
   * 같은 시각에 잰 값: 서명 없는 PUT 은 403(서버까지 닿음), 세션 주소는 못 닿음.
   */
  const uploadUrl = await gcsSignedPutUrl(object);
  if (!uploadUrl) {
    return NextResponse.json({ error: '업로드 주소를 열지 못했어요.' }, { status: 502 });
  }

  return NextResponse.json({ uploadUrl, object });
}
