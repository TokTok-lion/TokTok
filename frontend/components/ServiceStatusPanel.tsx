'use client';

import { useEffect, useState } from 'react';
import { Card } from './ui';
import { readParticipantStatus, setParticipantStatus } from '@/lib/repo';
import { SERVICE_STATUS_LABELS, type ServiceStatus } from '@/lib/seed';

/**
 * 어르신 이용 상태 — 이용 중 · 일시중지 · 종료.
 *
 * ── 왜 필요한가
 *
 * 목록에 「이용 중/일시중지/종료」 거르개가 있는데 그 값을 바꾸는 길이
 * 어디에도 없었다. 그래서 등록한 모든 어르신이 영영 이용 중이었고, 나머지 두
 * 거르개는 언제 눌러도 0명이었다.
 *
 * 실제로는 자주 일어난다 — 입원하시거나 한동안 안 나오시면 일시중지,
 * 퇴소하시면 종료. 스무 분이 넘어가면 이 구분 없는 목록은 못 쓴다.
 *
 * ── 되돌릴 수 있다
 *
 * 종료하신 분을 다시 이용 중으로 되돌릴 수 있다. 다시 오시는 일이 있고,
 * 잘못 눌렀을 수도 있다. 되돌릴 수 없게 만들면 아무도 상태를 안 바꾼다.
 *
 * 종료는 **지우는 것이 아니다.** 목록에서 내리는 표시일 뿐, 그분의 이야기와
 * 노래와 기록은 그대로 남는다. 그 사실을 화면에 적어 둔다 — 안 적으면
 * 복지사가 '종료'를 삭제로 읽고 누르지 못한다.
 */

const ORDER: ServiceStatus[] = ['active', 'paused', 'ended'];

const WHEN: Record<ServiceStatus, string> = {
  active: '회기를 이어서 진행합니다',
  paused: '입원·결석 등으로 당분간 쉬실 때',
  ended: '퇴소하셨을 때 · 기록은 그대로 남아요',
};

export function ServiceStatusPanel({
  participantId,
  honorific,
}: {
  /** 서버 participants.id. 둘러보기 어르신이면 null — 바꿀 곳이 없다. */
  participantId: string | null;
  honorific: string;
}) {
  /*
   * 상태는 여기서 직접 읽는다.
   *
   * 회기 상태(store)에 실어 나르지 않는 이유가 있다. beginSession 이 받는
   * 어르신 신원은 일부러 좁혀 둔 타입이다 — 예전에 그 자리로 앞 어르신의
   * 동의가 통째로 따라와서, 동의한 적 없는 분의 목소리가 외부로 나갈 뻔했다.
   * 목록에 없어도 되는 값을 그리로 밀어 넣지 않는다.
   */
  const [now, setNow] = useState<ServiceStatus | null>(null);
  const [busy, setBusy] = useState<ServiceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** 종료는 한 번 더 여쭙는다. 목록에서 사라지는 결정이다. */
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!participantId) return;
    let alive = true;
    void readParticipantStatus(participantId)
      .then((v) => {
        if (alive && v) setNow(v);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [participantId]);

  // 훅은 조건 뒤에 둘 수 없어 여기서 걸러 낸다.
  if (!participantId) return null;
  // 아직 못 읽었으면 아무 상태도 고른 것처럼 보이지 않게 비워 둔다 —
  // 틀린 상태를 잠깐 보여 주면 그걸 보고 누른다.
  if (!now) return null;

  const apply = async (next: ServiceStatus) => {
    setBusy(next);
    setError(null);
    const out = await setParticipantStatus(participantId, next);
    setBusy(null);
    setAsking(false);
    if (!out.ok) {
      setError(out.reason ?? '바꾸지 못했어요.');
      return;
    }
    setNow(next);
  };

  return (
    <>
      <h2 className="mt-7 text-[1.125rem] font-extrabold text-ink-900">이용 상태</h2>
      <Card className="mt-3 p-4">
        <p className="text-[0.9375rem] leading-relaxed text-ink-700">
          지금 <strong className="text-ink-900">{SERVICE_STATUS_LABELS[now]}</strong>
          이에요. 어르신 목록에서 이 상태로 걸러 보실 수 있습니다.
        </p>

        <ul className="mt-3 space-y-2">
          {ORDER.map((v) => {
            const on = v === now;
            return (
              <li key={v}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={busy !== null}
                  onClick={() => {
                    if (on) return;
                    // 종료만 한 번 더 여쭙는다. 나머지는 되돌리기 쉬운 결정이다.
                    if (v === 'ended') setAsking(true);
                    else void apply(v);
                  }}
                  className={`flex min-h-[60px] w-full items-center gap-3 rounded-[14px] border-2 px-3.5 text-left disabled:opacity-70 ${
                    on
                      ? 'border-brand-400 bg-brand-50'
                      : 'border-hairline bg-surface-strong'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                      on ? 'border-brand-600 bg-brand-600' : 'border-ink-300'
                    }`}
                  >
                    {on ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[1rem] font-bold text-ink-900">
                      {SERVICE_STATUS_LABELS[v]}
                      {busy === v ? ' · 바꾸는 중…' : ''}
                    </span>
                    <span className="block text-[0.875rem] leading-relaxed text-ink-500">
                      {WHEN[v]}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {asking ? (
          <div className="mt-3 rounded-[12px] bg-surface-sunk p-3.5">
            <p className="text-[0.9375rem] font-bold text-ink-900">
              {honorific}을(를) 종료로 두시겠어요?
            </p>
            <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-700">
              목록에서 「이용 중」에는 더 이상 나오지 않아요. 지우는 것이
              아니라서 이야기·노래·기록은 그대로 남고, 다시 오시면 언제든
              「이용 중」으로 되돌리실 수 있어요.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAsking(false)}
                className="min-h-[48px] rounded-[12px] border border-hairline bg-surface-strong text-[0.9375rem] font-bold text-ink-700"
              >
                그대로 두기
              </button>
              <button
                type="button"
                onClick={() => void apply('ended')}
                className="min-h-[48px] rounded-[12px] bg-brand-700 text-[0.9375rem] font-bold text-white"
              >
                종료로 두기
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="mt-2 text-[0.875rem] font-bold text-danger-600">
            {error}
          </p>
        ) : null}

        <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-500">
          회기 중에도 바꾸실 수 있어요. 진행 중인 회기는 그대로 이어집니다.
        </p>
      </Card>
    </>
  );
}
