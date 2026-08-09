'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card } from './ui';
import {
  CONSENT_FALLBACK,
  CONSENT_LABELS,
  type ConsentKind,
  type ConsentState,
  type Consents,
} from '@/lib/domain';

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
 * 다섯 가지를 한 번에 받는 '전체 동의' 버튼은 두지 않는다. 목적별 분리
 * 동의가 이 제품의 규칙이다 (원칙 4 · F-SW-CONS-009).
 */
export const CONSENT_ORDER: ConsentKind[] = [
  'recording',
  'externalAi',
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
