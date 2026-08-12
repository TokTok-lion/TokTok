// 확장자를 붙인 이유: 이 파일은 node --test 도 읽는다(lib/speechHints.test.ts).
// 노드의 해석기는 확장자 없는 상대 경로를 찾지 못한다.
import { SCENES, sceneForTopic } from './scenes.ts';

/**
 * 전사에 미리 알려 주는 낱말들 (Google STT · speechContexts).
 *
 * 왜 필요한지는 실측으로 확인했다. 잡음 하나 없는 합성음으로 회기 대사를
 * 읽혀 봤는데도 이렇게 나왔다.
 *
 *   "첫 월급"   → "차 벌금" · "처벌금"
 *   "열아홉에"  → "19배"
 *
 * 깨끗한 소리에서 이 정도면 요양기관 방에서 받은 어르신 음성은 더 나쁘다.
 * 그리고 이건 마이크로도 모델로도 안 고쳐지는 종류다 — 구글이 그 낱말을
 * 후보로 안 놓고 있는 것이라, 후보에 올려 주면 된다.
 *
 * 재료는 이미 있다. 주제 표(lib/scenes.ts)가 회기에서 나올 법한 낱말을
 * 스물넷 묶음으로 들고 있고, 오늘 어떤 주제인지도 앱이 안다. 그런데 지금까지
 * 그걸 구글에게 한 번도 알려 준 적이 없었다.
 *
 * 두 층으로 나눠 보낸다.
 *
 *   · 오늘 주제와 그 장면의 낱말 — 세게(boost 15)
 *   · 그 시절 살림살이 낱말 전반 — 약하게(boost 8)
 *
 * 전부 세게 밀면 반대로 틀린다. '김장' 회기에서 '군대'를 세게 올려 두면
 * 안 한 말이 튀어나온다. 오늘 이야기에 가까운 것만 세게 민다.
 */

/**
 * 그 시절 살림살이. 지금은 잘 안 쓰는 말이라 구글이 후보로 잘 안 놓는다.
 *
 * 어르신 성함이나 고향 지명은 넣지 않는다. 음성은 C-02(외부 전송) 동의를
 * 받고 나가지만, 신원을 낱말로 따로 얹어 보내는 것은 그 동의가 허락한 범위가
 * 아니다. 인식률을 조금 얻자고 넘을 선이 아니다.
 */
const ERA_WORDS = [
  // 일·살림
  '월급봉투', '구두방', '방앗간', '지게', '새참', '품앗이', '모내기', '보릿고개',
  '좌판', '됫박', '삯바느질', '재봉틀', '골무', '실패', '다듬이', '인두',
  // 집
  '댓돌', '툇마루', '아궁이', '가마솥', '연탄', '우물가', '빨래터', '장독대',
  '호롱불', '등잔불', '문패', '셋방', '단칸방',
  // 놀이·아이
  '굴렁쇠', '구슬치기', '자치기', '고무줄놀이', '딱지치기', '배냇저고리', '고무신',
  // 명절·예
  '차례상', '성묘', '세배', '명절빔', '송편', '떡국', '목기러기', '청실홍실',
  // 배움
  '국민학교', '야학', '주산', '붓글씨',
  // 소리
  '유성기', '전축', '라디오', '유행가',
  // 먹을거리
  '수제비', '미숫가루', '누룽지', '보리밥', '시래기', '김장',
];

/** 구글 제한: 구문 하나는 100자까지. 넘는 것은 도움이 안 되니 버린다. */
const MAX_PHRASE = 100;

export type SpeechContext = { phrases: string[]; boost: number };

/** 두 글자 미만·너무 긴 것·중복을 걸러 낸다. */
function clean(words: Iterable<string>, exclude?: Set<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of words) {
    const w = raw.trim();
    if ([...w].length < 2 || w.length > MAX_PHRASE) continue;
    if (seen.has(w) || exclude?.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
}

/**
 * 오늘 회기에 맞는 힌트를 만든다. 주제가 없으면 그 시절 낱말만 보낸다.
 *
 * 주제 문장 자체도 넣는다 — 복지사가 '첫 월급 타던 날'이라고 적었으면 그
 * 문장이 회기에서 실제로 오갈 말이다.
 */
export function speechContextsFor(topic: string | null | undefined): SpeechContext[] {
  const t = (topic ?? '').trim();
  const near: string[] = [];

  if (t) {
    near.push(t);
    // 이 주제가 고른 장면의 열쇠말이 곧 그 이야기의 낱말이다.
    near.push(...sceneForTopic(t).match);
  }

  const strong = clean(near);
  // 세게 미는 것을 약한 쪽에서 빼 준다. 같은 낱말이 두 층에 있으면 어느
  // 값이 이기는지 문서가 말해 주지 않는다 — 겹치지 않게 두는 편이 낫다.
  const wide = clean([...ERA_WORDS, ...SCENES.flatMap((s) => s.match)], new Set(strong));

  const out: SpeechContext[] = [];
  if (strong.length) out.push({ phrases: strong, boost: 15 });
  if (wide.length) out.push({ phrases: wide, boost: 8 });
  return out;
}
