'use client';

import { useState } from 'react';
import { Art } from '@/components/Art';
import { ServerSaveNote } from '@/components/ServerSaveNote';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chevron, Chip, IconCircle, OutlineButton, PrimaryButton } from '@/components/ui';
import { IconCopy, IconExport } from '@/components/icons';
import {
  CONSENT_FALLBACK,
  REACTIONS,
  hasConsent,
  lyricInputs,
} from '@/lib/domain';
import { downloadCsv, printLog, todayStamp, type LogRow } from '@/lib/export';
import { useSession } from '@/lib/store';
import { useServerSave } from '@/lib/useServerSave';

const MAX = 1000;

/**
 * 활동일지 편집 (deck p.10)
 *
 * The draft is AI-written and stays a draft until the social worker saves it
 * (원칙 3 · 사람 검수 필수). Export is copy/PDF/Excel shaped so it slots into
 * the centre's existing paperwork rather than replacing it (원칙 8).
 */
export default function LogPage() {
  const { s, set } = useSession();
  const [copied, setCopied] = useState(false);
  const server = useServerSave();
  const selected = REACTIONS.filter((r) => s.reactions.includes(r.id));

  // 외부 AI 전송은 목적별 동의다. 동의가 없으면 어르신 이야기가 밖으로
  // 나가서는 안 되므로 버튼 자체를 잠그고, 대신 무엇을 할 수 있는지 알린다.
  const aiAllowed = hasConsent(s.elder.consents, 'externalAi');
  const [ai, setAi] = useState<'idle' | 'busy' | 'done'>('idle');
  const [aiError, setAiError] = useState<string | null>(null);

  const rewrite = async () => {
    setAi('busy');
    setAiError(null);
    try {
      const res = await fetch('/api/log-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: s.topic,
          // 확인된 이야기만 나간다. 미확인·제외 항목과 어르신 이름은 보내지 않는다.
          facts: lyricInputs(s.story).map((i) => i.text),
          reactions: selected.map((r) => r.label),
          note: s.reactionNote || undefined,
        }),
      });
      const json = (await res.json()) as { draft?: string; error?: string };
      if (!res.ok || !json.draft) {
        setAiError(json.error ?? '초안을 만들지 못했습니다.');
        setAi('idle');
        return;
      }
      set('logDraft', json.draft);
      setAi('done');
    } catch {
      setAiError('연결하지 못했습니다. 직접 작성하셔도 됩니다.');
      setAi('idle');
    }
  };

  const rows: LogRow[] = [
    { label: '프로그램명', value: s.topic },
    { label: '진행 시간', value: '30분' },
    { label: '어르신', value: s.elder.displayName },
    { label: '관찰된 반응', value: selected.map((r) => r.label).join(', ') || '기록 없음' },
    { label: '활동일지', value: s.logDraft },
    { label: '다음 추천 주제', value: s.nextTopic },
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(s.logDraft);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Screen
      bell
      title="활동일지 편집"
      subtitle="오늘의 기록을 정리하고 저장해보세요"
      decoration={<Ornaments variant="both" />}
      footer={
        <>
          <div className="mb-3">
            <OutlineButton tone="leaf" onClick={copy} leading={<IconCopy size={22} />}>
              {copied ? '복사했어요' : '복사하기'}
            </OutlineButton>
          </div>
          {/* 서버 저장 결과는 감추지 않는다. 실패해도 화면은 넘어가지만,
              나중에 다시 저장해야 한다는 걸 복지사가 알아야 한다. 버튼을 누르면
              바로 마무리 화면으로 넘어가므로, 같은 안내가 그쪽에도 있다. */}
          <div className="mb-2 empty:mb-0">
            <ServerSaveNote retry />
          </div>
          <PrimaryButton
            href="/session/wrap"
            onClick={() => {
              set('logSaved', true);
              void server.save();
            }}
            leading={<IconExport size={22} />}
          >
            {server.state.kind === 'saving' ? '저장하는 중…' : '저장하고 내보내기'}
          </PrimaryButton>
        </>
      }
    >
      <Card className="flex min-h-[72px] items-center gap-3.5 px-4">
        <IconCircle tone="leaf" size={48}>
          <Art name="ui_program" size={26} alt="" />
        </IconCircle>
        <span className="flex-1 text-[1.125rem] font-bold text-ink-900">프로그램명</span>
        <span className="text-[1.125rem] font-extrabold text-ink-900">{s.topic}</span>
      </Card>

      <Card className="mt-3 flex min-h-[72px] items-center gap-3.5 px-4">
        <IconCircle tone="brand" size={48}>
          <Art name="ui_duration" size={26} alt="" />
        </IconCircle>
        <span className="flex-1 text-[1.125rem] font-bold text-ink-900">진행 시간</span>
        <span className="text-[1.25rem] font-extrabold text-ink-900">30분</span>
      </Card>

      <Card className="mt-3 p-4">
        <div className="flex items-center gap-3.5">
          <IconCircle tone="amber" size={48}>
            <Art name="ui_reaction" size={26} alt="" />
          </IconCircle>
          <span className="text-[1.125rem] font-bold text-ink-900">관찰된 반응</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {selected.length > 0 ? (
            selected.map((r) => (
              <Chip key={r.id} tone="brand">
                {r.label}
              </Chip>
            ))
          ) : (
            <p className="text-[0.9375rem] text-ink-500">
              선택된 반응이 없어요. 관찰 반응 기록에서 먼저 남겨 주세요.
            </p>
          )}
        </div>
      </Card>

      <Card className="mt-3 flex min-h-[72px] items-center gap-3.5 px-4">
        <IconCircle tone="leaf" size={48}>
          <Art name="ui_next_topic" size={26} alt="" />
        </IconCircle>
        {/* Korean keeps whole words together, so a flexible label wraps hard in
            this row. The label holds its line; the topic takes the slack. */}
        <span className="shrink-0 whitespace-nowrap text-[1.0625rem] font-bold text-ink-900">
          다음 추천 주제
        </span>
        <span className="min-w-0 flex-1 text-right text-[1rem] font-extrabold text-ink-900">
          {s.nextTopic}
        </span>
        <Chevron className="shrink-0 text-ink-300" />
      </Card>

      <Card className="mt-3 p-4">
        <div className="flex items-center gap-3">
          <IconCircle tone="brand" size={44}>
            <Art name="ui_draft" size={26} alt="" />
          </IconCircle>
          <label htmlFor="draft" className="text-[1.125rem] font-bold text-ink-900">
            활동일지 초안{' '}
            <span className="text-[0.9375rem] font-medium text-ink-500">(수정 가능)</span>
          </label>
        </div>

        <textarea
          id="draft"
          rows={7}
          maxLength={MAX}
          value={s.logDraft}
          onChange={(e) => set('logDraft', e.target.value)}
          className="mt-3 w-full resize-none rounded-[16px] bg-surface-strong p-4 text-[1rem] leading-[1.75] text-ink-900"
        />
        <p className="mt-1 text-right text-[0.875rem] text-ink-500">
          {s.logDraft.length} / {MAX}
        </p>

        <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-500">
          AI가 쓴 초안이에요. 복지사가 확인하고 고친 내용만 최종 기록이 됩니다.
        </p>

        {aiAllowed ? (
          <>
            <button
              type="button"
              onClick={() => void rewrite()}
              disabled={ai === 'busy'}
              className={`mt-3 min-h-[52px] w-full rounded-[14px] border border-hairline text-[1rem] font-bold ${
                ai === 'busy'
                  ? 'pointer-events-none bg-surface-sunk text-ink-500'
                  : 'bg-surface text-ink-700'
              }`}
            >
              {ai === 'busy'
                ? '초안을 쓰는 중…'
                : ai === 'done'
                  ? '초안을 새로 썼어요 — 다시 쓰기'
                  : 'AI로 초안 다시 쓰기'}
            </button>
            {aiError ? (
              <p
                role="alert"
                className="mt-2 rounded-[12px] bg-surface-sunk px-3 py-2 text-[0.875rem] font-bold text-danger-600"
              >
                {aiError}
              </p>
            ) : null}
          </>
        ) : (
          /* 동의가 없을 때 막다른 길로 두지 않는다 — 대신 할 수 있는 일을 적는다 */
          <p className="mt-3 rounded-[12px] bg-surface-sunk px-3.5 py-3 text-[0.875rem] leading-relaxed text-ink-700">
            <strong>외부 AI 전송</strong>에 동의하지 않으셔서 자동 초안은 만들지
            않아요. {CONSENT_FALLBACK.externalAi}
          </p>
        )}
      </Card>

      {/* 기관은 이미 쓰던 서식이 있다. 앱 안에 가두지 않고 꺼내 준다(원칙 8). */}
      <Card className="mt-3 p-4">
        <p className="text-[1.125rem] font-bold text-ink-900">기관 양식으로 내보내기</p>
        <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-500">
          인쇄 창에서 <strong>PDF로 저장</strong>을 고르면 파일로 남길 수 있어요.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={printLog}
            className="min-h-[52px] rounded-[14px] border border-hairline bg-surface text-[1rem] font-bold text-ink-700"
          >
            인쇄 · PDF
          </button>
          <button
            type="button"
            onClick={() =>
              downloadCsv(`활동일지_${s.elder.displayName}_${todayStamp()}.csv`, rows)
            }
            className="min-h-[52px] rounded-[14px] border border-hairline bg-surface text-[1rem] font-bold text-ink-700"
          >
            엑셀 (CSV)
          </button>
        </div>
      </Card>

      {/* 종이에 나가는 것. 화면에서는 숨어 있다가 인쇄할 때만 보인다. */}
      <div data-print className="hidden">
        <h1 style={{ fontSize: '20pt', fontWeight: 800, marginBottom: '4mm' }}>
          활동일지
        </h1>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11pt' }}>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th
                  style={{
                    border: '1px solid #999',
                    padding: '3mm',
                    textAlign: 'left',
                    width: '32mm',
                    verticalAlign: 'top',
                    background: '#f2f2f2',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.label}
                </th>
                <td
                  style={{
                    border: '1px solid #999',
                    padding: '3mm',
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {r.value || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ marginTop: '6mm', fontSize: '9pt', color: '#555' }}>
          작성일 {todayStamp()} · 똑똑 생애여정 음악지도
        </p>
      </div>
    </Screen>
  );
}
