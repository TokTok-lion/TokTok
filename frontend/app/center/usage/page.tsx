'use client';

import {
  CBtn,
  CenterShell,
  Kpi,
  LimitNote,
  Panel,
  Pill,
  SampleBadge,
  TableWrap,
  Td,
  Th,
} from '@/components/CenterShell';
import { formatWon, quotaState } from '@/lib/center';
import { AI_COST, USAGE } from '@/lib/center-seed';

const INVOICES = [
  { id: 'i1', month: '2025-04', amount: 372_400, state: '결제 완료' as const },
  { id: 'i2', month: '2025-03', amount: 351_900, state: '결제 완료' as const },
  { id: 'i3', month: '2025-02', amount: 288_600, state: '결제 완료' as const },
];

/** 요금·쿼터 (CM-USE · 9 functions) */
export default function UsagePage() {
  const billable = USAGE.filter((u) => !u.safetyCritical);
  const safety = USAGE.filter((u) => u.safetyCritical);
  const warned = billable.filter((u) => quotaState(u) !== 'ok');
  const aiTotal = AI_COST.reduce((a, b) => a + b.amount, 0);

  return (
    <CenterShell
      code="CM-USE"
      title="요금·쿼터"
      lead="플랜 사용량과 청구 상태를 봅니다."
      actions={<CBtn tone="solid">추가 크레딧 구매</CBtn>}
    >
      <SampleBadge>
        사용량과 금액은 예시입니다. 실제 요금제는 출시 전 확정됩니다.
      </SampleBadge>

      {/* F-CM-USE-001 플랜 조회 */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="현재 플랜" value="기관 스탠다드" note="월 30곡 · 50GB · 직원 10명" />
        <Kpi label="이번 달 예상 금액" value={formatWon(aiTotal + 190_000)} tone="brand" note="구독료 190,000원 포함" />
        <Kpi
          label="한도 임박"
          value={warned.length}
          unit="항목"
          tone={warned.length ? 'amber' : 'leaf'}
        />
      </div>

      {/* F-CM-USE-002 · 003 사용량과 쿼터 경고 */}
      <Panel className="mt-4" title="사용량" code="F-CM-USE-002 · 003">
        <ul className="space-y-3.5">
          {billable.map((u) => {
            const state = quotaState(u);
            const pct = Math.min(100, Math.round((u.used / u.quota) * 100));
            return (
              <li key={u.key}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[0.9375rem] font-bold text-ink-900">{u.label}</p>
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
                      {u.used.toLocaleString('ko-KR')}
                    </span>
                    {' / '}
                    {u.quota.toLocaleString('ko-KR')} {u.unit} ({pct}%)
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
                    한도의 {pct}%를 썼습니다. 추가 크레딧을 사거나 다음 달까지
                    기다릴 수 있습니다.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Panel>

      {/* F-CM-USE-003 안전 기능은 한도와 무관 */}
      <Panel
        className="mt-4"
        title="한도와 무관한 기능"
        code="F-CM-USE-003"
        desc="쿼터를 다 써도 절대 막히지 않습니다."
      >
        <ul className="flex flex-wrap gap-2">
          {safety.map((u) => (
            <li key={u.key}>
              <Pill tone="leaf">
                {u.label} · 이번 달 {u.used}
                {u.unit}
              </Pill>
            </li>
          ))}
        </ul>
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
                    <CBtn>내려받기</CBtn>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <p className="mt-3 text-[0.8125rem] text-ink-500">
            세금계산서 연동 방식은 상용화 전에 확정됩니다.
          </p>
        </Panel>

        {/* F-CM-USE-007 · 008 · 009 */}
        <Panel title="결제와 구독" code="F-CM-USE-007 · 008 · 009">
          <div className="space-y-3">
            <div className="rounded-[12px] border border-hairline bg-surface p-3.5">
              <p className="text-[0.9375rem] font-bold text-ink-900">결제수단</p>
              <p className="mt-1 text-[0.875rem] text-ink-500">
                법인카드 •••• 4412 · 결제 대행사 토큰으로만 보관합니다.
              </p>
              <div className="mt-2.5">
                <CBtn>결제수단 변경</CBtn>
              </div>
            </div>
            <div className="rounded-[12px] border border-hairline bg-surface p-3.5">
              <p className="text-[0.9375rem] font-bold text-ink-900">플랜 변경 · 해지</p>
              <p className="mt-1 text-[0.875rem] text-ink-500">
                해지해도 자료가 즉시 사라지지 않습니다. 보관·내보내기 기간을
                먼저 안내합니다.
              </p>
              <div className="mt-2.5 flex gap-2">
                <CBtn>플랜 변경</CBtn>
                <CBtn>해지 상담</CBtn>
              </div>
            </div>
          </div>
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
