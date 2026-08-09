'use client';

import { useState, useSyncExternalStore } from 'react';
import { Art } from '@/components/Art';
import { ServerSaveNote } from '@/components/ServerSaveNote';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chip, IconCircle, OutlineButton, PrimaryButton } from '@/components/ui';
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
 * 자동 계산을 믿을 수 있는 최대 길이(분).
 *
 * 회기는 며칠에 걸쳐 이어지기도 한다(lib/flow.ts). 사흘 전에 시작한 회기의
 * 경과 시간은 '진행 시간'이 아니므로, 이보다 길면 재지 않고 복지사에게
 * 넘긴다.
 */
const MAX_AUTO_MINUTES = 180;

/** 회기 시작부터 화면을 연 순간까지 몇 분인가. 못 믿을 값이면 null. */
function elapsedMinutes(startedAt: string, openedAt: number): number | null {
  const mins = Math.round((openedAt - new Date(startedAt).getTime()) / 60000);
  if (!Number.isFinite(mins) || mins < 0 || mins > MAX_AUTO_MINUTES) return null;
  return Math.max(1, mins);
}

// 구독은 아무것도 알리지 않는다 — 진행 시간은 화면을 여는 순간 한 번만
// 필요하고, 매 분 다시 그릴 이유가 없다.
const noSubscribe = () => () => {};
// 서버가 미리 그리는 화면에는 기기 시계가 없다. 비워 두고 기기에서만 채운다.
const noMinutes = () => null;

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
          // 주제가 없는 회기가 있다(lib/useElders.ts). 빈 문자열을 보내면
          // 프롬프트에 '회기 주제: ' 만 남아 무엇이 빠진 건지 모델도 모른다 —
          // 아예 빼면 서버가 '(없음)'으로 적는다.
          topic: s.topic || undefined,
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

  /* 진행 시간 — 기관 서식으로 나가는 값이라 지어내지 않는다.
   *
   * 예전에는 '30분'이 리터럴로 박혀 CSV·인쇄본에 그대로 실렸다. 10분짜리
   * 회기도 50분짜리 회기도 30분으로 남는 셈이라, 서비스 제공 실적을 증빙하는
   * 문서에 재 본 적 없는 숫자가 들어갔다.
   *
   * 이제는 체크리스트에서 '인터뷰 시작'을 누른 시각(remoteStartedAt)부터
   * 지금까지를 재서 채운다. 잴 수 없으면 비워 두고 복지사가 직접 적는다.
   * 빈 칸은 '—'로 나간다 — 모르는 것은 모른다고 두는 편이 낫다.
   *
   * 기기 시계로만 알 수 있는 값이라 서버가 미리 그리는 화면에는 없다. 이
   * 저장소는 그런 값을 useSyncExternalStore 로 읽는다(app/home/page.tsx 의
   * 오늘 날짜). 예전에는 이펙트에서 재서 setState 를 불렀는데, 그 한 줄이
   * 저장소 전체에서 유일한 ESLint 에러(react-hooks/set-state-in-effect)라
   * npm run lint 가 그것 하나로 깨졌다.
   *
   * 잰 시각을 화면을 연 순간(openedAt)으로 고정하는 이유는 두 가지다. 하나는
   * getSnapshot 이 부를 때마다 같은 값을 돌려줘야 하기 때문이고(값이 흔들리면
   * React 가 계속 다시 그린다), 하나는 복지사가 이 화면에서 글을 다듬는 동안
   * 칸의 숫자가 저 혼자 올라가면 안 되기 때문이다.
   */
  const startedAt = s.remoteStartedAt;
  const [openedAt] = useState(() => Date.now());
  const autoMinutes = useSyncExternalStore(
    noSubscribe,
    () => (startedAt ? elapsedMinutes(startedAt, openedAt) : null),
    noMinutes,
  );

  // null 은 "복지사가 아직 손대지 않음"이고 '' 는 "복지사가 지웠음"이다. 둘을
  // 구분해야 지운 칸을 잰 값으로 도로 채우지 않는다.
  const [typed, setTyped] = useState<string | null>(null);
  const minutes = typed ?? (autoMinutes === null ? '' : String(autoMinutes));
  const timeSource =
    typed !== null
      ? 'typed'
      : autoMinutes !== null
        ? 'measured'
        : startedAt
          ? 'spread'
          : 'none';

  const durationValue = minutes.trim() ? `${minutes.trim()}분` : '—';

  /* 안내는 한 문장 묶음으로만 나간다.
   *
   * 예전에는 칸을 비우면 '복지사가 직접 적은 값이에요'와 '비워 두면 —로
   * 나갑니다'가 나란히 떴다. 적었다면서 비었다고 하니 어느 쪽이 맞는지 알 수
   * 없었다. 칸이 비어 있으면 비었을 때 할 말만 한다. */
  const durationNote = minutes.trim()
    ? timeSource === 'measured'
      ? '인터뷰를 시작한 시각부터 재서 채웠어요. 실제와 다르면 고쳐 주세요.'
      : '복지사가 직접 적은 값이에요.'
    : `${
        timeSource === 'spread'
          ? '회기가 하루를 넘겨 이어져서 자동으로 재지 않았어요.'
          : timeSource === 'none'
            ? '회기 시작 시각이 남아 있지 않아 자동으로 재지 못했어요.'
            : '진행 시간이 비어 있어요.'
      } 오늘 진행한 시간을 적어 주세요. 비워 두면 내보내는 서식에 “—”로 나갑니다.`;

  const rows: LogRow[] = [
    // 주제 없이 진행한 회기가 있다(lib/useElders.ts). 서식의 빈 칸은 '—'로
    // 채운다 — 진행 시간과 같은 표기라 읽는 사람이 헷갈리지 않는다.
    { label: '프로그램명', value: s.topic || '—' },
    { label: '진행 시간', value: durationValue },
    { label: '어르신', value: s.elder.displayName },
    { label: '관찰된 반응', value: selected.map((r) => r.label).join(', ') || '기록 없음' },
    { label: '활동일지', value: s.logDraft },
    // '추천'이 아니라 복지사가 정한 주제다. 앱에는 다음 주제를 고르는 계산이
    // 없는데 라벨만 추천이라, 서식에 나간 값이 AI가 판단한 것처럼 읽혔다.
    { label: '다음 회기 주제', value: s.nextTopic || '—' },
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
        {/* 주제가 없는 회기는 화면에도 서식과 같은 '—'로 보인다. 빈 자리를
            그냥 두면 값을 못 불러온 것처럼 보인다. */}
        <span
          className={`text-[1.125rem] font-extrabold ${s.topic ? 'text-ink-900' : 'text-ink-500'}`}
        >
          {s.topic || '—'}
        </span>
      </Card>

      <Card className="mt-3 p-4">
        <div className="flex min-h-[56px] items-center gap-3.5">
          <IconCircle tone="brand" size={48}>
            <Art name="ui_duration" size={26} alt="" />
          </IconCircle>
          <label htmlFor="minutes" className="flex-1 text-[1.125rem] font-bold text-ink-900">
            진행 시간
          </label>
          <input
            id="minutes"
            type="text"
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setTyped(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
            placeholder="—"
            aria-describedby="minutes-note"
            className="h-[52px] w-[88px] rounded-[14px] border border-hairline bg-surface-strong px-3 text-right text-[1.25rem] font-extrabold text-ink-900 placeholder:font-bold placeholder:text-ink-500"
          />
          <span className="text-[1.125rem] font-bold text-ink-900">분</span>
        </div>
        <p id="minutes-note" className="mt-2 text-[0.8125rem] leading-relaxed text-ink-500">
          {durationNote}
        </p>
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

      {/* 다음 주제는 앱이 고르지 않는다. 예전에는 씨앗 문자열이 '다음 추천
          주제'라는 이름으로 화면에도 뜨고 서식·서버 기록에도 그대로 실려서,
          누구의 어떤 회기든 늘 같은 주제가 추천된 것처럼 남았다. 어르신을
          만난 사람이 직접 적게 하고, 안 적으면 비워 둔다. */}
      <Card className="mt-3 p-4">
        <div className="flex min-h-[56px] items-center gap-3.5">
          <IconCircle tone="leaf" size={48}>
            <Art name="ui_next_topic" size={26} alt="" />
          </IconCircle>
          <label
            htmlFor="next-topic"
            className="shrink-0 whitespace-nowrap text-[1.0625rem] font-bold text-ink-900"
          >
            다음 회기 주제
          </label>
          <input
            id="next-topic"
            type="text"
            value={s.nextTopic}
            maxLength={40}
            onChange={(e) => set('nextTopic', e.target.value)}
            placeholder="예: 고향의 여름"
            className="h-[52px] min-w-0 flex-1 rounded-[14px] border border-hairline bg-surface-strong px-3 text-right text-[1rem] font-extrabold text-ink-900 placeholder:font-medium placeholder:text-ink-500"
          />
        </div>
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
