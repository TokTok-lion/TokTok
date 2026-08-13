'use client';

import Link from 'next/link';
import { useSession } from '@/lib/store';

/**
 * 지금 가사는 노래를 만든 뒤에 고쳐졌다 — 그 사실을 말한다.
 *
 * ── 왜 이 안내가 있어야 하나
 *
 * 가사를 한 줄 고치면 이미 만든 노래는 옛 가사로 부르고 있다. 그런데 함께
 * 부르기 화면은 **노래를 틀면서 가사를 보여 준다.** 그 순간 화면의 글자와
 * 들리는 소리가 다르다.
 *
 * 어르신 앞에서 그건 그냥 어긋남이 아니다. 큰 글씨를 따라 부르시다 소리와
 * 어긋나면 "내가 잘못 읽었나" 하시게 된다. 이 제품이 하려는 일과 정반대다.
 *
 * 그래서 노래가 걸린 자리마다 같은 말을 한다. 감추지 않는다 — 고치신 것은
 * 잘하신 일이고, 다만 노래가 아직 따라오지 못했을 뿐이다.
 *
 * 가사 카드와 인쇄본은 고친 대로 나간다. 종이는 다시 만들 필요가 없다.
 */
export function StaleLyricsNote({ where }: { where: 'song' | 'sing' | 'card' }) {
  const { s } = useSession();
  if (!s.lyricsStale || !s.songKey) return null;

  return (
    <div className="mt-3 rounded-[14px] border-2 border-brand-300 bg-brand-50 p-3.5">
      <p className="text-[0.9375rem] font-extrabold leading-relaxed text-brand-800">
        지금 노래는 고치기 전 가사로 부르고 있어요
      </p>
      <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-700">
        {where === 'sing'
          ? // 여기가 제일 위험하다. 큰 글씨를 따라 부르시는데 소리가 다르다.
            '화면의 가사와 들리는 노래가 다를 수 있어요. 따라 부르실 때는 소리를 먼저 들려드리고, 고친 가사는 가사 카드로 보여 드리는 편이 나아요.'
          : where === 'card'
            ? '이 카드와 인쇄본은 고치신 대로 나와요. 노래만 아직 옛 가사입니다.'
            : '가사 카드와 인쇄본은 고치신 대로 나와요. 노래도 맞추시려면 다시 만들어야 합니다.'}
      </p>
      <Link
        href="/session/preview"
        className="mt-2.5 inline-flex min-h-[44px] items-center text-[0.9375rem] font-bold text-brand-800 underline underline-offset-2"
      >
        고친 가사로 노래 다시 만들기
      </Link>
    </div>
  );
}
