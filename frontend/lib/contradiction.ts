/**
 * 생애사 모순 탐지.
 *
 * 회상 인터뷰는 한 번으로 끝나지 않는다. 같은 이야기를 여러 회기에 걸쳐
 * 다시 하시고, 그때마다 나이나 연도가 조금씩 달라진다. 지금까지는 그 차이를
 * 아무도 못 보고 지나갔다 — 회기 기록이 따로따로 쌓이기 때문이다.
 *
 * 여기서 하는 일은 단순하다. 같은 사건을 가리키는 문장들을 모아, 숫자가
 * 어긋나면 짚어 준다. 그리고 그것을 "틀렸다"가 아니라 "다시 여쭤볼 것"으로
 * 바꾼다. 되묻기는 회상요법에서 그 자체로 의미 있는 개입이고, 무엇보다
 * 최종 판단은 어르신이 한다(원칙 1).
 *
 * 일부러 LLM 을 쓰지 않았다. 이건 판단이 아니라 대조다. 규칙으로 풀리는 것을
 * 모델에 맡기면 결과가 매번 달라지고, 왜 그렇게 봤는지 설명할 수 없게 된다.
 */

export type FactRef = {
  id: string;
  text: string;
  /** '3회기 · 5월 2일' 처럼 사람이 읽는 표기 */
  when: string;
};

export type Unit = 'age' | 'year' | 'count';

export type Contradiction = {
  id: string;
  unit: Unit;
  earlier: FactRef;
  later: FactRef;
  values: [number, number];
  /** 같은 사건으로 본 근거 */
  shared: string[];
  /** 어르신께 드릴 되묻기 질문 */
  question: string;
};

/* ---------------------------------------------------- 한국어 수 읽기 */

const NATIVE: Record<string, number> = {
  하나: 1, 한: 1, 둘: 2, 두: 2, 셋: 3, 세: 3, 넷: 4, 네: 4,
  다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9,
  열: 10, 스물: 20, 스무: 20, 서른: 30, 마흔: 40, 쉰: 50,
  예순: 60, 일흔: 70, 여든: 80, 아흔: 90,
};

const TENS = ['아흔', '여든', '일흔', '예순', '쉰', '마흔', '서른', '스물', '스무', '열'];
const ONES = ['하나', '한', '둘', '두', '셋', '세', '넷', '네', '다섯', '여섯', '일곱', '여덟', '아홉'];

/**
 * '열아홉', '스물둘', '스무' 같은 고유어 수를 숫자로.
 * 십의 자리와 일의 자리가 붙어 나오므로 긴 것부터 맞춰 본다.
 */
function readNativeNumber(text: string): number | null {
  for (const t of TENS) {
    const i = text.indexOf(t);
    if (i === -1) continue;
    const rest = text.slice(i + t.length);
    for (const o of ONES) {
      if (rest.startsWith(o)) return NATIVE[t] + NATIVE[o];
    }
    return NATIVE[t];
  }
  for (const o of ONES) {
    if (text.includes(o)) return NATIVE[o];
  }
  return null;
}

/* 고유어 수 뒤에 붙는 꼬리. '열아홉에', '스무 살', '스물둘 때' 를 잡는다.
   꼬리를 요구하는 이유는 '열심히'의 '열' 같은 것을 수로 읽지 않기 위해서다. */
const NATIVE_RE = new RegExp(
  `(?:(${TENS.join('|')})\\s*(${ONES.join('|')})?|(${ONES.join('|')}))\\s*(살|세|에|때)`,
  'g',
);

/** 문장에서 (단위, 값)을 뽑는다. 못 찾으면 빈 배열. */
export function extractValues(text: string): { unit: Unit; value: number }[] {
  const out: { unit: Unit; value: number }[] = [];

  // 숫자로 적힌 경우: 19살, 1950년, 3명
  for (const m of text.matchAll(/(\d{1,4})\s*(살|세|년|명|개)/g)) {
    const n = Number(m[1]);
    const u = m[2];
    out.push({ unit: u === '년' ? 'year' : u === '살' || u === '세' ? 'age' : 'count', value: n });
  }

  // 고유어로 적힌 경우: '열아홉에', '스무 살', '스물둘 때'
  for (const m of text.matchAll(NATIVE_RE)) {
    const [, tens, ones, alone] = m;
    const value = tens
      ? NATIVE[tens] + (ones ? NATIVE[ones] : 0)
      : alone
        ? NATIVE[alone]
        : 0;
    if (value > 0 && !out.some((v) => v.unit === 'age' && v.value === value)) {
      out.push({ unit: 'age', value });
    }
  }

  return out;
}

/* ------------------------------------------------------ 같은 사건인가 */

const PARTICLES =
  /(으로서|에서는|에서|으로|에게|께서|한테|부터|까지|이라고|라고|이며|하고|와의|과의|은|는|이|가|을|를|에|의|도|만|와|과|로)$/;

const STOP = new Set([
  '그때', '그날', '이야기', '기억', '말씀', '어르신', '당시', '처음', '다시',
  '아주', '정말', '조금', '많이', '그리고', '그런데', '하지만',
]);

/** 조사를 떼고 의미 있는 낱말만 남긴다. */
export function keywords(text: string): string[] {
  return text
    .replace(/[^가-힣0-9\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(PARTICLES, ''))
    .filter((w) => w.length >= 2 && !STOP.has(w) && readNativeNumber(w) === null)
    .map((w) => w.trim());
}

/**
 * 두 문장이 같은 사건을 가리키는가.
 *
 * 낱말이 하나라도 겹치면 같은 사건으로 본다. 느슨해 보이지만 이 단계에서
 * 놓치는 것보다 넉넉히 잡아 사람이 거르는 편이 낫다 — 어차피 최종 판단은
 * 복지사와 어르신이 한다.
 */
function sharedKeywords(a: string, b: string): string[] {
  const ka = new Set(keywords(a));
  return keywords(b).filter((w) => ka.has(w));
}

const UNIT_LABEL: Record<Unit, string> = { age: '살', year: '년', count: '' };

/* ------------------------------------------------------------- 본체 */

/**
 * 지난 회기 기록과 이번 회기 기록을 맞춰 본다.
 *
 * 같은 사건인데 나이·연도·개수가 다르면 하나씩 돌려준다. 한 쌍은 한 번만
 * 나온다 — 같은 지적을 여러 번 보여 주면 복지사가 전부 무시하게 된다.
 */
export function findContradictions(
  past: FactRef[],
  current: FactRef[],
): Contradiction[] {
  const found: Contradiction[] = [];
  const seen = new Set<string>();

  for (const older of past) {
    const olderVals = extractValues(older.text);
    if (!olderVals.length) continue;

    for (const newer of current) {
      const newerVals = extractValues(newer.text);
      if (!newerVals.length) continue;

      const shared = sharedKeywords(older.text, newer.text);
      if (!shared.length) continue;

      for (const ov of olderVals) {
        for (const nv of newerVals) {
          if (ov.unit !== nv.unit || ov.value === nv.value) continue;

          const key = `${older.id}|${newer.id}|${ov.unit}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const u = UNIT_LABEL[ov.unit];
          found.push({
            id: key,
            unit: ov.unit,
            earlier: older,
            later: newer,
            values: [ov.value, nv.value],
            shared,
            question: `${shared[0]} 이야기를 다시 해 주셨는데, ${older.when}에는 ${ov.value}${u}, 이번에는 ${nv.value}${u}이라고 하셨어요. 어느 쪽이 맞는지 여쭤봐 주세요.`,
          });
        }
      }
    }
  }

  return found;
}
