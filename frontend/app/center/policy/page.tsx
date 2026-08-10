'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
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
  RETENTION_BOUNDS,
  RETENTION_LABELS,
  canRequireConsent,
  type RetentionKey,
} from '@/lib/center';
import { CONSENT_POLICIES, RETENTION_DEFAULTS } from '@/lib/center-seed';
import { centerStats, type CenterStats } from '@/lib/repo';

/**
 * 기관 개인정보 운영 (CM-POL · 9 functions)
 *
 * 예전에는 이 화면이 조작판이었다. 동의 필수 지정 스위치, 보관기간 슬라이더,
 * 영상 촬영 스위치, 허용 제공자 체크박스, 처리 기한 입력칸과 담당자 선택.
 * 그런데 이 값을 담는 표가 서버에 하나도 없다 — lib/db.types.ts 에 기관 정책을
 * 저장하는 테이블은 없고, tenants 에 있는 것은 song_quota 와
 * song_retention_days 둘뿐이다. 즉 전부 화면 안에서만 움직이는 스위치였다.
 *
 * 그게 왜 나쁘냐면, 여기서 '녹음·전사 필수'를 켜 둔 센터장은 우리 기관이 그
 * 동의를 반드시 받고 있다고 믿게 되기 때문이다. 실제로 동의를 받는 곳은
 * 복지사 앱이고, 거기서는 이 화면을 읽지 않는다. 스위치가 만든 믿음과 현장의
 * 동작이 어긋나면, 어긋난 쪽 부담은 어르신이 진다.
 *
 * 그래서 조작판을 걷어내고 기준표로 바꿨다. 서비스가 정한 기준은 그대로 적고,
 * 기관이 바꿀 수 없다는 사실을 적고, 실제 동의는 어디에 남는지 적는다.
 * 저장할 곳이 생기면 그때 스위치를 되살린다.
 */
export default function PolicyPage() {
  const { account } = useAccount();
  const live = account.status === 'in';
  const checking = account.status === 'loading';

  const [stats, setStats] = useState<CenterStats | null>(null);

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

  return (
    <CenterShell
      code="CM-POL"
      title="기관 개인정보 운영"
      lead="서비스가 정한 동의·보관 기준입니다. 이 화면에서는 기준을 바꿀 수 없습니다."
      data={{
        kind: 'defaults',
        what: '아래 동의 정책과 보관기간은 지어낸 측정값이 아니라 서비스가 정한 기준값입니다. 기관별로 조정하는 기능은 아직 없고, 이 기관에 실제로 적용된 값을 읽어오지도 못합니다. 「이 기관의 동의」 칸만 서버에서 읽은 값입니다.',
      }}
    >
      {/* 이 화면에서 유일하게 서버가 아는 것. 기준표와 섞이지 않게 맨 위에 둔다 —
          아래는 전부 '정해 둔 기준'이고 여기만 '지금 우리 기관'이다. */}
      <Panel
        title="이 기관의 동의"
        code="F-CM-POL-001"
        desc={live ? `${account.tenantName} · 서버에서 바로 읽은 값` : undefined}
      >
        {checking ? (
          <Checking />
        ) : account.status === 'local' ? (
          <LimitNote>
            이 배포에는 서버가 연결되어 있지 않습니다. 동의 건수를 셀 곳이 없어
            아무 숫자도 표시하지 않습니다.
          </LimitNote>
        ) : !live ? (
          <>
            <LimitNote>
              동의 기록을 보려면 로그인해야 합니다. 로그인 전에는 어떤 표도
              조회되지 않습니다 — 권한이 없어서가 아니라, 모든 표에 RLS가 걸려
              있어 소속이 확인되기 전에는 0건이기 때문입니다.
            </LimitNote>
            <div className="mt-3">
              <Link
                href="/login"
                className="inline-flex min-h-[40px] items-center rounded-[10px] bg-brand-700 px-4 text-[0.9375rem] font-bold text-white"
              >
                로그인
              </Link>
            </div>
          </>
        ) : stats === null ? (
          <p className="text-[0.9375rem] text-ink-500">불러오는 중…</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Kpi
                label="만료가 다가온 동의"
                value={stats.consentExpiring}
                unit="건"
                tone="amber"
                /* 질의는 expires_at <= 30일 뒤라서 이미 지난 것도 함께 세어진다
                   (lib/repo.ts · centerStats). '30일 이내'라고만 적으면 이미
                   만료된 동의가 아직 살아 있는 것처럼 읽힌다. */
                note="30일 안에 만료되거나 이미 만료된 허용 건수입니다"
              />
              <Kpi
                label="이용 중 어르신"
                value={stats.elders}
                unit="명"
                note="동의는 어르신 한 분 한 분에게 따로 붙습니다"
              />
            </div>
            <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-700">
              동의 종류별로 몇 분이 허용하고 몇 분이 거부하셨는지는 이 콘솔이
              아직 세지 않습니다. 한 분의 동의 상태는 복지사 앱의{' '}
              <Link href="/more" className="font-bold underline">
                더보기
              </Link>
              에서 어르신을 고르면 그대로 보입니다. 거기서 바꾼 내용은 통신이
              닿으면 그 어르신의 기관 기록에도 남고, 닿지 않으면 그 화면이 남기지
              못한 항목을 적어 둡니다.
            </p>
          </>
        )}
      </Panel>

      {/* F-CM-POL-002 필수·선택 설정 */}
      <Panel
        className="mt-4"
        title="동의 정책 기준"
        code="F-CM-POL-002"
        desc="목적마다 따로 받습니다. 묶음 동의는 만들 수 없습니다."
      >
        <TableWrap>
          <thead>
            <tr>
              <Th>코드</Th>
              <Th>동의</Th>
              <Th>기관 필수 지정</Th>
              <Th>거부하셨을 때</Th>
            </tr>
          </thead>
          <tbody>
            {CONSENT_POLICIES.map((c) => (
              <tr key={c.code}>
                <Td className="font-mono text-[0.8125rem] text-ink-500">{c.code}</Td>
                <Td className="font-bold">{c.name}</Td>
                <Td>
                  {/* 예전에는 여기가 스위치였다. 켜도 아무 데도 저장되지 않으면서
                      '우리 기관은 이 동의를 필수로 받는다'는 믿음만 만들었다.
                      지금은 서비스 규칙(canRequireConsent)만 적는다. */}
                  {canRequireConsent(c.code) ? (
                    <Pill>지정 가능</Pill>
                  ) : (
                    <Pill tone="danger">필수 지정 불가</Pill>
                  )}
                </Td>
                <Td className="text-[0.875rem] text-ink-500">{c.note}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>

        <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-700">
          기관이 어떤 동의를 필수로 지정할지 이 화면에서 정할 수 없습니다. 정한
          값을 담을 표가 서버에 아직 없고, 복지사 앱도 그 값을 읽지 않습니다.
          지금은 위 표가 곧 규칙입니다 — 어떤 동의를 반드시 받을지 기관에서
          정하셨다면 회기 준비 화면에서 복지사가 직접 여쭙는 방식으로 운영하시고,
          기관 기준을 앱에 반영하고 싶으시면 도입 담당자에게 알려 주세요.
        </p>

        <div className="mt-3">
          <LimitNote>
            홍보 공개(C-05)는 어떤 경우에도 필수로 만들 수 없습니다. 서비스를
            쓰는 조건으로 홍보 동의를 요구하는 것은 금지되어 있습니다.
          </LimitNote>
        </div>
      </Panel>

      {/* F-CM-POL-003 보관기간 설정 */}
      <Panel
        className="mt-4"
        title="보관기간 기준"
        code="F-CM-POL-003"
        desc="유형별 상한과 하한입니다. 무기한은 없습니다."
      >
        <TableWrap>
          <thead>
            <tr>
              <Th>유형</Th>
              <Th className="text-right">서비스 기본값</Th>
              <Th className="text-right">허용 범위</Th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(RETENTION_LABELS) as RetentionKey[]).map((k) => (
              <tr key={k}>
                <Td className="font-bold">{RETENTION_LABELS[k]}</Td>
                <Td className="text-right font-bold tabular-nums text-brand-700">
                  {RETENTION_DEFAULTS[k]}일
                </Td>
                <Td className="text-right tabular-nums text-ink-500">
                  {RETENTION_BOUNDS[k].min}일 – {RETENTION_BOUNDS[k].max}일
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>

        <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-700">
          {/* 슬라이더가 있던 자리. 움직여도 저장되지 않았고, 그래서 '우리 기관은
              원음성을 90일만 두기로 했다'가 화면에만 존재했다. */}
          기관별 보관기간을 이 화면에서 조정할 수 없습니다. 이 기관에 실제로
          적용된 값도 읽어오지 못합니다 — 서버 기관 기록에 곡 보관기간 칸이
          있지만 콘솔이 그 값을 읽는 통로가 아직 없습니다. 지금 적용된 값을
          확인하거나 바꾸시려면 도입 담당자에게 요청하세요.
        </p>
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {/* F-CM-POL-005 영상촬영 정책 */}
        <Panel title="세션 영상 촬영" code="F-CM-POL-005">
          <div className="flex flex-wrap items-center gap-3">
            <Pill>사용하지 않음 (기본값)</Pill>
          </div>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-700">
            영상은 기본으로 꺼져 있고, 이 화면에서 켤 수 없습니다. 켜고 끈 설정을
            담을 곳이 서버에 없어서, 예전의 스위치는 화면 안에서만 움직였습니다.
          </p>
          <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-500">
            영상 촬영이 필요한 사업이 있으시면 도입 담당자와 먼저 상의하세요.
            촬영 동의(C-06)·보관기간·저장 용량 조건을 함께 정해야 켤 수 있습니다.
          </p>
        </Panel>

        {/* F-CM-POL-006 외부 AI 제공자 허용 */}
        <Panel title="외부 AI 제공자" code="F-CM-POL-006">
          <p className="text-[0.9375rem] leading-relaxed text-ink-700">
            {/* 예전에는 여기에 '전사(STT) 제공자 A · 대한민국(서울)' 처럼 소재
                국가가 붙은 체크박스 목록이 있었다. 제공자 소재지를 확인하는
                코드는 어디에도 없다 — 국외이전 고지의 근거가 되는 값을 지어내
                적은 셈이었다. 목록은 의존 관계만 적어 둔 운영 지원 화면 한
                곳으로 모으고, 여기서는 통제 지점이 어디인지만 말한다. */}
            기관이 제공자를 켜고 끄는 기능은 아직 없습니다. 이 서비스가 어떤 외부
            제공자에 기대고 있는지는{' '}
            <Link href="/center/support" className="font-bold underline">
              운영 지원
            </Link>
            에 적어 두었습니다. 제공자가 어느 나라에 있는지는 이 콘솔이 확인하지
            않으므로, 계약서와 개인정보 처리방침에서 확인하세요.
          </p>
          <div className="mt-3">
            <LimitNote>
              지금 실제로 작동하는 통제 지점은 어르신 본인의 외부 AI 전송
              동의(C-02)입니다. 거부하시면 그 어르신의 자료는 외부로 나가지 않고
              복지사가 손으로 작성합니다. 이 동의는 어르신별로 기관 기록에
              남습니다.
            </LimitNote>
          </div>
        </Panel>
      </div>

      {/* F-CM-POL-007 · 008 */}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="정책 변경 영향" code="F-CM-POL-007">
          <p className="text-[0.9375rem] leading-relaxed text-ink-700">
            {/* '영향 대상 계산' 버튼이 있던 자리. 누르면 아무 일도 일어나지
                않았는데, 계산해 봤다는 기억만 남는 것이 더 위험하다. */}
            정책을 바꿨을 때 재동의가 필요한 대상을 미리 계산해 주는 기능은 아직
            없습니다.
          </p>
          <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-500">
            지금 만료가 다가온 동의 건수는 이 화면 맨 위 「이 기관의 동의」에서
            보시고, 어느 어르신의 어떤 동의인지는 복지사와 함께 확인하셔야
            합니다. 재동의가 필요한지에 대한 판단은 사람이 합니다.
          </p>
        </Panel>

        <Panel title="철회·삭제 처리 기한" code="F-CM-POL-008">
          <p className="text-[0.9375rem] leading-relaxed text-ink-700">
            {/* 처리 기한 입력칸과 담당자 선택이 있던 자리. 담당자 목록에는 예시
                기관의 직원 이름 둘이 박혀 있어서, 실제 기관 센터장에게는 남의
                직원이 자기 기관 담당자로 보였다. */}
            처리 기한과 담당자를 이 화면에서 정할 수 없습니다. 저장할 곳이 없고,
            직원 이름을 이 콘솔이 알지도 못합니다.
          </p>
          <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-500">
            기한과 담당자는 기관 내부 규정으로 정해 두시고, 실제로 들어온 삭제
            요청은{' '}
            <Link href="/center/data" className="font-bold underline">
              데이터 거버넌스
            </Link>
            에서 확인하세요. 법정 기한은 별도로 확인해야 합니다 — 이 콘솔은
            법정 기한을 계산하지 않습니다.
          </p>
        </Panel>
      </div>
    </CenterShell>
  );
}
