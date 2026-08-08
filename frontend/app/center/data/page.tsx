'use client';

import { useState } from 'react';
import {
  CBtn,
  CenterShell,
  Kpi,
  LimitNote,
  Panel,
  Pill,
  TableWrap,
  Td,
  Th,
} from '@/components/CenterShell';
import {
  DELETION_SCOPE_LABELS,
  MIN_REASON_LENGTH,
  ROLE_LABELS,
  SENSITIVE_LABELS,
  blockApproval,
  needsTwoPersonApproval,
  validateAccessReason,
  type AuditEntry,
  type DeletionRequest,
  type SensitiveResource,
} from '@/lib/center';
import { AUDIT, DELETION_REQUESTS, QUALITY_ISSUES, STAFF } from '@/lib/center-seed';

/** 로그인한 센터장 — 승인 규칙 검사에 쓰인다. */
const ME = STAFF[0];

/** 데이터 거버넌스 (CM-DATA · 9 functions) */
export default function DataGovernancePage() {
  const [requests, setRequests] = useState<DeletionRequest[]>(DELETION_REQUESTS);
  const [audit, setAudit] = useState<AuditEntry[]>(AUDIT);
  const [open, setOpen] = useState<SensitiveResource | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [granted, setGranted] = useState<string | null>(null);

  const pending = requests.filter((r) => r.state === 'requested');

  const approve = (r: DeletionRequest) => {
    const blocked = blockApproval(r, ME);
    if (blocked) {
      window.alert(blocked);
      return;
    }
    setRequests((prev) =>
      prev.map((x) =>
        x.id === r.id ? { ...x, approvedBy: ME.name, state: 'inProgress' } : x,
      ),
    );
    setAudit((prev) => [
      {
        id: `a-${r.id}`,
        at: '방금',
        actor: ME.name,
        role: ME.role,
        action: '삭제 승인',
        target: r.subject,
      },
      ...prev,
    ]);
  };

  const requestAccess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!open) return;
    const err = validateAccessReason(reason);
    setReasonError(err);
    if (err) return;

    setGranted(SENSITIVE_LABELS[open]);
    setAudit((prev) => [
      {
        id: `g-${prev.length}`,
        at: '방금',
        actor: ME.name,
        role: ME.role,
        action: `${SENSITIVE_LABELS[open]} 열람`,
        target: '지정 어르신 자료',
        reason: reason.trim(),
      },
      ...prev,
    ]);
    setOpen(null);
    setReason('');
  };

  return (
    <CenterShell
      code="CM-DATA"
      title="데이터 거버넌스"
      lead="감사로그, 삭제 요청, 민감자료 접근을 관리합니다."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="처리 대기 삭제 요청" value={pending.length} unit="건" tone={pending.length ? 'brand' : 'leaf'} />
        <Kpi
          label="품질 점검 이슈"
          value={QUALITY_ISSUES.reduce((a, q) => a + q.count, 0)}
          unit="건"
          tone="amber"
        />
        <Kpi label="이번 주 감사 기록" value={audit.length} unit="건" />
      </div>

      {/* F-CM-DATA-002 민감 접근 사유 (break-glass) */}
      <Panel
        className="mt-4"
        title="민감자료 열람"
        code="F-CM-DATA-002"
        desc="원음성·영상·삭제 예정 자료는 사유를 남겨야 열립니다."
      >
        <p className="text-[0.9375rem] leading-relaxed text-ink-700">
          권한 매트릭스상 센터장은 원음성을 <strong>기본적으로 열람하지 않습니다</strong>.
          사고 조사나 삭제 범위 확인처럼 업무상 필요할 때만, 사유를 남기고
          단기간 열 수 있습니다.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(SENSITIVE_LABELS) as SensitiveResource[]).map((r) => (
            <CBtn key={r} onClick={() => { setOpen(r); setGranted(null); setReasonError(null); }}>
              {SENSITIVE_LABELS[r]} 열람 요청
            </CBtn>
          ))}
        </div>

        {open ? (
          <form
            onSubmit={requestAccess}
            className="mt-4 rounded-[12px] border border-brand-300 bg-brand-50 p-4"
          >
            <label htmlFor="reason" className="block text-[0.9375rem] font-extrabold text-ink-900">
              {SENSITIVE_LABELS[open]} 열람 사유
            </label>
            <p className="mt-1 text-[0.8125rem] text-ink-700">
              이 사유는 감사로그에 그대로 남고, 어르신·검토자가 확인할 수 있습니다.
            </p>
            <textarea
              id="reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={`${MIN_REASON_LENGTH}자 이상 적어 주세요`}
              aria-invalid={!!reasonError}
              aria-describedby={reasonError ? 'reason-err' : undefined}
              className="mt-2 w-full resize-none rounded-[10px] border border-hairline bg-surface p-3 text-[0.9375rem] text-ink-900"
            />
            {reasonError ? (
              <p id="reason-err" className="mt-1 text-[0.8125rem] font-bold text-danger-600">
                {reasonError}
              </p>
            ) : null}
            <div className="mt-3 flex gap-2">
              <CBtn type="submit" tone="solid">
                사유 남기고 열기
              </CBtn>
              <CBtn onClick={() => { setOpen(null); setReason(''); setReasonError(null); }}>
                취소
              </CBtn>
            </div>
          </form>
        ) : null}

        {granted ? (
          <p className="mt-3 rounded-[10px] bg-leaf-50 px-3.5 py-3 text-[0.9375rem] font-semibold text-leaf-800">
            {granted} 열람 권한이 <strong>15분간</strong> 열렸습니다. 감사로그에
            기록했습니다.
          </p>
        ) : null}
      </Panel>

      {/* F-CM-DATA-003/004/005 삭제 요청 큐 · 2인 승인 · 완료 증빙 */}
      <Panel
        className="mt-4"
        title="삭제 요청"
        code="F-CM-DATA-003 · 004 · 005"
        desc="고위험 삭제는 요청자와 다른 사람이 승인해야 합니다."
      >
        <ul className="space-y-3">
          {requests.map((r) => {
            const twoPerson = needsTwoPersonApproval(r);
            const blocked = blockApproval(r, ME);
            const overdue = r.requestedDaysAgo > r.slaDays;
            return (
              <li key={r.id} className="rounded-[12px] border border-hairline bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={r.scope === 'organization' ? 'danger' : r.scope === 'participant' ? 'amber' : 'neutral'}>
                    {DELETION_SCOPE_LABELS[r.scope]}
                  </Pill>
                  {twoPerson ? <Pill tone="danger">2인 승인 필요</Pill> : null}
                  {r.state === 'completedWithExceptions' ? (
                    <Pill tone="leaf">완료 (예외 있음)</Pill>
                  ) : r.state === 'inProgress' ? (
                    <Pill tone="brand">처리 중</Pill>
                  ) : null}
                  <span className="min-w-0 flex-1 text-[1rem] font-bold text-ink-900">
                    {r.subject}
                  </span>
                </div>

                <p className="mt-2 text-[0.875rem] text-ink-500">
                  요청 {r.requestedBy} ({ROLE_LABELS[r.requestedByRole]}) ·{' '}
                  {r.requestedDaysAgo}일 전 · 처리기한 {r.slaDays}일
                  {overdue ? (
                    <span className="ml-2 font-bold text-danger-600">기한 초과</span>
                  ) : null}
                  {r.approvedBy ? ` · 승인 ${r.approvedBy}` : ''}
                </p>

                {r.exceptions.length > 0 ? (
                  <div className="mt-3 rounded-[10px] bg-amber-100/60 px-3.5 py-2.5">
                    <p className="text-[0.875rem] font-extrabold text-amber-700">
                      완전히 지울 수 없는 항목
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {r.exceptions.map((x) => (
                        <li key={x} className="text-[0.875rem] leading-relaxed text-ink-700">
                          · {x}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {r.state === 'requested' ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <CBtn tone="danger" onClick={() => approve(r)} disabled={!!blocked}>
                      삭제 승인
                    </CBtn>
                    <CBtn>보류</CBtn>
                    {blocked ? (
                      <span className="text-[0.8125rem] font-semibold text-danger-600">
                        {blocked}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <div className="mt-3">
          <LimitNote>
            &ldquo;완전 삭제&rdquo;를 약속하지 않습니다. 백업 주기가 남은 사본이나 이미
            내려받은 파일은 회수할 수 없으며, 그 사실을 증빙에 그대로 적습니다.
          </LimitNote>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {/* F-CM-DATA-007 데이터 품질 점검 */}
        <Panel title="데이터 품질 점검" code="F-CM-DATA-007">
          <ul className="space-y-2">
            {QUALITY_ISSUES.map((q) => (
              <li key={q.id} className="flex items-center gap-3">
                <Pill tone={q.count === 0 ? 'leaf' : 'amber'}>
                  {q.count === 0 ? '이상 없음' : `${q.count}건`}
                </Pill>
                <span className="flex-1 text-[0.9375rem] font-semibold text-ink-900">
                  {q.rule}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
            규칙 위반을 찾기만 합니다. 자동으로 고치거나 지우지 않고, 담당자가
            승인한 뒤에 처리합니다.
          </p>
        </Panel>

        {/* F-CM-DATA-006 공유링크 일괄 만료 + F-CM-DATA-009 사고 신고 */}
        <Panel title="긴급 조치" code="F-CM-DATA-006 · 009">
          <div className="space-y-3">
            <div className="rounded-[12px] border border-hairline bg-surface p-3.5">
              <p className="text-[0.9375rem] font-bold text-ink-900">공유링크 일괄 만료</p>
              <p className="mt-1 text-[0.875rem] text-ink-500">
                철회·사고 시 해당 어르신의 가족 링크를 즉시 폐기합니다.
              </p>
              <div className="mt-2.5">
                <CBtn tone="danger">링크 만료 실행</CBtn>
              </div>
            </div>
            <div className="rounded-[12px] border border-hairline bg-surface p-3.5">
              <p className="text-[0.9375rem] font-bold text-ink-900">보안사고 신고</p>
              <p className="mt-1 text-[0.875rem] text-ink-500">
                유출·오전송·권한 오류를 신고하면 링크 차단과 로그 보존이 함께
                시작됩니다.
              </p>
              <div className="mt-2.5">
                <CBtn>사고 신고</CBtn>
              </div>
            </div>
          </div>
          <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
            법적 통지 의무가 있는지에 대한 판단은 전문가가 합니다. 이 화면은
            대응 절차를 시작하고 기록을 보존할 뿐입니다.
          </p>
        </Panel>
      </div>

      {/* F-CM-DATA-001 기관 감사로그 */}
      <Panel
        className="mt-4"
        title="감사로그"
        code="F-CM-DATA-001"
        desc="누가 · 언제 · 무엇에 했는지의 메타 기록입니다."
        actions={<CBtn>내보내기</CBtn>}
      >
        <TableWrap>
          <thead>
            <tr>
              <Th>시각</Th>
              <Th>수행자</Th>
              <Th>행위</Th>
              <Th>대상</Th>
              <Th>사유</Th>
            </tr>
          </thead>
          <tbody>
            {audit.map((a) => (
              <tr key={a.id}>
                <Td className="whitespace-nowrap text-ink-500">{a.at}</Td>
                <Td>
                  <span className="font-bold">{a.actor}</span>
                  <span className="ml-1.5 text-[0.8125rem] text-ink-500">
                    {ROLE_LABELS[a.role]}
                  </span>
                </Td>
                <Td className="font-semibold">{a.action}</Td>
                <Td className="text-ink-700">{a.target}</Td>
                <Td className="text-[0.875rem] text-ink-500">{a.reason ?? '—'}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>

        <div className="mt-3">
          <LimitNote>
            감사로그에는 어떤 자료를 다뤘는지만 남고, 어르신의 이야기·전사·가사
            본문은 저장되지 않습니다.
          </LimitNote>
        </div>
      </Panel>
    </CenterShell>
  );
}
