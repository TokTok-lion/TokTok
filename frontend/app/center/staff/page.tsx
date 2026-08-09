'use client';

import { useState } from 'react';
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
  ASSIGNABLE_ROLES,
  MFA_REQUIRED_ROLES,
  ROLE_LABELS,
  ROLE_SUMMARY,
  type StaffRole,
} from '@/lib/center';
import { CenterStaffLive } from '@/components/CenterStaffLive';
import { STAFF } from '@/lib/center-seed';

/** 직원 관리 (CM-STAFF · 8 functions) */
export default function StaffPage() {
  const [staff, setStaff] = useState(STAFF);
  const [inviteRole, setInviteRole] = useState<StaffRole>('worker');
  const [invited, setInvited] = useState<string | null>(null);

  const active = staff.filter((s) => s.active);
  const mfaGap = active.filter((s) => MFA_REQUIRED_ROLES.includes(s.role) && !s.mfa);
  // F-CM-STAFF-008 · 90일 이상 미사용 계정 점검
  const dormant = staff.filter((s) => s.active && s.lastActiveDays >= 90);

  const setRole = (id: string, role: StaffRole) =>
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, role } : s)));

  const toggleActive = (id: string) =>
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));

  return (
    <CenterShell
      code="CM-STAFF"
      title="직원 관리"
      lead="역할과 접근 권한을 관리합니다. 기본은 최소 권한입니다."
    >
      {/* 실제 기록에서 센 값 */}
      <CenterStaffLive />

      {/* 위는 진짜, 아래는 시연이다. 경계를 안 그으면 "센터장 1명"과 "5명"이
          나란히 보여서, 어느 쪽을 믿어야 할지 모른 채 둘 다 못 믿게 된다. */}
      <div className="mt-6">
        <SampleBadge>
          여기부터 아래는 예시 데이터입니다. 초대·권한 화면을 보여주기 위한
          것으로, 위의 「직원 현황」이 실제 기록입니다.
        </SampleBadge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Kpi label="활동 중인 직원" value={active.length} unit="명" />
        <Kpi
          label="MFA 미설정 (필수 역할)"
          value={mfaGap.length}
          unit="명"
          tone={mfaGap.length ? 'danger' : 'leaf'}
          note={mfaGap.length ? mfaGap.map((s) => s.name).join(', ') : '모두 설정 완료'}
        />
        <Kpi
          label="장기 미사용 계정"
          value={dormant.length}
          unit="명"
          tone={dormant.length ? 'amber' : 'leaf'}
          note="90일 이상 · 자동 해지하지 않습니다"
        />
      </div>

      {/* F-CM-STAFF-001 직원 초대 + F-CM-STAFF-002 역할 부여 */}
      <Panel className="mt-4" title="직원 초대" code="F-CM-STAFF-001">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const email = new FormData(e.currentTarget).get('email') as string;
            setInvited(email);
            e.currentTarget.reset();
          }}
        >
          <div className="min-w-[220px] flex-1">
            <label htmlFor="email" className="block text-[0.8125rem] font-bold text-ink-500">
              이메일
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="name@example.kr"
              className="mt-1 min-h-[40px] w-full rounded-[10px] border border-hairline bg-surface px-3 text-[0.9375rem] text-ink-900"
            />
          </div>
          <div>
            <label htmlFor="role" className="block text-[0.8125rem] font-bold text-ink-500">
              역할
            </label>
            <select
              id="role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as StaffRole)}
              className="mt-1 min-h-[40px] rounded-[10px] border border-hairline bg-surface px-3 text-[0.9375rem] text-ink-900"
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <CBtn type="submit" tone="solid">
            초대 보내기
          </CBtn>
        </form>

        <p className="mt-2 text-[0.875rem] text-ink-500">
          {ROLE_SUMMARY[inviteRole]}
          {MFA_REQUIRED_ROLES.includes(inviteRole)
            ? ' · 이 역할은 추가 인증(MFA)이 필요합니다.'
            : ''}
        </p>

        {invited ? (
          <p className="mt-3 rounded-[10px] bg-leaf-50 px-3.5 py-2.5 text-[0.875rem] font-semibold text-leaf-800">
            {invited} 주소로 만료형 초대 링크를 보냈습니다.
          </p>
        ) : null}

        <div className="mt-3">
          <LimitNote>
            시스템 관리자 역할은 기관에서 부여할 수 없습니다. 서비스 운영자만
            지정합니다.
          </LimitNote>
        </div>
      </Panel>

      {/* F-CM-STAFF-002/003/005/006 */}
      <Panel
        className="mt-4"
        title="직원 목록"
        code="F-CM-STAFF-002 · 005 · 006"
        desc="역할을 바꾸거나 접근을 즉시 차단할 수 있습니다."
      >
        <TableWrap>
          <thead>
            <tr>
              <Th>이름</Th>
              <Th>역할</Th>
              <Th>MFA</Th>
              <Th className="text-right">담당</Th>
              <Th>최근 접속</Th>
              <Th className="text-right">상태</Th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => {
              const needsMfa = MFA_REQUIRED_ROLES.includes(s.role);
              return (
                <tr key={s.id} className={s.active ? '' : 'opacity-55'}>
                  <Td>
                    <span className="font-bold">{s.name}</span>
                    <span className="block text-[0.8125rem] text-ink-500">{s.email}</span>
                  </Td>
                  <Td>
                    <label className="sr-only" htmlFor={`role-${s.id}`}>
                      {s.name} 역할
                    </label>
                    <select
                      id={`role-${s.id}`}
                      value={s.role}
                      disabled={!s.active}
                      onChange={(e) => setRole(s.id, e.target.value as StaffRole)}
                      className="min-h-[40px] rounded-[10px] border border-hairline bg-surface px-2.5 text-[0.875rem] font-semibold text-ink-900 disabled:opacity-60"
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </Td>
                  <Td>
                    {s.mfa ? (
                      <Pill tone="leaf">설정됨</Pill>
                    ) : needsMfa ? (
                      <Pill tone="danger">필요</Pill>
                    ) : (
                      <Pill>선택</Pill>
                    )}
                  </Td>
                  <Td className="text-right tabular-nums">{s.assigned}</Td>
                  <Td className="text-ink-500">
                    {s.lastActiveDays === 0 ? '오늘' : `${s.lastActiveDays}일 전`}
                  </Td>
                  <Td className="text-right">
                    <CBtn
                      tone={s.active ? 'ghost' : 'solid'}
                      onClick={() => toggleActive(s.id)}
                    >
                      {s.active ? '비활성화' : '다시 활성화'}
                    </CBtn>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>

        <div className="mt-3">
          <LimitNote>
            비활성화는 접근만 즉시 막습니다. 그 직원이 남긴 기록과 작성 이력은
            지워지지 않습니다.
          </LimitNote>
        </div>
      </Panel>

      {/* F-CM-STAFF-003 세부 권한 */}
      <Panel
        className="mt-4"
        title="역할별 기본 권한"
        code="F-CM-STAFF-003"
        desc="역할 템플릿 위에 제한만 더할 수 있습니다. 권한 상승은 감사로그에 남습니다."
      >
        <TableWrap>
          <thead>
            <tr>
              <Th>역할</Th>
              <Th>원음성</Th>
              <Th>전사·스토리</Th>
              <Th>가사·곡</Th>
              <Th>다운로드</Th>
              <Th>삭제</Th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ['director', '사유 입력 후', '진행상태', '조회·재생', '제한', '승인'],
                ['worker', '담당 자료', '담당 CRUD', '생성·검수', '제한', '요청'],
                ['assistant', '불가', '승인된 일부', '세션 재생', '제한', '불가'],
                ['reviewer', '검토 목적', '검토 목적', '검토 목적', '제한', '승인'],
                ['finance', '불가', '불가', '불가', '불가', '불가'],
              ] as [StaffRole, ...string[]][]
            ).map(([role, ...cells]) => (
              <tr key={role}>
                <Td className="font-bold">{ROLE_LABELS[role]}</Td>
                {cells.map((c, i) => (
                  <Td key={i} className="text-[0.875rem] text-ink-700">
                    {c === '불가' ? <span className="text-ink-500">불가</span> : c}
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Panel>
    </CenterShell>
  );
}
