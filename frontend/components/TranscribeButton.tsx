'use client';

import { useState } from 'react';
import { Card } from './ui';
import { CONSENT_FALLBACK, hasConsent } from '@/lib/domain';
import { settled } from '@/lib/longJob';
import { loadRecording } from '@/lib/recordingStore';
import { mmss } from '@/lib/recorder';
import { useSession } from '@/lib/store';

/**
 * 녹음을 글로 옮기기.
 *
 * 어르신 목소리가 기기를 떠나는 유일한 지점이다. 그래서 두 동의를 모두
 * 확인한다 — 녹음(C-01)과 외부 AI 전송(C-02). 하나라도 없으면 버튼을 두지
 * 않고, 대신 복지사가 받아 적는 길을 안내한다.
 *
 * 전사 결과에는 단어마다 시각이 붙어 온다. 그 시각을 그대로 전사 줄의 출처로
 * 쓰기 때문에, 나중에 이야기 항목이 "어르신 음성 0:42"를 가리킬 수 있다.
 * 복지사가 일일이 시각을 적을 수는 없으니, 자동으로 붙지 않으면 출처 규칙은
 * 현실에서 지켜지지 않는다.
 */
export function TranscribeButton() {
  const { s, set } = useSession();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const canRecord = hasConsent(s.elder.consents, 'recording');
  const canSend = hasConsent(s.elder.consents, 'externalAi');

  if (!canRecord || !canSend) {
    return (
      <Card className="mt-3 p-4">
        <p className="text-[1rem] font-bold text-ink-900">자동 전사를 하지 않아요</p>
        <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-700">
          {!canRecord
            ? CONSENT_FALLBACK.recording
            : CONSENT_FALLBACK.externalAi}
        </p>
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-500">
          자동 전사는 어르신 목소리를 외부로 보내야 해서, 녹음과 외부 AI 전송에
          모두 동의하셨을 때만 씁니다.
        </p>
      </Card>
    );
  }

  const run = async () => {
    setState('busy');
    setError(null);
    setInfo(null);

    const rec = await loadRecording();
    if (!rec) {
      setError('이 기기에 녹음이 없어요. 인터뷰 화면에서 먼저 녹음해 주세요.');
      setState('idle');
      return;
    }

    const form = new FormData();
    form.append('file', rec.blob, 'interview.webm');

    try {
      // 긴 녹음은 한 요청 안에서 안 끝난다. 서버가 작업 번호를 주면 끝날
      // 때까지 대신 물어봐 준다.
      const res = await settled(
        await fetch('/api/transcribe', { method: 'POST', body: form }),
        (job) => `/api/transcribe?job=${encodeURIComponent(job)}`,
      );
      const json = (await res.json()) as {
        segments?: { id: string; text: string; at: number }[];
        error?: string;
      };
      if (!res.ok || !json.segments) {
        setError(json.error ?? '전사하지 못했어요.');
        setState('idle');
        return;
      }
      set('transcript', json.segments);
      setInfo(`${json.segments.length}줄 · 녹음 ${mmss(rec.seconds)}`);
      setState('done');
    } catch {
      setError('연결하지 못했어요. 녹음은 그대로 남아 있습니다.');
      setState('idle');
    }
  };

  return (
    <Card className="mt-3 p-4">
      <p className="text-[1rem] font-bold text-ink-900">녹음에서 자동으로 옮기기</p>
      <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-500">
        어르신 목소리가 외부 서버로 전송돼요. 옮긴 뒤에는 복지사가 확인하고
        고쳐 주세요.
      </p>

      <button
        type="button"
        onClick={() => void run()}
        disabled={state === 'busy'}
        className={`mt-3 min-h-[52px] w-full rounded-[14px] text-[1rem] font-bold ${
          state === 'busy'
            ? 'pointer-events-none bg-surface-sunk text-ink-500'
            : 'bg-brand-700 text-white'
        }`}
      >
        {state === 'busy'
          ? '옮기는 중… 길면 1분 넘게 걸려요'
          : state === 'done'
            ? '다시 옮기기'
            : '녹음에서 옮기기'}
      </button>

      {info ? (
        <p className="mt-2 text-center text-[0.875rem] font-bold text-leaf-700">
          옮겼어요 — {info}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mt-2 rounded-[12px] bg-surface-sunk px-3.5 py-2.5 text-[0.875rem] font-bold text-danger-600"
        >
          {error}
        </p>
      ) : null}
    </Card>
  );
}
