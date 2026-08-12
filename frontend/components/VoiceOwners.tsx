'use client';

import { Card } from './ui';
import { isGroupSession, sessionMembers, setSessionField, useSession } from '@/lib/store';
import { voicesIn } from '@/lib/voiceOwners';

/**
 * 어느 목소리가 어느 어르신인가 — 그룹 회기에서만 나온다.
 *
 * ── 왜 목소리 단위인가
 *
 * 사실마다 "누구 말씀이세요?"를 물으면 스무 번을 누른다. 목소리는 서넛뿐이고
 * 한 목소리는 회기 내내 같은 분의 것이라, 한 번 지정하면 그 목소리에서 나온
 * 이야기가 전부 따라온다.
 *
 * ── 왜 사람이 하는가
 *
 * 업체가 주는 것은 '1번 목소리 · 2번 목소리'까지다. 그게 김 어르신인지 박
 * 어르신인지는 응답 어디에도 없고 앱이 알 방법도 없다. 아는 사람은 그 자리에
 * 계셨던 복지사뿐이다.
 *
 * ── 안 하셔도 된다
 *
 * 지정은 의무가 아니다. 지정하지 않은 목소리의 이야기는 「함께 나눈 이야기」로
 * 회기에만 남는다 — 그것도 온전한 기록이다. 다만 그 이야기는 개인 생애지도에는
 * 들어가지 않으므로, 어느 분의 생애로 남기고 싶으시면 여기서 지정하셔야 한다.
 *
 * 잘못 붙이는 것보다 비워 두는 편이 낫다. 김 어르신 생애지도에 박 어르신
 * 이야기가 들어가면 화면상으로는 정상과 구분되지 않는다.
 */
export function VoiceOwners() {
  const { s } = useSession();

  if (!isGroupSession(s)) return null;

  const voices = voicesIn(s.transcript);
  if (!voices.length) return null;

  const members = sessionMembers(s);

  const assign = (voice: string, elderId: string | null) => {
    const next = { ...s.voiceOwners };
    if (elderId) next[voice] = elderId;
    else delete next[voice];
    setSessionField('voiceOwners', next);
  };

  const mmss = (t: number) =>
    `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  return (
    <Card className="mt-4 border-2 border-leaf-300 p-4">
      <p className="text-[1.0625rem] font-extrabold text-ink-900">
        어느 목소리가 어느 어르신인가요?
      </p>
      <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-500">
        목소리는 갈랐지만 누구인지는 앱이 알 수 없어요. 지정하시면 그 목소리에서
        나온 이야기가 그분 기록으로 남습니다. <strong>안 하셔도 괜찮아요</strong> —
        지정하지 않으면 「함께 나눈 이야기」로 회기에만 남아요.
      </p>

      <ul className="mt-3 space-y-3">
        {voices.map((v, i) => (
          <li key={v.key} className="rounded-[14px] bg-surface-sunk p-3.5">
            <p className="text-[0.9375rem] font-bold text-ink-900">
              목소리 {i + 1}
              <span className="ml-2 text-[0.8125rem] font-semibold text-ink-500">
                {v.lines}줄 · 처음 {mmss(v.at)}
              </span>
            </p>
            {/* 어느 목소리인지 알아보시라고 첫 문장을 보여 드린다. 번호만
                있으면 무엇을 고르는지 알 수 없다. */}
            <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-700">
              “{v.sample}”
            </p>

            <div className="mt-2.5 flex flex-wrap gap-2">
              {members.map((m) => {
                const on = s.voiceOwners[v.key] === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => assign(v.key, on ? null : m.id)}
                    className={`min-h-[44px] rounded-[12px] border-2 px-3.5 text-[0.9375rem] font-bold ${
                      on
                        ? 'border-leaf-500 bg-leaf-50 text-leaf-800'
                        : 'border-hairline bg-surface text-ink-700'
                    }`}
                  >
                    {m.displayName}
                  </button>
                );
              })}
              {/* 모르겠는 것을 모른다고 두는 자리. 잘못 붙이는 것보다 낫다. */}
              <button
                type="button"
                aria-pressed={!s.voiceOwners[v.key]}
                onClick={() => assign(v.key, null)}
                className={`min-h-[44px] rounded-[12px] border-2 px-3.5 text-[0.9375rem] font-bold ${
                  !s.voiceOwners[v.key]
                    ? 'border-brand-300 bg-brand-50 text-brand-800'
                    : 'border-hairline bg-surface text-ink-500'
                }`}
              >
                모르겠어요
              </button>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
        목소리가 실제보다 적게 갈렸다면 두 분 말씀이 한 목소리로 뭉친 거예요.
        그때는 지정하지 마시고 「모르겠어요」로 두세요 — 한 분 것으로 붙이면 다른
        분의 생애가 그분 기록에 들어갑니다.
      </p>
    </Card>
  );
}
