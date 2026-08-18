'use client';

import Link from 'next/link';
import { Ornaments, Screen } from '@/components/Shell';
import { Card } from '@/components/ui';
import type { Scene } from '@/lib/sceneStore';
import { useElderScenes } from '@/lib/useElderScenes';
import { useSession } from '@/lib/store';
import { ViewElderPicker } from '@/components/ViewElderPicker';
import { useViewElder } from '@/lib/viewElder';

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
  const view = useViewElder();
  const owner = view.id ?? undefined;
  const { scenes, shared, fromServer } = useElderScenes(owner, { push: !owner });

  // 확정한 그림 수. 책·숏츠는 확정한 것으로만 만든다(원칙 3).
  const approved = (scenes ?? []).filter((x) => x.approved).length;

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
      subtitle={`${view.id ? `${view.name} 어르신` : s.elder.honorific}의 사연 그림`}
      decoration={<Ornaments variant="leafRight" />}
    >
      <ViewElderPicker />

      {scenes === null ? (
        <p className="text-center text-[0.9375rem] text-ink-500">불러오는 중…</p>
      ) : scenes.length === 0 ? (
        <Card className="p-4">
          <p className="text-[1rem] font-bold text-ink-900">
            {shared === 'off' ? '이 기기에는 그림이 없어요' : '아직 그린 그림이 없어요'}
          </p>
          <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-500">
            {shared === 'off'
              ? /*
                 * 계정을 못 읽은 채로 "없어요"라고만 적으면, 계정에 있는 그림을
                 * 없다고 말하는 것이 된다. 그러면 같은 그림을 한 번 더 그린다.
                 */
                '기관 저장소를 못 읽었어요. 계정에 그림이 있을 수 있으니, 통신이 되는 곳에서 다시 열어 봐 주세요.'
              : '회기에서 노래를 만든 뒤 「사연 그림 만들기」로 그리실 수 있어요.'}
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
            {shared === 'off' ? ' · 이 기기에 있는 그림만 보여 드려요' : ''}
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

          {/*
            책과 숏츠로 가는 입구.

            예전에는 회기 안의 「사연 그림」 화면에서만 들어갈 수 있었다. 그
            화면은 그림을 만드는 자리라, 지난 회기 그림으로 책을 보려면 갈 길이
            없었다 — 기능은 있는데 아무도 못 찾는 상태였다.

            여기 두는 것이 맞다. 보관함은 지난 그림이 모이는 자리이고, 책과
            숏츠는 모인 그림으로 만드는 물건이다. 「보는 어르신」도 그대로
            따라간다.
          */}
          {approved > 0 ? (
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Link
                href="/session/book"
                className="flex min-h-[60px] items-center justify-center rounded-[16px] bg-brand-700 text-[1rem] font-bold text-white"
              >
                책으로 보기
              </Link>
              <Link
                href="/session/reel"
                className="flex min-h-[60px] items-center justify-center rounded-[16px] bg-leaf-100 text-[1rem] font-bold text-leaf-800"
              >
                노래와 함께 보기
              </Link>
            </div>
          ) : (
            <p className="mt-5 rounded-[14px] bg-surface-sunk p-3.5 text-[0.875rem] leading-relaxed text-ink-700">
              「이 그림 쓰기」로 확정한 그림이 있어야 책과 숏츠를 만들 수 있어요.
              사연 그림 화면에서 확정해 주세요.
            </p>
          )}

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
