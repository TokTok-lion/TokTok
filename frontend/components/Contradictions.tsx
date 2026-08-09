'use client';

import { useMemo } from 'react';
import { Card } from './ui';
import { findContradictions, type FactRef } from '@/lib/contradiction';
import { SEED_PAST_FACTS } from '@/lib/seed';
import { useSession } from '@/lib/store';

/**
 * 지난 회기와 어긋나는 곳.
 *
 * 회상 인터뷰는 한 번으로 끝나지 않는다. 같은 사건을 여러 회기에 걸쳐 다시
 * 이야기하시고, 그때마다 나이나 연도가 조금씩 달라진다. 회기 기록이 따로
 * 쌓이는 한 아무도 그 차이를 못 본다.
 *
 * 여기서 "틀렸다"고 하지 않는다. 기억이 흐려진 것인지, 지난번 기록이 잘못
 * 적힌 것인지, 정말 두 번 있었던 일인지 우리는 모른다. 아는 사람은 어르신
 * 뿐이다(원칙 1). 그래서 결과를 판정이 아니라 되묻기 질문으로 바꾼다.
 */
export function Contradictions() {
  const { s, set } = useSession();

  const found = useMemo(() => {
    const current: FactRef[] = s.story
      .filter((i) => i.status === 'verified')
      .map((i) => ({ id: i.id, text: i.text, when: '이번 회기' }));
    return findContradictions(SEED_PAST_FACTS, current);
  }, [s.story]);

  if (!found.length) return null;

  const addFollowUp = (question: string, key: string) => {
    const id = `ask-${key}`;
    if (s.story.some((i) => i.id === id)) return;
    set('story', [
      ...s.story,
      {
        id,
        text: question,
        status: 'unverified' as const,
        // 되묻기 항목도 출처가 있어야 한다 — 어디서 나온 질문인지 남긴다.
        sources: [{ kind: 'staffNote' as const, label: '지난 회기 대조' }],
        followUp: question,
      },
    ]);
  };

  return (
    <Card className="mt-3 border-2 border-brand-200 bg-brand-50 p-4">
      <p className="text-[1.0625rem] font-extrabold text-ink-900">
        지난 회기와 다른 곳이 있어요
      </p>
      <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-700">
        틀렸다는 뜻이 아니에요. 어느 쪽이 맞는지는 어르신만 아십니다.
      </p>

      <ul className="mt-3 space-y-3">
        {found.map((c) => {
          const added = s.story.some((i) => i.id === `ask-${c.id}`);
          return (
            <li key={c.id} className="rounded-[14px] bg-surface-strong p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-surface-sunk px-2.5 py-1 text-[0.8125rem] font-bold text-ink-700">
                  {c.earlier.when} · {c.values[0]}살
                </span>
                <span className="text-ink-300">→</span>
                <span className="rounded-full bg-brand-100 px-2.5 py-1 text-[0.8125rem] font-bold text-brand-800">
                  이번 회기 · {c.values[1]}살
                </span>
              </div>

              <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-900">
                {c.question}
              </p>

              <button
                type="button"
                onClick={() => addFollowUp(c.question, c.id)}
                disabled={added}
                className={`mt-3 min-h-[44px] w-full rounded-[12px] text-[0.9375rem] font-bold ${
                  added
                    ? 'pointer-events-none bg-surface-sunk text-ink-500'
                    : 'bg-brand-700 text-white'
                }`}
              >
                {added ? '확인 필요 목록에 넣었어요' : '다음에 여쭤볼 것으로 넣기'}
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
