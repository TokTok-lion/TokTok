'use client';

import { useState } from 'react';
import { CBtn, CenterShell, LimitNote, Panel, Pill } from '@/components/CenterShell';
import { CENTER } from '@/lib/center-seed';

const TYPES = ['주야간보호', '요양원', '복지관', '치매안심센터'];

/** 기관 설정 (CM-ORG · 7 functions) */
export default function OrgPage() {
  const [saved, setSaved] = useState(false);
  const [closing, setClosing] = useState(false);

  return (
    <CenterShell
      code="CM-ORG"
      title="기관 설정"
      lead="기관 정보와 운영 일정, 계약 관련 설정입니다."
    >
      <div className="grid gap-4 xl:grid-cols-2">
        {/* F-CM-ORG-001 · 002 · 003 */}
        <Panel title="기관 정보" code="F-CM-ORG-001 · 002 · 003">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setSaved(true);
            }}
          >
            <Field id="name" label="기관명" defaultValue={CENTER.name} />
            <div>
              <label htmlFor="type" className="block text-[0.8125rem] font-bold text-ink-500">
                기관 유형
              </label>
              <select
                id="type"
                defaultValue={CENTER.type}
                className="mt-1 min-h-[40px] w-full rounded-[10px] border border-hairline bg-surface px-3 text-[0.9375rem] text-ink-900"
              >
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <Field id="contact" label="대표 연락처" defaultValue={CENTER.contact} />
            <Field id="capacity" label="정원" defaultValue={String(CENTER.capacity)} type="number" />
            <div className="flex items-center gap-2 pt-1">
              <CBtn type="submit" tone="solid">
                저장
              </CBtn>
              {saved ? (
                <span className="text-[0.875rem] font-semibold text-leaf-700">
                  저장했습니다. 변경 이력이 감사로그에 남았습니다.
                </span>
              ) : null}
            </div>
          </form>

          <div className="mt-3">
            <LimitNote>
              여기에는 기관 정보만 넣습니다. 어르신의 주민등록번호·계좌·건강정보를
              저장하는 칸은 제공하지 않습니다.
            </LimitNote>
          </div>
        </Panel>

        {/* F-CM-ORG-005 운영시간·휴무일 */}
        <div className="space-y-4">
          <Panel title="운영시간·휴무일" code="F-CM-ORG-005">
            <div className="space-y-3">
              <Field id="hours" label="운영시간" defaultValue={CENTER.hours} />
              <Field id="holiday" label="휴무일" defaultValue={CENTER.holidays} />
            </div>
            <p className="mt-3 text-[0.8125rem] text-ink-500">
              세션 일정과 알림이 이 달력을 따릅니다. 공휴일 정보는 매년
              갱신해야 합니다.
            </p>
          </Panel>

          {/* F-CM-ORG-004 브랜딩 */}
          <Panel title="브랜딩" code="F-CM-ORG-004">
            <p className="text-[0.9375rem] leading-relaxed text-ink-700">
              내보내는 문서의 머리말에 기관 로고와 이름을 넣을 수 있습니다.
            </p>
            <div className="mt-3 flex gap-2">
              <CBtn>로고 올리기</CBtn>
            </div>
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
              감사나 계약 종료 시 기관 범위 자료를 구조화해 내보냅니다. 원음성을
              포함하려면 별도 승인이 필요합니다.
            </p>
            <div className="mt-3 flex gap-2">
              <CBtn>메타데이터만 내보내기</CBtn>
              <CBtn>원음성 포함 승인 요청</CBtn>
            </div>
          </div>

          <div className="rounded-[12px] border border-hairline bg-surface p-4">
            <div className="flex items-center gap-2">
              <p className="text-[0.9375rem] font-bold text-ink-900">계약 종료</p>
              <Pill tone="leaf">계약 {CENTER.contractUntil}까지</Pill>
            </div>
            <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-500">
              종료일을 정하면 신규 생성만 막히고, 기존 자료는 보관정책에 따라
              단계적으로 처리됩니다.
            </p>
            <div className="mt-3">
              {closing ? (
                <div className="rounded-[10px] bg-[#fbe3dd] p-3.5">
                  <p className="text-[0.875rem] font-bold text-danger-600">
                    종료 절차를 시작하면 되돌리기 어렵습니다.
                  </p>
                  <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-700">
                    종료일 이후에도 내보내기 기간이 남아 있어 자료가 즉시
                    사라지지는 않습니다.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <CBtn onClick={() => setClosing(false)}>취소</CBtn>
                    <CBtn tone="danger">종료 절차 시작</CBtn>
                  </div>
                </div>
              ) : (
                <CBtn onClick={() => setClosing(true)}>계약 종료 설정</CBtn>
              )}
            </div>
          </div>
        </div>
      </Panel>
    </CenterShell>
  );
}

function Field({
  id,
  label,
  defaultValue,
  type = 'text',
}: {
  id: string;
  label: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[0.8125rem] font-bold text-ink-500">
        {label}
      </label>
      <input
        id={id}
        type={type}
        defaultValue={defaultValue}
        className="mt-1 min-h-[40px] w-full rounded-[10px] border border-hairline bg-surface px-3 text-[0.9375rem] text-ink-900"
      />
    </div>
  );
}
