'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  CBtn,
  CenterShell,
  Checking,
  Kpi,
  LimitNote,
  Panel,
  Pill,
  TableWrap,
  Td,
  Th,
} from '@/components/CenterShell';
import { useAccount } from '@/lib/auth';
import { formatWon, quotaState } from '@/lib/center';
import { AI_COST, USAGE } from '@/lib/center-seed';
import { costEstimate, type CostEstimate } from '@/lib/repo';

const INVOICES = [
  { id: 'i1', month: '2025-04', amount: 372_400, state: '결제 완료' as const },
  { id: 'i2', month: '2025-03', amount: 351_900, state: '결제 완료' as const },
  { id: 'i3', month: '2025-02', amount: 288_600, state: '결제 완료' as const },
];

/**
 * 서버 한 번 읽기의 세 가지 결말. 못 읽은 것을 0 으로 그리면 "이번 달 한 곡도
 * 안 만들었다"가 되고, 씨앗으로 메우면 남의 기관 사용량이 된다.
 */
type Load<T> = { state: 'loading' } | { state: 'failed' } | { state: 'ok'; value: T };

/**
 * 요금·쿼터 (CM-USE · 9 functions)
 *
 * 이 화면은 위에서 아래까지 전부 씨앗이었다. 플랜 이름도, 사용량 막대도,
 * 청구서 세 줄도, 법인카드 끝 네 자리도. 돈이 걸린 화면에서 그 숫자들은
 * 그대로 예산 근거가 된다 — 실제 기관 센터장이 '이번 달 372,400원'을 보고
 * 결재를 올리면, 그 금액은 아무 데서도 온 적이 없는 숫자다.
 *
 * 그래서 서버가 실제로 아는 하나(이번 달 만든 곡 수와 한도)만 남기고, 나머지는
 * 없다고 적는다. 둘러보기에서는 화면의 모양을 볼 수 있도록 씨앗을 그리되 맨
 * 위 띠가 예시라고 밝힌다.
 */
export default function UsagePage() {
  const { account } = useAccount();
  const live = account.status === 'in';
  const checking = account.status === 'loading';
  const demo = !live && !checking;

  const [cost, setCost] = useState<Load<CostEstimate>>({ state: 'loading' });

  useEffect(() => {
    if (!live) return;
    // 처음 값이 이미 loading 이라 여기서 되돌릴 필요가 없다. 효과 안에서
    // 곧바로 setState 를 부르면 렌더만 한 번 더 돈다.
    let alive = true;
    void costEstimate().then(
      (c) => {
        if (alive) setCost(c ? { state: 'ok', value: c } : { state: 'failed' });
      },
      () => {
        if (alive) setCost({ state: 'failed' });
      },
    );
    return () => {
      alive = false;
    };
  }, [live]);

  const billable = USAGE.filter((u) => !u.safetyCritical);
  const safety = USAGE.filter((u) => u.safetyCritical);
  const warned = billable.filter((u) => quotaState(u) !== 'ok');
  const aiTotal = AI_COST.reduce((a, b) => a + b.amount, 0);

  return (
    <CenterShell
      code="CM-USE"
      title="요금·쿼터"
      lead="플랜 사용량과 청구 상태를 봅니다."
      actions={
        // 눌러도 아무것도 사지지 않는 구매 버튼을 살아 있는 것처럼 두지 않는다.
        // 요금이 나가는 동작은 특히 그렇다.
        <CBtn disabled title="아직 준비되지 않았습니다">
          추가 크레딧 구매
        </CBtn>
      }
      data={{
        kind: 'seedWhileBrowsing',
        what: (
          <>
            아래 플랜·사용량·금액·청구서는 둘러보기용 예시이며, 구매·결제 버튼은
            아무것도 청구하지 않습니다. 실제 기관으로 로그인하면 서버가 아는 것
            (이번 달 만든 곡 수와 한도)만 남습니다. 곡당 어림 요금은{' '}
            <Link href="/center/analytics" className="font-extrabold underline">
              운영·ROI 분석
            </Link>
            의 「이번 달 AI 사용량」에서도 볼 수 있습니다.
          </>
        ),
      }}
    >
      {/* F-CM-USE-001 플랜 조회 */}
      {checking ? (
        <Panel title="플랜" code="F-CM-USE-001">
          <Checking />
        </Panel>
      ) : live ? (
        <Panel title="플랜" code="F-CM-USE-001">
          {cost.state === 'loading' ? (
            <p className="text-[0.9375rem] text-ink-500">불러오는 중…</p>
          ) : cost.state === 'failed' ? (
            <ReadFailed />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Kpi
                label="이번 달 만든 곡"
                value={cost.value.songs}
                unit="곡"
                tone="brand"
              />
              <Kpi
                label="이번 달 곡 한도"
                value={cost.value.quota ?? '—'}
                unit={cost.value.quota === null ? undefined : '곡'}
                note={
                  cost.value.quota === null
                    ? '한도를 읽지 못했습니다'
                    : `서버가 계산한 남은 곡 ${cost.value.quotaLeft ?? '—'}곡`
                }
              />
            </div>
          )}
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-700">
            플랜 이름과 이번 달 청구 예상 금액은 아직 이 화면에서 알 수 없습니다.
            요금제가 출시 전에 확정되면 그때 표시합니다. 지금 계약 조건이 궁금하면
            도입 담당자에게 문의하세요.
          </p>
        </Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi label="현재 플랜" value="기관 스탠다드" note="월 30곡 · 50GB · 직원 10명" />
          <Kpi
            label="이번 달 예상 금액"
            value={formatWon(aiTotal + 190_000)}
            tone="brand"
            note="구독료 190,000원 포함"
          />
          <Kpi
            label="한도 임박"
            value={warned.length}
            unit="항목"
            tone={warned.length ? 'amber' : 'leaf'}
          />
        </div>
      )}

      {/* F-CM-USE-002 · 003 사용량과 쿼터 경고 */}
      <Panel className="mt-4" title="사용량" code="F-CM-USE-002 · 003">
        {checking ? (
          <Checking />
        ) : live ? (
          cost.state === 'loading' ? (
            <p className="text-[0.9375rem] text-ink-500">불러오는 중…</p>
          ) : cost.state === 'failed' ? (
            <ReadFailed />
          ) : (
            <>
              {cost.value.quota !== null && cost.value.quota > 0 ? (
                <UsageBar
                  label="곡 생성"
                  used={cost.value.songs}
                  quota={cost.value.quota}
                  unit="곡"
                />
              ) : (
                <p className="text-[0.9375rem] leading-relaxed text-ink-700">
                  이번 달 만든 곡은 {cost.value.songs}곡입니다. 한도를 읽지 못해
                  진행 막대는 그리지 않습니다.
                </p>
              )}
              <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-700">
                전사(STT)·LLM 호출·스토리지 사용량은 아직 기관 단위로 세지
                않습니다. 곡만 세는 이유는 곡이 유일하게 값이 큰 자원이고, 서버가
                한도를 거는 곳도 곡 하나뿐이기 때문입니다.
              </p>
            </>
          )
        ) : (
          <div className="space-y-3.5">
            {billable.map((u) => (
              <UsageBar
                key={u.key}
                label={u.label}
                used={u.used}
                quota={u.quota}
                unit={u.unit}
              />
            ))}
          </div>
        )}
      </Panel>

      {/* F-CM-USE-003 안전 기능은 한도와 무관 */}
      <Panel
        className="mt-4"
        title="한도와 무관한 기능"
        code="F-CM-USE-003"
        desc="쿼터를 다 써도 절대 막히지 않습니다."
      >
        {/* 약속은 측정값이 아니라 서비스가 정한 규칙이라 어느 상태에서도 같다.
            다만 '이번 달 74건' 같은 숫자는 잰 적이 없으므로 둘러보기에서만. */}
        <ul className="flex flex-wrap gap-2">
          {safety.map((u) => (
            <li key={u.key}>
              <Pill tone="leaf">
                {u.label}
                {demo ? ` · 이번 달 ${u.used}${u.unit}` : ''}
              </Pill>
            </li>
          ))}
        </ul>
        {live ? (
          <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-500">
            처리 건수는 아직 세지 않습니다. 세지 않아도 이 두 가지는 동작합니다 —
            한도와 무관하다는 것이 이 칸의 요점입니다.
          </p>
        ) : null}
        <div className="mt-3">
          <LimitNote>
            동의 철회와 삭제 요청 처리는 요금·한도와 관계없이 항상 동작합니다.
            결제가 밀려도 이 기능들은 잠기지 않습니다.
          </LimitNote>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {/* F-CM-USE-006 청구서 조회 */}
        <Panel title="청구서" code="F-CM-USE-006">
          {checking ? (
            <Checking />
          ) : live ? (
            <p className="text-[0.9375rem] leading-relaxed text-ink-700">
              청구서를 이 화면으로 가져오는 연동이 아직 없습니다. 예시 청구서를
              대신 보여주지 않는 이유는, 그 금액이 그대로 결재 자료로 올라갈 수
              있기 때문입니다. 지난달 청구 내역이 필요하면 도입 담당자에게
              요청하세요.
            </p>
          ) : (
            <>
              <TableWrap min={420}>
                <thead>
                  <tr>
                    <Th>월</Th>
                    <Th className="text-right">금액</Th>
                    <Th>상태</Th>
                    <Th className="text-right">문서</Th>
                  </tr>
                </thead>
                <tbody>
                  {INVOICES.map((i) => (
                    <tr key={i.id}>
                      <Td className="font-bold">{i.month}</Td>
                      <Td className="text-right tabular-nums">{formatWon(i.amount)}</Td>
                      <Td>
                        <Pill tone="leaf">{i.state}</Pill>
                      </Td>
                      <Td className="text-right">
                        <CBtn disabled title="아직 준비되지 않았습니다">
                          내려받기
                        </CBtn>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
              <p className="mt-3 text-[0.8125rem] text-ink-500">
                세금계산서 연동 방식은 상용화 전에 확정됩니다.
              </p>
            </>
          )}
        </Panel>

        {/* F-CM-USE-007 · 008 · 009 */}
        <Panel title="결제와 구독" code="F-CM-USE-007 · 008 · 009">
          {checking ? (
            <Checking />
          ) : (
            <div className="space-y-3">
              <div className="rounded-[12px] border border-hairline bg-surface p-3.5">
                <p className="text-[0.9375rem] font-bold text-ink-900">결제수단</p>
                <p className="mt-1 text-[0.875rem] text-ink-500">
                  {live
                    ? '등록된 결제수단을 이 화면에서 읽지 못합니다. 결제 대행사 연동은 아직 없습니다.'
                    : '법인카드 •••• 4412 · 결제 대행사 토큰으로만 보관합니다. (예시)'}
                </p>
                <div className="mt-2.5">
                  <CBtn disabled title="아직 준비되지 않았습니다">
                    결제수단 변경
                  </CBtn>
                </div>
              </div>
              <div className="rounded-[12px] border border-hairline bg-surface p-3.5">
                <p className="text-[0.9375rem] font-bold text-ink-900">플랜 변경 · 해지</p>
                <p className="mt-1 text-[0.875rem] text-ink-500">
                  해지해도 자료가 즉시 사라지지 않습니다. 보관·내보내기 기간을
                  먼저 안내합니다.
                </p>
                <div className="mt-2.5 flex gap-2">
                  <CBtn disabled title="아직 준비되지 않았습니다">
                    플랜 변경
                  </CBtn>
                  <CBtn disabled title="아직 준비되지 않았습니다">
                    해지 상담
                  </CBtn>
                </div>
                <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-ink-500">
                  플랜 변경과 해지는 이 화면에서 처리되지 않습니다. 도입 담당자와
                  협의해 주세요.
                </p>
              </div>
            </div>
          )}
          <div className="mt-3">
            <LimitNote>
              결제가 실패해도 자료를 바로 지우지 않습니다. 실패 원인과 유예기간을
              먼저 안내하고 재시도합니다.
            </LimitNote>
          </div>
        </Panel>
      </div>
    </CenterShell>
  );
}

/** 사용량 막대 하나. 씨앗과 실제 값이 같은 모양으로 보이도록 한 곳에 둔다. */
function UsageBar({
  label,
  used,
  quota,
  unit,
}: {
  label: string;
  used: number;
  quota: number;
  unit: string;
}) {
  const state = quotaState({ key: label, label, used, quota, unit, safetyCritical: false });
  const pct = quota === 0 ? 0 : Math.min(100, Math.round((used / quota) * 100));
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[0.9375rem] font-bold text-ink-900">{label}</p>
        <p className="text-[0.875rem] tabular-nums text-ink-500">
          <span
            className={
              state === 'over'
                ? 'font-extrabold text-danger-600'
                : state === 'warn'
                  ? 'font-extrabold text-amber-700'
                  : 'font-bold text-ink-900'
            }
          >
            {used.toLocaleString('ko-KR')}
          </span>
          {' / '}
          {quota.toLocaleString('ko-KR')} {unit} ({pct}%)
        </p>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-track">
        <div
          className={`h-full rounded-full ${
            state === 'over'
              ? 'bg-danger-600'
              : state === 'warn'
                ? 'bg-amber-400'
                : 'bg-leaf-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {state !== 'ok' ? (
        <p className="mt-1.5 text-[0.8125rem] font-semibold text-amber-700">
          한도의 {pct}%를 썼습니다. 추가 크레딧을 사거나 다음 달까지 기다릴 수
          있습니다. 추가 구매는 아직 이 화면에서 할 수 없으니 도입 담당자에게
          문의하세요.
        </p>
      ) : null}
    </div>
  );
}

/**
 * 읽기가 실패했을 때. 조용히 0 이나 씨앗으로 떨어지지 않는다 — 요금 화면에서
 * "이번 달 0곡"은 안심하고 더 만들어도 된다는 뜻으로 읽힌다.
 */
function ReadFailed() {
  return (
    <p className="rounded-[12px] bg-[#fbe3dd] px-3.5 py-3 text-[0.9375rem] font-semibold leading-relaxed text-danger-600">
      이번 달 사용량을 서버에서 읽지 못했습니다. 숫자를 비워 두는 것은 사용량이
      0이어서가 아니라 확인하지 못해서입니다. 새로고침해 보시고, 계속 안 되면
      도입 담당자에게 알려 주세요.
    </p>
  );
}
