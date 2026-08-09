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

/**
 * 진행 시간을 재 본 결과.
 *
 * 칸에 넣을 값과 칸 아래에서 할 말이 이 한 값에서 나온다. 둘을 따로 계산하면
 * 같은 자리에서 서로 반대되는 말이 나온다 — 칸은 비어 있는데 쟀다고 하거나,
 * 14분짜리 회기를 두고 하루를 넘겼다고 하거나.
 */
type Measure =
  /** 아직 기기 시계를 읽지 못함 — 서버가 미리 그린 화면이 여기다 */
  | { kind: 'pending' }
  | { kind: 'ok'; minutes: number }
  /** 회기가 며칠에 걸쳐 이어짐 — 그 경과 시간은 '진행 시간'이 아니다 */
  | { kind: 'spread' }
  /** 시작 시각이 기기 시계보다 뒤 — 어느 쪽이 맞는지 앱은 모른다 */
  | { kind: 'skew' }
  | { kind: 'none' };

/** 회기 시작부터 화면을 연 순간까지. 못 재면 왜 못 쟀는지까지 돌려준다. */
function measure(startedAt: string | null, openedAt: number | null): Measure {
  if (openedAt === null) return { kind: 'pending' };
  if (!startedAt) return { kind: 'none' };
  const mins = Math.round((openedAt - new Date(startedAt).getTime()) / 60000);
  if (!Number.isFinite(mins)) return { kind: 'none' };
  if (mins < 0) return { kind: 'skew' };
  if (mins > MAX_AUTO_MINUTES) return { kind: 'spread' };
  return { kind: 'ok', minutes: Math.max(1, mins) };
}

/**
 * 칸이 비어 있을 때 할 말 — 왜 비었는지부터 적는다.
 *
 * 예전에는 못 잰 이유를 'spread' 하나로 뭉뚱그려서, 시작 시각이 기기 시계보다
 * 뒤인 회기에도 "하루를 넘겨 이어져서"라고 적었다. 하루를 넘긴 적 없는 회기를
 * 그렇게 적으면 그건 지어낸 말이다.
 */
function emptyNote(m: Measure, cleared: boolean): string {
  if (cleared) return '진행 시간이 비어 있어요.';
  switch (m.kind) {
    case 'pending':
      return '진행 시간을 재는 중이에요.';
    case 'spread':
      return '회기가 하루를 넘겨 이어져서 자동으로 재지 않았어요.';
    case 'skew':
      return '회기 시작 시각이 이 기기의 시계보다 뒤라 재지 못했어요.';
    case 'none':
      return '회기 시작 시각이 남아 있지 않아 자동으로 재지 못했어요.';
    case 'ok':
      return '진행 시간이 비어 있어요.';
  }
}

// 구독은 아무것도 알리지 않는다 — 화면을 연 시각은 여는 순간 한 번만
// 필요하고, 매 분 다시 그릴 이유가 없다.
const noSubscribe = () => () => {};
// 서버가 미리 그리는 화면에는 기기 시계가 없다. 비워 두고 기기에서만 채운다.
const noClock = () => null;

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
   * 오늘 날짜). 이펙트에서 재서 setState 를 부르면 저장소 전체에서 유일한
   * ESLint 에러(react-hooks/set-state-in-effect)가 되어 lint 가 그것 하나로
   * 깨진다.
   *
   * 스냅샷에 담는 것은 '몇 분'이 아니라 '기기가 화면을 연 시각'뿐이다.
   *
   * 잰 결과를 스냅샷에 담으면 회기 시작 시각까지 스냅샷 안으로 따라 들어간다.
   * 서버 스냅샷에는 그 시각이 없어 칸은 빈 채로 그려지는데, 칸 아래 문장은
   * 칸의 값이 아니라 저 혼자 세운 판단(timeSource)으로 말했다. 그래서 14분
   * 전에 시작한 회기를 두고 "회기가 하루를 넘겨 이어져서 자동으로 재지
   * 않았어요"라고 적혔다 — 하루를 넘긴 적 없는 회기다. 칸과 문장이 서로 다른
   * 값을 보고 있으면 어느 쪽이든 지어낸 말이 나온다.
   *
   * 이제 재는 일은 렌더에서 한 번, 한 값(measured)으로 끝내고 칸과 문장이 그
   * 값을 같이 쓴다. 쟀다는 말은 잰 값이 칸에 들어 있을 때만 나온다.
   *
   * 시각을 화면을 연 순간(openedAt)으로 고정하는 이유는 두 가지다. 하나는
   * getSnapshot 이 부를 때마다 같은 값을 돌려줘야 하기 때문이고(값이 흔들리면
   * React 가 계속 다시 그린다), 하나는 복지사가 이 화면에서 글을 다듬는 동안
   * 칸의 숫자가 저 혼자 올라가면 안 되기 때문이다.
   */
  const [openedAt] = useState(() => Date.now());
  const deviceNow = useSyncExternalStore(noSubscribe, () => openedAt, noClock);
  const measured = measure(s.remoteStartedAt, deviceNow);

  // null 은 "복지사가 아직 손대지 않음"이고 '' 는 "복지사가 지웠음"이다. 둘을
  // 구분해야 지운 칸을 잰 값으로 도로 채우지 않는다.
  const [typed, setTyped] = useState<string | null>(null);
  const minutes = typed ?? (measured.kind === 'ok' ? String(measured.minutes) : '');
  const filled = minutes.trim();
  // 칸에 든 값이 곧 화면이 할 말이다 — 잰 값이 칸에 그대로 들어 있을 때만
  // 쟀다고 적는다.
  const filledByClock = typed === null && filled !== '';

  const durationValue = filled ? `${filled}분` : '—';

  /* 안내는 한 문장 묶음으로만 나간다.
   *
   * 예전에는 칸을 비우면 '복지사가 직접 적은 값이에요'와 '비워 두면 —로
   * 나갑니다'가 나란히 떴다. 적었다면서 비었다고 하니 어느 쪽이 맞는지 알 수
   * 없었다. 칸이 비어 있으면 비었을 때 할 말만 한다. */
  const durationNote = filled
    ? filledByClock
      ? '인터뷰를 시작한 시각부터 재서 채웠어요. 실제와 다르면 고쳐 주세요.'
      : '복지사가 직접 적은 값이에요.'
    : `${emptyNote(measured, typed !== null)} 오늘 진행한 시간을 적어 주세요. 비워 두면 내보내는 서식에 “—”로 나갑니다.`;

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
      <Card className="p-4">
        <div className="flex min-h-[56px] items-center gap-3.5">
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
        </div>
        {/* '—' 하나만 두면 앱이 값을 잃어버린 것처럼 보인다. 기관 회기는 주제
            없이 진행하는 것이 정상이고(lib/useElders.ts — 참가자 표에 주제
            칸이 없다), 서식에는 그대로 '—'로 나가는 게 맞다. 다만 어디서
            정해지는 값인지는 알려 준다. */}
        {s.topic ? null : (
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-500">
            정해진 주제 없이 진행한 회기예요. 주제는 <strong>어르신 고르기</strong>에서
            회기를 시작할 때 어르신 기록에서 따라오는데, 기관 어르신 기록에는 주제
            칸이 없어 대개 비어 있습니다. 서식에는 “—”로 나가니, 오늘 다룬 이야기는
            아래 활동일지에 적어 주세요.
          </p>
        )}
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

        {/* 누가 쓴 글인지에 맞춰 적는다.
            'AI가 쓴 초안이에요'가 늘 붙어 있어서, 바로 아래에서 "동의하지
            않으셔서 자동 초안은 만들지 않아요"라고 말해 놓고 위에서는 AI가 썼다고
            했다. 한 화면 안에서 서로 반대되는 말이라 어느 쪽이 맞는지 알 수 없다.
            사람 검수가 최종이라는 규칙(원칙 3)은 어느 경우에도 그대로다. */}
        <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-500">
          {aiAllowed
            ? ai === 'done'
              ? 'AI가 쓴 초안이에요. 복지사가 확인하고 고친 내용만 최종 기록이 됩니다.'
              : '복지사가 확인하고 고친 내용만 최종 기록이 됩니다. 아래 버튼을 누르면 AI가 초안을 써 드려요.'
            : '복지사가 직접 적는 칸이에요. 여기 적은 내용이 그대로 최종 기록이 됩니다.'}
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
