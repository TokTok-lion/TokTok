'use client';

import { useState } from 'react';
import { Card } from './ui';
import { writeAvoidTopics } from '@/lib/repo';
import { noteAvoidTopics } from '@/lib/store';

/**
 * 피하고 싶은 주제를 적어 두는 자리.
 *
 * ── 왜 이제야 생겼나
 *
 * 칸은 처음부터 있었다. 프로필도 그 값을 보여 줬다. 그런데 **적는 화면이 어디에도
 * 없었다.** 그래서 실제로 등록한 어르신은 전부 빈칸이었고, 값이 들어 있는 분은
 * 둘러보기용 씨앗 어르신 한 분뿐이었다. 읽는 곳만 있고 쓰는 곳이 없는 값은
 * 없는 값과 같다.
 *
 * ── 왜 지금 필요해졌나
 *
 * 오늘의 질문을 지난 이야기에서 짓기 시작했다(api/questions). 그 이야기 속에
 * 피난이나 사별이 섞여 있으면, 앱이 먼저 그 대목을 꺼내 여쭙게 된다. 거를
 * 목록이 있어야 거를 수 있다.
 *
 * ── 무엇을 약속하고 무엇을 약속하지 않는가
 *
 * 여기 적어 두면 개인화 질문을 지을 때 "이 주제는 묻지 마세요"로 함께 보낸다.
 * 그게 전부다. 어르신이 스스로 그 이야기를 꺼내시는 것을 막지 않고, 고정
 * 질문지도 바꾸지 않으며, 가사 초안까지 걸러 주지는 않는다. 화면이 그 선을
 * 그대로 적는다 — 안전장치를 실제보다 넓게 적으면 복지사가 믿고 안 살핀다.
 *
 * ── 왜 예시를 함께 두나
 *
 * 빈 칸만 있으면 아무도 안 적는다. 요양 현장에서 자주 나오는 대목을 눌러서
 * 담게 하되, 직접 적는 칸을 함께 둔다 — 어느 분께 무엇이 아픈 자리인지는
 * 목록이 알 수 없다.
 */

/** 눌러서 담는 예시. 목록에 갇히지 않게 직접 적는 칸을 함께 둔다. */
const COMMON = [
  '전쟁·피난',
  '사별',
  '자녀와의 갈등',
  '병환·수술',
  '어렵게 지내던 시절',
  '헤어짐',
];

export function AvoidTopicsPanel({
  participantId,
  current,
}: {
  /** 서버 participants.id. 둘러보기 어르신이면 null — 저장할 곳이 없다. */
  participantId: string | null;
  /** 지금 기록에 남아 있는 값. 서버에서 늦게 채워질 수 있다. */
  current: string[];
}) {
  /*
   * 손대기 전에는 기록의 값을 그대로 보여 준다.
   *
   * 처음에는 current 를 useState 의 첫 값으로 넣고 이펙트로 다시 맞췄는데,
   * 서버 기록은 회기가 시작된 뒤에 뒤늦게 채워진다(hydrateElderRecord). 첫
   * 값만으로는 늦게 온 값을 못 받고, 이펙트로 맞추면 렌더가 연쇄로 돈다.
   * 고치기 전에는 아예 내 상태를 갖지 않는 편이 맞다 — null 이면 기록을 본다.
   */
  const [draft, setDraft] = useState<string[] | null>(null);
  const items = draft ?? current;

  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!participantId) {
    return (
      <p className="mt-2.5 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
        둘러보기 어르신이라 피하고 싶은 주제를 저장할 수 없어요. 기관에 등록하신
        어르신에게는 이 자리에서 적어 두실 수 있습니다.
      </p>
    );
  }

  const change = (next: string[]) => {
    setSaved(false);
    setError(null);
    setDraft(next);
  };

  const toggle = (topic: string) => {
    change(items.includes(topic) ? items.filter((x) => x !== topic) : [...items, topic]);
  };

  const addTyped = () => {
    const t = typed.trim();
    if (!t || items.includes(t)) {
      setTyped('');
      return;
    }
    change([...items, t]);
    setTyped('');
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const out = await writeAvoidTopics(participantId, items);
    setBusy(false);
    if (!out.ok) {
      setError(out.reason ?? '저장하지 못했어요.');
      return;
    }
    // 화면 위쪽 프로필 칩도 같은 값을 보게 한다. 저장은 됐는데 위에는 옛 값이
    // 그대로 있으면 복지사가 저장이 안 된 줄 알고 또 누른다.
    noteAvoidTopics(participantId, items);
    // 저장된 값이 곧 기록의 값이다. 내 사본을 버리고 다시 기록을 본다.
    setDraft(null);
    setSaved(true);
  };

  return (
    <Card className="mt-3 p-4">
      <p className="text-[0.9375rem] leading-relaxed text-ink-700">
        어르신이 다시 떠올리기 힘들어하시는 대목을 적어 두세요. 지난 이야기에서
        오늘의 질문을 지을 때 이 주제는 빼고 만듭니다.
      </p>

      {/* 지금 담긴 것 */}
      <div className="mt-3">
        <p className="text-[0.875rem] font-bold text-ink-900">지금 적어 둔 주제</p>
        {items.length === 0 ? (
          <p className="mt-1.5 text-[0.9375rem] text-ink-500">아직 없어요.</p>
        ) : (
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {items.map((t) => (
              <li key={t}>
                <button
                  type="button"
                  onClick={() => toggle(t)}
                  className="flex min-h-[40px] items-center gap-2 rounded-full border-2 border-brand-400 bg-brand-50 px-3.5 text-[0.9375rem] font-bold text-brand-700"
                >
                  {t}
                  {/* 지우는 버튼이 따로 있으면 손가락이 작아진다. 칩 전체가 버튼이다. */}
                  <span aria-hidden="true" className="text-[1.125rem] leading-none">
                    ×
                  </span>
                  <span className="sr-only">빼기</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 예시에서 고르기 */}
      <p className="mt-4 text-[0.875rem] font-bold text-ink-900">자주 쓰는 주제</p>
      <ul className="mt-1.5 flex flex-wrap gap-2">
        {COMMON.filter((c) => !items.includes(c)).map((c) => (
          <li key={c}>
            <button
              type="button"
              onClick={() => toggle(c)}
              className="min-h-[40px] rounded-full border border-hairline bg-surface-strong px-3.5 text-[0.9375rem] font-bold text-ink-700"
            >
              + {c}
            </button>
          </li>
        ))}
      </ul>

      {/* 직접 적기 */}
      <div className="mt-4">
        <label
          htmlFor="avoid-typed"
          className="text-[0.875rem] font-bold text-ink-900"
        >
          직접 적기
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            id="avoid-typed"
            value={typed}
            onChange={(ev) => setTyped(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key !== 'Enter') return;
              // 이 칸이 폼 안에 들어가면 엔터가 화면을 넘긴다. 여기서 막는다.
              ev.preventDefault();
              addTyped();
            }}
            placeholder="예) 첫째 아드님 이야기"
            className="min-h-[52px] min-w-0 flex-1 rounded-[12px] border border-hairline bg-surface-strong px-3.5 text-[1rem] text-ink-900"
          />
          <button
            type="button"
            onClick={addTyped}
            disabled={typed.trim().length === 0}
            className="min-h-[52px] shrink-0 rounded-[12px] border border-hairline bg-surface-strong px-4 text-[0.9375rem] font-bold text-ink-700 disabled:opacity-50"
          >
            담기
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="mt-4 min-h-[60px] w-full rounded-[16px] bg-brand-700 text-[1.0625rem] font-extrabold text-white disabled:opacity-70"
      >
        {busy ? '저장하는 중…' : '저장하기'}
      </button>

      {saved ? (
        <p role="status" className="mt-2 text-[0.875rem] font-bold text-leaf-700">
          저장했어요.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-[0.875rem] font-bold text-danger-600">
          {error}
        </p>
      ) : null}

      {/* 되는 것과 안 되는 것을 그대로 적는다. */}
      <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
        지난 이야기에서 만드는 질문에만 적용돼요. 정해진 질문지와 가사 초안까지
        걸러 주지는 않으니, 어르신 앞에서 한 번 더 살펴 주세요. 어르신이 먼저
        꺼내신 이야기는 막지 않습니다.
      </p>
    </Card>
  );
}
