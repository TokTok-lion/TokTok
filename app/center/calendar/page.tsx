'use client';

import { useState } from 'react';
import {
  CBtn,
  CenterShell,
  Kpi,
  LimitNote,
  Panel,
  Pill,
  TableWrap,
  Td,
  Th,
} from '@/components/CenterShell';
import { SESSION_OUTCOME, STAFF } from '@/lib/center-seed';

const WEEK = ['월', '화', '수', '목', '금'];

/** 주간 보드. 어르신은 가명, 내용은 표시하지 않는다 (개인정보 최소표시). */
const BOARD: { day: number; time: string; elder: string; worker: string; kind: string }[] = [
  { day: 0, time: '10:00', elder: '김○○', worker: '박서준', kind: '인터뷰' },
  { day: 0, time: '14:00', elder: '박○○', worker: '박서준', kind: '노래 듣기' },
  { day: 1, time: '10:00', elder: '이○○', worker: '김하늘', kind: '인터뷰' },
  { day: 1, time: '11:00', elder: '정○○', worker: '김하늘', kind: '가사 검수' },
  { day: 2, time: '10:00', elder: '한○○', worker: '박서준', kind: '함께 부르기' },
  { day: 2, time: '10:00', elder: '조○○', worker: '박서준', kind: '인터뷰' },
  { day: 3, time: '14:00', elder: '윤○○', worker: '김하늘', kind: '함께 부르기' },
  { day: 4, time: '10:00', elder: '장○○', worker: '김하늘', kind: '인터뷰' },
];

const APPROVAL_STEPS = [
  { key: 'plan', label: '12주 운영계획', on: true },
  { key: 'lyrics', label: '가사 확정', on: false },
  { key: 'song', label: '곡 확정', on: false },
  { key: 'log', label: '활동일지 확정', on: true },
];

/** 운영 계획 관리 (CM-CAL · 8 functions) */
export default function CalendarPage() {
  const [approvals, setApprovals] = useState(APPROVAL_STEPS);

  // F-CM-CAL-005 · 같은 시간에 같은 직원이 둘 이상 배정된 건을 찾는다.
  const conflicts = BOARD.filter(
    (a, _, arr) =>
      arr.filter((b) => b.day === a.day && b.time === a.time && b.worker === a.worker)
        .length > 1,
  );

  return (
    <CenterShell
      code="CM-CAL"
      title="운영 계획 관리"
      lead="센터 전체 일정과 승인 정책을 관리합니다."
      actions={<CBtn tone="solid">12주 계획 만들기</CBtn>}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="이번 주 일정" value={BOARD.length} unit="건" />
        <Kpi
          label="일정 충돌"
          value={conflicts.length}
          unit="건"
          tone={conflicts.length ? 'danger' : 'leaf'}
          note={conflicts.length ? '같은 직원·같은 시간' : '충돌 없음'}
        />
        <Kpi
          label="이번 분기 완료"
          value={SESSION_OUTCOME.completed}
          unit="회"
          tone="leaf"
          note={`계획 ${SESSION_OUTCOME.planned}회`}
        />
      </div>

      {/* F-CM-CAL-001 센터 캘린더 */}
      <Panel className="mt-4" title="주간 일정" code="F-CM-CAL-001">
        <div className="-mx-4 overflow-x-auto px-4">
          <div className="grid min-w-[720px] grid-cols-5 gap-3">
            {WEEK.map((w, i) => (
              <div key={w}>
                <p className="border-b border-hairline pb-2 text-[0.875rem] font-bold text-ink-500">
                  {w}
                </p>
                <div className="mt-2 space-y-2">
                  {BOARD.filter((b) => b.day === i).map((b, j) => {
                    const clash = conflicts.includes(b);
                    return (
                      <div
                        key={j}
                        className={`rounded-[10px] border px-2.5 py-2 ${
                          clash
                            ? 'border-danger-600 bg-[#fbe3dd]'
                            : 'border-hairline bg-surface'
                        }`}
                      >
                        {/* on the pale danger tint, brand-700 only reaches
                            4.2:1 — the dark ink keeps AA while the border and
                            the warning below carry the signal */}
                        <p
                          className={`text-[0.8125rem] font-bold ${
                            clash ? 'text-ink-900' : 'text-brand-700'
                          }`}
                        >
                          {b.time}
                        </p>
                        <p className="text-[0.9375rem] font-bold text-ink-900">{b.elder}</p>
                        <p className="text-[0.75rem] text-ink-500">
                          {b.kind} · {b.worker}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {conflicts.length > 0 ? (
          <p className="mt-3 rounded-[10px] bg-[#fbe3dd] px-3.5 py-2.5 text-[0.875rem] font-semibold text-danger-600">
            같은 직원이 같은 시간에 두 건을 맡고 있습니다. 경고만 표시하며,
            사정이 있으면 그대로 진행할 수 있습니다.
          </p>
        ) : null}
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {/* F-CM-CAL-003 세션 승인 정책 */}
        <Panel
          title="승인 정책"
          code="F-CM-CAL-003"
          desc="어느 단계에서 센터장 승인을 받을지 정합니다."
        >
          <ul className="space-y-2">
            {approvals.map((s) => (
              <li
                key={s.key}
                className="flex items-center gap-3 rounded-[10px] border border-hairline bg-surface px-3.5 py-2.5"
              >
                <button
                  type="button"
                  role="switch"
                  aria-checked={s.on}
                  aria-label={`${s.label} 센터장 승인 필요`}
                  onClick={() =>
                    setApprovals((prev) =>
                      prev.map((x) => (x.key === s.key ? { ...x, on: !x.on } : x)),
                    )
                  }
                  className={`relative h-[30px] w-[54px] shrink-0 rounded-full transition-colors ${
                    s.on ? 'bg-leaf-600' : 'bg-ink-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 h-[22px] w-[22px] rounded-full bg-white transition-[left] ${
                      s.on ? 'left-[27px]' : 'left-1'
                    }`}
                  />
                </button>
                <span className="flex-1 text-[0.9375rem] font-bold text-ink-900">
                  {s.label}
                </span>
                <Pill tone={s.on ? 'leaf' : 'neutral'}>
                  {s.on ? '승인 필요' : '담당자 재량'}
                </Pill>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <LimitNote>
              승인 단계를 늘릴수록 현장이 느려집니다. 어르신 본인의 확인은 어떤
              설정에서도 생략되지 않으니, 행정 승인은 꼭 필요한 곳에만 켜세요.
            </LimitNote>
          </div>
        </Panel>

        {/* F-CM-CAL-004 · 006 · 007 */}
        <Panel title="계획 도구" code="F-CM-CAL-002 · 004 · 006 · 007">
          <div className="space-y-3">
            {[
              { t: '12주 프로그램 생성', d: '대상 인원과 주당 회기로 초안을 만듭니다. 치료 프로토콜이 아닙니다.' },
              { t: '일괄 일정 변경', d: '휴무·행사로 여러 회기를 한 번에 옮깁니다.' },
              { t: '프로그램 템플릿 관리', d: '질문 카드·진행안·일지 양식을 기관 버전으로 관리합니다.' },
              { t: '프로그램 이력', d: '주차별 완료·중단·대체 회기를 봅니다.' },
            ].map((x) => (
              <div key={x.t} className="rounded-[12px] border border-hairline bg-surface p-3.5">
                <p className="text-[0.9375rem] font-bold text-ink-900">{x.t}</p>
                <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-500">{x.d}</p>
                <div className="mt-2.5">
                  <CBtn>열기</CBtn>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* F-CM-STAFF-004 담당자 배정 규칙 (계획 화면에서 함께 다룬다) */}
      <Panel className="mt-4" title="담당자 배정 규칙" code="F-CM-STAFF-004">
        <TableWrap>
          <thead>
            <tr>
              <Th>직원</Th>
              <Th>기본 담당 요일</Th>
              <Th className="text-right">담당 어르신</Th>
            </tr>
          </thead>
          <tbody>
            {STAFF.filter((s) => s.active && s.role === 'worker').map((s) => (
              <tr key={s.id}>
                <Td className="font-bold">{s.name}</Td>
                <Td className="text-ink-700">월 · 수 · 금</Td>
                <Td className="text-right tabular-nums">{s.assigned}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
        <p className="mt-3 text-[0.8125rem] text-ink-500">
          일정을 만들 때 기본값으로 제안할 뿐입니다. 담당자는 언제든 바꿀 수
          있습니다.
        </p>
      </Panel>
    </CenterShell>
  );
}
