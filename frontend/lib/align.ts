/**
 * 노래와 가사 줄을 맞춘다 (강제 정렬).
 *
 * ── 무엇이 문제였나
 *
 * 함께 부르기 화면은 "지금 이 줄을 부르고 있어요"를 큰 글씨로 띄운다. 그런데
 * 그 자리는 잰 값이 아니라 어림이었다 — 곡이 백이십 초고 줄이 열둘이면 십
 * 초마다 한 줄씩 넘겼다(useMusic.lineStarts). 전주가 길거나 후렴이 늘어지면
 * 반드시 어긋난다.
 *
 * 어르신 여러 분이 태블릿 하나를 건너다보며 따라 부르는 자리에서 글자가
 * 어긋나면, 그 순간 노래방이 아니게 된다.
 *
 * ── 어떻게 맞추나
 *
 * 우리는 가사를 **이미 알고 있다.** 그러니 받아쓰기를 새로 할 필요가 없다.
 * 만들어진 노래를 음성인식에 한 번 넣어 "몇 초에 어떤 소리가 났는지"만 받고,
 * 그것을 아는 가사에 겹쳐 놓으면 된다. 노래하는 목소리는 알아듣기 어려워서
 * 받아쓴 글자는 군데군데 틀린다 — 그래서 글자 하나하나를 늘어놓고 **어긋난
 * 자리를 견디는** 방식으로 맞춘다(전역 정렬).
 *
 * 맞춘 결과가 이 파일의 전부다. 소리를 다루는 부분은 여기 없다 — 그래야
 * 이 계산을 실제 곡 없이도 검증할 수 있다.
 *
 * ── 못 맞추면 못 맞췄다고 한다
 *
 * 몇 줄이 실제로 걸렸는지(anchored)를 함께 돌려준다. 적게 걸렸으면 화면은
 * 예전 어림으로 돌아가고 "어림"이라고 계속 적는다. 반쯤 맞은 정렬을 정확한
 * 척 내놓는 것이 지금보다 나쁘다 — 지금은 최소한 어림이라고 말은 하고 있다.
 */

/** 받아쓴 낱말 하나 — 무엇이, 몇 초에. */
export type HeardWord = { text: string; at: number };

export type Alignment = {
  /** 줄마다 시작 시각(초). 길이는 줄 수와 같다. */
  starts: number[];
  /** 그중 실제로 노래에서 걸린 줄 수. 나머지는 사이를 채운 값이다. */
  anchored: number;
};

/** 견줄 때는 띄어쓰기·문장부호를 지운다. 노래는 띄어 부르지 않는다. */
const NOISE = /[\s.,!?…·'"''""~\-—()[\]]/g;

type Cell = { ch: string; at: number; line: number };

/** 받아쓴 낱말을 글자 흐름으로 편다. 낱말 안에서는 시간을 고르게 나눈다. */
function heardChars(words: HeardWord[]): { ch: string; at: number }[] {
  const out: { ch: string; at: number }[] = [];
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    const text = w.text.replace(NOISE, '');
    if (!text) continue;
    // 다음 낱말이 시작하기 전까지를 이 낱말의 몫으로 본다. 마지막 낱말은
    // 글자당 0.2초로 둔다 — 마지막 줄의 시작만 알면 되므로 넉넉히 잡지 않는다.
    const next = words[i + 1]?.at;
    const span = typeof next === 'number' && next > w.at ? next - w.at : text.length * 0.2;
    for (let j = 0; j < text.length; j += 1) {
      out.push({ ch: text[j], at: w.at + (span * j) / text.length });
    }
  }
  return out;
}

/** 아는 가사를 글자 흐름으로 편다. 글자마다 몇 번째 줄인지 들고 간다. */
function lyricChars(lines: string[]): Cell[] {
  const out: Cell[] = [];
  lines.forEach((line, index) => {
    for (const ch of line.replace(NOISE, '')) out.push({ ch, at: 0, line: index });
  });
  return out;
}

const MATCH = 2;
const MISMATCH = -1;
const GAP = -1;

/**
 * 아는 가사와 받아쓴 글자를 통째로 겹친다 (Needleman–Wunsch).
 *
 * 부분 일치를 찾는 방식(지역 정렬)을 쓰지 않는 이유가 있다. 후렴은 같은 말이
 * 두 번 나오고, 지역 정렬은 그 둘을 구분하지 못해 뒤쪽 후렴을 앞쪽에 붙인다.
 * 노래는 순서대로 흐르므로 순서를 지키는 정렬이 맞다.
 *
 * 돌려주는 것은 가사 글자마다 짝지어진 받아쓰기 글자의 번호(없으면 -1)다.
 */
function align(lyric: Cell[], heard: { ch: string; at: number }[]): number[] {
  const n = lyric.length;
  const m = heard.length;
  const width = m + 1;

  // 점수표는 한 줄씩만 들고 간다. 되짚어 갈 길만 따로 적어 둔다.
  const back = new Uint8Array((n + 1) * width);
  let prev = new Int32Array(width);
  for (let j = 1; j <= m; j += 1) {
    prev[j] = j * GAP;
    back[j] = 2; // 왼쪽에서 왔다 (받아쓰기만 소비)
  }

  let cur = new Int32Array(width);
  for (let i = 1; i <= n; i += 1) {
    cur[0] = i * GAP;
    back[i * width] = 1; // 위에서 왔다 (가사만 소비)
    for (let j = 1; j <= m; j += 1) {
      const diag = prev[j - 1] + (lyric[i - 1].ch === heard[j - 1].ch ? MATCH : MISMATCH);
      const up = prev[j] + GAP;
      const left = cur[j - 1] + GAP;
      if (diag >= up && diag >= left) {
        cur[j] = diag;
        back[i * width + j] = 0;
      } else if (up >= left) {
        cur[j] = up;
        back[i * width + j] = 1;
      } else {
        cur[j] = left;
        back[i * width + j] = 2;
      }
    }
    const swap = prev;
    prev = cur;
    cur = swap;
  }

  const pair = new Array<number>(n).fill(-1);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const dir = back[i * width + j];
    if (dir === 0) {
      // 글자가 같을 때만 짝으로 인정한다. 어긋난 자리는 시각의 근거가 못 된다.
      if (lyric[i - 1].ch === heard[j - 1].ch) pair[i - 1] = j - 1;
      i -= 1;
      j -= 1;
    } else if (dir === 1) {
      i -= 1;
    } else {
      j -= 1;
    }
  }
  return pair;
}

/**
 * 줄마다 시작 시각을 낸다.
 *
 * 걸린 줄은 그 줄에서 처음 맞은 글자의 시각을 쓴다. 한 글자도 못 맞은 줄은
 * 앞뒤로 걸린 줄 사이를 고르게 나눠 채운다 — 비워 두면 화면이 그 줄에서
 * 멈춘다.
 */
export function alignLines(
  words: HeardWord[],
  lines: string[],
  duration: number,
): Alignment {
  const usable = lines.map((l) => l.replace(NOISE, ''));
  if (!lines.length) return { starts: [], anchored: 0 };
  if (!words.length || !usable.some(Boolean)) {
    return { starts: lines.map(() => 0), anchored: 0 };
  }

  const lyric = lyricChars(lines);
  const heard = heardChars(words);
  const pair = align(lyric, heard);

  // 줄마다 처음 맞은 자리의 시각.
  const anchor = new Array<number | null>(lines.length).fill(null);
  for (let k = 0; k < lyric.length; k += 1) {
    const at = pair[k];
    if (at < 0) continue;
    const line = lyric[k].line;
    if (anchor[line] === null) anchor[line] = heard[at].at;
  }

  /*
   * 시각은 뒤로만 간다. 잘못 걸린 한 줄이 앞으로 튀면 그 뒤가 전부 밀린다 —
   * 노래방 자막이 한 번 거꾸로 가면 복지사는 그 화면을 다시 안 쓴다.
   */
  let last = 0;
  for (let i = 0; i < anchor.length; i += 1) {
    const v = anchor[i];
    if (v === null) continue;
    if (v < last) anchor[i] = null;
    else last = v;
  }

  const anchored = anchor.filter((v) => v !== null).length;

  // 빈 자리를 앞뒤 사이로 채운다.
  const starts = new Array<number>(lines.length).fill(0);
  const end = duration > 0 ? duration : (anchor.filter((v): v is number => v !== null).at(-1) ?? 0);
  let i = 0;
  while (i < lines.length) {
    const here = anchor[i];
    if (here !== null) {
      starts[i] = here;
      i += 1;
      continue;
    }
    // 채울 구간의 앞뒤를 찾는다.
    const from = i > 0 ? starts[i - 1] : 0;
    let next = i;
    while (next < lines.length && anchor[next] === null) next += 1;
    const to = next < lines.length ? (anchor[next] as number) : end;
    const gaps = next - i + 1;
    for (let k = 0; k < next - i; k += 1) {
      starts[i + k] = from + ((to - from) * (k + 1)) / gaps;
    }
    i = next;
  }

  return { starts, anchored };
}
