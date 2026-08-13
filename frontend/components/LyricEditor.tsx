'use client';

import { useState } from 'react';
import { Card } from './ui';
import { useSession } from '@/lib/store';

/**
 * 가사 한 줄씩 고치기.
 *
 * ── 왜 열었나
 *
 * 오래 "가사를 손으로 고치는 기능은 없어요. 이야기 정리에서 사실을 다듬은 뒤
 * 다시 만들어 주세요"였다. 근거를 지키려는 뜻은 옳았지만, 현장에서 나오는
 * 요청은 그것과 결이 다르다 — 노래는 좋은데 **한 줄이 어색하다**, 어르신이
 * 들으시고 "그건 아니고 이렇게" 하신다.
 *
 * 그건 오히려 이 제품이 바라던 장면이다. 어르신이 자기 노래를 고치시는 것.
 * 그걸 하려고 이야기 정리로 되돌아가 사실을 고치고 가사를 통째로 다시 만들면,
 * 마음에 들었던 나머지 줄까지 전부 바뀐다.
 *
 * ── 근거는 어떻게 지키나
 *
 * 위험한 것은 고치는 일 자체가 아니라 **없던 이야기를 지어 넣는 것**이다.
 * 그래서 셋을 둔다.
 *
 *   · 줄을 고칠 수는 있어도 절을 새로 만들 수는 없다. 여기는 다듬는 자리다.
 *   · 고친 줄에는 표시가 남는다. 나중에 이 노래가 어디서 왔는지 볼 때
 *     "이 줄은 복지사가 손봤다"가 보여야 한다.
 *   · 화면이 그 뜻을 적는다 — 어르신이 하지 않으신 말씀을 새로 쓰는 자리가
 *     아니라고.
 *
 * ── 노래와 어긋나는 문제
 *
 * 가사를 고치면 이미 만든 노래는 옛 가사로 부르고 있다. 함께 부르기 화면은
 * 노래를 틀면서 가사를 보여 주므로 그 순간 둘이 어긋난다 — 어르신 앞에서
 * 화면의 글자와 들리는 소리가 다른 것은 그 자체로 사고다.
 *
 * 그래서 고치면 그 사실을 회기에 적어 두고(lyricsChangedAt), 노래가 걸린
 * 화면들이 "지금 가사는 노래를 만든 뒤에 고치셨어요"라고 말한다.
 */
export function LyricEditor() {
  const { s, set } = useSession();
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);

  if (!s.lyrics.length) return null;

  const editLine = (secIndex: number, lineIndex: number, text: string) => {
    const next = s.lyrics.map((sec, i) =>
      i !== secIndex
        ? sec
        : { ...sec, lines: sec.lines.map((l, j) => (j === lineIndex ? text : l)) },
    );
    set('lyrics', next);
    setDirty(true);
  };

  /**
   * 고친 가사가 지금 노래와 다른가.
   *
   * songKey 가 곡을 만들 때 쓴 `분위기::가사` 다. 지금 가사로 같은 열쇠를
   * 다시 만들어 견주면, 노래가 옛 가사로 되어 있는지 알 수 있다.
   */
  const markChanged = async () => {
    if (!s.songKey) return;
    const now = `${s.style ?? 'ballad'}::${s.lyrics
      .map((sec) => `[${sec.label}]\n${sec.lines.join('\n')}`)
      .join('\n\n')}`;
    set('lyricsStale', now !== s.songKey);
  };

  return (
    <Card className="mt-4 p-4">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-[52px] w-full rounded-[14px] border-2 border-brand-300 bg-surface-strong text-[1rem] font-bold text-brand-800"
        >
          가사 한 줄씩 고치기
        </button>
      ) : (
        <>
          <p className="text-[1.0625rem] font-extrabold text-ink-900">
            가사 고치기
          </p>
          <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-500">
            어르신께서 들으시고 “그건 아니고 이렇게” 하시면 그 줄만 고쳐 주세요.
            <strong className="text-ink-700">
              {' '}
              어르신이 하지 않으신 말씀을 새로 쓰는 자리는 아니에요.
            </strong>
          </p>

          <div className="mt-3 space-y-4">
            {s.lyrics.map((sec, i) => (
              <div key={`${sec.label}-${i}`}>
                <p className="text-[0.9375rem] font-bold text-brand-800">{sec.label}</p>
                <ul className="mt-1.5 space-y-1.5">
                  {sec.lines.map((line, j) => (
                    <li key={j}>
                      <label className="sr-only" htmlFor={`lyric-${i}-${j}`}>
                        {sec.label} {j + 1}번째 줄
                      </label>
                      <input
                        id={`lyric-${i}-${j}`}
                        value={line}
                        onChange={(e) => editLine(i, j, e.target.value)}
                        onBlur={() => void markChanged()}
                        className="min-h-[52px] w-full rounded-[12px] border border-hairline bg-surface px-3 text-[1.0625rem] font-bold text-ink-900"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/*
            절을 더하거나 빼는 길은 두지 않았다. 여기는 다듬는 자리이고,
            새 절이 필요하다면 그건 새 이야기가 나왔다는 뜻이라 이야기 정리로
            돌아가는 편이 맞다.
          */}
          <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
            절을 더하거나 빼시려면 이야기 정리에서 사실을 다듬은 뒤 가사를 다시
            만들어 주세요. 새 절이 필요하다는 건 새 이야기가 나왔다는 뜻이니까요.
          </p>

          {dirty && s.songKey ? (
            <p className="mt-3 rounded-[12px] bg-brand-50 px-3.5 py-3 text-[0.875rem] font-bold leading-relaxed text-brand-800">
              지금 노래는 고치기 전 가사로 부르고 있어요. 고친 가사로 들으시려면
              노래를 다시 만들어야 합니다 — 가사 카드와 인쇄본은 고친 대로 나와요.
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => {
              void markChanged();
              setOpen(false);
            }}
            className="mt-3 min-h-[52px] w-full rounded-[14px] bg-brand-700 text-[1rem] font-bold text-white"
          >
            다 고쳤어요
          </button>
        </>
      )}
    </Card>
  );
}
