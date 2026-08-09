'use client';

import { CBtn, CenterShell, Checking, LimitNote, Panel, Pill } from '@/components/CenterShell';
import { useAccount } from '@/lib/auth';
import { CENTER } from '@/lib/center-seed';

/**
 * 기관 설정 (CM-ORG · 7 functions)
 *
 * 예전에는 이 화면이 입력 폼이었다. 씨앗 기관(청주 햇살주야간보호센터 ·
 * 043-000-0000 · 정원 28 · 계약 2026-12-31)이 defaultValue 로 채워져 있었고,
 * '저장'을 누르면 아무것도 저장하지 않은 채 "변경 이력이 감사로그에
 * 남았습니다"라고 답했다. 실제 기관 센터장에게는 남의 기관 정보가 자기
 * 정보처럼 보였고, 저장했다는 확인까지 거짓이었다.
 *
 * 그래서 폼을 걷어냈다. 서버가 실제로 아는 값(기관명)만 보여주고, 모르는
 * 칸은 모른다고 적는다. 저장 기능이 생기면 그때 입력칸을 되살린다 —
 * 고칠 수 없는 칸을 고칠 수 있는 것처럼 그려 두지 않는다.
 */
export default function OrgPage() {
  const { account } = useAccount();
  const live = account.status === 'in';
  const checking = account.status === 'loading';

  // 로그인 확인이 끝나기 전에는 씨앗을 먼저 그리지 않는다. 실제 센터장이
  // 화면을 여는 첫 순간에 남의 기관 이름이 스치면, 그 순간을 캡처하는
  // 사람이 생긴다.
  const info: { label: string; value: string | null }[] = live
    ? [
        { label: '기관명', value: account.tenantName },
        // 유형·연락처·정원을 담는 표가 서버에 아직 없다. 비워 두는 편이
        // 씨앗으로 채워 두는 것보다 정확하다.
        { label: '기관 유형', value: null },
        { label: '대표 연락처', value: null },
        { label: '정원', value: null },
      ]
    : [
        { label: '기관명', value: CENTER.name },
        { label: '기관 유형', value: CENTER.type },
        { label: '대표 연락처', value: CENTER.contact },
        { label: '정원', value: `${CENTER.capacity}명` },
      ];

  const schedule: { label: string; value: string | null }[] = live
    ? [
        { label: '운영시간', value: null },
        { label: '휴무일', value: null },
      ]
    : [
        { label: '운영시간', value: CENTER.hours },
        { label: '휴무일', value: CENTER.holidays },
      ];

  return (
    <CenterShell
      code="CM-ORG"
      title="기관 설정"
      lead="기관 정보와 운영 일정, 계약 관련 설정입니다."
      data={{
        kind: 'seedWhileBrowsing',
        what: '아래 기관 정보·운영시간·계약은 예시입니다. 실제 기관 계정으로 들어오면 서버에 등록된 기관명만 표시되고, 나머지 칸은 비어 있습니다.',
      }}
    >
      <div className="grid gap-4 xl:grid-cols-2">
        {/* F-CM-ORG-001 · 002 · 003 */}
        <Panel title="기관 정보" code="F-CM-ORG-001 · 002 · 003">
          {checking ? (
            <Checking />
          ) : (
            <InfoList rows={info} />
          )}

          <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-500">
            이 화면에서는 기관 정보를 고칠 수 없습니다. 기관명은 서버에 등록된
            기관 기록에서 오고, 바꾸려면 도입 담당자에게 요청해야 합니다.
            유형·연락처·정원을 저장하는 기능은 아직 만들지 않았습니다.
          </p>

          <div className="mt-3">
            <LimitNote>
              여기에는 기관 정보만 넣습니다. 어르신의 주민등록번호·계좌·건강정보를
              저장하는 칸은 제공하지 않습니다.
            </LimitNote>
          </div>
        </Panel>

        <div className="space-y-4">
          {/* F-CM-ORG-005 운영시간·휴무일 */}
          <Panel title="운영시간·휴무일" code="F-CM-ORG-005">
            {checking ? (
              <Checking />
            ) : (
              <InfoList rows={schedule} />
            )}
            <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-500">
              회기 일정과 알림이 기관 달력을 따르게 하려면 이 값을 저장할 곳이
              먼저 있어야 합니다. 아직 없으므로, 지금은 기관에서 쓰던 일정표를
              그대로 쓰셔야 합니다.
            </p>
          </Panel>

          {/* F-CM-ORG-004 브랜딩 */}
          <Panel title="브랜딩" code="F-CM-ORG-004">
            <p className="text-[0.9375rem] leading-relaxed text-ink-700">
              내보내는 문서의 머리말에 기관 로고와 이름을 넣는 기능은 아직
              없습니다. 지금 내보내는 활동일지에는 기관 로고가 들어가지
              않습니다.
            </p>
            <div className="mt-3">
              <LimitNote>
                기관 색을 앱 본문에 적용하지는 않습니다. 어르신이 보는 화면의
                글자 대비가 기관 설정 때문에 나빠지면 안 되기 때문입니다.
              </LimitNote>
            </div>
          </Panel>
        </div>
      </div>

      {/* F-CM-ORG-006 · 007 */}
      <Panel className="mt-4" title="데이터 내보내기와 계약 종료" code="F-CM-ORG-006 · 007">
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-[12px] border border-hairline bg-surface p-4">
            <p className="text-[0.9375rem] font-bold text-ink-900">기관 데이터 내보내기</p>
            <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-500">
              감사나 계약 종료 시 기관 범위 자료를 구조화해 내보내는 기능입니다.
              원음성을 포함하려면 별도 승인이 필요합니다.
            </p>
            {/* 눌러도 아무 일이 없는 버튼을 살아 있는 것처럼 두지 않는다.
                기능이 없다는 사실을 버튼 자체가 말하게 둔다. */}
            <div className="mt-3 flex gap-2">
              <CBtn disabled title="아직 준비되지 않았습니다">
                메타데이터만 내보내기
              </CBtn>
              <CBtn disabled title="아직 준비되지 않았습니다">
                원음성 포함 승인 요청
              </CBtn>
            </div>
            <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-ink-500">
              아직 실행할 수 없습니다. 지금 자료가 필요하면 도입 담당자에게
              요청하세요.
            </p>
          </div>

          <div className="rounded-[12px] border border-hairline bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[0.9375rem] font-bold text-ink-900">계약 종료</p>
              {/* 이 파일의 다른 칸들과 같은 순서로 갈라야 한다 — 확인 중 →
                  실기관 → 둘러보기. 예전에는 여기만 확인 중을 빼먹어서, 로그인한
                  센터장이 화면을 여는 첫 순간에 남의 기관 계약 만료일이
                  초록 Pill 로 스쳤다. */}
              {checking ? (
                <Pill>확인 중…</Pill>
              ) : live ? (
                <Pill>계약 정보 미등록</Pill>
              ) : (
                <Pill tone="leaf">계약 {CENTER.contractUntil}까지 (예시)</Pill>
              )}
            </div>
            <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-500">
              종료일을 정하면 신규 생성만 막히고, 기존 자료는 보관정책에 따라
              단계적으로 처리됩니다.
            </p>
            {/* 예전에는 '계약 종료 설정 → 종료 절차 시작' 두 단계가 있었지만
                마지막 버튼이 아무 일도 하지 않았다. 되돌리기 어려운 절차를
                눌러 놓고 시작된 줄 알게 만드는 것이 가장 나쁘다. */}
            <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-700">
              계약 종료는 이 화면에서 처리하지 않습니다. 계약 담당자와 협의해
              종료일과 자료 인계 방법을 먼저 정해야 합니다.
            </p>
          </div>
        </div>
      </Panel>
    </CenterShell>
  );
}

/** 값이 없는 칸은 비워 두지 않고 없다고 적는다. */
function InfoList({ rows }: { rows: { label: string; value: string | null }[] }) {
  return (
    <dl className="space-y-2.5">
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-hairline pb-2.5 last:border-b-0 last:pb-0"
        >
          <dt className="w-[92px] shrink-0 text-[0.8125rem] font-bold text-ink-500">
            {r.label}
          </dt>
          <dd
            className={`min-w-0 flex-1 text-[0.9375rem] ${
              r.value ? 'font-bold text-ink-900' : 'text-ink-500'
            }`}
          >
            {r.value ?? '등록된 값 없음'}
          </dd>
        </div>
      ))}
    </dl>
  );
}
