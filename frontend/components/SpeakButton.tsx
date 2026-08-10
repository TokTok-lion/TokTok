'use client';

import { useEffect } from 'react';
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
 *
 * 재생 중일 때는 speak 의 껐다 켜기에 기대지 않고 stop 을 직접 부른다.
 * '멈추기'라고 적힌 버튼이 멈추는 것 말고 다른 일을 할 여지를 남기지
 * 않는다 — 라벨과 반대로 동작하는 버튼을 한 번 겪었으면 충분하다.
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
  const { state, speak, stop } = useSpeak();

  // 문장이 바뀌면 앞 문장 읽기를 멈춘다. 인터뷰 화면은 이 버튼을 그대로 둔 채
  // text 만 갈아 끼우기 때문에(질문마다 새로 만들지 않는다), 다음 질문으로
  // 넘어가도 귀에는 앞 질문이 계속 났다. 0.85배속이라 한 문장이 5~8초씩
  // 가는데, 화면과 소리가 다른 질문을 말하면 어르신은 무엇에 답해야 하는지
  // 알 수 없다. 라벨도 '읽어주기'로 돌아온다 — 소리와 표시가 같이 움직인다.
  useEffect(() => stop, [text, stop]);

  if (state.kind === 'exhausted') return null;

  const busy = state.kind === 'loading';
  const playing = state.kind === 'playing';

  return (
    <>
      <button
        type="button"
        onClick={() => (playing ? stop() : void speak(text))}
        // 받는 동안은 잠근다. 여기서 한 번 더 누르면 같은 문장으로 요금이
        // 나가는 요청이 한 번 더 나간다(캐시는 첫 응답이 와야 채워진다).
        disabled={busy}
        aria-busy={busy}
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
