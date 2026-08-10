import type { QuestionLevel } from './domain';

/**
 * 회상 인터뷰 질문지.
 *
 * 화면에 질문이 하나 뜨고 보조 질문이 셋 있었다. 그걸로 20~30분을 끌고 갈
 * 수는 없다 — 실제 회기는 어르신이 말문을 여시는 데만 몇 분이 걸린다.
 * 복지사가 "이제 뭘 여쭙지" 하고 멈추는 순간 어르신도 멈추신다.
 *
 * 그래서 카드마다 순서 있는 질문 흐름을 둔다. 순서에는 이유가 있다 —
 * 회상은 큰 것부터 물으면 안 나오고, 장면·사람·감각 같은 구체적인 것부터
 * 물어야 풀린다.
 *
 *   1. 장면    어디였는지 · 언제였는지        (대답하기 쉬운 것부터)
 *   2. 사람    누가 함께 있었는지
 *   3. 감각    소리 · 냄새 · 맛              (기억을 여는 열쇠다)
 *   4. 행동    무엇을 하며 지냈는지
 *   5. 사건    기억에 남는 하루
 *   6. 마음    그때 어떠셨는지               (감정은 뒤에 묻는다)
 *   7. 변화    그 뒤로 어떻게 되었는지
 *   8. 지금    지금 생각하면 어떠신지
 *   9. 전함    남기고 싶은 말                (노래로 갈 문장이 여기서 나온다)
 *
 * 이 문장들은 모델이 지어낸 것이 아니라 우리가 쓴 것이다. 그래서 어르신
 * 앞에서 무슨 말이 나올지 미리 알 수 있고, 같은 카드면 늘 같은 질문이
 * 나온다. 카드를 더하려면 SEED_MEMORY_CARDS 와 여기에 한 벌씩 더하면 된다.
 *
 * 감정을 앞에 두지 않은 이유가 하나 더 있다. "그때 어떠셨어요?"를 먼저
 * 여쭈면 대개 "좋았지" 한 마디로 끝난다. 장면과 사람을 먼저 놓아 드리면
 * 그 안에서 감정이 저절로 따라 나온다.
 */

export type PromptKind =
  | 'scene'
  | 'people'
  | 'sense'
  | 'doing'
  | 'event'
  | 'feel'
  | 'after'
  | 'now'
  | 'leave';

export type Prompt = { text: string; kind: PromptKind };

export const PROMPT_KIND_LABEL: Record<PromptKind, string> = {
  scene: '장면',
  people: '함께한 사람',
  sense: '소리·냄새',
  doing: '하시던 일',
  event: '기억에 남는 날',
  feel: '그때 마음',
  after: '그 뒤로',
  now: '지금 생각하면',
  leave: '남기고 싶은 말',
};

/** 카드를 아직 안 고른 회기에서 쓰는 흐름. 주제를 가리지 않는 문장들이다. */
export const OPEN_FLOW: Prompt[] = [
  { text: '어릴 적에 사시던 동네는 어떤 곳이었어요?', kind: 'scene' },
  { text: '그 집에는 누구누구 사셨어요?', kind: 'people' },
  { text: '아침에 눈뜨면 어떤 소리가 먼저 들렸어요?', kind: 'sense' },
  { text: '하루를 주로 어떻게 보내셨어요?', kind: 'doing' },
  { text: '그 시절에 제일 기억에 남는 날이 언제세요?', kind: 'event' },
  { text: '그날은 마음이 어떠셨어요?', kind: 'feel' },
  { text: '그 뒤로는 어떻게 지내셨어요?', kind: 'after' },
  { text: '지금 그때를 생각하면 어떤 마음이 드세요?', kind: 'now' },
  { text: '그 시절 이야기 중에 꼭 남기고 싶은 게 있으세요?', kind: 'leave' },
];

/**
 * 카드별 질문 흐름.
 *
 * 카드를 고르면 그 카드의 단계별 여는 질문(CARD_QUESTIONS)이 맨 앞에 서고,
 * 그 뒤로 이 흐름이 이어진다. 아홉 개 안팎이면 한 회기를 끌고 간다 —
 * 하나에 2~3분씩만 머물러도 20분이 넘는다.
 */
export const CARD_FLOW: Record<string, Prompt[]> = {
  friends: [
    { text: '그 친구는 어디 살았어요? 가까웠어요, 멀었어요?', kind: 'scene' },
    { text: '그 친구 이름이나 별명이 기억나세요?', kind: 'people' },
    { text: '둘이 만나면 주로 어디서 만났어요?', kind: 'scene' },
    { text: '같이 있을 때 무슨 소리가 많이 났어요? 웃음소리요, 아니면 조용했어요?', kind: 'sense' },
    { text: '둘이서 주로 무엇을 하며 지내셨어요?', kind: 'doing' },
    { text: '그 친구와 있었던 일 중에 제일 기억에 남는 날이 언제세요?', kind: 'event' },
    { text: '그 친구를 만나면 마음이 어떠셨어요?', kind: 'feel' },
    { text: '그 친구와는 언제까지 지내셨어요?', kind: 'after' },
    { text: '지금 그 친구를 만나면 무슨 말을 해 주고 싶으세요?', kind: 'leave' },
  ],
  family: [
    { text: '가족과 사시던 집은 어떤 집이었어요?', kind: 'scene' },
    { text: '그 집에 누구누구 계셨어요?', kind: 'people' },
    { text: '어머니가 해 주시던 음식 중에 뭐가 제일 생각나세요?', kind: 'sense' },
    { text: '식구들이 모이면 주로 무엇을 하셨어요?', kind: 'doing' },
    { text: '가족과 함께한 날 중에 특별히 기억나는 날이 있으세요?', kind: 'event' },
    { text: '그날 마음이 어떠셨어요?', kind: 'feel' },
    { text: '식구들은 그 뒤로 어떻게 지내셨어요?', kind: 'after' },
    { text: '지금 가족을 생각하면 어떤 마음이 드세요?', kind: 'now' },
    { text: '가족에게 꼭 남기고 싶은 말씀이 있으세요?', kind: 'leave' },
  ],
  school: [
    { text: '학교는 어디에 있었어요? 걸어 다니셨어요?', kind: 'scene' },
    { text: '학교 가는 길에 누구랑 같이 다니셨어요?', kind: 'people' },
    { text: '학교에서 어떤 냄새나 소리가 기억나세요?', kind: 'sense' },
    { text: '제일 좋아하던 시간은 무슨 시간이었어요?', kind: 'doing' },
    { text: '학교에서 있었던 일 중에 잊히지 않는 일이 있으세요?', kind: 'event' },
    { text: '그때 학교 가는 길은 어떤 기분이었어요?', kind: 'feel' },
    { text: '학교를 마치고는 무엇을 하셨어요?', kind: 'after' },
    { text: '지금 그 시절을 생각하면 어떠세요?', kind: 'now' },
    { text: '그때의 나에게 한마디 한다면 뭐라고 하고 싶으세요?', kind: 'leave' },
  ],
  play: [
    { text: '어릴 때 어디서 노셨어요? 마당이었어요, 골목이었어요?', kind: 'scene' },
    { text: '누구와 함께 노셨어요?', kind: 'people' },
    { text: '놀 때 어떤 소리가 났어요?', kind: 'sense' },
    { text: '그 놀이는 어떻게 하는 거였어요? 저한테 알려 주세요.', kind: 'doing' },
    { text: '놀다가 있었던 일 중에 웃긴 일이나 크게 혼난 일이 있으세요?', kind: 'event' },
    { text: '해 질 때까지 놀고 집에 들어갈 때 마음이 어떠셨어요?', kind: 'feel' },
    { text: '크시면서 그 놀이는 언제까지 하셨어요?', kind: 'after' },
    { text: '요즘 아이들이 노는 걸 보면 어떤 생각이 드세요?', kind: 'now' },
    { text: '그 시절 이야기 중에 남겨 두고 싶은 게 있으세요?', kind: 'leave' },
  ],
  holiday: [
    { text: '명절에는 어디로 가셨어요? 집에 계셨어요?', kind: 'scene' },
    { text: '명절에는 누가 모이셨어요?', kind: 'people' },
    { text: '명절 아침에 집에서 어떤 냄새가 났어요?', kind: 'sense' },
    { text: '명절 준비는 어떻게 하셨어요?', kind: 'doing' },
    { text: '기억에 남는 명절이 있으세요?', kind: 'event' },
    { text: '식구들이 다 모였을 때 마음이 어떠셨어요?', kind: 'feel' },
    { text: '명절 지내는 모습이 그 뒤로 많이 달라졌어요?', kind: 'after' },
    { text: '요즘 명절은 어떠세요?', kind: 'now' },
    { text: '명절 하면 꼭 남기고 싶은 이야기가 있으세요?', kind: 'leave' },
  ],
};

/**
 * 오늘 여쭐 질문들을 순서대로.
 *
 * 맨 앞은 고른 단계의 여는 질문이다 — 말문이 트이지 않으시면 선택형부터라는
 * 명세를 그대로 지킨다. 그 뒤로 흐름이 이어진다.
 */
export function interviewFlow(
  opener: string,
  card: string | null,
  level: QuestionLevel,
): Prompt[] {
  const rest = card ? CARD_FLOW[card] ?? OPEN_FLOW : OPEN_FLOW;
  // 여는 질문의 성격은 고른 단계가 정한다. 선택형은 장면을 여는 자리,
  // 회상형은 이미 이야기를 청하는 자리라 종류를 달리 적는다.
  const kind: PromptKind = level === 3 ? 'event' : 'scene';
  return [{ text: opener, kind }, ...rest];
}
