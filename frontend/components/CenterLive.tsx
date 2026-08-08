'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Kpi, LimitNote, Panel } from './CenterShell';
import { useAccount } from '@/lib/auth';
import { centerStats, type CenterStats } from '@/lib/repo';
import { ROLE_LABELS } from '@/lib/center';

/**
 * 콘솔에서 실제 데이터로 채워지는 부분.
 *
 * 아래쪽의 파이프라인·비용·직원 지표는 아직 시연용 씨앗이다. 그 값들을
 * 만들려면 STT·가사·음악 연동과 요금 집계가 먼저 있어야 한다. 없는 것을
 * 있는 것처럼 그리는 대신, 서버가 실제로 아는 것만 여기 모아 보여주고
 * 나머지는 시연 데이터라고 화면에 적는다.
 *
 * 여기에서도 이야기 본문·전사·가사는 읽지 않는다. 권한 표상 센터장은
 * 원음성 "기본 미열람", 전사·스토리는 "진행상태"만 볼 수 있다.
 */
export function CenterLive() {
  const { account } = useAccount();
  const [stats, setStats] = useState<CenterStats | null>(null);

  const live = account.status === 'in';
  // 별도의 loading 상태를 두지 않는다 — 아직 안 왔다는 것은 stats 가 null 인
  // 것과 같은 말이고, 상태가 둘이면 어긋날 수 있다.
  const loading = stats === null;

  useEffect(() => {
    if (!live) return;
    let alive = true;
    void centerStats().then((s) => {
      if (alive) setStats(s);
    });
    return () => {
      alive = false;
    };
  }, [live]);

  if (account.status === 'local') {
    return (
      <Panel title="기관 데이터" code="CM-DASH" desc="서버 연결 없음">
        <LimitNote>
          이 배포에는 서버가 연결되어 있지 않습니다. 아래 지표는 모두 시연용
          데이터이며, 실제 기관 기록이 아닙니다.
        </LimitNote>
      </Panel>
    );
  }

  if (!live) {
    return (
      <Panel title="기관 데이터" code="CM-DASH" desc="로그인 필요">
        <LimitNote>
          기관 기록을 보려면 로그인해야 합니다. 로그인 전에는 어떤 표도 조회되지
          않습니다 — 권한이 없어서가 아니라, 모든 표에 RLS가 걸려 있어 소속이
          확인되기 전에는 0건이기 때문입니다.
        </LimitNote>
        <div className="mt-3">
          <Link
            href="/login"
            className="inline-flex min-h-[40px] items-center rounded-[10px] bg-brand-700 px-4 text-[0.9375rem] font-bold text-white"
          >
            로그인
          </Link>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="기관 데이터"
      code="CM-DASH"
      desc={`${account.tenantName} · 서버에서 바로 읽은 값`}
    >
      {loading || !stats ? (
        <p className="text-[0.9375rem] text-ink-500">불러오는 중…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="이용 중 어르신" value={stats.elders} unit="명" />
            <Kpi
              label="이번 달 회기"
              value={stats.sessionsThisMonth}
              unit="회"
              tone="brand"
              note={`진행 중 ${stats.sessionsRunning} · 완료 ${stats.sessionsDone}`}
            />
            <Kpi
              label="동의 만료 임박"
              value={stats.consentExpiring}
              unit="건"
              tone="amber"
              note="30일 이내"
            />
            <Kpi
              label="활동 직원"
              value={stats.staff.reduce((a, b) => a + b.count, 0)}
              unit="명"
              tone="leaf"
              note={stats.staff.map((r) => `${ROLE_LABELS[r.role] ?? r.role} ${r.count}`).join(' · ') || '—'}
            />
          </div>

          {stats.recent.length ? (
            <ul className="mt-4 space-y-2">
              {stats.recent.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-[12px] bg-surface px-3.5 py-2.5 text-[0.9375rem]"
                >
                  <span className="flex-1 font-bold text-ink-900">{r.topic}</span>
                  <span className="text-ink-500">{STATUS_LABEL[r.status] ?? r.status}</span>
                  <span className="tabular-nums text-ink-500">
                    {new Date(r.at).toLocaleDateString('ko-KR', {
                      month: 'numeric',
                      day: 'numeric',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-[0.9375rem] text-ink-500">
              아직 저장된 회기가 없습니다.
            </p>
          )}

          <div className="mt-4">
            <LimitNote>
              회기 주제와 진행 상태만 표시합니다. 어르신의 이야기 본문·전사·가사는
              센터장 권한으로 조회하지 않습니다.
            </LimitNote>
          </div>
        </>
      )}
    </Panel>
  );
}

const STATUS_LABEL: Record<string, string> = {
  planned: '예정',
  running: '진행 중',
  done: '완료',
  stopped: '중단',
  cancelled: '취소',
};
