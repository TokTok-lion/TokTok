'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Ornaments, Screen } from '@/components/Shell';
import { Card } from '@/components/ui';
import { readElderScenes, type Scene } from '@/lib/sceneStore';
import { listServerScenes } from '@/lib/sceneSync';
import { useSession } from '@/lib/store';

/**
 * 그림 보관함 — 이 어르신의 지난 회기 그림까지.
 *
 * ── 왜 생겼나
 *
 * 그림은 처음부터 어르신·회기별로 저장되고 있었는데, **읽는 코드가 "이번
 * 회기"로만 걸러 냈다.** 그래서 회기가 끝나고 새 회기를 시작하면 지난 그림이
 * 기기 안에 그대로 있는데도 볼 화면이 없었다. 곡은 어르신 단위로 보관함에
 * 남는데(/library) 그림만 그렇지 않았다.
 *
 * ── 두 곳을 합친다
 *
 * 기기에 있는 것을 먼저 그리고, 기관 저장소에 있는 것을 뒤이어 얹는다. 곡
 * 보관함과 같은 순서다 — 통신을 기다리느라 있는 것을 못 보여 주는 일이
 * 없어야 한다.
 */
export default function SceneShelfPage() {
  const { s } = useSession();
  const [scenes, setScenes] = useState<Scene[] | null>(null);
  const [fromServer, setFromServer] = useState(false);

  /*
   * 기기 먼저, 서버는 뒤이어.
   *
   * 두 번 그린다. 통신을 기다리느라 이미 손에 있는 그림을 못 보여 주는 일이
   * 없어야 한다 — 곡 보관함이 그렇게 만들어져 있고, 여기도 같은 이유다.
   *
   * 합치는 계산은 이펙트 안에서 하지 않는다. 이펙트가 상태를 또 고치면 렌더가
   * 연쇄로 돈다 — 한 번에 합쳐서 한 번만 넣는다.
   */
  useEffect(() => {
    let alive = true;
    void (async () => {
      const mine = await readElderScenes();
      if (!alive) return;
      setScenes(mine);

      const remote = await listServerScenes();
      if (!alive || !remote.length) return;
      const seen = new Set(mine.map((x) => x.factId));
      const add = remote.filter((r) => !seen.has(r.factId));
      if (!add.length) return;
      setScenes([...mine, ...add].sort((a, b) => b.madeAt - a.madeAt));
      setFromServer(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const bySession = new Map<string, Scene[]>();
  for (const sc of scenes ?? []) {
    const list = bySession.get(sc.sessionId) ?? [];
    list.push(sc);
    bySession.set(sc.sessionId, list);
  }

  return (
    <Screen
      back
      title="그림 보관함"
      subtitle={`${s.elder.honorific}의 사연 그림`}
      decoration={<Ornaments variant="leafRight" />}
    >
      {scenes === null ? (
        <p className="text-center text-[0.9375rem] text-ink-500">불러오는 중…</p>
      ) : scenes.length === 0 ? (
        <Card className="p-4">
          <p className="text-[1rem] font-bold text-ink-900">아직 그린 그림이 없어요</p>
          <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-500">
            회기에서 노래를 만든 뒤 「사연 그림 만들기」로 그리실 수 있어요.
          </p>
          <Link
            href="/session/scenes"
            className="mt-3 inline-flex min-h-[52px] items-center rounded-[14px] bg-brand-700 px-5 text-[1rem] font-bold text-white"
          >
            사연 그림으로 가기
          </Link>
        </Card>
      ) : (
        <>
          <p className="text-[0.9375rem] text-ink-700">
            그림 {scenes.length}장 · 회기 {bySession.size}회
            {fromServer ? ' · 기관 저장소에 있는 그림도 함께 보여요' : ''}
          </p>

          {[...bySession.entries()].map(([sessionId, list]) => (
            <section key={sessionId} className="mt-5">
              <h2 className="text-[1rem] font-extrabold text-ink-900">
                {stamp(list[0].madeAt)} 회기 · {list.length}장
              </h2>
              <ul className="mt-2 grid grid-cols-2 gap-3">
                {list.map((sc) => (
                  <li key={sc.key}>
                    <div className="overflow-hidden rounded-[16px] bg-surface">
                      {/* eslint-disable-next-line @next/next/no-img-element -- data: URI */}
                      <img src={sc.image} alt={`그림 — ${sc.text}`} className="block w-full" />
                      <p className="p-2.5 text-[0.8125rem] leading-snug text-ink-700">
                        {sc.text}
                      </p>
                      {!sc.approved ? (
                        <p className="px-2.5 pb-2.5 text-[0.75rem] font-bold text-amber-700">
                          아직 확정 안 함
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <p className="mt-5 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
            확정한 그림은 기관 저장소에도 올라가서 다른 태블릿에서도 보여요.
            확정하지 않은 그림은 이 태블릿에만 있습니다.
          </p>
        </>
      )}
    </Screen>
  );
}

/** 회기를 날짜로 적는다. 회기 식별자는 사람이 읽을 값이 아니다. */
function stamp(ms: number): string {
  return new Date(ms).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
}
