'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Ornaments, Screen } from '@/components/Shell';
import { Card } from '@/components/ui';
import { printLog } from '@/lib/export';
import { readScenes, type Scene } from '@/lib/sceneStore';
import { songTitleForTopic } from '@/lib/scenes';
import { useSession } from '@/lib/store';

/**
 * 동화책 — 확정한 그림과 그 문장을 한 장씩 넘겨보는 책.
 *
 * ── 왜
 *
 * 기획팀장님 말씀이다 — "노래와 이야기에서 나아가 동화책처럼 이미지화하여
 * 책으로 제작해도 좋을 것 같다". 장수복지관은 직원분들이 AI 교육을 받으셔서
 * 책 만드는 일 자체는 기관이 하실 수 있다. 우리가 할 일은 **인쇄해서 그대로
 * 쓸 수 있는 모양**으로 내보내는 것이다.
 *
 * ── 무엇이 들어가나
 *
 * 복지사가 「이 그림 쓰기」를 누른 것만 들어간다(원칙 3). 확정하지 않은
 * 초안이 책이 되어 가족에게 건네지는 일은 없어야 한다.
 *
 * 그림마다 그 그림이 나온 **어르신 말씀**이 함께 인쇄된다. 그림책이지만
 * 지어낸 이야기가 아니라 그분이 하신 말씀이라는 것이 종이에도 남아야 한다.
 *
 * ── 인쇄
 *
 * 한 장에 한 쪽이다. 화면의 머리말·아래 단추는 종이에 나오지 않는다
 * (components/Shell 의 data-print-hide). 활동일지·가사 인쇄와 같은 방식이다.
 */
export default function BookPage() {
  const { s } = useSession();
  const [scenes, setScenes] = useState<Scene[] | null>(null);

  useEffect(() => {
    void readScenes().then((all) => setScenes(all.filter((x) => x.approved)));
  }, []);

  const title = songTitleForTopic(s.topic);

  return (
    <Screen
      back
      title="이야기 책"
      subtitle="확정한 그림으로 만든 책이에요"
      decoration={<Ornaments variant="leafRight" />}
    >
      {scenes === null ? (
        <p className="text-center text-[0.9375rem] text-ink-500">불러오는 중…</p>
      ) : scenes.length === 0 ? (
        <Card className="p-4" data-print-hide>
          <p className="text-[1rem] font-bold text-ink-900">
            책에 넣을 그림이 아직 없어요
          </p>
          <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-500">
            사연 그림에서 「이 그림 쓰기」를 누른 그림만 책에 들어갑니다. 확정하지
            않은 초안이 그대로 책이 되지 않도록 한 단계를 둔 거예요.
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
          <div data-print-hide className="mb-4">
            <button
              type="button"
              onClick={printLog}
              className="min-h-[60px] w-full rounded-[16px] bg-brand-700 text-[1.0625rem] font-extrabold text-white"
            >
              책 인쇄하기 ({scenes.length}쪽)
            </button>
            <p className="mt-2 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
              인쇄 창에서 「배경 그래픽」을 켜시면 그림이 그대로 나옵니다. PDF 로
              저장하시면 기관에서 책으로 만드실 수 있어요.
            </p>
          </div>

          {/* 표지 */}
          <section className="mb-6 break-after-page rounded-[18px] bg-surface p-6 text-center">
            <p className="text-[0.9375rem] text-ink-500">{s.elder.honorific}의 이야기</p>
            <h2 className="mt-2 text-[1.75rem] font-extrabold leading-tight text-ink-900">
              {title}
            </h2>
            <p className="mt-4 text-[0.875rem] leading-relaxed text-ink-500">
              이 책의 모든 문장은 어르신이 직접 들려주시고 맞다고 확인해 주신
              이야기입니다.
            </p>
          </section>

          {/* 한 쪽에 그림 하나와 그 말씀 하나 */}
          <ol className="space-y-6">
            {scenes.map((sc, i) => (
              <li key={sc.key} className="break-inside-avoid">
                <div className="overflow-hidden rounded-[18px] bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data: URI */}
                  <img src={sc.image} alt={`그림 — ${sc.text}`} className="block w-full" />
                  <div className="p-5">
                    <p className="text-[1.25rem] font-bold leading-relaxed text-ink-900">
                      {sc.text}
                    </p>
                    <p className="mt-2 text-[0.8125rem] text-ink-500">
                      {i + 1} / {scenes.length}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-6 text-center text-[0.8125rem] leading-relaxed text-ink-500">
            그림은 어르신 말씀을 바탕으로 그린 그림이며, 실제 사진이 아닙니다.
          </p>
        </>
      )}
    </Screen>
  );
}
