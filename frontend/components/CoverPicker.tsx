'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArtBox } from '@/components/Art';
import { COVER_CHOICES, sceneForTopic } from '@/lib/scenes';

/**
 * 앨범 그림 고르기 (덱에 없는 화면).
 *
 * 왜 만들었나. 그림은 주제 열쇠말로 정해지는데(lib/scenes.ts), 주제는 복지사가
 * 자유롭게 타이핑하고 열쇠말은 스물셋뿐이다. 못 덮는 이야기가 늘 남는다.
 * 그런데 지금까지는 틀려도 손댈 자리가 없었다 — '설' 한 글자가 건설 현장
 * 이야기에 송편을 붙여 놓았을 때, 아무도 그걸 바꿀 수 없었고 그래서 아무도
 * 신고하지 않았다.
 *
 * 이 그림은 어르신 본인의 이야기 옆에 붙는다. 잘못된 그림은 그 이야기를
 * 잘못 대변한다. 고르는 자리는 그래서 있다.
 *
 * 맨 앞은 '주제에 맞춰 자동'이다. 고른 것을 무르는 길이 없으면 한 번 고른
 * 뒤로는 주제를 고쳐도 그림이 따라오지 않는다 — 무르는 길이 곧 기본값이다.
 */
export function CoverPicker({
  topic,
  cover,
  onPick,
  onClose,
}: {
  topic: string | null;
  /** 지금 고른 그림. null 이면 주제에 맡긴 상태. */
  cover: string | null;
  onPick: (id: string | null) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // 열리면 닫기 단추에 초점을 둔다. 낭독으로 듣는 사람이 시트가 열린 것을
  // 알아야 하고, ESC 로 닫는 사람에게도 시작점이 필요하다.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 자동일 때 실제로 어떤 그림이 오는지 미리 보여 준다. '자동'이라고만 적으면
  // 무엇으로 돌아가는지 모른 채 고르게 된다.
  const auto = sceneForTopic(topic);

  const body = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="앨범 그림 고르기"
      className="fixed inset-0 z-[70] flex items-end justify-center"
    >
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 bg-ink-900/40" />

      <div className="relative mx-auto flex max-h-[86vh] w-full max-w-[440px] flex-col rounded-t-[24px] bg-surface-strong px-5 pb-7 pt-5">
        <div className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-hairline" />

        <p className="shrink-0 text-[1.125rem] font-extrabold text-ink-900">앨범 그림 고르기</p>
        <p className="mt-1 shrink-0 text-[0.9375rem] leading-relaxed text-ink-500">
          어르신 이야기와 맞지 않으면 바꿔 주세요. 노래와 보관함에 이 그림이 붙어요.
        </p>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {/* 자동으로 되돌리는 줄. 다른 것과 모양을 달리해 '고르는 그림 하나'가
              아니라 '맡기는 상태'라는 것이 보이게 둔다. */}
          <button
            type="button"
            onClick={() => onPick(null)}
            aria-pressed={cover === null}
            className={`flex w-full items-center gap-3.5 rounded-[16px] border-2 p-3 text-left ${
              cover === null ? 'border-brand-700 bg-brand-50' : 'border-hairline bg-surface'
            }`}
          >
            <ArtBox
              name={auto.art}
              alt=""
              className="h-[64px] w-[64px] shrink-0 rounded-[12px] object-cover"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[1rem] font-extrabold text-ink-900">주제에 맞춰 자동</span>
              <span className="mt-0.5 block text-[0.875rem] text-ink-500">
                지금은 「{auto.label}」 그림이에요
              </span>
            </span>
            {cover === null ? <Picked /> : null}
          </button>

          <p className="mt-5 text-[0.875rem] font-bold text-ink-500">직접 고르기</p>

          <ul className="mt-2 grid grid-cols-3 gap-2.5">
            {COVER_CHOICES.map((s) => {
              const on = cover === s.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onPick(s.id)}
                    aria-pressed={on}
                    className={`w-full rounded-[14px] border-2 p-1.5 ${
                      on ? 'border-brand-700 bg-brand-50' : 'border-transparent bg-surface'
                    }`}
                  >
                    <span className="relative block">
                      <ArtBox
                        name={s.art}
                        // 그림 자체가 고르는 근거다. 낭독으로 듣는 사람에게는
                        // 이 문장이 그림 전부이므로 여기서는 alt 를 비우지 않는다.
                        alt={s.alt}
                        className="aspect-square w-full rounded-[10px] object-cover"
                      />
                      {on ? (
                        <span className="absolute right-1 top-1">
                          <Picked />
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1.5 block text-center text-[0.8125rem] font-bold leading-tight text-ink-700">
                      {s.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="mt-4 min-h-[60px] w-full shrink-0 rounded-[14px] bg-brand-700 text-[1.0625rem] font-extrabold text-white"
        >
          다 골랐어요
        </button>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(body, document.body) : null;
}

/** 고른 것 표시. 색만으로 알리지 않으려고 모양(체크)을 함께 쓴다. */
function Picked() {
  return (
    <span
      aria-hidden="true"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
