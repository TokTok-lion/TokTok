'use client';

import Link from 'next/link';
import {
  CBtn,
  CenterShell,
  Checking,
  LimitNote,
  Panel,
  Pill,
  TableWrap,
  Td,
  Th,
} from '@/components/CenterShell';
import { useAccount } from '@/lib/auth';
import { QUESTION_LEVELS } from '@/lib/domain';
import { RECIPES } from '@/lib/center-seed';
import { SEED_MEMORY_CARDS } from '@/lib/seed';

/**
 * 프로그램 템플릿 (CM-LIB · 6 functions)
 *
 * 이 화면에는 읽어 올 서버가 없다. lib/db.types.ts 에 템플릿·질문 카드·공유
 * 신청을 담는 표가 아예 없다 — 있는 것은 기관·직원·어르신·동의·회기·이야기·
 * 가사·곡·관찰·활동일지·감사로그뿐이다. 그래서 목록도, 사용 횟수도, 수정일도
 * 서버에서 올 수가 없다.
 *
 * 예전에는 그 자리를 씨앗 네 줄이 채웠다. '고향과 명절 · 사용 34회'가 아무
 * 구분 없이 표로 그려졌고, 공유 신청을 누르면 '공유 신청 1건이 개인정보 검사
 * 대기 중입니다'라고 답했다. 개인정보를 검사하는 코드는 없다. 실제 기관
 * 센터장은 우리 기관이 만든 템플릿 두 개가 검사를 기다린다고 읽었을 것이다.
 *
 * 그래서 로그인한 기관에서는 씨앗을 그리지 않는다. 대신 지금 실제로 쓸 수 있는
 * 것 — 복지사 앱에 들어 있는 기억 카드와 단계별 질문 — 을 먼저 적는다.
 * 둘러보기에서는 화면이 어떤 모습이 될지 보여주되 예시라고 밝힌다.
 */
export default function LibraryPage() {
  const { account } = useAccount();
  const live = account.status === 'in';
  const checking = account.status === 'loading';

  return (
    <CenterShell
      code="CM-LIB"
      title="프로그램 템플릿"
      lead="질문 카드와 진행안입니다. 어르신의 생애사는 템플릿에 담기지 않습니다."
      data={{
        kind: 'seedWhileBrowsing',
        what: '아래 템플릿 목록·사용 횟수·수정일은 예시입니다. 템플릿을 담는 표가 서버에 아직 없어서, 실제 기관 계정으로 들어오면 목록 대신 지금 쓸 수 있는 질문 카드만 표시됩니다.',
      }}
    >
      {/* 서버가 아니라 앱 안에 들어 있는 값이다. 그래서 '기관 자료'라고 하지
          않는다 — 다만 지어낸 값도 아니다. 복지사가 회기에서 실제로 마주치는
          카드와 질문이 이만큼이라는 뜻이고, 세는 곳이 코드 한 군데뿐이라
          (lib/seed.ts · app/session/interview) 숫자가 화면과 어긋날 일이 없다. */}
      <Panel
        title="지금 쓸 수 있는 질문 카드"
        code="F-CM-LIB-001"
        desc="복지사 앱에 들어 있습니다 · 기관이 만든 자료가 아닙니다"
      >
        <div className="flex flex-wrap gap-2">
          {SEED_MEMORY_CARDS.map((c) => (
            <Pill key={c.id} tone="leaf">
              {c.label}
            </Pill>
          ))}
        </div>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-700">
          기억 카드 {SEED_MEMORY_CARDS.length}종이 앱에 들어 있고, 카드마다{' '}
          {QUESTION_LEVELS.map((q) => q.name).join('·')} {QUESTION_LEVELS.length}
          단계 질문이 준비되어 있습니다. 회기에서 카드와 단계를 고르면 그 질문이
          그대로 나오므로, 어르신 앞에서 무슨 말이 나올지 미리 확인하실 수
          있습니다 —{' '}
          <Link href="/session/cards" className="font-bold underline">
            기억 카드 선택
          </Link>
          에서 보세요.
        </p>
        <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-500">
          카드나 질문 문장을 기관에서 직접 추가·수정하는 기능은 아직 없습니다.
          넣고 싶은 카드와 질문이 있으시면 문장 그대로 도입 담당자에게 보내
          주세요. 앱에 넣어 다음 배포에 반영합니다.
        </p>
      </Panel>

      {/* F-CM-LIB-002 · 003 기관 템플릿 만들기·복제·공유 */}
      <Panel className="mt-4" title="기관 템플릿" code="F-CM-LIB-002 · 003">
        {checking ? (
          <Checking />
        ) : live ? (
          <>
            <p className="text-[0.9375rem] leading-relaxed text-ink-700">
              이 기관에 저장된 템플릿이 없습니다. 없다기보다, 템플릿을 담는 표가
              서버에 아직 없어서 만들어도 저장되지 않습니다. 그래서 만들기·복제·
              공유 신청 버튼을 두지 않았습니다 — 눌러도 아무 데도 남지 않는
              버튼은 만든 줄 알게 만듭니다.
            </p>
            <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-700">
              그동안은 이렇게 하실 수 있습니다. 회기는 위의 기억 카드로 그대로
              진행하시고, 기관에서 쓰시던 진행안이 있으면 기존 문서를 계속
              쓰세요. 이 화면이 그 문서를 대신하지 않습니다. 다른 기관과 나누고
              싶은 진행안이 있으시면 도입 담당자에게 보내 주세요.
            </p>
          </>
        ) : (
          <>
            <p className="text-[0.875rem] font-bold text-ink-500">
              화면이 어떤 모습이 될지 보여드리는 예시입니다. 실제 기관 자료가
              아닙니다.
            </p>
            <div className="mt-3">
              <TableWrap>
                <thead>
                  <tr>
                    <Th>제목</Th>
                    <Th>출처</Th>
                    <Th className="text-right">질문 카드</Th>
                    <Th className="text-right">사용</Th>
                    <Th>수정일</Th>
                  </tr>
                </thead>
                <tbody>
                  {RECIPES.map((r) => (
                    <tr key={r.id}>
                      <Td className="font-bold">{r.title}</Td>
                      <Td>
                        <Pill tone={r.origin === '공식' ? 'leaf' : 'brand'}>
                          {r.origin}
                        </Pill>
                      </Td>
                      <Td className="text-right tabular-nums">{r.cards}</Td>
                      <Td className="text-right tabular-nums">{r.uses}</Td>
                      <Td className="text-ink-500">{r.updated}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </div>
            {/* 예시 화면에서도 살아 있는 버튼은 두지 않는다. 복제·공유 신청은
                누른 흔적이 어디에도 남지 않고, 특히 '공유 신청'은 다른 기관에
                우리 자료를 보냈다는 뜻으로 읽힌다. */}
            <div className="mt-3 flex flex-wrap gap-2">
              <CBtn disabled title="아직 준비되지 않았습니다">
                기관 템플릿 만들기
              </CBtn>
              <CBtn disabled title="아직 준비되지 않았습니다">
                복제
              </CBtn>
              <CBtn disabled title="아직 준비되지 않았습니다">
                공유 신청
              </CBtn>
            </div>
            <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-500">
              만들기·복제·공유 신청은 아직 서버에 연결되어 있지 않습니다.
            </p>
          </>
        )}

        <div className="mt-3">
          <LimitNote>
            템플릿에는 질문과 진행 방법만 담깁니다. 어르신의 이야기·전사·가사를
            템플릿으로 복사하거나 외부에 공유할 수 없습니다. 공유 기능을 만들
            때도 이 선은 그대로 둡니다.
          </LimitNote>
        </div>
      </Panel>
    </CenterShell>
  );
}
