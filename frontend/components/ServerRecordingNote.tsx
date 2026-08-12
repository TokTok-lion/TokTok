'use client';

import { useEffect, useState } from 'react';
import { formatBytes } from '@/lib/recordingStore';
import { fetchServerRecording, findServerRecording, type ServerRecording } from '@/lib/recordingSync';
import { mmssOrUnknown } from '@/lib/recorder';
import { recordingReplaced } from '@/lib/transcribeJob';

/**
 * 기관 저장소에 있는 이 회기의 녹음 — 받아 올 수 있다고 알려 준다.
 *
 * 회기를 다른 태블릿에서 이어받으면 전사·이야기·가사는 따라오지만 녹음은
 * 따라오지 않는다. 파일이 크기도 하거니와, 원음성은 여는 일 자체가 기록에
 * 남아야 하는 자료라(명세의 권한 행렬 — 기본 미열람) 말없이 내려받아 두는
 * 것이 옳지 않다.
 *
 * 그래서 있다는 사실만 먼저 알리고, 누르면 그때 받는다. 받고 나면 출처
 * 되짚어 듣기가 이 기기에서도 살아난다.
 */
export function ServerRecordingNote() {
  const [found, setFound] = useState<ServerRecording | null>(null);
  const [stage, setStage] = useState<'idle' | 'working' | 'error'>('idle');

  useEffect(() => {
    let alive = true;
    void findServerRecording()
      .then((r) => {
        if (alive) setFound(r);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (!found) return null;

  const get = async () => {
    setStage('working');
    const ok = await fetchServerRecording().catch(() => false);
    if (!ok) {
      setStage('error');
      return;
    }
    // 받아 온 것을 화면들이 알아야 한다 — 재생기도, 전사 쪽 상태도.
    await recordingReplaced();
    setStage('idle');
  };

  return (
    <div className="mt-3 rounded-[14px] bg-surface-sunk p-3.5">
      <p className="text-[0.9375rem] font-bold leading-relaxed text-ink-900">
        이 회기의 녹음이 기관 저장소에 있어요
      </p>
      <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-500">
        {mmssOrUnknown(found.seconds)} · {formatBytes(found.bytes)} · 다른 태블릿에서
        녹음한 것이에요. 받아 오시면 출처를 눌러 어르신 말씀을 다시 들으실 수
        있어요.
      </p>

      <button
        type="button"
        onClick={() => void get()}
        disabled={stage === 'working'}
        className="mt-3 min-h-[52px] w-full rounded-[14px] border-2 border-brand-300 bg-surface-strong text-[1rem] font-bold text-brand-800 disabled:opacity-70"
      >
        {stage === 'working' ? '받아 오는 중…' : '이 기기로 받아 오기'}
      </button>

      {stage === 'error' ? (
        <p role="alert" className="mt-2 text-[0.875rem] font-bold text-danger-600">
          받아 오지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.
        </p>
      ) : null}

      {/* 여는 일이 기록에 남는다는 것을 숨기지 않는다. 어르신의 목소리다. */}
      <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-500">
        어르신 원음성이라, 받아 오신 기록이 기관 감사로그에 남아요. 보관기간이
        지나면 기관 저장소에서도 자동으로 지워집니다.
      </p>
    </div>
  );
}
