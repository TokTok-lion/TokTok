'use client';

import { useState } from 'react';
import { Card } from './ui';
import { CONSENT_LABELS, hasConsent, type ConsentKind } from '@/lib/domain';
import { CONSENT_PURPOSE } from './ConsentGate';
import { writeConsent } from '@/lib/repo';
import { forgetConsentCache } from '@/lib/groupConsent';
import type { GroupConsents } from '@/lib/useGroupConsents';

/**
 * 그룹 회기의 동의 — 어르신 한 분 한 분께 따로 여쭙고 그대로 적는다.
 *
 * ── 왜 필요했나
 *
 * 회기 준비 화면의 동의 확인은 오래 **기준 어르신 한 분**에게만 기록했다
 * (store.setConsent 가 state.elder 만 고친다). 1:1 회기에서는 그게 맞는 말이지만,
 * 그룹에서는 화면이 "박○○ 어르신은 녹음 동의가 없어요"라고 알려 주면서 정작
 * 그 동의를 받을 자리를 주지 않았다.
 *
 * 네 분을 모셔 놓고 여쭈었는데 적을 데가 없는 상태다. 그러면 복지사는 앱을
 * 덮고 종이에 적거나, 더 나쁘게는 "한 분만 눌러도 되겠지" 하고 넘어간다 —
 * 뒤엣것이 동의 없는 분의 목소리가 녹음되는 길이다.
 *
 * ── 사람마다 따로 적는 이유
 *
 * 동의는 회기가 아니라 사람에게 붙는 값이다. 한 번에 "전원 동의"로 처리하는
 * 버튼은 두지 않았다. 그 버튼은 실제로 여쭙지 않고 누르게 되어 있고, 그러면
 * 기록만 남고 동의는 없다.
 *
 * ── 거절도 그대로 적는다
 *
 * 거절이 막다른 길은 아니다(원칙 4). 녹음을 거절하시면 그 방은 녹음하지 않고
 * 복지사가 받아 적는다. 그 길은 이미 있다.
 */

const KINDS: ConsentKind[] = ['recording', 'externalAi'];

export function GroupConsentAsk({ group }: { group: GroupConsents }) {
  /** 지금 서버에 적는 중인 (어르신+항목). 두 번 눌리지 않게. */
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  if (group.loading) {
    return (
      <Card className="mt-3 p-4">
        <p role="status" className="text-[1rem] font-bold text-ink-700">
          어르신들의 동의를 확인하는 중이에요…
        </p>
      </Card>
    );
  }

  const decide = async (participantId: string, kind: ConsentKind, granted: boolean) => {
    const key = `${participantId}:${kind}`;
    setBusy(key);
    setFailed(null);
    const out = await writeConsent(participantId, kind, granted ? 'granted' : 'withdrawn');
    setBusy(null);
    if (!out.ok) {
      // 기록에 실패했으면 화면도 바꾸지 않는다. 표시만 바뀌고 서버에 없으면,
      // 다음에 이 회기를 열 때 동의가 사라져 있다.
      setFailed(out.reason ?? '기록하지 못했어요.');
      return;
    }
    // 짧게 기억해 둔 답을 비운다 — 안 비우면 방금 받은 동의가 30초 동안
    // 반영되지 않고, 그동안 마이크가 안 열린다.
    forgetConsentCache();
    group.reload();
  };

  return (
    <Card className="mt-3 p-4">
      <p className="text-[1.0625rem] font-extrabold text-ink-900">
        어르신 한 분씩 여쭤 주세요
      </p>
      <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-500">
        동의는 회기가 아니라 그분께 붙는 기록이에요. 한 번에 처리하는 버튼은
        두지 않았습니다 — 여쭙지 않고 누르게 되니까요.
      </p>

      <ul className="mt-3 space-y-3">
        {group.members.map((m) => (
          <li key={m.elder.id} className="rounded-[14px] bg-surface-sunk p-3.5">
            <p className="text-[1rem] font-extrabold text-ink-900">
              {m.elder.displayName} 어르신
            </p>
            {m.consents === null ? (
              // 못 읽은 것을 '미동의'로 그리지 않는다. 여쭐 필요가 없다는 뜻이
              // 아니라, 지금 기록을 못 읽었다는 뜻이다.
              <p className="mt-1 text-[0.875rem] font-bold text-danger-600">
                이 어르신의 동의 기록을 읽지 못했어요. 인터넷 연결을 확인해 주세요.
              </p>
            ) : null}

            {KINDS.map((kind) => {
              const on = m.consents ? hasConsent(m.consents, kind) : false;
              const key = `${m.elder.id}:${kind}`;
              return (
                <div key={kind} className="mt-2.5">
                  <p className="text-[0.9375rem] font-bold text-ink-900">
                    {CONSENT_LABELS[kind]}
                  </p>
                  <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-ink-500">
                    {CONSENT_PURPOSE[kind]}
                  </p>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      aria-pressed={on}
                      disabled={busy !== null}
                      onClick={() => void decide(m.elder.id, kind, true)}
                      className={`min-h-[52px] rounded-[12px] text-[0.9375rem] font-bold disabled:opacity-70 ${
                        on
                          ? 'bg-leaf-600 text-white'
                          : 'border-2 border-hairline bg-surface-strong text-ink-700'
                      }`}
                    >
                      {busy === key ? '적는 중…' : '동의하셨어요'}
                    </button>
                    <button
                      type="button"
                      aria-pressed={m.consents ? !on : false}
                      disabled={busy !== null}
                      onClick={() => void decide(m.elder.id, kind, false)}
                      className={`min-h-[52px] rounded-[12px] border-2 border-hairline bg-surface-strong text-[0.9375rem] font-bold text-ink-700 disabled:opacity-70`}
                    >
                      동의 안 하셨어요
                    </button>
                  </div>
                </div>
              );
            })}
          </li>
        ))}
      </ul>

      {failed ? (
        <p role="alert" className="mt-2 text-[0.875rem] font-bold text-danger-600">
          {failed} 표시는 바꾸지 않았어요 — 기록되지 않은 동의를 받은 것처럼
          보이게 두지 않습니다.
        </p>
      ) : null}

      <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
        녹음은 한 분이라도 동의하지 않으시면 켜지지 않아요. 방 하나를 녹음하면
        그 자리에 계신 분들 목소리가 전부 담기니까요. 그때는 녹음 없이 복지사가
        받아 적어 진행합니다.
      </p>
    </Card>
  );
}
