'use client';

import { useEffect, useState } from 'react';
import { listParticipants } from '@/lib/repo';
import { useSession } from '@/lib/store';
import { setViewElder, useViewElder } from '@/lib/viewElder';

/**
 * 기록에서 「보는 어르신」을 고른다.
 *
 * ── 왜 회기 어르신과 따로 두나
 *
 * 보관함은 지금 회기의 어르신 것만 보여 줬다. 그래서 다른 어르신의 노래를
 * 보려면 그분으로 회기를 시작해야 했다.
 *
 * 그렇다고 여기서 회기를 바꾸면 안 된다. 회기 중에 어르신이 갈리면 진행하던
 * 이야기·가사·녹음이 다른 분 것으로 넘어간다. 기록을 들춰 보려다 회기가
 * 망가지는 일은 있어서는 안 된다.
 *
 * 그래서 이 고르개는 **보는 것만** 바꾼다. 회기를 시작하려면 지금처럼 어르신
 * 목록에서 고르셔야 한다.
 *
 * ── 다르면 다르다고 적는다
 *
 * 보는 어르신과 회기 어르신이 다를 때 그 사실을 화면에 적는다. 안 적으면
 * 복지사는 지금 보고 있는 기록을 회기의 어르신 것으로 읽는다 — 그 오해가
 * 활동일지에 남으면 남의 기록이 된다.
 */
export function ViewElderPicker() {
  const { s } = useSession();
  const view = useViewElder();
  const [list, setList] = useState<{ id: string; name: string }[] | null>(null);

  useEffect(() => {
    let alive = true;
    void listParticipants()
      .then((rows) => {
        if (alive) {
          setList(rows.map((r) => ({ id: r.id, name: r.display_name })));
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // 기관 어르신이 둘 미만이면 고를 것이 없다. 둘러보기 회기도 여기로 온다.
  if (!list || list.length < 2) return null;

  const sessionId = s.remoteParticipantId ?? '';

  return (
    <div className="mt-3 rounded-[14px] bg-surface-strong p-3.5">
      <label
        htmlFor="view-elder"
        className="text-[0.875rem] font-bold text-ink-700"
      >
        보는 어르신
      </label>
      <select
        id="view-elder"
        value={view.id ?? sessionId}
        onChange={(e) => {
          const id = e.target.value;
          const found = list.find((x) => x.id === id);
          // 회기 어르신을 고르면 따로 기억하지 않는다 — 기본으로 돌아간다.
          setViewElder(
            id === sessionId ? { id: null, name: '' } : { id, name: found?.name ?? '' },
          );
        }}
        className="mt-1.5 min-h-[52px] w-full rounded-[12px] border border-hairline bg-surface px-3 text-[1rem] font-bold text-ink-900"
      >
        {list.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
            {x.id === sessionId ? ' (지금 회기)' : ''}
          </option>
        ))}
      </select>

      {!view.sameAsSession ? (
        <p className="mt-2 text-[0.875rem] leading-relaxed text-brand-700">
          <strong className="font-extrabold">{view.name}</strong> 어르신의 기록을
          보고 있어요. 지금 진행 중인 회기는{' '}
          <strong className="font-extrabold">{s.elder.honorific}</strong> 그대로입니다
          — 회기를 바꾸려면 어르신 목록에서 골라 주세요.
        </p>
      ) : null}
    </div>
  );
}
