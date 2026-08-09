'use client';

import { useSpeak } from '@/lib/tts';

/**
 * 이 문장 읽어주기.
 *
 * 어르신 중에는 글씨가 잘 안 보이는 분이 많고, 복지사가 한 시간 내내 큰
 * 소리로 읽어 드리는 것도 힘들다. 눌러서 들을 수 있으면 두 사람 다 편하다.
 *
 * 한도가 떨어지면 버튼이 조용히 사라진다. 눌러도 아무 일이 없는 버튼을
 * 남겨 두면 고장으로 보이고, 어르신 앞에서 오류 문구가 뜨는 것은 소리가
 * 없는 것보다 나쁘다.
 */
export function SpeakButton({
  text,
  label = '읽어주기',
  className = '',
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const { state, speak } = useSpeak();

  if (state.kind === 'exhausted') return null;

  const busy = state.kind === 'loading';
  const playing = state.kind === 'playing';

  return (
    <>
      <button
        type="button"
        onClick={() => void speak(text)}
        disabled={busy}
        aria-label={playing ? `${label} 멈추기` : label}
        className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border-2 px-4 text-[0.9375rem] font-bold ${
          playing
            ? 'border-brand-500 bg-brand-50 text-brand-800'
            : 'border-leaf-300 bg-surface-strong text-leaf-700'
        } ${className}`}
      >
        {playing ? <StopGlyph /> : <SpeakerGlyph />}
        {busy ? '준비 중…' : playing ? '멈추기' : label}
      </button>

      {state.kind === 'error' ? (
        <span role="alert" className="ml-2 text-[0.875rem] font-bold text-danger-600">
          {state.message}
        </span>
      ) : null}
    </>
  );
}

function SpeakerGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6.5 9H3v6h3.5L11 19z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 6a9 9 0 0 1 0 12" />
    </svg>
  );
}

function StopGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
