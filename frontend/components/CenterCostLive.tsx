'use client';

import { useEffect, useState } from 'react';
import { Kpi, LimitNote, Panel } from './CenterShell';
import { useAccount } from '@/lib/auth';
import { costEstimate, type CostEstimate } from '@/lib/repo';

/**
 * 이번 달 AI 사용량과 어림 요금.
 *
 * 곡 수로 계산한다. 전사·읽어주기·가사는 곡에 비하면 없는 수준이라 따로
 * 세지 않는다.
 *
 * "어림값"이라고 적는 것이 이 화면의 핵심이다. 청구서처럼 보이면 센터가 이
 * 숫자로 예산을 잡고, 실제 청구서와 다르면 신뢰를 잃는다. 가늠자라고 말해
 * 두면 가늠자로 쓴다.
 */
export function CenterCostLive() {
  const { account } = useAccount();
  const [cost, setCost] = useState<CostEstimate | null>(null);
  const live = account.status === 'in';

  useEffect(() => {
    if (!live) return;
    let alive = true;
    void costEstimate().then((c) => {
      if (alive) setCost(c);
    });
    return () => {
      alive = false;
    };
  }, [live]);

  if (!live) {
    return (
      <Panel title="이번 달 AI 사용량" code="F-CM-ANL-008" desc="로그인 필요">
        <LimitNote>
          기관 사용량을 보려면 로그인해야 합니다. 아래 비용 표는 시연용입니다.
        </LimitNote>
      </Panel>
    );
  }

  const used = cost && cost.quota !== null ? cost.quota - (cost.quotaLeft ?? 0) : null;

  return (
    <Panel
      title="이번 달 AI 사용량"
      code="F-CM-ANL-008"
      desc={`${account.tenantName} · 실제 사용량`}
    >
      {!cost ? (
        <p className="text-[0.9375rem] text-ink-500">불러오는 중…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="만든 노래" value={cost.songs} unit="곡" />
            {/* unit 은 값에 바로 붙어 나오므로 "3/ 3" 처럼 보였다.
                분수는 값 자체로 넘긴다. */}
            <Kpi
              label="남은 곡"
              value={
                cost.quota !== null
                  ? `${cost.quotaLeft ?? 0} / ${cost.quota}`
                  : (cost.quotaLeft ?? '—')
              }
              tone={cost.quotaLeft === 0 ? 'danger' : 'leaf'}
              note="이번 달 한도"
            />
            <Kpi
              label="곡당 어림값"
              value={
                cost.songs
                  ? Math.round(cost.krw / cost.songs).toLocaleString('ko-KR')
                  : '—'
              }
              unit="원"
              tone="brand"
              note="만든 만큼만 나갑니다"
            />
            <Kpi
              label="어림 요금"
              value={cost.krw.toLocaleString('ko-KR')}
              unit="원"
              tone="brand"
              note="청구서가 아닙니다"
            />
          </div>

          {used !== null && used > 0 ? (
            <p className="mt-3 text-[0.9375rem] text-ink-700">
              이번 달 {used}곡을 만들었고, 곡당 약{' '}
              {Math.round(cost.krw / Math.max(cost.songs, 1)).toLocaleString('ko-KR')}원이
              들었습니다.
            </p>
          ) : null}

          <div className="mt-3">
            <LimitNote>
              어림값입니다. 곡당 단가로 계산한 것이라 환율·세금에 따라 실제
              청구서와 다를 수 있습니다. 전사·읽어주기·가사는 곡에 비해 매우
              작아 따로 세지 않았습니다.
            </LimitNote>
          </div>
        </>
      )}
    </Panel>
  );
}
