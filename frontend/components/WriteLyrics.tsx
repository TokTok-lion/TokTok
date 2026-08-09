'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CONSENT_FALLBACK, hasConsent } from '@/lib/domain';
import { findContradictions } from '@/lib/contradiction';
import { useLifeStory } from '@/lib/useLifeStory';
import { useSession } from '@/lib/store';

/**
 * 확인된 이야기로 가사 쓰기.
 *
 * 보내는 것은 lyricInputs() 를 통과한 문장뿐이다 — 어르신이 맞다고 확인했고
 * 출처가 붙은 것들. 미확인·제외 항목은 나가지 않는다. 이 걸러내기가 이
 * 서비스의 규칙 자체라, 화면에도 몇 개가 근거인지 적어 둔다.
 */
export function WriteLyrics() {
  const { s, set } = useSession();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const life = useLifeStory();

  // 생애사는 한 회기에 다 나오지 않는다. 기본을 "지금까지 모은 이야기"로
  // 두는 이유다 — 조각난 이야기로 만든 노래는 어르신께 얕게 들린다.
  const [scope, setScope] = useState<'all' | 'session'>('all');
  const basis = scope === 'all' ? life.all : life.thisSession;
  const allowed = hasConsent(s.elder.consents, 'externalAi');

  if (!allowed) {
    return (
      <p className="mt-3 rounded-[12px] bg-surface-sunk px-3.5 py-3 text-[0.875rem] leading-relaxed text-ink-700">
        <strong>외부 AI 전송</strong>에 동의하지 않으셔서 가사는 자동으로 만들지
        않아요. {CONSENT_FALLBACK.externalAi}
      </p>
    );
  }

  const run = async () => {
    setState('busy');
    setError(null);
    try {
      const res = await fetch('/api/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: s.topic,
          facts: basis.map((i) => i.text),
          style: s.style ?? 'ballad',
        }),
      });
      const json = (await res.json()) as {
        sections?: { label: string; tone: 'verse' | 'chorus'; lines: string[] }[];
        error?: string;
      };
      if (!res.ok || !json.sections) {
        setError(json.error ?? '가사를 만들지 못했어요.');
        setState('idle');
        return;
      }
      set('lyrics', json.sections);
      setState('done');
    } catch {
      setError('연결하지 못했어요.');
      setState('idle');
    }
  };

  // 고른 이야기들 사이에 어긋나는 것이 있으면 짚는다. 그대로 두면 어르신이
  // 열아홉에도 스물둘에도 공장에 들어간 노래가 나온다 — 본인 이야기인데
  // 앞뒤가 맞지 않는 노래를 드리게 된다.
  //
  // 막지는 않는다. 어느 쪽이 맞는지는 어르신만 아시고, 되묻기 전에 곡을
  // 만들어야 할 사정도 있다(원칙 1). 판단은 복지사가 한다.
  const clashes = findContradictions(
    basis.filter((f) => f.when !== '이번 회기'),
    basis.filter((f) => f.when === '이번 회기'),
  );

  const OPTIONS = [
    {
      id: 'all' as const,
      label: '지금까지 모은 이야기',
      count: life.all.length,
      note: '여러 회기가 모여 깊은 노래가 돼요',
    },
    {
      id: 'session' as const,
      label: '이번 회기만',
      count: life.thisSession.length,
      note: '오늘 들은 이야기로만',
    },
  ];

  return (
    <>
      {/* 무엇으로 만들지 먼저 고른다. 어떤 이야기가 노래가 되는지는
          복지사가 알고 있어야 하고, 화면에 개수로 보여야 안다. */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={scope === o.id}
            onClick={() => setScope(o.id)}
            className={`rounded-[14px] border-2 px-3 py-3 text-left ${
              scope === o.id
                ? 'border-brand-500 bg-brand-50'
                : 'border-hairline bg-surface'
            }`}
          >
            <span className="block text-[0.9375rem] font-extrabold text-ink-900">
              {o.label}
            </span>
            <span className="mt-0.5 block text-[0.875rem] font-bold text-brand-700">
              이야기 {o.count}개
            </span>
            <span className="mt-0.5 block text-[0.75rem] leading-snug text-ink-500">
              {o.note}
            </span>
          </button>
        ))}
      </div>

      {life.loading ? (
        <p className="mt-2 text-center text-[0.875rem] text-ink-500">
          지난 회기 이야기를 불러오는 중…
        </p>
      ) : null}

      {clashes.length ? (
        <div className="mt-3 rounded-[14px] border-2 border-brand-200 bg-brand-50 p-3.5">
          <p className="text-[0.9375rem] font-extrabold text-ink-900">
            서로 다른 이야기가 섞여 있어요
          </p>
          <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-700">
            {clashes[0].shared[0]} 이야기가 {clashes[0].values[0]}살과{' '}
            {clashes[0].values[1]}살로 갈립니다. 이대로 만들면 두 이야기가 한 노래에
            같이 들어가요.
          </p>
          <Link
            href="/session/story"
            className="mt-2.5 inline-flex min-h-[44px] items-center rounded-[12px] bg-brand-700 px-4 text-[0.9375rem] font-bold text-white"
          >
            이야기 정리에서 여쭤보기
          </Link>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void run()}
        disabled={state === 'busy' || basis.length === 0}
        className={`mt-3 min-h-[52px] w-full rounded-[14px] text-[1rem] font-bold ${
          state === 'busy' || basis.length === 0
            ? 'pointer-events-none bg-surface-sunk text-ink-500'
            : 'bg-brand-700 text-white'
        }`}
      >
        {basis.length === 0
          ? '확인된 이야기가 필요해요'
          : state === 'busy'
            ? '가사를 쓰는 중…'
            : state === 'done'
              ? '가사를 새로 썼어요 — 다시 쓰기'
              : `확인된 이야기 ${basis.length}개로 가사 만들기`}
      </button>

      {error ? (
        <p
          role="alert"
          className="mt-2 rounded-[12px] bg-surface-sunk px-3.5 py-2.5 text-[0.875rem] font-bold text-danger-600"
        >
          {error}
        </p>
      ) : null}
    </>
  );
}
