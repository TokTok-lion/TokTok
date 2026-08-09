'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  CBtn,
  CenterShell,
  LimitNote,
  Panel,
  Pill,
  TableWrap,
  Td,
  Th,
} from '@/components/CenterShell';
import { NOTICES, PROVIDERS_USED, TICKETS, TRAINING } from '@/lib/center-seed';

/** 운영 지원 (CM-SUP · 6 functions) */
export default function SupportPage() {
  const [practiceMode, setPracticeMode] = useState(false);

  return (
    <CenterShell
      code="CM-SUP"
      title="운영 지원"
      lead="공지, 문의, 외부 서비스와 교육 이수를 관리합니다."
      data={{
        kind: 'seed',
        what: '아래 공지·지원 문의·교육 이수는 예시입니다. 파일럿 실측 전까지 표시되는 값이며, 실제 기관 기록이 아닙니다.',
      }}
    >
      {/* F-CM-SUP-003 장애 현황
          예전에는 여기에 제공자별 '정상 / 지연' Pill 과 '생성 지연 (평균 4분 →
          11분)' 이 떠 있었다. 제공자 상태를 확인하는 코드는 어디에도 없으니
          지어낸 장애였고, 센터장이 오늘의 장애로 읽고 어르신 일정을 미룰 수
          있는 종류의 거짓이었다. 확인하지 않은 것을 '정상'이라 적는 것도 같은
          거짓이라 상태 표시를 통째로 뺐다. 대신 어디에 물어보면 되는지를 적는다. */}
      <Panel
        title="외부 서비스"
        code="F-CM-SUP-003"
        desc="상태를 자동으로 확인하는 기능은 아직 없습니다"
      >
        <p className="text-[0.9375rem] leading-relaxed text-ink-700">
          이 서비스는 아래 외부 제공자에 기대고 있습니다. 지금 무엇이 정상이고
          무엇이 느린지는 이 화면이 알지 못합니다 — 확인하지 않은 상태를
          &lsquo;정상&rsquo;이라고 적지 않습니다.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {PROVIDERS_USED.map((p) => (
            <li
              key={p.name}
              className="flex items-center gap-3 rounded-[10px] border border-hairline bg-surface px-3.5 py-2.5"
            >
              <span className="min-w-0 flex-1 text-[0.9375rem] font-bold text-ink-900">
                {p.name}
              </span>
              <span className="text-[0.8125rem] text-ink-500">{p.purpose}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-700">
          곡 생성이 늦거나 실패한 건수는{' '}
          <Link href="/center" className="font-bold underline">
            운영 콘솔
          </Link>
          의 「생성 오류」에서 봅니다. 제공자 쪽 문제로 보이면 도입 담당자에게
          연락하세요. 복구 예정 시각은 제공자가 알려주지 않으며, 확인되지 않은
          예상 시각을 지어내 표시하지 않습니다.
        </p>
      </Panel>

      {/* F-CM-SUP-005 샘플 데이터 모드
          명세의 이름은 '샘플 데이터 모드'지만 화면에서는 '연습 모드'라고
          부른다. 이 콘솔에서 '샘플'은 이미 '실측이 아닌 예시 값'을 뜻하고,
          그 말이 맨 위 띠에 붙어 있다. 한 화면에서 같은 낱말이 두 가지를
          뜻하면 띠의 경고가 설정 이름으로 읽힌다. */}
      <Panel className="mt-4" title="교육용 연습 모드" code="F-CM-SUP-005">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={practiceMode}
            aria-label="교육용 연습 모드"
            onClick={() => setPracticeMode((v) => !v)}
            className={`relative h-[32px] w-[58px] shrink-0 rounded-full transition-colors ${
              practiceMode ? 'bg-leaf-600' : 'bg-ink-300'
            }`}
          >
            <span
              className={`absolute top-1 h-[24px] w-[24px] rounded-full bg-white transition-[left] ${
                practiceMode ? 'left-[29px]' : 'left-1'
              }`}
            />
          </button>
          <p className="text-[0.9375rem] font-bold text-ink-900">
            {practiceMode ? '연습 모드 켜짐' : '연습 모드 꺼짐'}
          </p>
        </div>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-700">
          가상의 어르신과 곡으로 신규 복지사가 전 과정을 연습하게 하려는
          기능입니다.
        </p>
        {/* 스위치가 켜지기만 하고 아무 데도 연결되지 않는다는 사실을 스위치
            옆에 적는다. 켠 채로 복지사에게 넘기면 실제 어르신 자료로 연습하게
            된다. */}
        <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-500">
          아직 만들지 않았습니다. 이 스위치는 화면 안에서만 움직이고, 복지사
          앱에는 연습용 환경이 따로 생기지 않습니다. 지금 신규 복지사를
          연습시키려면 실제 어르신 없이 담당자와 화면을 함께 보며 익히셔야
          합니다.
        </p>
        <div className="mt-3">
          <LimitNote>
            연습 환경이 생기면 실제 어르신 자료와 완전히 분리됩니다. 연습 중
            만든 곡이나 일지가 실제 기록에 섞이지 않게 하는 것이 이 기능의
            전제입니다.
          </LimitNote>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {/* F-CM-SUP-001 기관 공지 */}
        <Panel
          title="기관 공지"
          code="F-CM-SUP-001"
          actions={<CBtn tone="solid">공지 작성</CBtn>}
        >
          <ul className="space-y-2">
            {NOTICES.map((n) => (
              <li
                key={n.id}
                className="rounded-[10px] border border-hairline bg-surface px-3.5 py-2.5"
              >
                <p className="text-[0.9375rem] font-bold text-ink-900">{n.title}</p>
                <p className="mt-0.5 text-[0.8125rem] text-ink-500">
                  {n.at} · {n.by}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.8125rem] text-ink-500">
            공지에 어르신의 이름이나 이야기를 적지 마세요.
          </p>
        </Panel>

        {/* F-CM-SUP-002 지원 티켓 */}
        <Panel title="지원 문의" code="F-CM-SUP-002">
          <TableWrap min={400}>
            <thead>
              <tr>
                <Th>내용</Th>
                <Th>제출</Th>
                <Th>상태</Th>
              </tr>
            </thead>
            <tbody>
              {TICKETS.map((t) => (
                <tr key={t.id}>
                  <Td className="font-semibold">{t.title}</Td>
                  <Td className="text-ink-500">
                    {t.by} · {t.days}일 전
                  </Td>
                  <Td>
                    <Pill tone={t.state === '답변 완료' ? 'leaf' : 'brand'}>{t.state}</Pill>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Panel>
      </div>

      {/* F-CM-SUP-004 교육 이수 */}
      <Panel className="mt-4" title="교육 이수" code="F-CM-SUP-004">
        <TableWrap>
          <thead>
            <tr>
              <Th>직원</Th>
              <Th>온보딩</Th>
              <Th>개인정보</Th>
              <Th>안전·응대</Th>
            </tr>
          </thead>
          <tbody>
            {TRAINING.map((t) => (
              <tr key={t.name}>
                <Td className="font-bold">{t.name}</Td>
                {[t.onboarding, t.privacy, t.safety].map((v, i) => (
                  <Td key={i}>
                    <Pill tone={v ? 'leaf' : 'amber'}>{v ? '이수' : '미이수'}</Pill>
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </TableWrap>
        <div className="mt-3">
          <LimitNote>
            내부 교육 기록일 뿐, 사회복지사 자격이나 법정 의무교육을 대체하지
            않습니다.
          </LimitNote>
        </div>
      </Panel>
    </CenterShell>
  );
}
