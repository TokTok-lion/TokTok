'use client';

import { useEffect, useState } from 'react';
import { Card } from './ui';
import { forgetRecording, mmss, useRecorder } from '@/lib/recorder';
import { RETENTION_DAYS, formatBytes, recordingTotals, retentionLeftDays } from '@/lib/recordingStore';

/**
 * 이 기기에 남은 녹음.
 *
 * 음성을 저장하면서 지우는 길을 안 만들면, 지워야 할 때 지울 수 없다.
 * 어디에 무엇이 얼마나 남아 있는지 보이고, 한 번에 지울 수 있어야 한다.
 *
 * 보관기간을 함께 보여 준다. "언젠가는 사라진다"가 화면에 없으면 사람들은
 * 영원히 쌓이는 줄 안다 — 실제로 무기한 보관은 금지다.
 */
export function StoredAudio() {
  const rec = useRecorder();
  const [asking, setAsking] = useState(false);
  /*
   * 기기 전체에 몇 개가 남아 있는지.
   *
   * 아래 재생기는 '이 회기' 녹음 하나만 보여 준다. 그런데 이 화면이 약속하는
   * 것은 "어디에 무엇이 얼마나 남아 있는지"다 — 회기별로 쌓이게 바뀌었으니
   * 하나만 보여 주면 나머지가 없는 것처럼 읽힌다.
   */
  const [totals, setTotals] = useState<{ count: number; bytes: number } | null>(null);
  useEffect(() => {
    void recordingTotals().then(setTotals);
  }, [rec.savedAt, rec.bytes]);

  if (!rec.url || !rec.savedAt) return null;

  const left = retentionLeftDays(rec.savedAt);

  return (
    <>
      <h2 className="mt-6 text-[1.1875rem] font-extrabold text-ink-900">
        이 기기에 남은 녹음
      </h2>
      <Card className="mt-3 p-4">
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block text-[1.0625rem] font-extrabold text-ink-900">
              {mmss(rec.seconds)} · {formatBytes(rec.bytes)}
            </span>
            <span className="block text-[0.875rem] text-ink-500">
              {left}일 뒤 자동으로 지워져요 (보관 {RETENTION_DAYS}일)
            </span>
          </span>
        </div>

        <audio src={rec.url} controls preload="metadata" className="mt-3 w-full" />

        {totals && totals.count > 1 ? (
          <p className="mt-2 text-[0.875rem] font-bold leading-relaxed text-ink-700">
            이 기기에는 지난 회기 것까지 녹음 {totals.count}개 ·{' '}
            {formatBytes(totals.bytes)}가 남아 있어요. 위 재생기는 이번 회기
            녹음이고, 아래 버튼도 이번 회기 것만 지웁니다. 전부 지우시려면 아래
            「이 기기의 기록 지우기」를 써 주세요.
          </p>
        ) : null}

        <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-500">
          이 녹음은 이 기기에만 있고 서버로 보내지 않았어요.
        </p>

        {asking ? (
          <div className="mt-3 rounded-[12px] bg-surface-sunk p-3.5">
            <p className="text-[0.9375rem] font-bold text-ink-900">
              지우면 되돌릴 수 없어요.
            </p>
            <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-700">
              이야기의 출처를 눌러도 더는 들을 수 없게 됩니다.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAsking(false)}
                className="min-h-[48px] rounded-[12px] border border-hairline bg-surface-strong text-[0.9375rem] font-bold text-ink-700"
              >
                그대로 두기
              </button>
              <button
                type="button"
                onClick={() => {
                  void forgetRecording();
                  setAsking(false);
                }}
                className="min-h-[48px] rounded-[12px] bg-danger-600 text-[0.9375rem] font-bold text-white"
              >
                지우기
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="mt-3 min-h-[52px] w-full rounded-[14px] border border-hairline bg-surface text-[1rem] font-bold text-danger-600"
          >
            지금 지우기
          </button>
        )}
      </Card>
    </>
  );
}
