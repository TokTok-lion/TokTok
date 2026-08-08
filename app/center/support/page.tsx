'use client';

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
import { NOTICES, PROVIDER_STATUS, TICKETS, TRAINING } from '@/lib/center-seed';

/** 운영 지원 (CM-SUP · 6 functions) */
export default function SupportPage() {
  const [sampleMode, setSampleMode] = useState(false);
  const degraded = PROVIDER_STATUS.filter((p) => p.state !== 'ok');

  return (
    <CenterShell
      code="CM-SUP"
      title="운영 지원"
      lead="공지, 문의, 외부 서비스 상태와 교육 이수를 관리합니다."
    >
      {/* F-CM-SUP-003 장애 현황 */}
      <Panel title="외부 서비스 상태" code="F-CM-SUP-003">
        <ul className="grid gap-2 sm:grid-cols-2">
          {PROVIDER_STATUS.map((p) => (
            <li
              key={p.name}
              className="flex items-center gap-3 rounded-[10px] border border-hairline bg-surface px-3.5 py-2.5"
            >
              <Pill tone={p.state === 'ok' ? 'leaf' : 'amber'}>
                {p.state === 'ok' ? '정상' : '지연'}
              </Pill>
              <span className="min-w-0 flex-1 text-[0.9375rem] font-bold text-ink-900">
                {p.name}
              </span>
              <span className="text-[0.8125rem] text-ink-500">{p.note}</span>
            </li>
          ))}
        </ul>
        {degraded.length > 0 ? (
          <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-700">
            복구 예정 시각은 제공자가 알려주지 않았습니다. 확인되지 않은 예상
            시각을 지어내 표시하지 않습니다.
          </p>
        ) : null}
      </Panel>

      {/* F-CM-SUP-005 샘플 데이터 모드 */}
      <Panel className="mt-4" title="교육용 샘플 모드" code="F-CM-SUP-005">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={sampleMode}
            aria-label="교육용 샘플 모드"
            onClick={() => setSampleMode((v) => !v)}
            className={`relative h-[32px] w-[58px] shrink-0 rounded-full transition-colors ${
              sampleMode ? 'bg-leaf-600' : 'bg-ink-300'
            }`}
          >
            <span
              className={`absolute top-1 h-[24px] w-[24px] rounded-full bg-white transition-[left] ${
                sampleMode ? 'left-[29px]' : 'left-1'
              }`}
            />
          </button>
          <p className="text-[0.9375rem] font-bold text-ink-900">
            {sampleMode ? '샘플 모드 켜짐' : '샘플 모드 꺼짐'}
          </p>
          {sampleMode ? <Pill tone="amber">화면 상단에 샘플 표시가 붙습니다</Pill> : null}
        </div>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-700">
          가상의 어르신과 곡으로 신규 복지사가 전 과정을 연습할 수 있습니다.
        </p>
        <div className="mt-3">
          <LimitNote>
            샘플 환경은 실제 어르신 자료와 완전히 분리됩니다. 연습 중 만든 곡이나
            일지가 실제 기록에 섞이지 않습니다.
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
