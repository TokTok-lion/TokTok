'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Card } from './ui';
import {
  CONSENT_FALLBACK,
  CONSENT_LABELS,
  type ConsentKind,
  type ConsentState,
  type Consents,
} from '@/lib/domain';
import {
  dismissPendingConsent,
  retryPendingConsent,
  useSession,
  type PendingConsent,
} from '@/lib/store';

/**
 * 동의 — 여쭙는 자리와 막힌 자리를 잇는 공통 조각.
 *
 * 동의는 기기가 아니라 어르신께 붙는 값이라, 회기를 시작하면 전부 unset 으로
 * 선다(store.beginSession). 옳은 기본값이다 — 모르는 것은 허용이 아니다.
 * 그런데 그 뒤가 비어 있었다: 녹음·사실 추출·가사·곡 생성이 차례로 "동의가
 * 없어 하지 않아요"라고만 말하고, 동의를 여쭙는 자리가 어디인지는 어디에도
 * 없었다. 막힌 화면이 갈 곳을 가리키지 않으면 그 화면은 막다른 길이다.
 *
 * 그래서 여기에 세 가지를 모아 둔다 — 동의를 여쭙는 자리(CONSENT_SCREEN),
 * 한 건씩 여쭙는 조각(ConsentAsk), 막혔을 때 그 자리를 가리키는 안내
 * (ConsentGate). 문구와 순서가 화면마다 갈라지지 않게 한곳에 둔다.
 */

/** 동의를 여쭙는 자리. 어르신과 마주 앉기 직전인 회기 준비 화면 하나뿐이다. */
export const CONSENT_SCREEN = '/session/checklist';

/**
 * 여쭙는 순서 — 회기에서 먼저 필요한 것부터.
 *
 * 다섯 가지를 한 번에 받는 '전체 동의' 버튼은 없다. 목적별 분리 동의가 이
 * 제품의 규칙이다 (원칙 4 · F-SW-CONS-009).
 *
 * 회기 준비 화면에는 이 중 앞의 둘(SESSION_CONSENTS)을 함께 누르는 버튼이
 * 있다. 왜 그것만은 묶어도 되는지는 그 버튼 자리에 적어 두었다
 * (app/session/checklist/page.tsx). 뒤의 셋(RESULT_CONSENTS)은 어디서도 함께
 * 눌리지 않는다 — 노래를 들어 보고 하나씩 정하시는 값이고, 그중 홍보 공개는
 * 필수화 자체가 막혀 있다(lib/center.ts · canRequireConsent).
 */
export const CONSENT_ORDER: ConsentKind[] = [
  'recording',
  'externalAi',
  'facilityPlay',
  'familyShare',
  'promotion',
];

/**
 * 회기를 시작하기 전에 여쭤야 하는 것.
 *
 * 다섯 가지를 모두 앉은 자리에서 여쭙게 했더니 회기 준비 화면에 확인할 것이
 * 아홉 개가 됐다. 그 길이 자체가 위험하다 — 길면 읽지 않고 넘기게 되고,
 * 그러면 동의는 형식이 된다. 묶음 동의를 금지한 이유(F-SW-CONS-009)가
 * 정확히 그것인데, 하나씩 물어도 한꺼번에 아홉 개면 결과가 같아진다.
 *
 * 그래서 시점으로 나눈다. 이 둘은 지금 없으면 회기가 진행되지 않는다 —
 * 마이크가 열리지 않고, 말씀이 글이 되지 않는다.
 */
export const SESSION_CONSENTS: ConsentKind[] = ['recording', 'externalAi'];

/**
 * 결과물을 어떻게 쓸지 — 곡이 나온 뒤에 여쭙는다.
 *
 * 시설에서 함께 들을지, 가족에게 보여드릴지, 외부에 공개할지는 전부 '만들어진
 * 노래'에 대한 물음이다. 노래가 없는 자리에서 미리 답을 받아 두면 무엇에
 * 동의하시는지 알 수 없는 채로 답하시게 된다. 물어야 할 것을 물어야 할 때
 * 묻는 편이 개수를 줄이는 것보다 중요하다.
 */
export const RESULT_CONSENTS: ConsentKind[] = [
  'facilityPlay',
  'familyShare',
  'promotion',
];

/** 무엇에 쓰는지. 목적을 말하지 않고 받은 것은 동의가 아니다. */
export const CONSENT_PURPOSE: Record<ConsentKind, string> = {
  recording: '대화를 녹음하고 글로 옮기는 데 사용해요.',
  externalAi: '전사·이야기 정리·가사 생성을 위해 외부 사업자에 보내요.',
  facilityPlay: '센터 안에서 노래를 함께 듣는 범위를 정해요.',
  familyShare: '가족에게 곡·가사·사진을 보여줄 범위를 정해요.',
  promotion: '외부 홍보나 공모전에 쓰는 것을 따로 정해요.',
};

/**
 * 지금 상태를 사람 말로.
 *
 * '아직 여쭙지 않음'과 '동의하지 않으심'을 한 칸으로 합치지 않는다. 앞은
 * 복지사가 할 일이 남은 것이고, 뒤는 어르신의 결정이다. 스위치 하나로
 * 뭉뚱그리면 여쭙지 않은 것이 거절한 것처럼 보인다.
 */
export function consentStateLabel(state: ConsentState): string {
  if (state === 'granted') return '동의하셨어요';
  if (state === 'unset') return '아직 여쭙지 않았어요';
  // denied 와 withdrawn 은 어르신이 결정하신 시점만 다르고, 지금 할 수 있는
  // 일은 같다 — 하지 않는다.
  return '동의하지 않으셨어요';
}

/** 내린 결정 그대로. 목록이 "무엇을 못 남겼는지" 말할 때 쓴다. */
function decisionLabel(state: ConsentState): string {
  if (state === 'granted') return '동의하셨어요';
  if (state === 'withdrawn') return '동의를 거두셨어요';
  if (state === 'denied') return '동의하지 않으셨어요';
  return '아직 여쭙지 않았어요';
}

/** ISO → '3월 4일 오후 2:07'. 언제 일인지 말해야 복지사가 상황을 떠올린다. */
function decidedAtLabel(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const half = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${half} ${h12}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
}

/**
 * 기관 기록에 남기지 못한 동의 결정.
 *
 * 이 목록이 없던 동안, 철회를 눌렀는데 통신이 끊기면 화면은 아무 말도 하지
 * 않았다. 스위치는 꺼진 채였고 복지사는 거둔 줄 알았지만 서버 행은 granted
 * 였다. 다음 회기에 그 값이 되살아나 원음성이 외부로 나갔다 — 화면이 조용한
 * 것이 사고의 절반이었다.
 *
 * 그래서 세 가지를 말한다: 누구의 어느 항목인지, 지금 어디까지 남았는지,
 * 그리고 다시 시도할 길. 어르신을 바꿔도 목록은 남으므로 결정 당시의 호칭을
 * 그대로 쓴다.
 *
 * 두 화면(회기 준비·더보기)이 같은 말을 하도록 여기 한 곳에 둔다.
 */
export function UnrecordedConsents({ className = 'mt-4' }: { className?: string }) {
  const { s } = useSession();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [confirmDrop, setConfirmDrop] = useState<string | null>(null);

  const list = s.pendingConsents;
  if (!list.length) return null;

  const keyOf = (p: PendingConsent) => `${p.participantId}:${p.kind}`;

  const retry = async (p: PendingConsent) => {
    const key = keyOf(p);
    setBusy(key);
    // 실패 문구를 먼저 지운다. 지난 실패가 새 시도 옆에 남아 있으면 방금
    // 무엇이 일어났는지 읽을 수 없다.
    setFailed((f) => {
      const next = { ...f };
      delete next[key];
      return next;
    });
    const r = await retryPendingConsent(p);
    setBusy(null);
    if (!r.ok) {
      setFailed((f) => ({
        ...f,
        [key]: r.reason ?? '아직 기관 기록에 남기지 못했어요.',
      }));
    }
  };

  return (
    <Card className={`${className} border-2 border-brand-300 p-4`}>
      <p className="text-[1.0625rem] font-extrabold text-ink-900">
        기관 기록에 남기지 못한 동의 {list.length}건
      </p>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-700">
        아래 결정이 기관 기록에 닿지 못했어요. 이 태블릿에서는 그대로 지켜지지만,
        기관 기록과 다른 기기는 아직 이 결정을 모릅니다.
      </p>

      <ul className="mt-3 space-y-2.5">
        {list.map((p) => {
          const key = keyOf(p);
          const working = busy === key;
          return (
            <li key={key} className="rounded-[12px] bg-surface-sunk px-3.5 py-3">
              <p className="text-[0.9375rem] font-extrabold text-ink-900">
                {p.elderName} · {CONSENT_LABELS[p.kind]} — {decisionLabel(p.decision)}
              </p>
              <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-700">
                {p.keptOnDevice
                  ? '이 기기에는 남겼어요. 다시 시도해서 남기기 전까지 기관 기록에는 이전 값이 그대로 있어요.'
                  : '허용은 기록이 남아야 허용이라, 표시를 켜지 않고 되돌렸어요. 다시 시도해서 남으면 그때 켜집니다.'}
              </p>
              <p className="mt-1 text-[0.8125rem] text-ink-500">
                {decidedAtLabel(p.at)}에 누르셨어요
              </p>

              {failed[key] ? (
                <p className="mt-2 text-[0.875rem] font-bold text-danger-600">
                  {failed[key]} 통신을 확인하고 다시 눌러 주세요.
                </p>
              ) : null}

              {confirmDrop === key ? (
                <div className="mt-2.5 rounded-[12px] bg-surface px-3.5 py-3">
                  {/* 무엇을 포기하는지 적지 않으면, 경고를 치우는 버튼이 곧
                      동의를 되살리는 버튼이 된다. */}
                  <p className="text-[0.9375rem] leading-relaxed text-ink-900">
                    목록에서만 지워요. 기관 기록은 이전 값 그대로라, 다음 회기에는
                    그 값이 쓰입니다.
                  </p>
                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDrop(null)}
                      className="min-h-[52px] rounded-[14px] border-2 border-hairline bg-surface-strong text-[1rem] font-bold text-ink-700"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        dismissPendingConsent(p.participantId, p.kind);
                        setConfirmDrop(null);
                      }}
                      className="min-h-[52px] rounded-[14px] bg-danger-600 text-[1rem] font-bold text-white"
                    >
                      그래도 지우기
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  {/*
                    보내는 중이라는 표시는 글자로만 한다.
                    흐리게(opacity) 처리하면 흰 글자 대 brand-700 이 5.18:1 에서
                    약 3.15:1 로 떨어진다(0.7 을 surface-sunk 위에 합성해 계산).
                    보내는 순간이 짧다고 해도, 70~90대 어르신과 함께 보는 화면에서
                    읽을 수 없게 만들 이유가 없다 (NFR-A11Y-004).
                  */}
                  <button
                    type="button"
                    onClick={() => void retry(p)}
                    disabled={working}
                    className="min-h-[52px] rounded-[14px] bg-brand-700 px-3 text-[1rem] font-bold text-white"
                  >
                    {working ? '남기는 중…' : '다시 시도'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDrop(key)}
                    className="min-h-[52px] rounded-[14px] border-2 border-hairline bg-surface-strong px-3 text-[1rem] font-bold text-ink-700"
                  >
                    목록에서 지우기
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** 필요한 동의 중 아직 받지 못한 것. 없으면 빈 배열이다. */
export function missingConsents(
  consents: Consents,
  need: ConsentKind[],
): ConsentKind[] {
  return need.filter((k) => consents[k] !== 'granted');
}

/**
 * 한 건을 여쭙는 조각.
 *
 * '동의' / '동의 안 함'을 각각 누르게 한다. 스위치를 쓰지 않는 이유는 위
 * consentStateLabel 과 같다 — 스위치는 꺼진 상태 하나로 '아직 안 여쭤봄'과
 * '거절하심'을 함께 표현해 버린다.
 */
export function ConsentAsk({
  kind,
  state,
  onDecide,
}: {
  kind: ConsentKind;
  state: ConsentState;
  onDecide: (granted: boolean) => void;
}) {
  const granted = state === 'granted';
  const refused = state === 'denied' || state === 'withdrawn';

  const pick = (on: boolean, tone: 'leaf' | 'brand') =>
    `min-h-[52px] rounded-[14px] px-3 text-[1rem] font-bold ${
      on
        ? tone === 'leaf'
          ? 'bg-leaf-600 text-white'
          : 'bg-brand-700 text-white'
        : 'border-2 border-hairline bg-surface-strong text-ink-700'
    }`;

  return (
    <Card as="li" className="p-4">
      <p className="text-[1.125rem] font-extrabold text-ink-900">
        {CONSENT_LABELS[kind]}
      </p>
      <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-500">
        {CONSENT_PURPOSE[kind]}
      </p>

      <div
        role="group"
        aria-label={`${CONSENT_LABELS[kind]} 동의 여부`}
        className="mt-3 grid grid-cols-2 gap-2"
      >
        <button
          type="button"
          aria-pressed={granted}
          onClick={() => onDecide(true)}
          className={pick(granted, 'leaf')}
        >
          동의하셨어요
        </button>
        <button
          type="button"
          aria-pressed={refused}
          onClick={() => onDecide(false)}
          className={pick(refused, 'brand')}
        >
          동의 안 하셨어요
        </button>
      </div>

      {/* 거절이 손해로 느껴지면 그 동의는 자유로운 동의가 아니다. 거절했을 때
          무엇을 할 수 있는지 같은 자리에서 보인다 (F-SW-CONS-009). */}
      {granted ? null : (
        <p className="mt-3 rounded-[12px] bg-brand-50 px-3.5 py-2.5 text-[0.875rem] font-semibold leading-relaxed text-brand-800">
          {refused ? '대신 이렇게 해요 · ' : '동의하지 않으셔도 괜찮아요 · '}
          {CONSENT_FALLBACK[kind]}
        </p>
      )}
    </Card>
  );
}

/**
 * 막혔을 때 보여 주는 안내.
 *
 * 왜 못 하는지, 대신 무엇을 하는지, 그리고 동의를 여쭈러 어디로 가면 되는지
 * 세 가지를 한 화면에서 말한다. 마지막이 빠지면 복지사는 다섯 개 스위치가
 * 어디 있는지 모른 채 회기 한가운데서 멈춘다.
 */
export function ConsentGate({
  missing,
  title,
  why,
  children,
  className = 'mt-3',
}: {
  /** 아직 받지 못한 동의 (missingConsents 의 결과). */
  missing: ConsentKind[];
  title: string;
  /** 이 화면에서 왜 그 동의가 필요한지. */
  why?: ReactNode;
  /** 동의 없이도 실제로 할 수 있는 일 — 있으면 여기에 붙인다. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`${className} p-4`}>
      <p className="text-[1.0625rem] font-extrabold text-ink-900">{title}</p>

      <ul className="mt-2.5 space-y-2">
        {missing.map((kind) => (
          <li key={kind} className="rounded-[12px] bg-surface-sunk px-3.5 py-3">
            <p className="text-[0.9375rem] font-extrabold text-ink-900">
              {CONSENT_LABELS[kind]} · 동의 없음
            </p>
            <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-700">
              {CONSENT_FALLBACK[kind]}
            </p>
          </li>
        ))}
      </ul>

      {why ? (
        <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-ink-500">{why}</p>
      ) : null}

      <Link
        href={CONSENT_SCREEN}
        className="mt-3 flex min-h-[52px] w-full items-center justify-center rounded-[14px] border-2 border-brand-300 bg-surface-strong px-4 text-[1rem] font-bold text-brand-700"
      >
        회기 준비에서 동의 여쭙기
      </Link>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-500">
        어르신께 여쭙고 동의를 받으시면 여기서 바로 이어서 하실 수 있어요.
      </p>

      {children}
    </Card>
  );
}
