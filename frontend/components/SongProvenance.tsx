'use client';

import { Card } from './ui';
import { formatDuration } from '@/lib/domain';
import { provenanceOf } from '@/lib/provenance';
import { useSession } from '@/lib/store';

/**
 * 이 노래가 무엇으로 만들어졌는가.
 *
 * ── 왜 이 카드가 필요한가
 *
 * 이 서비스를 말로 설명하려면 열 문단이 든다 — 출처를 붙이고, 확인을 받고,
 * 확인된 것만 가사로 보내고, 못 맞춘 것은 버린다. 그런데 그 모든 것이 이미
 * 숫자로 남아 있다. 세어서 보여 주면 기관 담당자도 가족도 곧바로 안다.
 *
 * 그리고 이 숫자는 출처를 붙여 온 서비스만 만들 수 있다. 안 붙였으면 셀
 * 것이 없다.
 *
 * ── 버린 수를 함께 적는 이유
 *
 * "근거를 못 찾아 2개를 버렸습니다"는 흠이 아니라 이 서비스가 하는 일
 * 자체다. 지어낸 문장을 걸러 냈다는 뜻이니까. 쓴 것만 적고 버린 것을 감추면
 * 그 걸러냄이 있었는지 알 길이 없다.
 *
 * ── 이번 회기 것만 센다
 *
 * 지난 회기 이야기는 이 기기의 story 에 없다. 그래서 여러 회기를 모아 만든
 * 곡이면 이 수는 노래 전체의 근거보다 작다. 화면이 그렇게 적는다 — 실제보다
 * 크게 말하지 않는 것이 이 카드의 존재 이유다.
 */
export function SongProvenance() {
  const { s } = useSession();
  const p = provenanceOf(s.story, s.factsDropped);

  // 셀 것이 없으면 아무 말도 하지 않는다. '0개로 만들었습니다'는 근거가
  // 아니라 사고 신호다.
  if (p.used === 0) return null;

  const span =
    p.voiceFrom !== null && p.voiceTo !== null && p.voiceTo > p.voiceFrom
      ? `${formatDuration(p.voiceFrom)}~${formatDuration(p.voiceTo)}`
      : null;

  return (
    <Card className="mt-4 border-2 border-leaf-300 p-4">
      <p className="text-[1.125rem] font-extrabold leading-snug text-ink-900">
        이 노래는 어르신 말씀 {p.used}개로 만들어졌어요
      </p>

      <ul className="mt-3 space-y-1.5">
        <Row label="근거가 붙은 문장" value={`${p.used}개`} />
        <Row label="출처" value={`${p.sources}곳`} />
        {p.dropped > 0 ? (
          <Row label="근거를 못 찾아 버린 문장" value={`${p.dropped}개`} />
        ) : null}
        {p.unverified > 0 ? (
          <Row label="확인 못 해 안 넣은 문장" value={`${p.unverified}개`} />
        ) : null}
        {p.excluded > 0 ? (
          <Row label="어르신이 빼 달라 하신 문장" value={`${p.excluded}개`} />
        ) : null}
        {span ? <Row label="어르신 음성" value={`${span} 구간`} /> : null}
      </ul>

      {/* 말씨는 개수보다 그 말 자체가 힘이 세다. 그대로 적는다. */}
      {s.lyricsKept.length ? (
        <div className="mt-3 border-t border-hairline pt-3">
          <p className="text-[0.9375rem] font-bold text-ink-900">
            어르신 말씨 그대로 {s.lyricsKept.length}대목
          </p>
          <p className="mt-1.5 flex flex-wrap gap-1.5">
            {s.lyricsKept.map((k) => (
              <span
                key={k}
                className="rounded-full bg-leaf-50 px-2.5 py-1 text-[0.875rem] font-bold text-leaf-800"
              >
                “{k}”
              </span>
            ))}
          </p>
        </div>
      ) : null}

      <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
        이번 회기에 정리한 이야기를 센 것이에요. 지난 회기 이야기까지 모아
        만드셨다면 실제 근거는 이보다 많습니다. 근거가 없는 문장은 노래에
        들어가지 않아요.
      </p>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="text-[0.9375rem] text-ink-700">{label}</span>
      <span className="shrink-0 text-[1rem] font-extrabold tabular-nums text-brand-700">
        {value}
      </span>
    </li>
  );
}
