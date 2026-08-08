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
import {
  RETENTION_BOUNDS,
  RETENTION_LABELS,
  canRequireConsent,
  clampRetention,
  type ConsentPolicy,
  type RetentionKey,
} from '@/lib/center';
import { CONSENT_POLICIES, RETENTION_DEFAULTS } from '@/lib/center-seed';

const PROVIDERS = [
  { name: '전사(STT) 제공자 A', region: '대한민국(서울)', purpose: '음성 → 텍스트' },
  { name: 'LLM 제공자 B', region: '미국', purpose: '이야기 구조화·가사 초안' },
  { name: '음악 생성 제공자 C', region: '미국', purpose: '반주·보컬 합성' },
];

/** 기관 개인정보 운영 (CM-POL · 9 functions) */
export default function PolicyPage() {
  const [consents, setConsents] = useState<ConsentPolicy[]>(CONSENT_POLICIES);
  const [retention, setRetention] =
    useState<Record<RetentionKey, number>>(RETENTION_DEFAULTS);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [allowed, setAllowed] = useState<string[]>([PROVIDERS[0].name, PROVIDERS[1].name]);

  const toggleRequired = (code: string) =>
    setConsents((prev) =>
      prev.map((c) =>
        c.code === code && canRequireConsent(c.code)
          ? { ...c, required: !c.required }
          : c,
      ),
    );

  return (
    <CenterShell
      code="CM-POL"
      title="기관 개인정보 운영"
      lead="동의 정책과 보관기간을 정합니다. 서비스 최소 기준보다 느슨하게는 설정할 수 없습니다."
    >
      {/* F-CM-POL-002 필수·선택 설정 */}
      <Panel
        title="동의 정책"
        code="F-CM-POL-002"
        desc="목적마다 따로 받습니다. 묶음 동의는 만들 수 없습니다."
      >
        <TableWrap>
          <thead>
            <tr>
              <Th>코드</Th>
              <Th>동의</Th>
              <Th>기관 필수 지정</Th>
              <Th>비고</Th>
            </tr>
          </thead>
          <tbody>
            {consents.map((c) => {
              const lockable = canRequireConsent(c.code);
              return (
                <tr key={c.code}>
                  <Td className="font-mono text-[0.8125rem] text-ink-500">{c.code}</Td>
                  <Td className="font-bold">{c.name}</Td>
                  <Td>
                    {lockable ? (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={c.required}
                        aria-label={`${c.name} 기관 필수 지정`}
                        onClick={() => toggleRequired(c.code)}
                        className={`relative h-[30px] w-[54px] rounded-full transition-colors ${
                          c.required ? 'bg-leaf-600' : 'bg-ink-300'
                        }`}
                      >
                        <span
                          className={`absolute top-1 h-[22px] w-[22px] rounded-full bg-white transition-[left] ${
                            c.required ? 'left-[27px]' : 'left-1'
                          }`}
                        />
                      </button>
                    ) : (
                      <Pill tone="danger">필수 지정 불가</Pill>
                    )}
                  </Td>
                  <Td className="text-[0.875rem] text-ink-500">{c.note}</Td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>

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
        title="보관기간"
        code="F-CM-POL-003"
        desc="유형별로 정합니다. 무기한은 선택할 수 없습니다."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(Object.keys(RETENTION_LABELS) as RetentionKey[]).map((k) => {
            const { min, max } = RETENTION_BOUNDS[k];
            const v = retention[k];
            return (
              <div key={k} className="rounded-[12px] border border-hairline bg-surface p-3.5">
                <label htmlFor={`ret-${k}`} className="flex items-baseline justify-between">
                  <span className="text-[0.9375rem] font-bold text-ink-900">
                    {RETENTION_LABELS[k]}
                  </span>
                  <span className="text-[1rem] font-extrabold tabular-nums text-brand-700">
                    {v}일
                  </span>
                </label>
                <input
                  id={`ret-${k}`}
                  type="range"
                  min={min}
                  max={max}
                  step={30}
                  value={v}
                  onChange={(e) =>
                    setRetention({ ...retention, [k]: clampRetention(k, Number(e.target.value)) })
                  }
                  className="mt-2 h-7 w-full cursor-pointer appearance-none bg-transparent
                    [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full
                    [&::-webkit-slider-runnable-track]:bg-track
                    [&::-webkit-slider-thumb]:mt-[-7px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-brand-600
                    [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-track
                    [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:border-0
                    [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-brand-600"
                />
                <p className="text-[0.75rem] text-ink-500">
                  최소 {min}일 · 최대 {max}일
                </p>
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {/* F-CM-POL-005 영상촬영 정책 */}
        <Panel title="세션 영상 촬영" code="F-CM-POL-005">
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={videoEnabled}
              aria-label="세션 영상 촬영 사용"
              onClick={() => setVideoEnabled((v) => !v)}
              className={`relative h-[32px] w-[58px] shrink-0 rounded-full transition-colors ${
                videoEnabled ? 'bg-leaf-600' : 'bg-ink-300'
              }`}
            >
              <span
                className={`absolute top-1 h-[24px] w-[24px] rounded-full bg-white transition-[left] ${
                  videoEnabled ? 'left-[29px]' : 'left-1'
                }`}
              />
            </button>
            <p className="text-[0.9375rem] font-bold text-ink-900">
              {videoEnabled ? '사용함' : '사용하지 않음 (기본값)'}
            </p>
          </div>
          <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-500">
            영상은 기본으로 꺼져 있습니다. 켜면 촬영 동의(C-06), 보관기간, 저장
            용량 조건을 함께 만족해야 실제로 촬영할 수 있습니다.
          </p>
        </Panel>

        {/* F-CM-POL-006 외부 AI 제공자 허용 */}
        <Panel title="허용 AI 제공자" code="F-CM-POL-006">
          <ul className="space-y-2">
            {PROVIDERS.map((p) => {
              const on = allowed.includes(p.name);
              return (
                <li
                  key={p.name}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] border border-hairline bg-surface px-3.5 py-2.5"
                >
                  <input
                    id={`prov-${p.name}`}
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      setAllowed((prev) =>
                        on ? prev.filter((x) => x !== p.name) : [...prev, p.name],
                      )
                    }
                    className="h-6 w-6 accent-leaf-600"
                  />
                  <label
                    htmlFor={`prov-${p.name}`}
                    className="min-w-0 flex-1 text-[0.9375rem] font-bold text-ink-900"
                  >
                    {p.name}
                  </label>
                  <Pill tone={p.region.startsWith('대한민국') ? 'leaf' : 'amber'}>
                    {p.region}
                  </Pill>
                  <span className="text-[0.8125rem] text-ink-500">{p.purpose}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-3">
            <LimitNote>
              기관이 허용해도 어르신 본인의 외부 AI 전송 동의(C-02)가 따로
              있어야 처리합니다. 국외로 나가는 제공자는 이전받는 자·국가·목적·
              항목·보유기간·거부권을 동의 화면에 그대로 고지합니다.
            </LimitNote>
          </div>
        </Panel>
      </div>

      {/* F-CM-POL-007 · 008 */}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="정책 변경 영향" code="F-CM-POL-007">
          <p className="text-[0.9375rem] leading-relaxed text-ink-700">
            정책을 바꾸면 재동의가 필요한 대상과 이미 처리된 자료의 영향 범위를
            먼저 계산해 보여 줍니다.
          </p>
          <div className="mt-3 flex gap-2">
            <CBtn>영향 대상 계산</CBtn>
          </div>
          <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
            계산만 합니다. 어르신에게 재동의를 자동으로 요청하거나 대신
            처리하지 않습니다.
          </p>
        </Panel>

        <Panel title="철회·삭제 처리 기한" code="F-CM-POL-008">
          <div className="space-y-3">
            <div>
              <label htmlFor="sla" className="block text-[0.8125rem] font-bold text-ink-500">
                처리 기한
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="sla"
                  type="number"
                  defaultValue={7}
                  min={1}
                  max={30}
                  className="min-h-[40px] w-24 rounded-[10px] border border-hairline bg-surface px-3 text-right tabular-nums text-ink-900"
                />
                <span className="text-[0.875rem] font-semibold text-ink-500">일 이내</span>
              </div>
            </div>
            <div>
              <label htmlFor="owner" className="block text-[0.8125rem] font-bold text-ink-500">
                담당자
              </label>
              <select
                id="owner"
                className="mt-1 min-h-[40px] rounded-[10px] border border-hairline bg-surface px-3 text-[0.9375rem] text-ink-900"
              >
                <option>한지우 · 개인정보·안전 검토자</option>
                <option>이정은 · 센터장</option>
              </select>
            </div>
          </div>
          <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
            법정 기한은 별도로 확인해야 합니다. 이 설정은 센터 내부 업무 기한과
            에스컬레이션 규칙일 뿐입니다.
          </p>
        </Panel>
      </div>
    </CenterShell>
  );
}
