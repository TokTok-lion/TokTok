/**
 * 어느 모델로 부를지, 그리고 그 모델이 받는 모양으로 부탁을 맞추는 곳.
 *
 * ── 왜 한곳에 모으나
 *
 * 모델 이름이 네 라우트에 흩어져 있었고, 그중 사실 추출만 'gpt-4o-mini' 를
 * **박아 두고** 있었다. 그래서 배포 환경변수 OPENAI_MODEL 을 올려도 정작
 * 가장 정확해야 할 자리 — 어르신 말씀에서 사실을 뽑는 자리 — 는 그대로
 * 작은 모델로 돌았다. 올렸다고 믿는 것과 올라간 것은 다르다.
 *
 * ── 왜 일마다 따로 정할 수 있게 하나
 *
 * 네 가지 일의 무게가 다르다. 사실 추출과 가사는 틀리면 어르신의 삶이
 * 잘못 적히고, 질문과 활동일지 초안은 사람이 곧바로 보고 고친다. 예산이
 * 한정돼 있으면 앞의 둘에 쓰는 편이 낫다.
 *
 *   OPENAI_MODEL              — 기본값 (안 정하면 gpt-4o-mini)
 *   OPENAI_MODEL_FACTS        — 사실 추출만 따로
 *   OPENAI_MODEL_LYRICS       — 가사만 따로
 *   OPENAI_MODEL_QUESTIONS    — 개인화 질문만 따로
 *   OPENAI_MODEL_LOG          — 활동일지 초안만 따로
 *
 * ── 왜 요청 모양까지 여기서 만드나
 *
 * 새 계열 모델(gpt-5·o 시리즈)은 max_tokens 를 받지 않고
 * max_completion_tokens 를 받으며, temperature 를 1 말고 다른 값으로 주면
 * 거절한다. 이름만 바꿔 끼우면 400 이 떨어지고, 화면에는 "가사를 만들지
 * 못했어요"만 뜬다 — 내일 아침 기관에서 그 화면을 보게 할 수는 없다.
 * 그래서 이름에 맞춰 모양을 여기서 갈아 준다.
 */

export type Purpose = 'facts' | 'lyrics' | 'questions' | 'log';

const ENV_BY_PURPOSE: Record<Purpose, string> = {
  facts: 'OPENAI_MODEL_FACTS',
  lyrics: 'OPENAI_MODEL_LYRICS',
  questions: 'OPENAI_MODEL_QUESTIONS',
  log: 'OPENAI_MODEL_LOG',
};

export const DEFAULT_MODEL = 'gpt-4o-mini';

/** 환경변수 묶음 — 테스트에서 가짜 값을 넣을 수 있게 좁게 잡는다. */
export type Env = Record<string, string | undefined>;

/** 이 일에 쓸 모델 이름. 일별 설정 → 기본 설정 → 안전한 기본값 순. */
export function modelFor(purpose: Purpose, env: Env = process.env): string {
  const one = env[ENV_BY_PURPOSE[purpose]]?.trim();
  if (one) return one;
  const all = env.OPENAI_MODEL?.trim();
  if (all) return all;
  return DEFAULT_MODEL;
}

/**
 * 정해진 길이·온도를 못 받는 계열인가.
 *
 * 이름으로 가른다. 확실히 아는 계열만 새 모양으로 보내고, 모르는 이름은
 * 예전 모양 그대로 둔다 — 모르는 것을 새 것으로 넘겨짚었다가 되레 거절당하는
 * 편보다 낫다.
 */
function reasoningStyle(model: string): boolean {
  const m = model.toLowerCase();
  return /^(gpt-5|o1|o3|o4)/.test(m);
}

export type ChatAsk = {
  model: string;
  messages: { role: 'system' | 'user'; content: string }[];
  /** 낮게 둘수록 재료에 붙는다. 새 계열에서는 조용히 버려진다. */
  temperature: number;
  maxTokens?: number;
  /** JSON 으로만 답하게 할 것인가. */
  json?: boolean;
};

/** OpenAI 채팅 API 가 받는 몸통으로 만든다. */
export function chatBody(ask: ChatAsk): Record<string, unknown> {
  const out: Record<string, unknown> = {
    model: ask.model,
    messages: ask.messages,
  };
  if (ask.json) out.response_format = { type: 'json_object' };

  if (reasoningStyle(ask.model)) {
    // temperature 는 아예 넣지 않는다. 1 이 아닌 값을 주면 거절한다.
    if (ask.maxTokens) out.max_completion_tokens = ask.maxTokens;
    return out;
  }

  out.temperature = ask.temperature;
  if (ask.maxTokens) out.max_tokens = ask.maxTokens;
  return out;
}
