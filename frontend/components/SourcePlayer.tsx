'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SOURCE_LABELS, type Source } from '@/lib/domain';
import { mmss, useRecorder } from '@/lib/recorder';
import { RETENTION_DAYS } from '@/lib/recordingStore';
import { useTranscribeStatus, type TranscriptOrigin } from '@/lib/transcribeJob';

/**
 * 출처 듣기.
 *
 * 이 앱의 핵심 주장은 "확인된 이야기에는 반드시 출처가 붙는다"이다. 그런데
 * 출처가 화면에 적힌 글자로만 있으면 그건 주장일 뿐이다. 눌러서 그 대목을
 * 실제로 들을 수 있어야 근거가 된다 — 어르신도, 가족도, 나중에 기록을 보는
 * 사람도 확인할 수 있어야 한다.
 *
 * 그래서 무엇을 트는지가 이 화면의 전부다.
 *
 * 예전에는 출처 시각을 '지금 기기에 있는 녹음'에 무조건 감았다. 그런데
 * 인터뷰 화면에서 다시 녹음하면 앞 녹음은 지워지고 새 녹음이 그 자리에
 * 들어온다(lib/recorder.ts) — 전사와 이야기는 앞 녹음의 것 그대로 남는데
 * 소리만 바뀐다. 그 상태에서 '어르신 음성 0:42'를 누르면 새 녹음의 0:42 가
 * 재생됐다. 어르신과 가족 앞에서 근거로 들려드리는 자리에서 다른 소리가
 * 났다는 뜻이다.
 *
 * 지금은 전사가 나온 녹음과 기기에 있는 녹음이 같을 때만 재생한다. 아닐
 * 때는 재생 대신 사실을 적는다 — 못 듣는 것보다 나쁜 것은 다른 것을 듣고
 * 맞다고 믿는 것이다.
 */
export function SourceChips({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState<Source | null>(null);
  const rec = useRecorder();
  const { origin } = useTranscribeStatus();

  // 출처 시각은 전사에서 나온 값이라, 그 전사가 나온 녹음 위에서만 그 대목을
  // 가리킨다.
  const playable = origin === 'thisRecording' && rec.url !== null;

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
              // 들을 수 있을 때만 들을 수 있는 모양을 한다. 눌러 봐야 못
              // 듣는 밑줄은 고장으로 읽힌다.
              aria-label={
                voice && !playable
                  ? `${src.label} — 지금은 들려드릴 수 없어요. 눌러서 이유 보기`
                  : undefined
              }
              className={`inline-flex min-h-[32px] items-center gap-1 rounded-full px-2.5 text-[0.875rem] font-bold ${
                voice && playable
                  ? 'bg-brand-50 text-brand-800 underline underline-offset-2'
                  : 'bg-surface-sunk text-ink-700'
              }`}
            >
              {voice && playable ? <PlayGlyph /> : null}
              {src.label}
            </button>
          );
        })}
      </span>

      {open ? (
        <Player
          source={open}
          url={rec.url}
          playable={playable}
          origin={origin}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  );
}

/**
 * 왜 못 들려드리는지.
 *
 * "음성이 없어요" 한 줄로 뭉뚱그리지 않는다. 지워진 것과 새로 녹음한 것과
 * 아직 옮기지 않은 것은 복지사가 할 일이 저마다 다르다.
 */
function whyNot(origin: TranscriptOrigin, hasUrl: boolean): string {
  if (origin === 'thisRecording' && !hasUrl) {
    return '녹음을 여는 중이에요. 잠시 뒤 다시 눌러 주세요.';
  }
  switch (origin) {
    case 'checking':
      return '이 기기에 어떤 녹음이 있는지 확인하고 있어요. 잠시만 기다려 주세요.';
    case 'otherRecording':
      return (
        '이 출처는 앞 녹음의 대목이에요. 그 뒤에 다시 녹음하시면서 앞 녹음은 지워졌고, ' +
        '지금 이 기기에 있는 것은 새 녹음입니다 — 그대로 틀면 다른 대목이 나와요. ' +
        '전사 교정 화면에서 새 녹음을 글로 옮기시면 출처가 다시 맞춰집니다.'
      );
    case 'gone':
      return (
        `출처가 가리키는 녹음이 이 기기에 없어요. 지웠거나 보관기간(${RETENTION_DAYS}일)이 ` +
        '지나 정리된 녹음입니다. 글로 옮긴 내용은 그대로 남아 있어요.'
      );
    case 'unmarked':
      return (
        '이 출처가 어느 녹음에서 나온 것인지 확인할 수 없어요. 지금 기기에 있는 녹음을 ' +
        '그대로 틀면 다른 대목이 나올 수 있어 재생하지 않습니다.'
      );
    case 'none':
    default:
      return (
        '이 회기에는 녹음에서 옮긴 전사가 없어요. 이 출처는 둘러보기용 예시라 ' +
        '들려드릴 음성이 없습니다. 인터뷰 화면에서 녹음하고 글로 옮기시면, ' +
        '여기서 그 대목을 바로 들으실 수 있어요.'
      );
  }
}

function Player({
  source,
  url,
  playable,
  origin,
  onClose,
}: {
  source: Source;
  url: string | null;
  playable: boolean;
  origin: TranscriptOrigin;
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
            {whyNot(origin, url !== null)}
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
