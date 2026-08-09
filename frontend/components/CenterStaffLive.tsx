'use client';

import { useEffect, useState } from 'react';
import { LimitNote, Panel, TableWrap, Td, Th } from './CenterShell';
import { useAccount } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/center';
import { staffLoads, type StaffLoad } from '@/lib/repo';

/**
 * 직원별 업무량 — 실제 기록에서 센 것.
 *
 * 개수만 센다. 점수도 순위도 만들지 않는다. 복지사를 줄 세우는 도구가 되면
 * 어르신께 쓸 시간을 기록 채우는 데 쓰게 되고, 그건 이 서비스가 하려는 일의
 * 반대다. 아래에 왜 등수가 없는지도 적어 둔다 — 안 적으면 다음 사람이
 * "정렬 기능이 빠졌다"고 생각하고 넣는다.
 */
export function CenterStaffLive() {
  const { account } = useAccount();
  const [rows, setRows] = useState<StaffLoad[] | null>(null);
  const live = account.status === 'in';

  useEffect(() => {
    if (!live) return;
    let alive = true;
    void staffLoads().then((r) => {
      if (alive) setRows(r);
    });
    return () => {
      alive = false;
    };
  }, [live]);

  if (!live) {
    return (
      <Panel title="직원 현황" code="F-CM-STAFF-004" desc="로그인 필요">
        <LimitNote>
          기관 기록을 보려면 로그인해야 합니다. 아래 표는 시연용 데이터입니다.
        </LimitNote>
      </Panel>
    );
  }

  return (
    <Panel
      title="직원 현황"
      code="F-CM-STAFF-004"
      desc={`${account.tenantName} · 실제 기록에서 센 값`}
    >
      {rows === null ? (
        <p className="text-[0.9375rem] text-ink-500">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="text-[0.9375rem] text-ink-500">아직 등록된 직원이 없습니다.</p>
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>권한</Th>
                <Th>이번 달 회기</Th>
                <Th>미확정 일지</Th>
                <Th>마지막 회기</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.membershipId}>
                  <Td>{ROLE_LABELS[r.role] ?? r.role}</Td>
                  <Td>{r.sessionsThisMonth}회</Td>
                  <Td>{r.logsPending}건</Td>
                  <Td>
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

          <div className="mt-3">
            <LimitNote>
              개수만 셉니다. 점수·등수·평가는 만들지 않습니다 — 복지사를 줄 세우는
              도구가 되면 어르신께 쓸 시간이 기록 채우는 데 쓰이게 됩니다.
              이름 대신 권한으로 표시하는 것도 같은 이유입니다.
            </LimitNote>
          </div>
        </>
      )}
    </Panel>
  );
}
