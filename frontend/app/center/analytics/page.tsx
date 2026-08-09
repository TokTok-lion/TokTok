'use client';

import { useState } from 'react';
import { CenterCostLive } from '@/components/CenterCostLive';
import { CenterReport } from '@/components/CenterReport';
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
import {
  SMALL_SAMPLE_THRESHOLD,
  computeRoi,
  formatWon,
  type RoiAssumptions,
} from '@/lib/center';
import {
  AI_COST,
  FAMILY_ENGAGEMENT,
  ROI_DEFAULTS,
  SESSION_OUTCOME,
} from '@/lib/center-seed';

const FIELDS: {
  key: keyof RoiAssumptions;
  label: string;
  unit: string;
  hint?: string;
}[] = [
  { key: 'baselinePrepMin', label: '서비스 전 준비시간', unit: '분/회', hint: '기준선 실측' },
  { key: 'currentPrepMin', label: '서비스 후 준비시간', unit: '분/회' },
  { key: 'baselineLogMin', label: '서비스 전 일지 작성', unit: '분/회', hint: '기준선 실측' },
  { key: 'currentLogMin', label: '서비스 후 일지 작성', unit: '분/회' },
  { key: 'sessionsPerMonth', label: '월 회기 수', unit: '회' },
  { key: 'hourlyWage', label: '시간당 인건비', unit: '원', hint: '센터가 입력' },
  { key: 'monthlyFee', label: '월 구독료', unit: '원' },
  { key: 'monthlyAiCost', label: '월 AI 직접비', unit: '원' },
  { key: 'baselineSampleSize', label: '기준선 표본 수', unit: '건' },
];

/** 운영·ROI 분석 (CM-ANL · 11 functions) */
export default function AnalyticsPage() {
  const [a, setA] = useState<RoiAssumptions>(ROI_DEFAULTS);
  const roi = computeRoi(a);

  const totalPlanned = SESSION_OUTCOME.planned;
  const rate = (n: number) => Math.round((n / totalPlanned) * 100);
  const familyDenominator = FAMILY_ENGAGEMENT.invited;

  return (
    <CenterShell
      code="CM-ANL"
      title="운영·ROI 분석"
      lead="운영 지표를 같은 정의로 비교합니다. 치료 효과가 아니라 업무 시간과 비용을 봅니다."
    >
      {/* 서버가 실제로 아는 값. 아래 시연 지표와 섞이지 않게 먼저 둔다. */}
      <CenterCostLive />
      <CenterReport />

      <SampleBadge>
        아래 수치는 예시입니다. 기준선을 실제로 측정한 뒤에 다시 계산하세요.
      </SampleBadge>

      {/* F-CM-ANL-004 세션 완료율 */}
      <Panel title="세션 진행 결과" code="F-CM-ANL-004">
        <div className="grid gap-3 sm:grid-cols-4">
          <Kpi label="완료" value={`${rate(SESSION_OUTCOME.completed)}%`} tone="leaf" note={`${SESSION_OUTCOME.completed}회`} />
          <Kpi label="중단" value={`${rate(SESSION_OUTCOME.stopped)}%`} note={`${SESSION_OUTCOME.stopped}회`} />
          <Kpi label="취소" value={`${rate(SESSION_OUTCOME.cancelled)}%`} note={`${SESSION_OUTCOME.cancelled}회`} />
          <Kpi label="계획" value={totalPlanned} unit="회" />
        </div>
        <div className="mt-3">
          <LimitNote>
            중단은 실패가 아닙니다. 어르신이 쉬고 싶다고 하셔서 안전하게 끝낸
            회기도 여기에 들어갑니다. 중단율을 낮추는 것이 목표가 아닙니다.
          </LimitNote>
        </div>
      </Panel>

      {/* F-CM-ANL-001~003 · 009 · 010 : 가정을 드러낸 ROI */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.1fr]">
        <Panel
          title="계산에 쓰는 값"
          code="F-CM-ANL-001 · 009"
          desc="모두 센터가 입력합니다. 코드에 박아 둔 값은 없습니다."
          actions={<CBtn onClick={() => setA(ROI_DEFAULTS)}>초기값</CBtn>}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label
                  htmlFor={f.key}
                  className="block text-[0.8125rem] font-bold text-ink-500"
                >
                  {f.label}
                  {f.hint ? (
                    <span className="ml-1.5 font-semibold text-ink-500">{f.hint}</span>
                  ) : null}
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    id={f.key}
                    type="number"
                    min={0}
                    value={a[f.key]}
                    onChange={(e) =>
                      setA({ ...a, [f.key]: Math.max(0, Number(e.target.value) || 0) })
                    }
                    className="min-h-[40px] w-full rounded-[10px] border border-hairline bg-surface px-3 text-right text-[0.9375rem] tabular-nums text-ink-900"
                  />
                  <span className="shrink-0 text-[0.8125rem] font-semibold text-ink-500">
                    {f.unit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="계산 결과" code="F-CM-ANL-002 · 003 · 010">
            <div className="grid gap-3 sm:grid-cols-2">
              <Kpi
                label="회기당 절감 시간"
                value={roi.minutesSavedPerSession}
                unit="분"
                tone={roi.minutesSavedPerSession > 0 ? 'leaf' : 'danger'}
              />
              <Kpi
                label="월 절감 시간"
                value={roi.hoursSavedPerMonth.toFixed(1)}
                unit="시간"
                tone="leaf"
              />
              <Kpi label="절감 시간의 인건비 환산" value={formatWon(roi.laborValue)} />
              <Kpi label="월 비용 (구독+AI)" value={formatWon(roi.totalCost)} tone="brand" />
            </div>

            <div className="mt-3 rounded-[12px] border border-hairline bg-surface p-4">
              <p className="text-[0.875rem] font-semibold text-ink-500">
                인건비 환산액 − 월 비용
              </p>
              <p
                className={`mt-1 text-[1.75rem] font-extrabold ${
                  roi.net >= 0 ? 'text-leaf-700' : 'text-danger-600'
                }`}
              >
                {roi.net >= 0 ? '+' : ''}
                {formatWon(roi.net)}
              </p>
              <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-700">
                계산식: ({a.baselinePrepMin}−{a.currentPrepMin} + {a.baselineLogMin}−
                {a.currentLogMin})분 × {a.sessionsPerMonth}회 ÷ 60 ×{' '}
                {a.hourlyWage.toLocaleString('ko-KR')}원 − ({formatWon(a.monthlyFee)} +{' '}
                {formatWon(a.monthlyAiCost)})
              </p>
            </div>

            {roi.smallSample ? (
              <p className="mt-3 rounded-[12px] border border-amber-300 bg-amber-100/60 px-3.5 py-3 text-[0.875rem] font-semibold leading-relaxed text-amber-700">
                기준선 표본이 {a.baselineSampleSize}건입니다 ({SMALL_SAMPLE_THRESHOLD}건
                미만). 이 수치는 방향을 참고하는 정도로만 보시고, 표본을 더 모은 뒤
                다시 계산하세요.
              </p>
            ) : null}

            <div className="mt-3">
              <LimitNote>
                시간이 줄어든 것이 이 서비스 때문이라고 단정할 수 없습니다.
                계절·인원 변동·업무 재배치 같은 다른 이유가 함께 작용합니다.
                절감액을 보장하지 않습니다.
              </LimitNote>
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {/* F-CM-ANL-008 월 AI 직접비 */}
        <Panel title="월 AI 직접비" code="F-CM-ANL-008">
          <TableWrap min={320}>
            <thead>
              <tr>
                <Th>항목</Th>
                <Th className="text-right">금액</Th>
              </tr>
            </thead>
            <tbody>
              {AI_COST.map((c) => (
                <tr key={c.label}>
                  <Td>{c.label}</Td>
                  <Td className="text-right tabular-nums font-semibold">
                    {formatWon(c.amount)}
                  </Td>
                </tr>
              ))}
              <tr>
                <Td className="font-extrabold">합계</Td>
                <Td className="text-right tabular-nums font-extrabold text-brand-700">
                  {formatWon(AI_COST.reduce((s, c) => s + c.amount, 0))}
                </Td>
              </tr>
            </tbody>
          </TableWrap>
          <p className="mt-3 text-[0.8125rem] text-ink-500">
            환율·세금은 별도입니다. 실제 청구액은 청구서를 따릅니다.
          </p>
        </Panel>

        {/* F-CM-ANL-005 · 006 · 007 */}
        <Panel title="참여 요약" code="F-CM-ANL-005 · 006 · 007">
          <div className="grid gap-3 sm:grid-cols-2">
            <Kpi label="노래 따라부름 관찰" value="31" unit="회" tone="leaf" />
            <Kpi label="자발적 발화 관찰" value="44" unit="회" tone="leaf" />
            <Kpi
              label="가족 응답률"
              value={`${Math.round((FAMILY_ENGAGEMENT.responded / familyDenominator) * 100)}%`}
              note={`분모 ${familyDenominator}명 · 가족 미참여 ${FAMILY_ENGAGEMENT.notApplicable}명 제외`}
            />
            <Kpi label="재참여 의향 응답" value="17" unit="명" note="응답 거부 3명 제외" />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Pill tone="leaf">개인 순위 비공개</Pill>
            <Pill tone="leaf">건강 상태 추론 없음</Pill>
          </div>

          <div className="mt-3">
            <LimitNote>
              참여 행동을 센 것이지 임상 지표가 아닙니다. 어르신 개인을 서로
              비교하거나 순위를 매기지 않습니다. 가족이 없는 어르신은 응답률
              분모에서 빠지므로 참여를 압박하는 지표로 쓰이지 않습니다.
            </LimitNote>
          </div>
        </Panel>
      </div>

      {/* F-CM-ANL-011 리포트 내보내기 */}
      <Panel className="mt-4" title="리포트 내보내기" code="F-CM-ANL-011">
        <p className="text-[0.9375rem] leading-relaxed text-ink-700">
          월간 운영 리포트에는 표본 수, 측정 방법, 그리고 이 수치로 말할 수 없는
          것이 함께 인쇄됩니다. 치료·인지 개선 효과를 주장하는 문구는 리포트에
          들어가지 않습니다.
        </p>
        <div className="mt-3 flex gap-2">
          <CBtn tone="solid">PDF로 내보내기</CBtn>
          <CBtn>엑셀로 내보내기</CBtn>
        </div>
      </Panel>
    </CenterShell>
  );
}
