'use client';

import { useEffect, useState } from 'react';
import { CBtn, LimitNote, Panel } from './CenterShell';
import { useAccount } from '@/lib/auth';
import { downloadCsv, printLog, todayStamp, type LogRow } from '@/lib/export';
import { ROLE_LABELS } from '@/lib/center';
import { centerStats, costEstimate, staffLoads } from '@/lib/repo';

/**
 * 운영 리포트 내보내기.
 *
 * 지금까지 이 버튼들은 눌러도 아무 일이 없었다. 기관은 이 숫자를 보고서에
 * 옮겨 적어야 하는데, 화면에만 있으면 손으로 다시 친다.
 *
 * 어르신 이름도 이야기도 나가지 않는다. 나가는 것은 집계 숫자뿐이다 —
 * 리포트는 보통 기관 밖으로 나가고, 한 번 나간 것은 되돌릴 수 없다.
 */
export function CenterReport() {
  const { account } = useAccount();
  const [rows, setRows] = useState<LogRow[] | null>(null);
  const live = account.status === 'in';

  useEffect(() => {
    if (!live) return;
    let alive = true;
    void Promise.all([centerStats(), staffLoads(), costEstimate()]).then(
      ([stats, staff, cost]) => {
        if (!alive || !stats) return;
        /*
         * 못 읽은 값을 0 으로 적지 않는다.
         *
         * 이 표는 기관 밖으로 나간다. 통신이 끊겨 못 읽었을 뿐인데 "이번 달
         * 만든 노래 0곡 · AI 어림 요금 0원"이 적힌 보고서가 나가면, 그 종이를
         * 받은 쪽은 그것을 사실로 읽고 우리는 되돌릴 수 없다. 모르면 모른다고
         * 적는다.
         */
        const n = (v: number | null, unit: string) =>
          v === null ? '못 읽음' : `${v}${unit}`;
        setRows([
          { label: '기관', value: account.status === 'in' ? account.tenantName : '' },
          { label: '기준일', value: todayStamp() },
          { label: '이용 중 어르신', value: n(stats.elders, '명') },
          { label: '이번 달 회기', value: n(stats.sessionsThisMonth, '회') },
          { label: '진행 중 회기', value: n(stats.sessionsRunning, '회') },
          { label: '완료 회기', value: n(stats.sessionsDone, '회') },
          {
            // 이미 만료된 건도 이 수에 들어간다. 제목이 그렇게 말해야 한다.
            label: '동의 만료 임박(30일 이내·이미 만료 포함)',
            value: n(stats.consentExpiring, '건'),
          },
          {
            label: '직원',
            value:
              staff
                .map((s) => `${ROLE_LABELS[s.role] ?? s.role} ${s.sessionsThisMonth}회`)
                .join(' · ') || '—',
          },
          {
            label: '미확정 활동일지',
            value: `${staff.reduce((a, s) => a + s.logsPending, 0)}건`,
          },
          { label: '이번 달 만든 노래', value: cost ? `${cost.songs}곡` : '못 읽음' },
          {
            label: 'AI 어림 요금',
            value: cost
              ? `${cost.krw.toLocaleString('ko-KR')}원 (청구서 아님)`
              : '못 읽음',
          },
        ]);
      },
    );
    return () => {
      alive = false;
    };
  }, [live, account]);

  if (!live) {
    return (
      <Panel title="리포트 내보내기" code="F-CM-ANL-011" desc="로그인 필요">
        <LimitNote>
          기관 리포트를 만들려면 로그인해야 합니다.
        </LimitNote>
      </Panel>
    );
  }

  const name = account.status === 'in' ? account.tenantName : '기관';

  return (
    <Panel
      title="리포트 내보내기"
      code="F-CM-ANL-011"
      desc="집계 숫자만 나갑니다 — 어르신 이름과 이야기는 포함되지 않습니다"
    >
      {!rows ? (
        <p className="text-[0.9375rem] text-ink-500">불러오는 중…</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <CBtn tone="solid" onClick={printLog}>
              인쇄 · PDF로 저장
            </CBtn>
            <CBtn onClick={() => downloadCsv(`운영리포트_${name}_${todayStamp()}.csv`, rows)}>
              엑셀 (CSV)
            </CBtn>
          </div>

          {/* 인쇄할 때만 나가는 표. 화면에서는 숨어 있다. */}
          <div data-print className="hidden">
            <h1 style={{ fontSize: '20pt', fontWeight: 800, marginBottom: '4mm' }}>
              운영 리포트
            </h1>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11pt' }}>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label}>
                    <th
                      style={{
                        border: '1px solid #999',
                        padding: '3mm',
                        textAlign: 'left',
                        width: '48mm',
                        background: '#f2f2f2',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.label}
                    </th>
                    <td style={{ border: '1px solid #999', padding: '3mm' }}>
                      {r.value || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ marginTop: '6mm', fontSize: '9pt', color: '#555' }}>
              작성일 {todayStamp()} · 똑똑 생애여정 음악지도 · AI 요금은 어림값입니다
            </p>
          </div>

          <div className="mt-3">
            <LimitNote>
              리포트는 대개 기관 밖으로 나갑니다. 그래서 집계 숫자만 담고 어르신
              이름·이야기·녹음은 넣지 않습니다. 한 번 나간 것은 되돌릴 수 없습니다.
            </LimitNote>
          </div>
        </>
      )}
    </Panel>
  );
}
