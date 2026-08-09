'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SOURCE_LABELS, type Source } from '@/lib/domain';
import { mmss, useRecorder } from '@/lib/recorder';

/**
 * 출처 듣기.
 *
 * 이 앱의 핵심 주장은 "확인된 이야기에는 반드시 출처가 붙는다"이다. 그런데
 * 출처가 화면에 적힌 글자로만 있으면 그건 주장일 뿐이다. 눌러서 그 대목을
 * 실제로 들을 수 있어야 근거가 된다 — 어르신도, 가족도, 나중에 기록을 보는
 * 사람도 확인할 수 있어야 한다.
 *
 * 녹음이 없으면 왜 못 듣는지 말한다. 조용히 눌리지 않게 두면 고장으로 보인다.
 */
export function SourceChips({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState<Source | null>(null);
  const rec = useRecorder();
  const playable = rec.url !== null;

  return (
    <>
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="text-[0.875rem] text-ink-500">출처 ·</span>
        {sources.map((src, i) => {
          const voice = src.kind === 'voice' && typeof src.at === 'number';
          return (
            <button
              key={`${src.kind}-${i}`}
              type="button"
              onClick={() => setOpen(src)}
              // 음성 출처는 눌러서 들을 수 있다는 것이 보이게 밑줄을 준다
              className={`inline-flex min-h-[32px] items-center gap-1 rounded-full px-2.5 text-[0.875rem] font-bold ${
                voice
                  ? 'bg-brand-50 text-brand-800 underline underline-offset-2'
                  : 'bg-surface-sunk text-ink-700'
              }`}
            >
              {voice ? <PlayGlyph /> : null}
              {src.label}
            </button>
          );
        })}
      </span>

      {open ? (
        <Player source={open} url={rec.url} playable={playable} onClose={() => setOpen(null)} />
      ) : null}
    </>
  );
}

function Player({
  source,
  url,
  playable,
  onClose,
}: {
  source: Source;
  url: string | null;
  playable: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [ready, setReady] = useState(false);

  // 열리면 그 대목으로 옮기고 재생한다. 사용자가 이미 "듣겠다"고 누른
  // 뒤이므로 자동재생이 막히지 않는다.
  useEffect(() => {
    const el = ref.current;
    if (!el || !ready) return;
    const at = typeof source.at === 'number' ? source.at : 0;
    try {
      el.currentTime = Math.min(at, el.duration || at);
    } catch {
      /* 길이를 아직 모르면 처음부터 */
    }
    void el.play().catch(() => {});
  }, [ready, source.at]);

  const body = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="출처 듣기"
      className="fixed inset-0 z-[70] flex items-end justify-center"
    >
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-ink-900/40"
      />
      <div className="relative mx-auto w-full max-w-[440px] rounded-t-[24px] bg-surface-strong px-5 pb-7 pt-5">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-hairline" />

        <p className="text-[1.125rem] font-extrabold text-ink-900">
          {SOURCE_LABELS[source.kind]}
          {typeof source.at === 'number' ? ` ${mmss(source.at)}` : ''}
        </p>
        <p className="mt-1 text-[0.9375rem] text-ink-500">{source.label}</p>

        {source.kind !== 'voice' ? (
          <p className="mt-4 rounded-[12px] bg-surface-sunk px-3.5 py-3 text-[0.9375rem] leading-relaxed text-ink-700">
            음성이 아닌 출처예요. {SOURCE_LABELS[source.kind]}에서 나온 내용입니다.
          </p>
        ) : playable && url ? (
          <>
            <audio
              ref={ref}
              src={url}
              controls
              preload="metadata"
              onLoadedMetadata={() => setReady(true)}
              className="mt-4 w-full"
            />
            <p className="mt-2 text-[0.8125rem] text-ink-500">
              이 대목부터 재생돼요. 어르신께 다시 들려드릴 수 있어요.
            </p>
          </>
        ) : (
          <p className="mt-4 rounded-[12px] bg-surface-sunk px-3.5 py-3 text-[0.9375rem] leading-relaxed text-ink-700">
            이 회기에서 녹음한 음성이 없어 들을 수 없어요. 인터뷰 화면에서 녹음하면
            여기서 그 대목을 바로 들을 수 있습니다.
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 min-h-[52px] w-full rounded-[14px] border border-hairline bg-surface text-[1rem] font-bold text-ink-700"
        >
          닫기
        </button>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(body, document.body) : null;
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  );
}
