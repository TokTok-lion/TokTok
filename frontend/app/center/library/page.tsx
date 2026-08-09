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
import { RECIPES } from '@/lib/center-seed';

/** 프로그램 템플릿 공유 (CM-LIB · 6 functions) */
export default function LibraryPage() {
  const [filter, setFilter] = useState<'전체' | '공식' | '기관'>('전체');
  const [shared, setShared] = useState<string[]>([]);

  const rows = RECIPES.filter((r) => filter === '전체' || r.origin === filter);

  return (
    <CenterShell
      code="CM-LIB"
      title="프로그램 템플릿"
      lead="질문 카드와 진행안을 관리합니다. 어르신의 생애사는 템플릿에 담기지 않습니다."
      actions={<CBtn tone="solid">기관 템플릿 만들기</CBtn>}
      data={{
        kind: 'seed',
        what: '아래 템플릿 목록과 사용 횟수는 예시입니다. 만들기·복제·공유 신청은 아직 서버에 연결되어 있지 않아, 눌러도 이 화면 밖에는 아무것도 남지 않습니다.',
      }}
    >
      <div className="flex gap-2">
        {(['전체', '공식', '기관'] as const).map((f) => (
          <CBtn key={f} tone={filter === f ? 'solid' : 'ghost'} onClick={() => setFilter(f)}>
            {f}
          </CBtn>
        ))}
      </div>

      <Panel className="mt-4" title="템플릿 목록" code="F-CM-LIB-001 · 002 · 003">
        <TableWrap>
          <thead>
            <tr>
              <Th>제목</Th>
              <Th>출처</Th>
              <Th className="text-right">질문 카드</Th>
              <Th className="text-right">사용</Th>
              <Th>수정일</Th>
              <Th className="text-right">작업</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td className="font-bold">{r.title}</Td>
                <Td>
                  <Pill tone={r.origin === '공식' ? 'leaf' : 'brand'}>{r.origin}</Pill>
                </Td>
                <Td className="text-right tabular-nums">{r.cards}</Td>
                <Td className="text-right tabular-nums">{r.uses}</Td>
                <Td className="text-ink-500">{r.updated}</Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-2">
                    <CBtn>복제</CBtn>
                    {r.origin === '기관' ? (
                      shared.includes(r.id) ? (
                        <CBtn onClick={() => setShared((p) => p.filter((x) => x !== r.id))}>
                          공유 철회
                        </CBtn>
                      ) : (
                        <CBtn onClick={() => setShared((p) => [...p, r.id])}>공유 신청</CBtn>
                      )
                    ) : null}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>

        {shared.length > 0 ? (
          <p className="mt-3 rounded-[10px] bg-amber-100/60 px-3.5 py-2.5 text-[0.875rem] font-semibold text-amber-700">
            공유 신청 {shared.length}건이 개인정보 검사 대기 중입니다. 개인을
            식별할 수 있는 내용이 들어 있으면 자동으로 반려됩니다.
          </p>
        ) : null}

        <div className="mt-3">
          <LimitNote>
            템플릿에는 질문과 진행 방법만 담깁니다. 어르신의 이야기·전사·가사를
            템플릿으로 복사하거나 외부에 공유할 수 없습니다.
          </LimitNote>
        </div>
      </Panel>
    </CenterShell>
  );
}
