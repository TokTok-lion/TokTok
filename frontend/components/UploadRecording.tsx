'use client';

import { useRef, useState } from 'react';
import { CONVERT_MAX_SECONDS, toTranscribable } from '@/lib/audioConvert';
import { mmss } from '@/lib/recorder';
import { saveUploaded } from '@/lib/recordingStore';

/**
 * 밖에서 녹음해 온 파일을 이 회기의 녹음으로 올린다 (덱에 없는 화면).
 *
 * 왜 만들었나. 태블릿을 어르신 앞 탁자에 놓고 받은 소리는, 요양기관 방의
 * 소음과 어르신의 작은 발화 앞에서 잘 버티지 못한다. 전사가 아쉬운 이유의
 * 상당 부분이 모델이 아니라 마이크다 — 어떤 모델도 안 들린 소리를 살리지는
 * 못한다. 제대로 된 녹음기로 받아 온 소리를 쓸 수 있어야 한다.
 *
 * 올린 파일은 '이 기기의 녹음'이 된다(recordingStore.saveUploaded). 그래야
 * 전사·출처 되짚어 듣기·보관기간·동의 철회 시 삭제가 그대로 적용된다.
 *
 * ── 동의를 여기서 한 번 더 확인하는 이유
 *
 * 앱이 녹음할 때는 C-01(녹음)이 마이크 앞을 지킨다. 그런데 올리는 파일은 그
 * 앞단을 건너뛴다 — 언제 어디서 누가 녹음한 것인지 앱은 알 수 없다. 동의
 * 없이 녹음된 것일 수도 있고, 다른 어르신의 목소리일 수도 있다. 그래서
 * 파일을 고르기 전에 복지사에게 명시적으로 확인받는다. 체크 하나가 그 사실을
 * 대신 보증하지는 않지만, 적어도 묻지 않고 넘어가지는 않는다.
 */

/** 화면에 적을 만큼만. 실제로 받을 수 있는 것은 audioConvert 가 정한다. */
const ACCEPT = 'audio/*,.m4a,.mp3,.wav,.flac,.ogg,.webm';

type Stage =
  | { kind: 'idle' }
  | { kind: 'working'; note: string }
  | { kind: 'error'; note: string }
  // seconds 가 null 이면 길이를 못 쟀다는 뜻이다. 0 으로 바꿔 놓지 않는다 —
  // 「0:00 녹음을 올렸어요」는 재지도 않고 쟀다고 말하는 것이다.
  | { kind: 'done'; seconds: number | null; converted: boolean };

export function UploadRecording({ onSaved }: { onSaved?: () => void }) {
  const [agreed, setAgreed] = useState(false);
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const input = useRef<HTMLInputElement | null>(null);

  const pick = async (file: File) => {
    setStage({ kind: 'working', note: '녹음을 읽고 있어요' });

    const out = await toTranscribable(file);
    if (!out.ok) {
      const len = out.seconds ? ` (${mmss(Math.round(out.seconds))})` : '';
      setStage({
        kind: 'error',
        note:
          out.reason === 'tooLong'
            ? `이 녹음은 너무 길어 이 기기에서 바꾸지 못해요${len}. ` +
              `${Math.round(CONVERT_MAX_SECONDS / 60)}분 이내로 나누시거나, wav·mp3 로 바꿔서 올려 주세요.`
            : out.reason === 'unsupported'
              ? '이 파일은 소리로 읽지 못했어요. wav·mp3·m4a 로 된 녹음을 올려 주세요.'
              : '녹음을 바꾸지 못했어요. wav 나 mp3 로 바꿔서 올려 주시면 그대로 쓸 수 있어요.',
      });
      return;
    }

    setStage({ kind: 'working', note: '기기에 저장하고 있어요' });
    const saved = await saveUploaded(out.blob, out.seconds);
    if (!saved) {
      setStage({
        kind: 'error',
        note: '이 기기에 저장하지 못했어요. 저장 공간을 확인해 주세요.',
      });
      return;
    }
    setStage({
      kind: 'done',
      seconds: out.seconds === null ? null : Math.round(out.seconds),
      converted: out.converted,
    });
    onSaved?.();
  };

  return (
    <div className="rounded-[20px] bg-surface p-4 shadow-[0_2px_10px_rgba(122,84,46,0.06)]">
      <p className="text-[1.0625rem] font-extrabold text-ink-900">녹음본 올리기</p>
      <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-500">
        녹음기나 휴대폰으로 받아 두신 파일이 있으면 올려서 쓰실 수 있어요. 태블릿
        마이크보다 소리가 또렷해 글로 옮기기도 잘 됩니다.
      </p>

      {/*
        동의 확인. 파일을 고르기 전에 나온다 — 고른 뒤에 물으면 이미 읽은
        뒤이고, 그때 '아니오'는 물어본 시늉일 뿐이다.
      */}
      <label className="mt-3.5 flex min-h-[60px] cursor-pointer items-start gap-3 rounded-[14px] bg-surface-sunk p-3.5">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-6 w-6 shrink-0 accent-brand-700"
        />
        <span className="text-[0.9375rem] font-bold leading-relaxed text-ink-900">
          이 녹음은 어르신께 여쭙고 동의를 받은 뒤 녹음한 것입니다
        </span>
      </label>

      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          // 같은 파일을 다시 고를 수 있게 비운다. 안 비우면 두 번째 선택에서
          // change 가 안 뜬다.
          e.target.value = '';
          if (f) void pick(f);
        }}
      />

      <button
        type="button"
        disabled={!agreed || stage.kind === 'working'}
        onClick={() => input.current?.click()}
        className="mt-3 min-h-[60px] w-full rounded-[14px] bg-brand-700 text-[1.0625rem] font-extrabold text-white disabled:bg-hairline disabled:text-ink-500"
      >
        {stage.kind === 'working' ? stage.note + '…' : '녹음 파일 고르기'}
      </button>

      {!agreed ? (
        <p className="mt-2 text-center text-[0.875rem] text-ink-500">
          위 확인에 표시하시면 파일을 고르실 수 있어요
        </p>
      ) : null}

      {stage.kind === 'error' ? (
        <p
          role="alert"
          className="mt-3 rounded-[14px] bg-surface-sunk px-3.5 py-3 text-[1rem] font-bold leading-relaxed text-ink-900"
        >
          {stage.note}
        </p>
      ) : null}

      {stage.kind === 'done' ? (
        <p
          role="status"
          className="mt-3 rounded-[14px] bg-surface-sunk px-3.5 py-3 text-[1rem] font-bold leading-relaxed text-ink-900"
        >
          {stage.seconds === null
            ? '녹음을 올렸어요. 길이는 확인하지 못했지만 소리는 그대로 저장했어요.'
            : `${mmss(stage.seconds)} 녹음을 올렸어요.`}{' '}
          이제 이 녹음이 이번 회기의 녹음이에요.
          {/* 바꿨다는 사실을 숨기지 않는다. 원본과 다른 파일이 저장돼 있고,
              나중에 소리를 견줄 일이 생길 수 있다. */}
          {stage.converted ? ' (전사에 맞는 형식으로 바꿔서 저장했어요)' : ''}
        </p>
      ) : null}
    </div>
  );
}
