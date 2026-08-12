'use client';

import type { StoryItem } from './domain';
import type { SessionState } from './store';

/**
 * 어느 목소리가 어느 어르신인가 — 그룹 회기에서 이야기의 임자를 정하는 길.
 *
 * ── 왜 목소리 단위인가
 *
 * 사실마다 "누구 말씀이세요?"를 물으면 스무 번을 누른다. 그런데 목소리는
 * 서넛뿐이고, 한 목소리는 회기 내내 같은 분의 것이다. 한 번 지정하면 그
 * 목소리에서 나온 사실이 전부 따라온다 — 스무 번이 서너 번이 된다.
 *
 * ── 왜 자동으로 하지 않는가
 *
 * 업체가 주는 것은 '1번 목소리 · 2번 목소리'까지다. 그게 김 어르신인지 박
 * 어르신인지는 응답 어디에도 없고, 앱이 알 방법도 없다. 지정하는 사람은
 * 그 자리에 계셨던 복지사뿐이다.
 *
 * 잘못 붙이면 김 어르신 생애지도에 박 어르신 이야기가 들어가고, 화면상으로는
 * 정상과 구분되지 않는다. 그래서 지정하지 않은 목소리는 **아무의 것도 아닌**
 * 채로 둔다 — 「함께 나눈 이야기」로 회기에만 남고 개인 기록에는 안 들어간다.
 * 모르는 것을 아는 척하지 않는 편이 언제나 낫다.
 */

export type VoiceInfo = {
  /** 업체가 준 화자 열쇠 그대로 */
  key: string;
  /** 이 목소리로 잡힌 줄 수 — 많이 말씀하신 목소리를 위에 둔다 */
  lines: number;
  /** 누구인지 알아보시라고 보여 드리는 첫 문장 */
  sample: string;
  /** 이 목소리가 처음 나온 시각(초) — 되짚어 들으실 수 있게 */
  at: number;
};

/**
 * 전사에서 어르신 목소리들을 뽑는다.
 *
 * 복지사 줄은 뺀다. 복지사가 누구인지는 지정할 일이 없고, 목록에 섞이면
 * 실수로 어르신으로 지정하게 된다.
 */
export function voicesIn(transcript: SessionState['transcript']): VoiceInfo[] {
  const by = new Map<string, VoiceInfo>();
  for (const line of transcript) {
    if (line.example) continue;
    if (line.speaker !== 'elder') continue;
    const key = line.voice;
    if (!key) continue;
    const got = by.get(key);
    if (got) {
      got.lines += 1;
      continue;
    }
    by.set(key, { key, lines: 1, sample: line.text, at: line.at });
  }
  return [...by.values()].sort((a, b) => b.lines - a.lines);
}

/**
 * 이 사실은 누구 말씀에서 나왔나 — 지정된 어르신의 id, 모르면 null.
 *
 * 사실에는 출처 시각이 붙어 있다(Source.at). 그 시각의 전사 줄을 찾아 그
 * 줄의 목소리를 보고, 그 목소리에 지정된 어르신을 돌려준다.
 *
 * 시각이 딱 맞지 않을 수 있어 가장 가까운 줄을 찾되, 너무 멀면 포기한다 —
 * 2초 넘게 떨어진 줄은 다른 말차례일 가능성이 높고, 그러면 남의 말씀을
 * 그분 것으로 붙이게 된다.
 */
export function ownerOfFact(item: StoryItem, s: SessionState): string | null {
  const spoken = (item.sources ?? []).filter((src) => typeof src.at === 'number');
  if (!spoken.length) return null;

  for (const src of spoken) {
    let best: SessionState['transcript'][number] | null = null;
    let gap = Number.POSITIVE_INFINITY;
    for (const line of s.transcript) {
      if (line.speaker !== 'elder' || !line.voice) continue;
      const d = Math.abs(line.at - (src.at as number));
      if (d < gap) {
        gap = d;
        best = line;
      }
    }
    if (best && gap <= 2 && best.voice) {
      const owner = s.voiceOwners[best.voice];
      if (owner) return owner;
    }
  }
  return null;
}
