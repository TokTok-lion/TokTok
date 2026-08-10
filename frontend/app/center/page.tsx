'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
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
import { CenterLive } from '@/components/CenterLive';
import { useAccount } from '@/lib/auth';
import { PIPELINE_STAGES, ROLE_LABELS, TASK_LABELS, sortTasks } from '@/lib/center';
import {
  AI_COST,
  FAMILY_ENGAGEMENT,
  PIPELINE,
  SESSION_OUTCOME,
  STAFF,
  TASKS,
  USAGE,
} from '@/lib/center-seed';
import { costEstimate, staffLoads, type CostEstimate, type StaffLoad } from '@/lib/repo';

const TASK_TONE = {
  consentExpiring: 'amber',
  generationFailed: 'danger',
  logUnconfirmed: 'brand',
  deletionRequest: 'danger',
  familyPending: 'leaf',
} as const;

/**
 * 서버 한 번 읽기의 세 가지 결말.
 *
 * lib/repo.ts 의 집계 함수는 실패를 예외로 던지지 않고 빈 값(null·[])으로
 * 돌려준다. 그래서 화면이 '못 읽었다'와 '읽었는데 0건'을 스스로 갈라야 한다.
 * 못 읽은 것을 0 으로 그리면 그 0 이 거짓말이 되고, 씨앗으로 메우면 남의
 * 기관 숫자가 된다.
 */
type Load<T> = { state: 'loading' } | { state: 'failed' } | { state: 'ok'; value: T };

/**
 * 센터장 운영 콘솔 (CM-DASH · 9 functions)
 *
 * 예전에는 이 화면 전체가 lib/center-seed.ts 의 씨앗이었다. 실제 기관으로
 * 로그인하면 맨 위 「기관 데이터」에는 서버에서 읽은 진짜 숫자가, 바로 아래
 * 칸에는 남의 기관 씨앗이 같은 모양의 카드로 나란히 앉았다. 어느 쪽이 진짜인지
 * 화면만 봐서는 알 수 없으니 결국 둘 다 못 믿게 된다 — 섞어 두는 것이 아예
 * 비워 두는 것보다 나쁘다.
 *
 * 그래서 세 갈래로 나눈다.
 *   확인 중   — 아무것도 그리지 않고 무엇을 기다리는지만 적는다.
 *   실제 기관 — 서버가 준 값만 그리고, 서버가 못 주는 자리는 못 준다고 적는다.
 *   둘러보기  — 씨앗을 그리되 맨 위 띠가 예시라고 밝힌다.
 */
export default function CenterDashboard() {
  const { account } = useAccount();
  const live = account.status === 'in';
  const checking = account.status === 'loading';
  // 서버가 아예 없는 배포(status 'local')도 둘러보기와 같은 취급이다. 로그인
  // 하라고 말해 봐야 로그인할 곳이 없다.
  const demo = !live && !checking;

  const [loads, setLoads] = useState<Load<StaffLoad[]>>({ state: 'loading' });
  const [cost, setCost] = useState<Load<CostEstimate>>({ state: 'loading' });

  useEffect(() => {
    if (!live) return;
    // 여기서 'loading' 으로 되돌리지 않는다. 처음 값이 이미 loading 이고,
    // 이 효과는 로그인이 확인되는 순간에만 도는데, 효과 안에서 곧바로
    // setState 를 부르면 렌더가 한 번 더 돈다.
    let alive = true;

    void staffLoads().then(
      (rows) => {
        if (!alive) return;
        // memberships 를 읽을 수 있었다면 최소한 지금 로그인한 사람의 행이
        // 돌아온다 (RLS: 같은 기관이면 전원 조회 가능, 그리고 로그인 상태
        // 'in' 자체가 활성 membership 이 있다는 뜻이다). 그러므로 빈 배열은
        // '직원이 없다'가 아니라 '못 읽었다'는 뜻이다.
        setLoads(rows.length ? { state: 'ok', value: rows } : { state: 'failed' });
      },
      () => {
        if (alive) setLoads({ state: 'failed' });
      },
    );

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

  const tasks = sortTasks(TASKS);
  const overdue = tasks.filter((t) => t.dueInDays < 0).length;
  const workers = STAFF.filter((s) => s.active && s.role === 'worker');
  const aiTotal = AI_COST.reduce((a, b) => a + b.amount, 0);
  const seedSong = USAGE.find((u) => u.key === 'song');

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
      data={{
        kind: 'seedWhileBrowsing',
        what: '아래 주간 현황·할 일·진행 단계·직원 업무량·비용 요약은 둘러보기용 예시입니다. 실제 기관으로 로그인하면 서버에서 읽은 값만 남고, 서버가 아직 집계하지 않는 항목은 예시로 채우지 않고 그렇다고 적습니다.',
      }}
    >
      {/* 서버가 실제로 아는 값. 이 패널은 스스로 로그인 상태를 가린다. */}
      <CenterLive />

      {/* F-CM-DASH-001 주간 운영 현황 */}
      <div className="mt-4">
        {checking ? (
          <Panel title="주간 운영 현황" code="F-CM-DASH-001">
            <Checking />
          </Panel>
        ) : live ? (
          <Panel title="주간 운영 현황" code="F-CM-DASH-001">
            {loads.state === 'loading' ? (
              <p className="text-[0.9375rem] text-ink-500">불러오는 중…</p>
            ) : loads.state === 'failed' ? (
              <ReadFailed what="직원 기록" />
            ) : (
              // 이번 달 회기 수는 여기서 다시 세지 않는다. 위 「기관 데이터」가
              // 이미 같은 이름으로 그리는데, 저쪽은 기관의 모든 회기를 세고
              // 이쪽은 담당자가 배정된 회기만 센다. 같은 이름표를 단 다른 숫자
              // 둘이 한 화면에 있으면 둘 다 못 믿게 된다.
              <div className="grid gap-3 sm:grid-cols-2">
                <Kpi
                  label="미확정 활동일지"
                  value={loads.value.reduce((a, s) => a + s.logsPending, 0)}
                  unit="건"
                  tone="brand"
                  note="담당자가 확인해야 최종 기록이 됩니다"
                />
              </div>
            )}
            <div className="mt-3">
              <NotYet>
                이번 주 <strong>예정</strong> 세션, 사실 확인 대기 인원, 가족 응답률은
                아직 집계하지 않습니다. 회기 예약과 가족 초대를 서버에 기록하는
                기능이 먼저 있어야 셀 수 있습니다.
              </NotYet>
            </div>
          </Panel>
        ) : (
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
        )}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_1fr]">
        {/* F-CM-DASH-002 오늘 처리할 일 */}
        <Panel
          title="오늘 처리할 일"
          code="F-CM-DASH-002"
          desc={
            demo
              ? overdue > 0
                ? `기한이 지난 ${overdue}건을 위로 올렸습니다.`
                : '기한이 가까운 순서입니다.'
              : undefined
          }
        >
          {checking ? (
            <Checking />
          ) : live ? (
            <NotYet>
              할 일 목록을 서버에서 만들지 못합니다. 어느 어르신의 무엇이 언제까지
              처리되어야 하는지를 담는 표가 아직 없기 때문입니다. 지금 확인할 수
              있는 것은 두 가지입니다 — 위 「기관 데이터」의 동의 만료 임박 건수와,
              「주간 운영 현황」의 미확정 활동일지 건수. 일지를 확정하는 곳은{' '}
              <Link href="/home" className="font-bold underline">
                복지사 앱
              </Link>
              입니다.
            </NotYet>
          ) : (
            <>
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
            </>
          )}
        </Panel>

        {/* F-CM-DASH-006 동의·보관 주의 + F-CM-DASH-005 생성 오류 */}
        <div className="space-y-4">
          <Panel title="동의·보관 주의" code="F-CM-DASH-006">
            {checking ? (
              <Checking />
            ) : live ? (
              <NotYet>
                30일 안에 만료되는 동의가 몇 건인지는 위 「기관 데이터」의 「동의
                만료 임박」에 있습니다. 그것이 <strong>어느 어르신의 어떤 동의</strong>
                인지까지는 아직 목록으로 뽑지 못합니다. 지금은 복지사 앱에서 어르신을
                열어 동의 상태를 확인해 주세요.
              </NotYet>
            ) : consentSoon.length === 0 ? (
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
            {checking ? (
              <Checking />
            ) : live ? (
              <NotYet>
                실패한 곡 생성을 기관 단위로 모아 세는 집계가 아직 없습니다. 곡이
                실패하면 그 곡을 만든 복지사의 화면에 그 자리에서 표시되고, 다시
                시도할 수 있습니다.
              </NotYet>
            ) : (
              <div className="flex items-center gap-3">
                <Pill tone="danger">음악 생성 1건</Pill>
                <span className="text-[0.875rem] text-ink-500">
                  제공자 일시 오류 · 재시도 대기
                </span>
              </div>
            )}
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
        {checking ? (
          <Checking />
        ) : live ? (
          <NotYet>
            단계별 보드를 그리려면 어르신 한 분의 회기·가사·곡·가족 전달을 한 줄로
            잇는 집계가 필요한데, 아직 없습니다. 대신 최근 회기 5건이 어느 단계에
            있는지는 위 「기관 데이터」에서 볼 수 있습니다.
          </NotYet>
        ) : (
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
        )}

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

        {demo && stalled.length > 0 ? (
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
          desc={live ? '이번 달 실제 기록에서 센 값입니다.' : '이번 주 담당 건수입니다.'}
        >
          {checking ? (
            <Checking />
          ) : live ? (
            loads.state === 'loading' ? (
              <p className="text-[0.9375rem] text-ink-500">불러오는 중…</p>
            ) : loads.state === 'failed' ? (
              <ReadFailed what="직원 기록" />
            ) : (
              <TableWrap min={420}>
                <thead>
                  <tr>
                    <Th>권한</Th>
                    <Th className="text-right">이번 달 회기</Th>
                    <Th className="text-right">미확정 일지</Th>
                    <Th>마지막 회기</Th>
                  </tr>
                </thead>
                <tbody>
                  {loads.value.map((r) => (
                    <tr key={r.membershipId}>
                      <Td className="font-bold">{ROLE_LABELS[r.role] ?? r.role}</Td>
                      <Td className="text-right tabular-nums">{r.sessionsThisMonth}</Td>
                      <Td className="text-right tabular-nums">
                        {r.logsPending > 0 ? (
                          <span className="font-bold text-brand-700">{r.logsPending}</span>
                        ) : (
                          0
                        )}
                      </Td>
                      <Td className="text-ink-500">
                        {r.lastActive
                          ? new Date(r.lastActive).toLocaleDateString('ko-KR', {
                              month: 'numeric',
                              day: 'numeric',
                            })
                          : '—'}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )
          ) : (
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
          )}

          <div className="mt-3">
            <LimitNote>
              업무량 집계이지 근무 평가가 아닙니다. 점수·등급·순위를 자동으로
              매기지 않습니다. 실제 기록에서는 이름 대신 권한으로 표시합니다 —
              같은 이유입니다.
            </LimitNote>
          </div>
        </Panel>

        {/* F-CM-DASH-009 비용·쿼터 요약 */}
        <Panel
          title="비용·쿼터 요약"
          code="F-CM-DASH-009"
          desc={live ? '이번 달 실제 사용량입니다.' : '이번 달 예상치입니다.'}
          actions={<CBtn href="/center/usage">자세히</CBtn>}
        >
          {checking ? (
            <Checking />
          ) : live ? (
            cost.state === 'loading' ? (
              <p className="text-[0.9375rem] text-ink-500">불러오는 중…</p>
            ) : cost.state === 'failed' ? (
              <ReadFailed what="이번 달 사용량" />
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Kpi
                    label="AI 어림 요금"
                    value={cost.value.krw.toLocaleString('ko-KR')}
                    unit="원"
                    tone="brand"
                    note="곡 수로 계산한 어림값 · 청구서가 아닙니다"
                  />
                  <Kpi
                    label="곡 생성"
                    value={
                      cost.value.quota !== null
                        ? `${cost.value.songs} / ${cost.value.quota}`
                        : cost.value.songs
                    }
                    unit={cost.value.quota !== null ? undefined : '곡'}
                    tone="amber"
                    note={
                      cost.value.quota !== null
                        ? `이번 달 한도 · 남은 곡 ${cost.value.quotaLeft ?? '—'}`
                        : '이번 달 한도를 읽지 못했습니다'
                    }
                  />
                </div>
                <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
                  전사·읽어주기·가사는 곡에 비해 매우 작아 따로 세지 않았습니다.
                  항목별로 나눈 금액과 플랜·청구서는 아직 집계하지 않습니다.
                </p>
              </>
            )
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Kpi
                  label="AI 직접비 (예상)"
                  value={aiTotal.toLocaleString('ko-KR')}
                  unit="원"
                  tone="brand"
                />
                <Kpi
                  label="곡 생성"
                  value={seedSong ? `${seedSong.used}/${seedSong.quota}` : '—'}
                  unit="곡"
                  tone="amber"
                  note="한도의 80%를 넘었습니다"
                />
              </div>
              <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
                여기 표시되는 금액은 사용량으로 계산한 <strong>예상치</strong>입니다.
                실제 청구액은 월 마감 후 청구서에서 확인하세요.
              </p>
            </>
          )}
        </Panel>
      </div>
    </CenterShell>
  );
}

/** 서버가 아직 주지 못하는 자리. 씨앗으로 메우지 않고 무엇이 없는지 적는다. */
function NotYet({ children }: { children: ReactNode }) {
  return <p className="text-[0.9375rem] leading-relaxed text-ink-700">{children}</p>;
}

/**
 * 읽기가 실패했을 때.
 *
 * 조용히 0 이나 씨앗으로 떨어지지 않는다. 센터장이 "오늘은 아무 일도 없었구나"로
 * 읽고 넘어가는 것이 통신 오류보다 나쁜 결과다.
 */
function ReadFailed({ what }: { what: string }) {
  return (
    <p className="rounded-[12px] bg-[#fbe3dd] px-3.5 py-3 text-[0.9375rem] font-semibold leading-relaxed text-danger-600">
      {what}을 서버에서 읽지 못했습니다. 이 자리를 비워 두는 것은 기록이 없어서가
      아니라 확인하지 못해서입니다. 새로고침해 보시고, 계속 안 되면 도입 담당자에게
      알려 주세요.
    </p>
  );
}
