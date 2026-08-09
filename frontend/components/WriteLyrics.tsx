'use client';

import { useState } from 'react';
import { CONSENT_FALLBACK, hasConsent, lyricInputs } from '@/lib/domain';
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

  const basis = lyricInputs(s.story);
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

  return (
    <>
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
