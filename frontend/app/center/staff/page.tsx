'use client';

import { useState } from 'react';
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
  ASSIGNABLE_ROLES,
  MFA_REQUIRED_ROLES,
  ROLE_LABELS,
  ROLE_SUMMARY,
  type StaffRole,
} from '@/lib/center';
import { CenterStaffLive } from '@/components/CenterStaffLive';
import { JoinCodePanel } from '@/components/JoinCodePanel';
import { STAFF } from '@/lib/center-seed';

/**
 * 직원 관리 (CM-STAFF · 8 functions)
 *
 * 이 화면에는 실제 기록에서 센 「직원 현황」(CenterStaffLive)과 씨앗 직원
 * 여섯 명이 함께 있었다. 실제 기관 센터장이 보면 위에는 '센터장 1명', 아래에는
 * 이정은·박서준·김하늘… 이 나란히 앉는다. 게다가 아래 목록의 역할 선택과
 * 초대 폼은 눌러도 서버에 아무것도 남지 않으면서 "초대 링크를 보냈습니다"라고
 * 답했다. 권한을 바꿨다고 믿은 센터장은 그 직원이 못 여는 화면을 열 수 있다고
 * 생각한다.
 *
 * 그래서 씨앗 직원과 그 위에서 도는 조작은 둘러보기에서만 그린다. 실제 기관
 * 에서는 서버가 아는 것(권한별 업무량)만 남기고, 없는 기능은 없다고 적는다.
 */
export default function StaffPage() {
  const { account } = useAccount();
  const live = account.status === 'in';
  const checking = account.status === 'loading';
  const demo = !live && !checking;

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
      data={{
        kind: 'seedWhileBrowsing',
        what: '아래 직원 목록·초대·상태 지표는 둘러보기용 예시입니다. 여기서 바꾼 역할이나 보낸 초대는 서버에 남지 않습니다. 실제 기관으로 로그인하면 서버에서 센 「직원 현황」만 남습니다.',
      }}
    >
      {/* 실제 기록에서 센 값. 이 패널은 스스로 로그인 상태를 가린다. */}
      <CenterStaffLive />

      {/* 복지사를 실제로 들어오게 하는 열쇠. 씨앗 초대 폼과 달리 이건 서버에
          닿는다 — 이 코드로 가입하면 진짜 memberships 에 들어온다. */}
      <JoinCodePanel />

      {/* F-CM-STAFF-004 · 008 상태 점검 */}
      <div className="mt-4">
        {checking ? (
          <Panel title="계정 점검" code="F-CM-STAFF-008">
            <Checking />
          </Panel>
        ) : live ? (
          <Panel title="계정 점검" code="F-CM-STAFF-008">
            <p className="text-[0.9375rem] leading-relaxed text-ink-700">
              추가 인증(MFA) 설정 여부와 마지막 접속일은 아직 서버에서 읽지
              못합니다. 그래서 &lsquo;MFA 미설정 몇 명&rsquo;, &lsquo;장기 미사용
              계정 몇 개&rsquo;를 세어 드릴 수 없습니다 — 세었다고 적으면 점검한
              적 없는 것을 점검했다고 말하는 셈입니다. 활동 중인 직원 수는 위
              「직원 현황」의 줄 수로 확인하세요.
            </p>
            <div className="mt-3">
              <LimitNote>
                점검 기능이 없다고 계정이 잠기지는 않습니다. 지금 당장 접근을
                막아야 하는 직원이 있으면 도입 담당자에게 연락해 주세요.
              </LimitNote>
            </div>
          </Panel>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
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
        )}
      </div>

      {/* F-CM-STAFF-001 직원 초대 + F-CM-STAFF-002 역할 부여 */}
      <Panel className="mt-4" title="직원 초대" code="F-CM-STAFF-001">
        {checking ? (
          <Checking />
        ) : live ? (
          <>
            {/* 눌러도 아무 일이 없는 폼을 살아 있는 것처럼 두지 않는다.
                초대는 계정과 권한이 걸린 일이라, 보냈다고 믿고 기다리는
                동안 그 직원은 아무것도 못 한다. */}
            <p className="text-[0.9375rem] leading-relaxed text-ink-700">
              이 화면에서 직원을 초대할 수 없습니다. 초대 메일을 보내고 계정을
              만드는 기능이 아직 없습니다. 직원을 추가하려면 도입 담당자에게
              이메일과 역할을 알려 주세요 — 계정이 만들어지면 위 「직원 현황」에
              나타납니다.
            </p>
            <div className="mt-3">
              <CBtn disabled title="아직 준비되지 않았습니다">
                초대 보내기
              </CBtn>
            </div>
          </>
        ) : (
          <>
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
                예시입니다 — 실제 서비스라면 {invited} 주소로 만료형 초대 링크가
                갑니다. 지금은 아무 메일도 보내지 않았습니다.
              </p>
            ) : null}
          </>
        )}

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
        desc={demo ? '역할을 바꾸거나 접근을 즉시 차단할 수 있습니다.' : undefined}
      >
        {checking ? (
          <Checking />
        ) : live ? (
          <p className="text-[0.9375rem] leading-relaxed text-ink-700">
            직원 이름과 이메일을 목록으로 읽어 오는 기능, 그리고 이 화면에서 역할을
            바꾸거나 접근을 차단하는 기능이 아직 없습니다. 예시 직원 목록을 대신
            보여주지 않는 이유는, 거기서 역할을 바꾸면 바뀐 줄 알고 넘어가기
            때문입니다. 누가 어떤 권한으로 얼마나 일했는지는 위 「직원 현황」에
            있고, 권한을 바꾸려면 도입 담당자에게 요청해야 합니다.
          </p>
        ) : (
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
        )}

        <div className="mt-3">
          <LimitNote>
            비활성화는 접근만 즉시 막습니다. 그 직원이 남긴 기록과 작성 이력은
            지워지지 않습니다.
          </LimitNote>
        </div>
      </Panel>

      {/* F-CM-STAFF-003 세부 권한 — 측정값이 아니라 서비스가 정한 규칙이라
          로그인 여부와 상관없이 그대로 보여준다. */}
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
