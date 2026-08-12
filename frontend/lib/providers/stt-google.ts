import {
  audioConfigFor,
  fail,
  toSegments,
  UNSUPPORTED_AUDIO,
  type Fail,
  type Job,
  type Segment,
  type SttProvider,
} from './types';
import {
  GCS_BUCKET,
  gcsDelete,
  gcsStat,
  gcsUpload,
  googleToken,
  googleConfigured,
} from './google';

/**
 * 녹음을 글로 옮기기 (Google Cloud Speech-to-Text v1).
 *
 * 이 경로가 이 서비스에서 가장 민감하다 — 어르신 목소리가 기기를 떠난다.
 * 그래서 부르는 쪽에서 두 동의를 모두 확인한다 (C-01 녹음, C-02 외부 전송).
 *
 * 단어마다 시각을 함께 받는다(enableWordTimeOffsets). 이게 핵심이다. 그
 * 시각이 이야기 항목의 출처가 되고, 복지사가 "몇 분에 하신 말씀"을 손으로
 * 적지 않아도 출처 규칙이 지켜진다.
 *
 * 1분 넘는 음성은 Cloud Storage 를 거쳐야 한다. 회기 녹음은 5~30분이라
 * 예외 없이 그 길로 간다. 대신 전사가 끝나는 즉시 지운다.
 */

const OBJ_PREFIX = 'stt/';

/** 작업 표에 지울 대상까지 담아 둔다 — 다음 요청에서도 치울 수 있어야 한다. */
function packJob(operation: string, object: string): string {
  return `${operation}::${object}`;
}
function unpackJob(jobId: string): { operation: string; object: string } {
  const at = jobId.lastIndexOf('::');
  return at < 0
    ? { operation: jobId, object: '' }
    : { operation: jobId.slice(0, at), object: jobId.slice(at + 2) };
}

type Word = {
  word?: string;
  startTime?: string | number;
  endTime?: string | number;
  /**
   * 화자 표시. 이름이 두 개인 이유가 있다.
   *
   * speakerTag 는 예전 이름이고 1부터 올라가는 정수인데, 지금 문서는 이것을
   * "obsolete"로 적고 speakerLabel(문자열)을 쓰라고 한다. 그런데 v1 응답에는
   * 아직 speakerTag 로 오는 배포가 있다. 어느 쪽이 올지 모르니 둘 다 읽는다 —
   * 한쪽만 읽었다가 못 알아보면 화자 분리가 통째로 없는 것이 된다.
   */
  speakerTag?: number;
  speakerLabel?: string;
};

type Alt = {
  transcript?: string;
  words?: Word[];
};

/** 구글은 시각을 "12.300s" 또는 { seconds, nanos } 로 준다. */
function seconds(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v.replace('s', '')) || 0;
  if (v && typeof v === 'object') {
    const o = v as { seconds?: string | number; nanos?: number };
    return Number(o.seconds ?? 0) + (o.nanos ?? 0) / 1e9;
  }
  return 0;
}

/** 우리가 다루기 좋은 모양으로 옮긴 단어 하나. */
type W = { text: string; start: number; end: number; key: string | null };

/**
 * 이 단어를 누가 말했는가. 모르면 null.
 *
 * speakerTag 는 1부터다. 0 은 "안 붙었다"는 뜻이라 화자로 세면 안 된다 —
 * 0 을 한 명으로 세면 화자가 둘인 줄 알고 엉뚱하게 갈라진다.
 */
function speakerKey(w: Word): string | null {
  const label = typeof w.speakerLabel === 'string' ? w.speakerLabel.trim() : '';
  if (label) return label;
  if (typeof w.speakerTag === 'number' && w.speakerTag > 0) return `tag-${w.speakerTag}`;
  return null;
}

function sameWord(a: Word, b: Word | undefined): boolean {
  return !!b && a.word === b.word && seconds(a.startTime) === seconds(b.startTime);
}

/**
 * 화자 분리를 켜면 result 의 모양이 달라진다. 이 함수는 그 달라진 모양을
 * 알아보는 자리다.
 *
 * 구글 문서가 이렇게 적는다 — "transcript 는 result 마다 따로 이어지지만,
 * alternatives 안의 words 목록에는 지금까지의 모든 result 의 단어가 들어
 * 있다. 그러니 화자표가 붙은 전체 단어를 얻으려면 마지막 result 의 words 만
 * 가져오면 된다." 즉 words 는 누적이다.
 *
 * 여기를 모르고 예전 코드를 그대로 두면 조용히 망가진다. 예전 코드는 result
 * 마다 "첫 단어의 시각"을 그 줄의 시각으로 썼는데, 누적이면 모든 result 의
 * 첫 단어가 녹음 맨 앞 단어다 — 스무 줄이 전부 at: 0 이 된다. 출처를 눌러 그
 * 대목을 듣는 것이 이 제품의 핵심 장면인데, 전부 0:00 을 가리키면 그 장면이
 * 통째로 없어진다.
 *
 * 그래서 누적인지 아닌지를 먼저 확인한다. 화자 분리가 안 먹은 응답은 result
 * 마다 자기 단어만 들고 오고, 그걸 누적으로 착각해 마지막 것만 쓰면 앞부분
 * 말씀이 통째로 사라진다. 확인 방법은 겹침이다 — 누적이면 마지막 목록의
 * 앞머리가 첫 result 의 목록과 글자·시각까지 똑같다.
 */
function cumulativeWords(
  results: { alternatives?: Alt[] }[],
): { words: W[]; pooled: boolean } | null {
  const lists = results.map((r) => r.alternatives?.[0]?.words ?? []);
  // 한 result 라도 단어가 비어 있으면 그 줄은 이 목록에 없다는 뜻이다.
  // 근거가 반쪽이면 안 쓰는 편이 낫다.
  if (!lists.length || lists.some((ws) => !ws.length)) return null;

  /*
   * 누적인지 가리는 자리. 여기서 한 번 헛디뎠다.
   *
   * 처음엔 "제일 긴 목록"을 전체 단어로 삼았는데, 화자 분리가 안 먹은 응답
   * 에서 첫 result 가 마침 제일 길면 그 목록을 자기 자신과 견주게 된다.
   * 겹침 검사는 당연히 통과하고, 그 뒤 result 들의 말씀이 통째로 사라진다.
   * 조용히 없어지는 것이라 화면에는 "옮겼어요 — 12줄"이라고만 뜬다.
   *
   * 그래서 문서가 말하는 대로 마지막 목록을 본다. 누적이면 마지막 목록이 첫
   * 목록보다 반드시 길고(뒤 result 도 단어를 보태니까), 그 앞머리가 첫 목록과
   * 글자·시각까지 똑같다. 둘 다 맞을 때만 누적으로 친다.
   */
  const last = lists[lists.length - 1];
  const pooled =
    lists.length > 1 &&
    last.length > lists[0].length &&
    lists[0].every((w, i) => sameWord(w, last[i]));
  if (lists.length > 1 && !pooled) return null;

  const out: W[] = [];
  for (const w of last) {
    if (!w.word?.trim()) continue;
    const start = seconds(w.startTime);
    // endTime 이 없으면 길이를 0 으로 둔다. 없는 값을 지어내지 않는다 —
    // 아래에서 전부 0 이면 단어 수로 갈아탄다.
    const end = w.endTime === undefined ? start : Math.max(start, seconds(w.endTime));
    out.push({ text: w.word, start, end, key: speakerKey(w) });
  }
  if (!out.length) return null;
  /*
   * pooled 은 "누적이라는 것이 증명됐다"는 뜻이다. result 가 하나뿐이면 겹칠
   * 상대가 없어 알 수 없으므로 거짓이고, 그때는 화자가 갈리지 않는 한 예전
   * 방식(transcript)을 그대로 쓴다 — 그쪽 글이 더 곱다.
   */
  return { words: out, pooled };
}

/**
 * 누가 어르신인가 — 이 함수가 하는 일은 **추정**이다.
 *
 * 구글이 주는 것은 "1번 목소리 · 2번 목소리"까지다. 그중 누가 어르신인지는
 * 응답 어디에도 없고, 알 방법도 없다. 회기에서 말씀을 더 오래 하시는 쪽이
 * 어르신일 가능성이 높다는 것뿐이다 — 복지사는 묻고 어르신은 답하니까.
 * 하지만 말수가 적은 날도 있고, 복지사가 길게 설명한 날도 있다.
 *
 * 그래서 이 추정은 화면에서 뒤집을 수 있어야 한다(전사 교정 화면). 여기서
 * 정한 것이 마지막 말이 되면 안 된다.
 *
 * 화자가 하나뿐이면 null 을 낸다. 갈라지지 않은 것을 한쪽으로 몰아 붙이면
 * 복지사 질문이 어르신 말씀으로 둔갑한다 — 모르는 것은 모른다고 둔다.
 */
function guessElder(words: W[]): string | null {
  const spoken = new Map<string, number>();
  const said = new Map<string, number>();
  for (const w of words) {
    if (!w.key) continue;
    spoken.set(w.key, (spoken.get(w.key) ?? 0) + (w.end - w.start));
    said.set(w.key, (said.get(w.key) ?? 0) + 1);
  }
  if (spoken.size < 2) return null;

  // 발화 시간이 원칙이다. endTime 이 안 와서 전부 0 이면 단어 수로 잰다.
  const scale = [...spoken.values()].some((v) => v > 0) ? spoken : said;
  let best: string | null = null;
  let top = -1;
  for (const [key, v] of scale) {
    if (v > top) {
      top = v;
      best = key;
    }
  }
  return best;
}

/**
 * 말차례(turn)로 나눠 줄을 만든다. 화자가 갈리지 않았으면 null.
 *
 * 말차례 하나를 그대로 한 줄로 두지 않고 안에서 문장으로 더 나눈다. 어르신이
 * 40초를 내리 말씀하시면 그것이 한 말차례인데, 통째로 한 줄이면 그 줄의 시각
 * 하나가 40초 전체를 가리킨다 — 고치려던 문제가 그대로 남는다. 문장으로
 * 나누는 규칙(쉬는 자리·길이)은 toSegments 에 이미 있고, 업체가 달라져도
 * 같아야 하는 규칙이라 여기서 다시 쓰지 않는다.
 */
function byTurn(words: W[]): Segment[] | null {
  const elder = guessElder(words);
  if (!elder) return null;

  type Turn = { key: string; words: { text: string; start: number }[] };
  const turns: Turn[] = [];
  // 화자표가 빠진 단어는 앞사람 말에 잇는다. 맨 앞이 비어 있으면 처음으로
  // 화자표가 붙은 사람 것으로 본다 — 어느 쪽이든 말씀을 버리지는 않는다.
  let last = words.find((w) => w.key)?.key ?? '';
  let cur: Turn | null = null;
  for (const w of words) {
    const key = w.key ?? last;
    if (!cur || cur.key !== key) {
      cur = { key, words: [] };
      turns.push(cur);
    }
    cur.words.push({ text: w.text, start: w.start });
    last = key;
  }

  const out: Segment[] = [];
  for (const t of turns) {
    const speaker = t.key === elder ? ('elder' as const) : ('worker' as const);
    for (const seg of toSegments(t.words)) {
      out.push({ id: `seg-${out.length}`, text: seg.text, at: seg.at, speaker });
    }
  }
  return out.length ? out : null;
}

/**
 * 구글이 나눠 준 결과 하나를 화면의 한 줄로 쓴다.
 *
 * 예전에는 모든 단어를 한 통에 쏟아 넣고 우리가 다시 잘랐다. 60자가 넘으면
 * 끊었는데, 한국어는 단어별 시각이 서브워드로 오기 때문에 그 자르는 자리가
 * 단어 한가운데였다. 실제로 이렇게 나왔다:
 *
 *   "…어머니께 흰 고무신을 사"
 *   "드렸어요 어머니가 오시던 모습이…"
 *
 * 어르신께 읽어 드릴 문장이 두 동강 나는 것도 문제지만, 더 나쁜 것은 그
 * 다음이다 — 이 줄들이 그대로 사실 추출의 입력이 된다. "사"로 끝나는 문장
 * 에서 뽑을 수 있는 사실은 없다.
 *
 * 구글은 이미 문장 단위로 results 를 나눠 주고, 각 result 의 transcript 는
 * 띄어쓰기가 제대로 붙은 완성된 글이다. 그걸 쓰면 우리가 다시 자를 이유가
 * 없다. 시각은 그 result 의 첫 단어에서 가져온다 — 출처 "어르신 음성 0:42"가
 * 가리키는 자리다.
 *
 * 단어 시각이 아예 안 오는 경우에만 예전 방식으로 돌아간다.
 */
function byResult(results: { alternatives?: Alt[] }[]): Segment[] {
  const out: Segment[] = [];
  const words: { text: string; start: number }[] = [];

  for (const r of results) {
    const alt = r.alternatives?.[0];
    if (!alt) continue;

    for (const w of alt.words ?? []) {
      if (w.word) words.push({ text: w.word, start: seconds(w.startTime) });
    }

    const text = (alt.transcript ?? '').trim();
    if (!text) continue;
    // 첫 단어의 시각. 없으면 앞 줄에 이어 붙은 것으로 보고 같은 자리를 쓴다.
    const first = alt.words?.find((w) => w.word);
    const at = first ? seconds(first.startTime) : (out.at(-1)?.at ?? 0);
    out.push({ id: `seg-${out.length}`, text, at: Math.round(at) });
  }

  if (out.length) return out;
  return toSegments(words);
}

/**
 * 어느 길로 갈지 정한다.
 *
 * 화자 분리가 살아 있으면 단어 목록이 근거다 — 누가 말했는지도, 언제
 * 말했는지도 거기에만 있다. 살아 있지 않으면 예전 길(result 의 transcript)이
 * 낫다. 구글이 문장 단위로 띄어쓰기까지 붙여 주는 글이라, 우리가 조각을 다시
 * 이어 붙인 것보다 읽기 좋다.
 */
function collect(results: { alternatives?: Alt[] }[]): Segment[] {
  const pool = cumulativeWords(results);
  if (pool) {
    const turns = byTurn(pool.words);
    if (turns) return turns;
    // 화자가 갈리지 않았다. 그래도 누적이 확인된 응답이면 result 별 시각은
    // 못 쓴다(전부 녹음 맨 앞을 가리킨다). 단어 시각으로 문장을 나누되
    // speaker 는 붙이지 않는다.
    if (pool.pooled) {
      return toSegments(pool.words.map((w) => ({ text: w.text, start: w.start })));
    }
  }
  return byResult(results);
}

async function readOperation(operation: string): Promise<Job<Segment[]>> {
  // settled 를 안 붙인 실패 = "상태를 못 읽었다". 부르는 쪽이 이 차이로
  // 원음성을 지울지 말지를 가른다.
  const token = await googleToken();
  if (!token) return fail('구글 인증에 실패했어요.', 503);

  const res = await fetch(`https://speech.googleapis.com/v1/operations/${operation}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error('google stt operation failed', res.status);
    return fail('전사 상태를 확인하지 못했어요.', 502);
  }

  const json = (await res.json()) as {
    done?: boolean;
    error?: { message?: string };
    response?: { results?: { alternatives?: Alt[] }[] };
  };

  if (json.error) {
    // 구글이 실패로 끝냈다. 다시 물어봐도 같은 답이므로 원음성을 지워도 된다.
    console.error('google stt error', json.error.message);
    return fail('전사하지 못했어요. 녹음은 그대로 남아 있습니다.', 502, {
      settled: true,
    });
  }
  if (!json.done) return { ok: true, done: false, jobId: operation };

  const segments = collect(json.response?.results ?? []);
  if (!segments.length) {
    return fail(
      '말씀이 잡히지 않았어요. 마이크가 어르신 가까이 있었는지 확인해 주세요.',
      422,
      { settled: true },
    );
  }
  return { ok: true, done: true, value: segments };
}

/**
 * 올라와 있는 객체 하나로 전사를 건다. 두 입구(파일·업로드)가 여기서 만난다.
 *
 * 실패하면 객체를 지운다 — 시작도 못 한 전사를 위해 어르신 목소리가 남의
 * 저장소에 남아 있을 이유가 없다.
 */
async function recognize(
  object: string,
  contentType: string,
  token: string,
): Promise<Job<Segment[]>> {
  const audio = audioConfigFor(contentType);
  if (!audio) {
    await gcsDelete(object);
    return fail(UNSUPPORTED_AUDIO, 415, { settled: true });
  }

  const res = await fetch(
    'https://speech.googleapis.com/v1/speech:longrunningrecognize',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          // 녹음이 실제로 어떤 형식인지 그대로 말한다. 다시 인코딩하지
          // 않는다 — 브라우저에서 30분짜리를 변환하면 태블릿이 못 견딘다.
          ...audio,
          languageCode: 'ko-KR',
          enableWordTimeOffsets: true,
          enableAutomaticPunctuation: true,
          /*
           * 회기는 복지사가 묻고 어르신이 답하는 대화다. 갈라 놓지 않으면
           * 두 가지가 망가진다 — 사실 추출 입력에 복지사 질문이 섞이고,
           * 대화 전체가 한 덩어리로 떨어져 출처가 가리킬 자리를 잃는다.
           *
           * 마주 앉은 두 사람이니 최소·최대 모두 2 로 못 박는다. 열어 두면
           * 옆방 소리나 기침을 세 번째 사람으로 세는 일이 생긴다.
           */
          diarizationConfig: {
            enableSpeakerDiarization: true,
            minSpeakerCount: 2,
            maxSpeakerCount: 2,
          },
          // 긴 대화용 모델. 회상 인터뷰는 짧은 명령이 아니라 이야기다.
          model: 'latest_long',
        },
        audio: { uri: `gs://${GCS_BUCKET}/${object}` },
      }),
    },
  );

  if (!res.ok) {
    await gcsDelete(object);
    const quota = res.status === 429;
    console.error('google stt start failed', res.status);
    return fail(
      quota
        ? '이번 달 전사 한도를 다 썼어요. 복지사가 받아 적어 진행해 주세요.'
        : '전사하지 못했어요. 녹음은 그대로 남아 있습니다.',
      quota ? 429 : 502,
      { quota },
    );
  }

  const { name } = (await res.json()) as { name?: string };
  if (!name) {
    await gcsDelete(object);
    return fail('전사를 시작하지 못했어요.', 502);
  }
  return { ok: true, done: false, jobId: packJob(name, object) };
}

/** 두 입구가 공통으로 먼저 확인하는 것. */
function notReady(): Fail | null {
  if (!googleConfigured()) {
    return fail('이 배포에는 전사 기능이 설정되어 있지 않습니다.', 503);
  }
  if (!GCS_BUCKET) {
    return fail('전사용 저장소(GOOGLE_STT_BUCKET)가 설정되지 않았습니다.', 503);
  }
  return null;
}

export const googleStt: SttProvider = {
  name: 'google',

  async start(file) {
    const bad = notReady();
    if (bad) return bad;

    const token = await googleToken();
    if (!token) return fail('구글 인증에 실패했어요.', 503);

    const type = file.type || 'audio/webm';
    // 보내기 전에 형식부터 본다. 못 다루는 형식이면 어르신 목소리를 남의
    // 저장소에 올렸다가 지우는 왕복을 할 이유가 없다.
    if (!audioConfigFor(type)) return fail(UNSUPPORTED_AUDIO, 415, { settled: true });

    // 이름에 어르신 정보를 넣지 않는다. 잠깐 있다 사라질 파일이지만,
    // 그 잠깐 동안에도 파일 이름은 로그에 남는다.
    const object = `${OBJ_PREFIX}${crypto.randomUUID()}`;
    const uri = await gcsUpload(object, await file.arrayBuffer(), type);
    if (!uri) return fail('녹음을 전사 서버로 보내지 못했어요.', 502);

    return recognize(object, type, token);
  },

  async startUploaded(object, contentType) {
    const bad = notReady();
    if (bad) return bad;

    // 우리가 연 세션으로 올라온 것만 받는다. 이름 규칙을 벗어난 값이 오면
    // 남의 객체를 가리키게 만들 수 있다.
    if (!object.startsWith(OBJ_PREFIX) || object.includes('..')) {
      return fail('잘못된 업로드입니다.', 400, { settled: true });
    }

    const token = await googleToken();
    if (!token) return fail('구글 인증에 실패했어요.', 503);

    // 브라우저가 "다 올렸어요"라고 말하는 것만 믿지 않는다. 없는 파일로
    // 작업을 걸어 놓고 기다리는 자리이자, 요금이 나가는 자리다.
    const stat = await gcsStat(object);
    if (!stat) return fail('올린 녹음을 찾지 못했어요. 다시 올려 주세요.', 404, { settled: true });

    return recognize(object, contentType, token);
  },

  async poll(jobId) {
    const { operation, object } = unpackJob(jobId);
    const out = await readOperation(operation);

    /*
     * 원음성은 '작업이 끝났을 때'만 지운다.
     *
     * 예전에는 out.ok === false 이기만 하면 지웠다. 그런데 readOperation 이
     * 실패를 내는 이유 중 둘은 전사 실패가 아니라 **상태를 못 읽었다**이다 —
     * 토큰 갱신 일시 오류(503)와 operations 엔드포인트 순단(502). 센터
     * 와이파이에서 흔한 일이다.
     *
     * 그때 지워 버리면 구글 쪽에서는 멀쩡히 돌고 있는 전사가 근거를 잃는다.
     * 다시 물어볼 수도, 다시 보낼 수도 없다(원본은 기기에 있지만 이미 요금은
     * 나갔다). 어르신이 한 시간 들려주신 이야기가 와이파이 한 번 끊긴 것으로
     * 죽는 셈이다.
     *
     * 그래서 종결된 실패(구글이 error 로 끝냈다)와 못 읽은 실패를 가른다.
     * 못 읽었으면 오브젝트를 남기고 작업표도 그대로 들고 다닌다 — 다음에
     * 다시 물어보면 된다.
     */
    const settledFail = out.ok === false && out.settled === true;
    if (('done' in out && out.done) || settledFail) {
      if (object) void gcsDelete(object);
    }
    // 아직 진행 중이거나 상태를 못 읽었으면 지울 대상을 계속 들고 다닌다.
    if (out.ok === false && !settledFail) return { ...out, jobId };
    if (out.ok && !out.done) return { ok: true, done: false, jobId };
    return out;
  },
};
