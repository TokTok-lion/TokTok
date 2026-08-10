'use client';

import { useState } from 'react';
import { CenterCostLive } from '@/components/CenterCostLive';
import { CenterReport } from '@/components/CenterReport';
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

/**
 * 아무것도 재지 않은 상태.
 *
 * 실제 기관에서는 여기서 시작한다. ROI_DEFAULTS(준비시간 35분 → 18분 …)는
 * 어느 기관에서도 잰 적 없는 숫자인데, 칸에 미리 들어가 있으면 센터장은 그것을
 * 자기 기관의 측정값으로 읽는다. 그리고 그 위에서 계산된 '월 절감 39만원'이
 * 그대로 품의서에 올라간다.
 */
const NOTHING_MEASURED: RoiAssumptions = {
  hourlyWage: 0,
  sessionsPerMonth: 0,
  baselinePrepMin: 0,
  currentPrepMin: 0,
  baselineLogMin: 0,
  currentLogMin: 0,
  monthlyFee: 0,
  monthlyAiCost: 0,
  baselineSampleSize: 0,
};

/** 운영·ROI 분석 (CM-ANL · 11 functions) */
export default function AnalyticsPage() {
  const { account } = useAccount();
  const live = account.status === 'in';
  const checking = account.status === 'loading';
  const demo = !live && !checking;

  const totalPlanned = SESSION_OUTCOME.planned;
  const rate = (n: number) => Math.round((n / totalPlanned) * 100);
  const familyDenominator = FAMILY_ENGAGEMENT.invited;

  return (
    <CenterShell
      code="CM-ANL"
      title="운영·ROI 분석"
      lead="운영 지표를 같은 정의로 비교합니다. 치료 효과가 아니라 업무 시간과 비용을 봅니다."
      data={{
        kind: 'seedWhileBrowsing',
        what: '아래 세션 결과·ROI 기본값·AI 직접비 내역·참여 요약은 둘러보기용 예시입니다. 실제 기관으로 로그인하면 서버에서 읽은 사용량만 남고, ROI 계산칸은 빈 값에서 시작합니다 — 기준선은 기관이 직접 재야 하는 숫자입니다.',
      }}
    >
      {/* 서버가 실제로 아는 값. 두 패널 모두 스스로 로그인 상태를 가린다. */}
      <CenterCostLive />
      <CenterReport />

      {/* F-CM-ANL-004 세션 완료율 */}
      <Panel className="mt-4" title="세션 진행 결과" code="F-CM-ANL-004">
        {checking ? (
          <Checking />
        ) : live ? (
          <p className="text-[0.9375rem] leading-relaxed text-ink-700">
            완료·중단·취소를 나눠 세는 집계가 아직 없습니다. 지금 확인할 수 있는
            것은 이번 달 회기 수와 진행 중·완료 건수이며,{' '}
            <span className="font-bold">운영 콘솔</span>의 「기관 데이터」에
            있습니다.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-4">
            <Kpi
              label="완료"
              value={`${rate(SESSION_OUTCOME.completed)}%`}
              tone="leaf"
              note={`${SESSION_OUTCOME.completed}회`}
            />
            <Kpi label="중단" value={`${rate(SESSION_OUTCOME.stopped)}%`} note={`${SESSION_OUTCOME.stopped}회`} />
            <Kpi label="취소" value={`${rate(SESSION_OUTCOME.cancelled)}%`} note={`${SESSION_OUTCOME.cancelled}회`} />
            <Kpi label="계획" value={totalPlanned} unit="회" />
          </div>
        )}
        <div className="mt-3">
          <LimitNote>
            중단은 실패가 아닙니다. 어르신이 쉬고 싶다고 하셔서 안전하게 끝낸
            회기도 여기에 들어갑니다. 중단율을 낮추는 것이 목표가 아닙니다.
          </LimitNote>
        </div>
      </Panel>

      {/* F-CM-ANL-001~003 · 009 · 010 : 가정을 드러낸 ROI */}
      {checking ? (
        <Panel className="mt-4" title="계산에 쓰는 값" code="F-CM-ANL-001 · 009">
          <Checking />
        </Panel>
      ) : (
        // 둘러보기와 실기관은 시작값이 다르다. key 를 바꿔 입력 상태를 새로
        // 만든다 — 로그인이 확인된 순간 예시 기준선이 칸에 남아 있으면 안 된다.
        <RoiPanels key={demo ? 'demo' : 'live'} seeded={demo} />
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {/* F-CM-ANL-008 월 AI 직접비 */}
        <Panel title="월 AI 직접비" code="F-CM-ANL-008">
          {checking ? (
            <Checking />
          ) : live ? (
            <p className="text-[0.9375rem] leading-relaxed text-ink-700">
              전사·LLM·음악·스토리지로 나눈 금액은 아직 집계하지 않습니다.
              제공자별 사용량을 기관 단위로 받아오는 연동이 먼저 있어야 합니다.
              이번 달 실제로 만든 곡 수와 그에 따른 어림 요금은 이 화면 맨 위
              「이번 달 AI 사용량」에 있습니다.
            </p>
          ) : (
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
          )}
          <p className="mt-3 text-[0.8125rem] text-ink-500">
            환율·세금은 별도입니다. 실제 청구액은 청구서를 따릅니다.
          </p>
        </Panel>

        {/* F-CM-ANL-005 · 006 · 007 */}
        <Panel title="참여 요약" code="F-CM-ANL-005 · 006 · 007">
          {checking ? (
            <Checking />
          ) : live ? (
            <p className="text-[0.9375rem] leading-relaxed text-ink-700">
              따라부름·자발적 발화 관찰은 회기마다 복지사가 기록하고 있지만, 그
              기록을 기관 단위로 세는 집계가 아직 없습니다. 가족 응답률과 재참여
              의향도 마찬가지입니다. 회기 하나하나의 관찰 기록은 복지사 앱의 그
              회기 화면에서 볼 수 있습니다.
            </p>
          ) : (
            <>
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
            </>
          )}

          <div className="mt-3">
            <LimitNote>
              참여 행동을 센 것이지 임상 지표가 아닙니다. 어르신 개인을 서로
              비교하거나 순위를 매기지 않습니다. 가족이 없는 어르신은 응답률
              분모에서 빠지므로 참여를 압박하는 지표로 쓰이지 않습니다.
            </LimitNote>
          </div>
        </Panel>
      </div>

      {/* F-CM-ANL-011 리포트에 담기는 것.
          예전에는 여기에도 'PDF로 내보내기 · 엑셀로 내보내기' 버튼이 있었다.
          둘 다 아무 일도 하지 않는데, 화면 맨 위의 진짜 내보내기 패널과 제목이
          같아서 어느 쪽이 되는 버튼인지 알 수 없었다. 실제로 내보내는 곳은
          하나만 남기고, 여기서는 무엇이 담기는지만 적는다. */}
      <Panel className="mt-4" title="리포트에 담기는 것" code="F-CM-ANL-011">
        <p className="text-[0.9375rem] leading-relaxed text-ink-700">
          월간 운영 리포트에는 표본 수, 측정 방법, 그리고 이 수치로 말할 수 없는
          것이 함께 인쇄됩니다. 치료·인지 개선 효과를 주장하는 문구는 리포트에
          들어가지 않습니다. 어르신 이름·이야기·녹음도 들어가지 않습니다.
        </p>
        <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-500">
          {live
            ? '내보내기는 이 화면 맨 위 「리포트 내보내기」에서 합니다.'
            : '로그인하면 이 화면 맨 위 「리포트 내보내기」에서 기관의 집계 숫자를 인쇄하거나 CSV로 내려받을 수 있습니다.'}
        </p>
      </Panel>
    </CenterShell>
  );
}

/**
 * ROI 계산칸.
 *
 * 입력값은 이 화면에서만 산다 — 서버에 저장하는 기능이 없다. 그 사실을 화면에
 * 적어 둔다. 적지 않으면 센터장은 다음 달에 다시 열었을 때 값이 사라진 것을
 * 두고 자료가 지워졌다고 생각한다.
 */
function RoiPanels({ seeded }: { seeded: boolean }) {
  const [a, setA] = useState<RoiAssumptions>(seeded ? ROI_DEFAULTS : NOTHING_MEASURED);
  const roi = computeRoi(a);
  const entered = FIELDS.some((f) => a[f.key] > 0);

  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.1fr]">
      <Panel
        title="계산에 쓰는 값"
        code="F-CM-ANL-001 · 009"
        desc="모두 센터가 입력합니다. 코드에 박아 둔 값은 없습니다."
        actions={
          <CBtn onClick={() => setA(seeded ? ROI_DEFAULTS : NOTHING_MEASURED)}>
            {seeded ? '초기값' : '비우기'}
          </CBtn>
        }
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

        <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
          {seeded
            ? '지금 칸에 들어 있는 값은 예시입니다. 어느 기관에서도 잰 적 없는 숫자이니, 기관의 실측값으로 바꿔 보세요.'
            : '여기 적은 값은 이 화면에서만 계산에 쓰이고 서버에 저장되지 않습니다. 창을 닫으면 사라집니다.'}
        </p>
      </Panel>

      <div className="space-y-4">
        <Panel title="계산 결과" code="F-CM-ANL-002 · 003 · 010">
          {!entered ? (
            // 0에서 0을 빼서 '절감 0분'이라고 적으면, 재 본 결과 효과가 없었다는
            // 말로 읽힌다. 아직 아무것도 재지 않았다는 것과는 다른 이야기다.
            <p className="text-[0.9375rem] leading-relaxed text-ink-700">
              아직 아무 값도 입력하지 않았습니다. 왼쪽 칸에 기관의 실측값을 넣으면
              그 자리에서 계산합니다. 기준선(서비스 전 준비시간·일지 작성시간)은
              도입 전에 몇 회기라도 직접 재 두셔야 합니다 — 그 숫자가 없으면 절감
              효과를 말할 수 없습니다.
            </p>
          ) : (
            <>
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
            </>
          )}

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
  );
}
