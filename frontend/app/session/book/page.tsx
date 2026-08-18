'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Ornaments, Screen } from '@/components/Shell';
import { ViewElderPicker } from '@/components/ViewElderPicker';
import { Card } from '@/components/ui';
import { printLog } from '@/lib/export';
import { useElderScenes } from '@/lib/useElderScenes';
import { useViewElder } from '@/lib/viewElder';
import { useSession } from '@/lib/store';

/**
 * 이야기 책 — 확정한 그림과 그 말씀을 한 쪽씩 넘겨 읽는 책.
 *
 * ── 왜
 *
 * 기획팀장님 말씀이다 — "노래와 이야기에서 나아가 동화책처럼 이미지화하여
 * 책으로 제작해도 좋을 것 같다".
 *
 * ── 처음 판이 왜 책이 아니었나
 *
 * 그 말씀을 인쇄 쪽으로만 받아서, 화면은 세로로 쭉 이어지는 카드 목록이었고
 * 주 버튼이 「책 인쇄하기」였다. 종이로는 맞는데 태블릿에서는 책이 아니었다 —
 * 어르신과 마주 앉아 한 쪽씩 넘기며 읽는 물건이어야 한다.
 *
 * 그래서 화면은 **한 쪽씩** 보여 준다. 좌우 단추와 손가락 쓸기로 넘긴다.
 * 인쇄는 그대로 남는다 — 종이에는 모든 쪽이 한 번에 나온다.
 *
 * ── 무엇이 들어가나
 *
 * 복지사가 「이 그림 쓰기」를 누른 것만 들어간다(원칙 3). 확정하지 않은
 * 초안이 책이 되어 가족에게 건네지는 일은 없어야 한다.
 *
 * 그림마다 그 그림이 나온 **어르신 말씀**이 함께 적힌다. 그림책이지만
 * 지어낸 이야기가 아니라 그분이 하신 말씀이라는 것이 종이에도 남아야 한다.
 *
 * ── 이번 회기가 아니라 그 어르신 전체다
 *
 * 예전에는 이번 회기 그림만 읽어서, 회기가 끝나면 그 책을 다시 열 수 없었다.
 * 계정에 그림이 석 장 있는데도 "책에 넣을 그림이 아직 없어요"였다. 책은
 * 한 회기의 물건이 아니라 그분 삶의 물건이다.
 */
export default function BookPage() {
  const { s } = useSession();
  const view = useViewElder();
  const { scenes, shared } = useElderScenes(view.id ?? undefined, { approvedOnly: true });

  const who = view.id ? `${view.name} 어르신` : s.elder.honorific;

  /*
   * 지금 펼친 쪽. 0 은 표지다.
   *
   * 그림이 늦게 도착하면 쪽 수가 늘어난다. 그때 펼친 쪽이 범위를 넘지 않게
   * 그리는 자리에서 가둔다 — 이펙트에서 되돌리면 렌더가 연쇄로 돈다.
   */
  const [raw, setRaw] = useState(0);
  const list = scenes ?? [];
  const last = list.length; // 표지 한 쪽 + 그림 쪽들
  const page = Math.min(raw, last);

  const go = (n: number) => setRaw(Math.max(0, Math.min(last, n)));

  /* 손가락으로 쓸어 넘기기. 어르신 앞에서는 이 동작이 먼저 나온다. */
  const touch = useRef<number | null>(null);
  const onStart = (e: React.TouchEvent) => {
    touch.current = e.touches[0]?.clientX ?? null;
  };
  const onEnd = (e: React.TouchEvent) => {
    const from = touch.current;
    touch.current = null;
    const to = e.changedTouches[0]?.clientX;
    if (from === null || to === undefined) return;
    const moved = to - from;
    // 40px 아래는 넘김이 아니라 손 떨림이다. 어르신 손이 스쳐도 안 넘어가야 한다.
    if (Math.abs(moved) < 40) return;
    go(moved < 0 ? page + 1 : page - 1);
  };

  /* 키보드로도 넘긴다 — 데스크톱 검수와 보조기기용. */
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setRaw((v) => v + 1);
      if (e.key === 'ArrowLeft') setRaw((v) => Math.max(0, v - 1));
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  const now = page === 0 ? null : list[page - 1];

  return (
    <Screen
      back
      title="이야기 책"
      subtitle={`${who}의 그림책이에요`}
      decoration={<Ornaments variant="leafRight" />}
    >
      <div data-print-hide>
        <ViewElderPicker />
      </div>

      {scenes === null ? (
        <p className="text-center text-[0.9375rem] text-ink-500">불러오는 중…</p>
      ) : list.length === 0 ? (
        <Card className="p-4" data-print-hide>
          <p className="text-[1rem] font-bold text-ink-900">
            {shared === 'off'
              ? '이 기기에는 책에 넣을 그림이 없어요'
              : '책에 넣을 그림이 아직 없어요'}
          </p>
          <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-500">
            {shared === 'off'
              ? '기관 저장소를 못 읽었어요. 계정에 그림이 있을 수 있으니 통신이 되는 곳에서 다시 열어 봐 주세요.'
              : '사연 그림에서 「이 그림 쓰기」를 누른 그림만 책에 들어갑니다. 확정하지 않은 초안이 그대로 책이 되지 않도록 한 단계를 둔 거예요.'}
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
          {/* ── 화면: 한 쪽씩 ── */}
          <div data-print-hide className="print:hidden">
            <div
              onTouchStart={onStart}
              onTouchEnd={onEnd}
              className="overflow-hidden rounded-[20px] bg-surface"
            >
              {now === null ? (
                <div className="px-6 py-14 text-center">
                  <p className="text-[1rem] text-ink-500">{who}의 이야기</p>
                  <h2 className="mt-3 text-[2rem] font-extrabold leading-tight text-ink-900">
                    우리들의 그림책
                  </h2>
                  <p className="mt-5 text-[0.9375rem] leading-relaxed text-ink-500">
                    이 책의 모든 문장은 어르신이 직접 들려주시고
                    <br />
                    맞다고 확인해 주신 이야기입니다.
                  </p>
                  <p className="mt-6 text-[0.9375rem] font-bold text-brand-700">
                    그림 {list.length}장
                  </p>
                </div>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- data: URI */}
                  <img src={now.image} alt={`그림 — ${now.text}`} className="block w-full" />
                  <p className="px-5 py-6 text-center text-[1.375rem] font-bold leading-relaxed text-ink-900">
                    {now.text}
                  </p>
                </>
              )}
            </div>

            {/* 넘기기 — 단추는 크고 늘 같은 자리에 있어야 한다 */}
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => go(page - 1)}
                disabled={page === 0}
                aria-label="앞쪽으로"
                className="min-h-[60px] flex-1 rounded-[16px] border border-hairline bg-surface-strong text-[1.0625rem] font-bold text-ink-700 disabled:opacity-40"
              >
                앞쪽
              </button>
              <p
                aria-live="polite"
                className="min-w-[76px] text-center text-[0.9375rem] font-bold text-ink-700"
              >
                {page === 0 ? '표지' : `${page} / ${list.length}`}
              </p>
              <button
                type="button"
                onClick={() => go(page + 1)}
                disabled={page === last}
                aria-label="다음 쪽으로"
                className="min-h-[60px] flex-1 rounded-[16px] bg-brand-700 text-[1.0625rem] font-extrabold text-white disabled:opacity-40"
              >
                다음 쪽
              </button>
            </div>

            <p className="mt-2 text-center text-[0.8125rem] text-ink-500">
              화면을 옆으로 쓸어도 넘어가요
            </p>

            <div className="mt-5">
              <button
                type="button"
                onClick={printLog}
                className="min-h-[60px] w-full rounded-[16px] border border-brand-300 bg-surface text-[1.0625rem] font-bold text-brand-700"
              >
                책 인쇄하기 ({list.length}쪽)
              </button>
              <p className="mt-2 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
                인쇄 창에서 「배경 그래픽」을 켜시면 그림이 그대로 나옵니다. PDF 로
                저장하시면 기관에서 책으로 만드실 수 있어요.
              </p>
            </div>
          </div>

          {/* ── 종이: 모든 쪽이 한 번에 ── */}
          <div className="hidden print:block">
            <section className="mb-6 break-after-page rounded-[18px] bg-surface p-6 text-center">
              <p className="text-[0.9375rem] text-ink-500">{who}의 이야기</p>
              <h2 className="mt-2 text-[1.75rem] font-extrabold leading-tight text-ink-900">
                우리들의 그림책
              </h2>
              <p className="mt-4 text-[0.875rem] leading-relaxed text-ink-500">
                이 책의 모든 문장은 어르신이 직접 들려주시고 맞다고 확인해 주신
                이야기입니다.
              </p>
            </section>

            <ol className="space-y-6">
              {list.map((sc, i) => (
                <li key={sc.key} className="break-inside-avoid">
                  <div className="overflow-hidden rounded-[18px] bg-surface">
                    {/* eslint-disable-next-line @next/next/no-img-element -- data: URI */}
                    <img src={sc.image} alt={`그림 — ${sc.text}`} className="block w-full" />
                    <div className="p-5">
                      <p className="text-[1.25rem] font-bold leading-relaxed text-ink-900">
                        {sc.text}
                      </p>
                      <p className="mt-2 text-[0.8125rem] text-ink-500">
                        {i + 1} / {list.length}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <p className="mt-6 text-center text-[0.8125rem] leading-relaxed text-ink-500">
            그림은 어르신 말씀을 바탕으로 그린 그림이며, 실제 사진이 아닙니다.
          </p>
        </>
      )}
    </Screen>
  );
}
