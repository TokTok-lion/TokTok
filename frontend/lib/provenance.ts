// 확장자를 적는다 — 이 파일은 node --test 로도 직접 돌기 때문이다
// (lib/speechHints.ts 와 같은 이유).
import type { SourceKind, StoryItem } from './domain.ts';
import { lyricInputs } from './domain.ts';

/**
 * 이 노래가 무엇으로 만들어졌는지 — 숫자 하나로.
 *
 * ── 왜 만드나
 *
 * 재료는 처음부터 다 있었는데 쓰지 않고 있었다. 사실 문장마다 출처가 붙어
 * 있고(원칙 1), 가사는 그 문장들로만 만들어진다(원칙 2). 그러면 셀 수 있다 —
 * 이 노래가 어르신 말씀 몇 개에서 나왔는지, 근거를 못 찾아 버린 것이 몇
 * 개인지, 어느 대목의 음성이었는지.
 *
 * 이 서비스를 설명하는 데 지금은 열 문단이 든다. 이 숫자 하나면 기관
 * 담당자도 가족도 곧바로 안다. 그리고 이 숫자는 출처를 붙여 온 서비스만
 * 만들 수 있다 — 안 붙였으면 셀 것이 없다.
 *
 * ── 세지 않는 것
 *
 * 지난 회기 이야기는 이 기기의 story 에 없다. 그래서 이 숫자는 **이번 회기에
 * 정리한 이야기**에 대한 것이다. 화면이 그렇게 적는다 — 여러 회기를 모아 만든
 * 곡에서 이 수를 '노래 전체의 근거'라고 부르면 실제보다 작게 말하게 된다.
 */

export type Provenance = {
  /** 가사 재료가 될 수 있는 문장 — 확인됐고 출처가 붙은 것(lyricInputs 와 같은 기준). */
  used: number;
  /** 아직 어르신께 확인 못 한 문장. 노래에 들어가지 않았다. */
  unverified: number;
  /** 어르신이 빼 달라고 하신 문장. */
  excluded: number;
  /** 뽑기는 했는데 어느 대목에서 나왔는지 못 맞춰 버린 문장(api/facts 가 버린 수). */
  dropped: number;
  /** 쓰인 문장들에 붙은 출처의 총 개수. */
  sources: number;
  /** 출처 종류별 개수 — 음성인지 카드인지 복지사 기록인지. */
  byKind: Record<SourceKind, number>;
  /** 근거가 된 음성의 첫 자리와 마지막 자리(초). 음성 출처가 없으면 null. */
  voiceFrom: number | null;
  voiceTo: number | null;
};

const EMPTY_KINDS: Record<SourceKind, number> = {
  voice: 0,
  card: 0,
  staffNote: 0,
  family: 0,
};

export function provenanceOf(story: StoryItem[], dropped = 0): Provenance {
  // 둘러보기용 씨앗 항목은 세지 않는다. 예시를 근거처럼 세면 그 숫자가
  // 이 서비스에서 가장 먼저 못 믿을 숫자가 된다.
  const real = story.filter((i) => !i.example);
  const used = lyricInputs(real);

  const byKind = { ...EMPTY_KINDS };
  const at: number[] = [];
  let sources = 0;
  for (const item of used) {
    for (const src of item.sources) {
      sources += 1;
      byKind[src.kind] = (byKind[src.kind] ?? 0) + 1;
      if (src.kind === 'voice' && typeof src.at === 'number') at.push(src.at);
    }
  }

  return {
    used: used.length,
    unverified: real.filter((i) => i.status === 'unverified').length,
    excluded: real.filter((i) => i.status === 'excluded').length,
    dropped: Math.max(0, Math.round(dropped)),
    sources,
    byKind,
    voiceFrom: at.length ? Math.min(...at) : null,
    voiceTo: at.length ? Math.max(...at) : null,
  };
}
