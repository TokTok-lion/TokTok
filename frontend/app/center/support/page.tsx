'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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
import { ROLE_LABELS } from '@/lib/center';
import { NOTICES, PROVIDERS_USED, TICKETS, TRAINING } from '@/lib/center-seed';
import { centerStats, type CenterStats } from '@/lib/repo';

/**
 * 운영 지원 (CM-SUP · 6 functions)
 *
 * 이 화면이 다루는 것 — 공지, 지원 문의, 교육 이수 — 은 담을 표가 서버에 없다
 * (lib/db.types.ts). 그래서 로그인한 기관에서는 목록을 그리지 않고, 무엇이
 * 없는지와 그동안 무엇을 하시면 되는지를 적는다. 둘러보기에서는 화면 모습을
 * 보여주되 예시라고 밝힌다.
 */
export default function SupportPage() {
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
      code="CM-SUP"
      title="운영 지원"
      lead="공지, 문의, 외부 서비스와 교육 이수를 관리합니다."
      data={{
        kind: 'seedWhileBrowsing',
        what: '아래 공지·지원 문의·교육 이수는 예시입니다. 이 세 가지를 담는 표가 서버에 아직 없어서, 실제 기관 계정으로 들어오면 목록 대신 아직 만들지 않았다는 안내가 표시됩니다.',
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
        <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-500">
          제공자가 어느 나라에 있는지도 이 콘솔은 확인하지 않습니다. 국외이전
          고지에 필요한 소재 국가는 계약서와 개인정보 처리방침에서 확인하세요.
        </p>
      </Panel>

      {/* F-CM-SUP-005 샘플 데이터 모드
          명세의 이름은 '샘플 데이터 모드'지만 화면에서는 '연습 모드'라고
          부른다. 이 콘솔에서 '샘플'은 이미 '실측이 아닌 예시 값'을 뜻하고,
          그 말이 맨 위 띠에 붙어 있다. 한 화면에서 같은 낱말이 두 가지를
          뜻하면 띠의 경고가 설정 이름으로 읽힌다. */}
      <Panel className="mt-4" title="교육용 연습 모드" code="F-CM-SUP-005">
        {/* 예전에는 여기 스위치가 있었고, 그 옆에 '아직 만들지 않았습니다'가
            적혀 있었다. 두 말이 서로를 지운다 — 스위치는 켜지고 글은 없다고
            하니, 켜 두고 넘긴 센터장은 신규 복지사가 연습용 환경에 들어간다고
            믿는다. 실제로는 실제 어르신 자료 위에서 연습하게 된다. */}
        <Pill tone="amber">아직 만들지 않았습니다</Pill>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-700">
          가상의 어르신과 곡으로 신규 복지사가 전 과정을 연습하게 하려는
          기능입니다. 지금은 연습용 환경이 따로 없어서, 켜고 끌 스위치도 두지
          않았습니다.
        </p>
        <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-700">
          지금 신규 복지사를 가르치시려면 실제 어르신 없이 담당자와 화면을 함께
          보며 익히시는 편이 안전합니다. 회기를 열어 보실 때는 어르신을 고르지
          않은 상태에서 화면 흐름만 따라가시고, 녹음 버튼은 누르지 마세요.
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
        <Panel title="기관 공지" code="F-CM-SUP-001">
          {checking ? (
            <Checking />
          ) : live ? (
            <>
              <p className="text-[0.9375rem] leading-relaxed text-ink-700">
                기관 공지를 쓰고 보관하는 기능은 아직 없습니다. 공지를 담는 표가
                서버에 없어서, 작성 버튼을 두지 않았습니다.
              </p>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-700">
                그동안은 기관에서 쓰시던 방법(게시판·메신저·조회)을 그대로
                쓰세요. 이 화면이 그것을 대신하지 않습니다.
              </p>
            </>
          ) : (
            <>
              <p className="text-[0.875rem] font-bold text-ink-500">
                아래 두 건은 예시입니다. 실제 기관 공지가 아닙니다.
              </p>
              <ul className="mt-3 space-y-2">
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
              <div className="mt-3">
                <CBtn disabled title="아직 준비되지 않았습니다">
                  공지 작성
                </CBtn>
              </div>
            </>
          )}
          <p className="mt-3 text-[0.8125rem] text-ink-500">
            공지에 어르신의 이름이나 이야기를 적지 마세요.
          </p>
        </Panel>

        {/* F-CM-SUP-002 지원 티켓 */}
        <Panel title="지원 문의" code="F-CM-SUP-002">
          {checking ? (
            <Checking />
          ) : live ? (
            <>
              <p className="text-[0.9375rem] leading-relaxed text-ink-700">
                앱 안에서 문의를 접수하고 답변 상태를 따라가는 기능은 아직
                없습니다. 문의를 담는 표가 서버에 없습니다.
              </p>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-700">
                지금은 도입 담당자에게 직접 연락하세요. 어느 화면에서 무엇을
                누르셨을 때 그랬는지와 시각을 함께 알려주시면 빨리 찾습니다.
                문의에 어르신의 이름이나 이야기는 적지 마세요.
              </p>
            </>
          ) : (
            <>
              <p className="text-[0.875rem] font-bold text-ink-500">
                아래 문의는 예시입니다. 실제 접수 내역이 아닙니다.
              </p>
              <div className="mt-3">
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
                          <Pill tone={t.state === '답변 완료' ? 'leaf' : 'brand'}>
                            {t.state}
                          </Pill>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              </div>
            </>
          )}
        </Panel>
      </div>

      {/* F-CM-SUP-004 교육 이수 */}
      <Panel className="mt-4" title="교육 이수" code="F-CM-SUP-004">
        {checking ? (
          <Checking />
        ) : live ? (
          <>
            {/* 직원 수는 서버가 안다(memberships). 이수 여부는 담을 표가 없다.
                아는 것과 모르는 것을 한 문단에서 갈라 적는다 — 예전에는 예시
                직원 넷의 '이수 / 미이수' Pill 이 그려져서, 실제 기관 센터장이
                남의 직원 교육 현황을 자기 기관 것으로 읽었다. */}
            {stats === null ? (
              <p className="text-[0.9375rem] text-ink-500">불러오는 중…</p>
            ) : stats.staff === null ? (
              /* 못 읽은 것을 0명이라고 적지 않는다. 교육 이수 여부를 모른다고
                 말하는 화면에서 인원수마저 틀리면 아래 문장까지 못 믿게 된다. */
              <p className="text-[0.9375rem] font-bold leading-relaxed text-ink-700">
                직원 수를 못 읽었어요. 잠시 뒤 새로고침해 주세요.
              </p>
            ) : (
              <>
                <p className="text-[0.9375rem] leading-relaxed text-ink-900">
                  <strong className="font-extrabold">
                    활동 중인 직원 {stats.staff.reduce((a, b) => a + b.count, 0)}명
                  </strong>
                  {stats.staff.length ? (
                    <span className="text-ink-500">
                      {' · '}
                      {stats.staff
                        .map((r) => `${ROLE_LABELS[r.role] ?? r.role} ${r.count}`)
                        .join(' · ')}
                    </span>
                  ) : null}
                </p>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-700">
                  직원 수는 서버에서 읽은 값입니다. 하지만 이 중 누가 온보딩·
                  개인정보·안전 응대 교육을 이수했는지는 이 콘솔이 알지 못합니다
                  — 이수 기록을 담는 표가 서버에 없습니다. 이수하지 않은 것을
                  이수했다고 적을 수 없어서 표를 그리지 않습니다.
                </p>
                <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-700">
                  그동안은 기관에서 쓰시던 교육 대장을 계속 쓰세요. 이 콘솔에
                  이수 기록을 남기는 기능이 필요하시면 도입 담당자에게 알려
                  주세요.
                </p>
              </>
            )}
          </>
        ) : (
          <>
            <p className="text-[0.875rem] font-bold text-ink-500">
              아래 이수 현황은 예시입니다. 실제 직원 기록이 아닙니다.
            </p>
            <div className="mt-3">
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
            </div>
          </>
        )}
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
