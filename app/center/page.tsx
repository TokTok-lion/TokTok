'use client';

import Link from 'next/link';
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
import { PIPELINE_STAGES, TASK_LABELS, sortTasks } from '@/lib/center';
import {
  AI_COST,
  FAMILY_ENGAGEMENT,
  PIPELINE,
  SESSION_OUTCOME,
  STAFF,
  TASKS,
  USAGE,
} from '@/lib/center-seed';

const TASK_TONE = {
  consentExpiring: 'amber',
  generationFailed: 'danger',
  logUnconfirmed: 'brand',
  deletionRequest: 'danger',
  familyPending: 'leaf',
} as const;

/** 센터장 운영 콘솔 (CM-DASH · 9 functions) */
export default function CenterDashboard() {
  const tasks = sortTasks(TASKS);
  const overdue = tasks.filter((t) => t.dueInDays < 0).length;
  const workers = STAFF.filter((s) => s.active && s.role === 'worker');
  const aiTotal = AI_COST.reduce((a, b) => a + b.amount, 0);

  const byStage = PIPELINE_STAGES.map((st) => ({
    ...st,
    rows: PIPELINE.filter((p) => p.stage === st.id),
  }));

  const stalled = PIPELINE.filter((p) => p.stalledDays >= 5);
  const consentSoon = PIPELINE.filter(
    (p) => p.consentExpiresInDays !== null && p.consentExpiresInDays <= 14,
  );

  return (
    <CenterShell
      code="CM-DASH"
      title="운영 콘솔"
      lead="이번 주 진행 상황과 오늘 처리할 일을 한 화면에서 확인합니다."
      actions={<CBtn href="/center/analytics">운영·ROI 분석</CBtn>}
    >
      <SampleBadge />

      {/* F-CM-DASH-001 주간 운영 현황 */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="이번 주 예정 세션"
          value={SESSION_OUTCOME.planned}
          unit="회"
          note={`완료 ${SESSION_OUTCOME.completed} · 중단 ${SESSION_OUTCOME.stopped} · 취소 ${SESSION_OUTCOME.cancelled}`}
        />
        <Kpi
          label="미확정 활동일지"
          value={STAFF.reduce((a, s) => a + s.pendingLogs, 0)}
          unit="건"
          tone="brand"
          note="담당자가 확인해야 최종 기록이 됩니다"
        />
        <Kpi
          label="사실 확인 대기"
          value={PIPELINE.filter((p) => p.stage === 'verify').length}
          unit="명"
          tone="amber"
          note="확인된 이야기만 가사로 넘어갑니다"
        />
        <Kpi
          label="가족 응답"
          value={`${FAMILY_ENGAGEMENT.responded}/${FAMILY_ENGAGEMENT.invited}`}
          tone="leaf"
          note={`가족 미참여 ${FAMILY_ENGAGEMENT.notApplicable}명은 분모에서 제외`}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_1fr]">
        {/* F-CM-DASH-002 오늘 처리할 일 */}
        <Panel
          title="오늘 처리할 일"
          code="F-CM-DASH-002"
          desc={
            overdue > 0
              ? `기한이 지난 ${overdue}건을 위로 올렸습니다.`
              : '기한이 가까운 순서입니다.'
          }
        >
          <ul className="space-y-2">
            {tasks.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[12px] border border-hairline bg-surface px-3.5 py-3"
              >
                <Pill tone={TASK_TONE[t.kind]}>{TASK_LABELS[t.kind]}</Pill>
                <span className="min-w-0 flex-1 text-[0.9375rem] font-semibold text-ink-900">
                  {t.subject}
                </span>
                <span className="text-[0.8125rem] text-ink-500">{t.owner}</span>
                <span
                  className={`text-[0.8125rem] font-bold ${
                    t.dueInDays < 0
                      ? 'text-danger-600'
                      : t.dueInDays <= 1
                        ? 'text-brand-700'
                        : 'text-ink-500'
                  }`}
                >
                  {t.dueInDays < 0
                    ? `${-t.dueInDays}일 지남`
                    : t.dueInDays === 0
                      ? '오늘'
                      : `${t.dueInDays}일 남음`}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-3">
            <LimitNote>
              기한이 지나도 계정을 잠그거나 기능을 끄지 않습니다. 순서만 앞으로
              옮겨 표시합니다.
            </LimitNote>
          </div>
        </Panel>

        {/* F-CM-DASH-006 동의·보관 주의 + F-CM-DASH-005 생성 오류 */}
        <div className="space-y-4">
          <Panel title="동의·보관 주의" code="F-CM-DASH-006">
            {consentSoon.length === 0 ? (
              <p className="text-[0.9375rem] text-ink-500">
                14일 안에 만료되는 동의가 없습니다.
              </p>
            ) : (
              <ul className="space-y-2">
                {consentSoon.map((p) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <Pill tone={p.consentExpiresInDays! <= 7 ? 'danger' : 'amber'}>
                      D-{p.consentExpiresInDays}
                    </Pill>
                    <span className="flex-1 text-[0.9375rem] font-semibold text-ink-900">
                      {p.elder}
                    </span>
                    <span className="text-[0.8125rem] text-ink-500">{p.worker}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
              만료 여부만 계산해 알려드립니다. 재동의가 필요한지에 대한 법적
              판단은 담당자와 검토자가 합니다.
            </p>
          </Panel>

          <Panel title="생성 오류" code="F-CM-DASH-005">
            <div className="flex items-center gap-3">
              <Pill tone="danger">음악 생성 1건</Pill>
              <span className="text-[0.875rem] text-ink-500">
                제공자 일시 오류 · 재시도 대기
              </span>
            </div>
            <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
              오류 코드와 건수만 표시합니다. 어르신의 이야기 본문은 오류 화면에
              나타나지 않습니다.
            </p>
          </Panel>
        </div>
      </div>

      {/* F-CM-DASH-003 어르신별 파이프라인 */}
      <Panel
        className="mt-4"
        title="어르신별 진행 단계"
        code="F-CM-DASH-003"
        desc="수집부터 가족 전달까지 어디에 머물러 있는지 봅니다."
      >
        <div className="-mx-4 overflow-x-auto px-4">
          <div className="flex min-w-[880px] gap-3">
            {byStage.map((st) => (
              <div key={st.id} className="w-[124px] shrink-0">
                <p className="flex items-center justify-between text-[0.8125rem] font-bold text-ink-500">
                  {st.label}
                  <span className="text-ink-900">{st.rows.length}</span>
                </p>
                <div className="mt-2 space-y-2">
                  {st.rows.map((r) => (
                    <div
                      key={r.id}
                      className={`rounded-[10px] border px-2.5 py-2 ${
                        r.stalledDays >= 5
                          ? 'border-brand-300 bg-brand-50'
                          : 'border-hairline bg-surface'
                      }`}
                    >
                      <p className="text-[0.9375rem] font-bold text-ink-900">{r.elder}</p>
                      <p className="text-[0.75rem] text-ink-500">{r.worker}</p>
                      {r.stalledDays >= 5 ? (
                        <p className="mt-1 text-[0.75rem] font-bold text-brand-700">
                          {r.stalledDays}일 정체
                        </p>
                      ) : null}
                    </div>
                  ))}
                  {st.rows.length === 0 ? (
                    <p className="rounded-[10px] border border-dashed border-hairline py-3 text-center text-[0.75rem] text-ink-500">
                      없음
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <LimitNote>
            이 보드는 이름과 단계만 보여줍니다. 인터뷰 내용·전사·가사 본문은
            센터장 권한으로 열리지 않으며, 필요할 때 사유를 남기고 여는 절차는{' '}
            <Link href="/center/data" className="font-bold underline">
              데이터 거버넌스
            </Link>
            에 있습니다.
          </LimitNote>
        </div>

        {stalled.length > 0 ? (
          <p className="mt-3 text-[0.875rem] text-ink-700">
            5일 이상 같은 단계에 머문 건이 {stalled.length}건 있습니다. 담당자와
            확인해 보세요.
          </p>
        ) : null}
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {/* F-CM-DASH-004 직원별 업무량 */}
        <Panel
          title="직원별 업무량"
          code="F-CM-DASH-004"
          desc="이번 주 담당 건수입니다."
        >
          <TableWrap min={420}>
            <thead>
              <tr>
                <Th>직원</Th>
                <Th className="text-right">담당</Th>
                <Th className="text-right">세션</Th>
                <Th className="text-right">미확정 일지</Th>
                <Th className="text-right">검수 대기</Th>
              </tr>
            </thead>
            <tbody>
              {workers.map((s) => (
                <tr key={s.id}>
                  <Td className="font-bold">{s.name}</Td>
                  <Td className="text-right tabular-nums">{s.assigned}</Td>
                  <Td className="text-right tabular-nums">{s.sessionsThisWeek}</Td>
                  <Td className="text-right tabular-nums">
                    {s.pendingLogs > 0 ? (
                      <span className="font-bold text-brand-700">{s.pendingLogs}</span>
                    ) : (
                      0
                    )}
                  </Td>
                  <Td className="text-right tabular-nums">{s.pendingReviews}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>

          <div className="mt-3">
            <LimitNote>
              업무량 집계이지 근무 평가가 아닙니다. 점수·등급·순위를 자동으로
              매기지 않습니다.
            </LimitNote>
          </div>
        </Panel>

        {/* F-CM-DASH-009 비용·쿼터 요약 */}
        <Panel
          title="비용·쿼터 요약"
          code="F-CM-DASH-009"
          desc="이번 달 예상치입니다."
          actions={<CBtn href="/center/usage">자세히</CBtn>}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Kpi
              label="AI 직접비 (예상)"
              value={aiTotal.toLocaleString('ko-KR')}
              unit="원"
              tone="brand"
            />
            <Kpi
              label="곡 생성"
              value={`${USAGE.find((u) => u.key === 'song')!.used}/${USAGE.find((u) => u.key === 'song')!.quota}`}
              unit="곡"
              tone="amber"
              note="한도의 80%를 넘었습니다"
            />
          </div>
          <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
            여기 표시되는 금액은 사용량으로 계산한 <strong>예상치</strong>입니다.
            실제 청구액은 월 마감 후 청구서에서 확인하세요.
          </p>
        </Panel>
      </div>
    </CenterShell>
  );
}
