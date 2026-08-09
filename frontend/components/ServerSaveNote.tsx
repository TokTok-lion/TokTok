'use client';

import { useServerSave } from '@/lib/useServerSave';
import { useSession } from '@/lib/store';

/**
 * 기관 기록(서버)에 저장됐는지 한 줄로 알린다.
 *
 * 저장 버튼은 누르자마자 다음 화면으로 넘어간다. 통신을 기다리느라 어르신
 * 앞에서 화면이 멈추면 안 되기 때문이다. 대신 결과는 회기 상태에 남겨 두고
 * 여기서 뒤늦게 말해 준다 — 실패를 조용히 넘기면 복지사는 저장된 줄 알고
 * 넘어가고, 그 기록은 그 기기가 바뀌는 날 사라진다.
 *
 * 서버를 아예 안 쓰는 기기(off)에서는 아무 말도 하지 않는다. 그때는 기기
 * 저장이 정상이라 알릴 것이 없다.
 */
export function ServerSaveNote({ retry = false }: { retry?: boolean }) {
  const { s } = useSession();
  const server = useServerSave();

  // 방금 이 화면에서 누른 결과가 있으면 그쪽이 최신이다.
  const live = server.state;
  if (live.kind === 'saving') {
    return <Line tone="muted">기관 기록에 저장하는 중…</Line>;
  }

  const mark = live.kind === 'idle' ? s.serverSave : live;

  if (mark.kind === 'saved') {
    return <Line tone="ok">기관 기록에도 저장했어요</Line>;
  }
  if (mark.kind === 'error') {
    return (
      <div className="rounded-[12px] bg-surface-sunk px-3.5 py-3">
        <p role="alert" className="text-[0.875rem] font-bold leading-relaxed text-danger-600">
          이 기기에는 저장됐어요. 기관 기록 저장은 실패했습니다 — {mark.reason}
        </p>
        {retry ? (
          <button
            type="button"
            onClick={() => void server.save()}
            className="mt-2 min-h-[44px] w-full rounded-[12px] border border-hairline bg-surface text-[0.9375rem] font-bold text-ink-700"
          >
            다시 저장하기
          </button>
        ) : null}
      </div>
    );
  }
  return null;
}

function Line({ children, tone }: { children: string; tone: 'ok' | 'muted' }) {
  return (
    <p
      className={`text-center text-[0.875rem] font-bold ${
        tone === 'ok' ? 'text-leaf-700' : 'text-ink-500'
      }`}
    >
      {children}
    </p>
  );
}
