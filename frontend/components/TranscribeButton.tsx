'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Card } from './ui';
import { ConsentGate, missingConsents } from './ConsentGate';
import { hasConsent } from '@/lib/domain';
import { mmss } from '@/lib/recorder';
import { useSession } from '@/lib/store';
import { autoTranscribe, runTranscribe, useTranscribeStatus } from '@/lib/transcribeJob';

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
 *
 * 이 버튼은 자기가 무엇에 대해 말하는지를 밝혀야 한다. 예전에는 이미 지워진
 * 녹음에 대고 "옮겼어요 — 12줄"을 계속 띄웠다. 다시 녹음한 뒤에도 그대로였고,
 * 그래서 오늘 말씀이 이미 글이 된 줄 알고 다음 단계로 넘어갔다.
 */
export function TranscribeButton() {
  const { s } = useSession();
  const { job, origin, device, deviceRead, sent, resumableJob } = useTranscribeStatus();

  // 이 화면에 도착했는데 아직 안 옮긴 녹음이 있으면 여기서도 시작한다.
  // 보통은 인터뷰를 마치는 화면에서 이미 시작돼 있고, 그때는 조용히 지나간다.
  // 주소를 직접 치거나 새로고침으로 들어온 경우를 위한 자리다.
  useEffect(() => {
    void autoTranscribe();
  }, []);

  const canRecord = hasConsent(s.elder.consents, 'recording');
  const canSend = hasConsent(s.elder.consents, 'externalAi');

  // 못 하는 이유만 적고 끝내면 회기가 여기서 멈춘다. 동의를 여쭈러 갈 자리와,
  // 동의 없이 오늘 회기를 이어 갈 자리를 같은 화면에서 가리킨다.
  if (!canRecord || !canSend) {
    return (
      <ConsentGate
        missing={missingConsents(s.elder.consents, ['recording', 'externalAi'])}
        title="자동 전사를 하지 않아요"
        why="자동 전사는 어르신 목소리를 외부로 보내야 해서, 녹음과 외부 AI 전송에 모두 동의하셨을 때만 씁니다."
      >
        <p className="mt-3 border-t border-hairline pt-3 text-[0.9375rem] leading-relaxed text-ink-700">
          동의 없이 오늘 회기를 이어 가셔도 됩니다. 아래 &lsquo;전사 없이
          다음으로&rsquo;를 누르시면{' '}
          <Link
            href="/session/story"
            className="font-bold text-brand-700 underline"
          >
            이야기 정리
          </Link>
          로 가고, 거기서 어르신 말씀을 복지사가 직접 적어 이야기로 남길 수
          있어요.
        </p>
      </ConsentGate>
    );
  }

  const busy = job.kind === 'busy';
  // 새로 녹음한 뒤인가 — 아래 전사는 앞 녹음에서 나온 것이다.
  const stale = origin === 'otherRecording';
  const noRecording = deviceRead && device === null;

  const label = busy
    ? job.resumed
      ? '결과를 받아오는 중…'
      : '옮기는 중… 길면 1분 넘게 걸려요'
    : resumableJob
      ? '이어서 결과 받기'
      : stale
        ? '새 녹음에서 옮기기'
        : job.kind === 'done' && origin === 'thisRecording'
          ? '다시 옮기기'
          : '녹음에서 옮기기';

  return (
    <Card className="mt-3 p-4">
      <p className="text-[1rem] font-bold text-ink-900">녹음에서 옮기기</p>
      <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-500">
        인터뷰를 마치면 자동으로 시작해요. 어르신 목소리가 외부 서버로
        전송되고, 옮긴 뒤에는 복지사가 확인하고 고쳐 주세요.
      </p>

      {/* 다시 녹음하면 앞 녹음은 지워지는데(lib/recorder.ts) 전사는 남는다.
          그 사실을 여기서 말하지 않으면, 화면에 있는 글이 오늘 말씀인 줄 알고
          그대로 다음 단계로 간다. */}
      {stale ? (
        <p className="mt-3 rounded-[12px] border-2 border-brand-300 bg-brand-50 px-3.5 py-2.5 text-[0.9375rem] font-bold leading-relaxed text-brand-800">
          아래 전사는 <strong>앞 녹음</strong>에서 나온 것이에요. 그 뒤에 새로
          녹음하셨고(앞 녹음은 그때 지워졌습니다), 새 녹음은 아직 글로 옮기지
          않았습니다. 아래 버튼을 누르면 오늘 말씀으로 바뀌어요 — 지금 화면의
          글과 출처는 사라집니다.
        </p>
      ) : null}

      {/* 이미 서버로 넘어간 녹음. 다시 올리면 요금이 한 번 더 나가고 어르신
          목소리도 한 번 더 나간다. 그래서 무엇이 일어날지 먼저 적는다. */}
      {sent && !busy ? (
        <p className="mt-3 rounded-[12px] bg-surface-sunk px-3.5 py-2.5 text-[0.875rem] leading-relaxed text-ink-700">
          {resumableJob
            ? '이 녹음은 이미 서버로 보냈어요. 아래 버튼은 녹음을 다시 보내지 않고, 맡겨 둔 그 작업의 결과만 받아옵니다.'
            : '이 녹음은 이미 서버로 보낸 적이 있어요. 그래서 자동으로는 다시 보내지 않습니다 — 아래 버튼을 누르면 처음부터 다시 보냅니다.'}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void runTranscribe()}
        disabled={busy}
        className={`mt-3 min-h-[52px] w-full rounded-[14px] text-[1rem] font-bold ${
          busy
            ? 'pointer-events-none bg-surface-sunk text-ink-500'
            : 'bg-brand-700 text-white'
        }`}
      >
        {label}
      </button>

      {/* 자동으로 시작된 것이면 그렇다고 밝힌다. 아무도 안 눌렀는데 어르신
          목소리가 나가고 있으면, 그 사실을 화면이 말해야 한다. */}
      {busy && job.auto ? (
        <p className="mt-2 text-center text-[0.875rem] font-bold text-brand-700">
          인터뷰를 마치면서 자동으로 시작했어요
        </p>
      ) : null}

      {/* '옮겼어요'는 지금 기기에 있는 그 녹음에 대해서만 참이다. */}
      {job.kind === 'done' && origin === 'thisRecording' ? (
        <p className="mt-2 text-center text-[0.875rem] font-bold text-leaf-700">
          옮겼어요 — {job.lines}줄 · 녹음 {mmss(job.seconds)}
        </p>
      ) : null}

      {job.kind === 'error' ? (
        <p
          role="alert"
          className="mt-2 rounded-[12px] bg-surface-sunk px-3.5 py-2.5 text-[0.875rem] font-bold text-danger-600"
        >
          {job.message}
        </p>
      ) : null}

      {/* 녹음이 없는 회기에서 버튼만 눌러 보게 두지 않는다. */}
      {noRecording && !busy ? (
        <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-500">
          이 기기에 저장된 녹음이 없어요.{' '}
          <Link
            href="/session/interview"
            className="font-bold text-brand-700 underline underline-offset-2"
          >
            인터뷰 화면
          </Link>
          에서 녹음하시거나, 아래에서 복지사가 직접 적으셔도 됩니다.
        </p>
      ) : null}
    </Card>
  );
}
