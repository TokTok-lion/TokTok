'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card } from './ui';
import { findContradictions, type Contradiction } from '@/lib/contradiction';
import { useLifeStory } from '@/lib/useLifeStory';
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
 *
 * 대조 대상은 useLifeStory() 가 준다. 예전에는 이 컴포넌트가 SEED_PAST_FACTS
 * 를 직접 읽었는데, 그러면 로그인해서 실제 어르신 회기를 열어도 씨앗 어르신
 * (김○○)의 '3회기 · 4월 18일' 과 대조했다. 그 어르신에게는 존재한 적 없는
 * 회기 날짜를 근거로 "지난번엔 스물둘이라 하셨는데" 라고 여쭙게 되는 것이라,
 * 되묻기 질문 자체가 지어낸 사실이 된다 — '출처 없는 사실은 만들지 않는다'
 * 는 이 앱의 규칙을 정면으로 어긴다.
 *
 * 그 판정이 로그인 확인이 끝난 뒤에만 맞는다는 것이 다음 구멍이었다. 확인
 * 중이거나 토큰이 풀린 동안에는 다시 씨앗과 대조됐고, 그 상태에서 버튼을
 * 누르면 지어낸 문장이 이야기 목록에 들어갔다. 지금은 useLifeStory 가
 * 지난 회기를 어디까지 아는지(pastState)를 같이 주고, 이 화면은 대조가
 * 된 경우에만 대조 결과를 말한다.
 *
 * 대조를 못 했으면 못 했다고 적는다. 예전에는 지난 회기를 못 읽었을 때 이
 * 패널이 조용히 사라졌는데, 화면만 보면 '어긋난 곳이 없다'와 똑같아 보인다.
 * 하나는 맞춰 봤다는 뜻이고 하나는 못 맞춰 봤다는 뜻이라, 복지사가 그 차이를
 * 모르면 대조된 줄 알고 넘어간다.
 */

/** 질문 문장(contradiction.ts 의 UNIT_LABEL)과 뱃지 표기를 같은 단위로 맞춘다. */
const UNIT_SUFFIX: Record<Contradiction['unit'], string> = {
  age: '살',
  year: '년',
  count: '',
};

/** 대조 결과가 아니라 대조 자체의 상태를 알리는 한 줄. */
function StatusLine({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="mt-3 text-center text-[0.875rem] leading-relaxed text-ink-500"
    >
      {children}
    </p>
  );
}

/**
 * 대조를 못 한 경우.
 *
 * 막다른 길을 두지 않는다 — 왜 못 했는지와, 어디로 가면 되는지와, 대조
 * 없이도 이야기 정리는 계속된다는 것을 같은 자리에서 알린다.
 */
function NotCompared({ reason, action }: { reason: string; action: ReactNode }) {
  return (
    <Card className="mt-3 border-2 border-hairline p-4">
      <p role="status" className="text-[1.0625rem] font-extrabold text-ink-900">
        지난 회기와 대조하지 못했어요
      </p>
      <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-700">
        {reason} 어긋난 곳이 없다는 뜻이 아니라, 아직 맞춰 보지 못했다는 뜻이에요.
      </p>
      <div className="mt-3">{action}</div>
      <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-500">
        대조 없이도 아래에서 이야기 정리는 이어서 하실 수 있어요.
      </p>
    </Card>
  );
}

export function Contradictions() {
  const { s, set } = useSession();
  const life = useLifeStory();

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

  // 대조가 아직 안 됐거나 못 된 구간을 먼저 가른다. 여기서 '어긋난 곳 없음'과
  // 같은 얼굴(=아무것도 안 보임)을 하면, 못 맞춰 본 것이 다 맞춰 본 것으로
  // 읽힌다.
  if (life.pastState === 'checking' || life.pastState === 'loading') {
    return <StatusLine>지난 회기 이야기와 맞춰 보는 중이에요…</StatusLine>;
  }

  if (life.pastState === 'failed') {
    return (
      <NotCompared
        reason="지난 회기 이야기를 불러오지 못했어요."
        action={
          <button
            type="button"
            onClick={life.reload}
            className="min-h-[44px] w-full rounded-[12px] bg-brand-700 text-[0.9375rem] font-bold text-white"
          >
            다시 맞춰 보기
          </button>
        }
      />
    );
  }

  if (life.pastState === 'signedOut') {
    return (
      <NotCompared
        reason="이 어르신의 지난 회기는 기관 계정으로 로그인해야 읽을 수 있어요."
        action={
          <Link
            href="/login"
            className="flex min-h-[44px] w-full items-center justify-center rounded-[12px] bg-brand-700 text-[0.9375rem] font-bold text-white"
          >
            로그인하고 대조하기
          </Link>
        }
      />
    );
  }

  // WriteLyrics 와 같은 방식으로 가른다 — 지난 회기분 대 이번 회기분.
  // 이번 회기 쪽은 lyricInputs 를 이미 통과한 것(확인됐고 출처가 붙은 것)만
  // 들어온다. 출처 없는 문장을 근거로 어르신께 되묻는 일은 없어야 한다.
  const found = findContradictions(
    life.all.filter((f) => f.when !== '이번 회기'),
    life.all.filter((f) => f.when === '이번 회기'),
  );

  // 둘러보기에서는 지난 회기가 씨앗 기록이다. 그걸 실제 기록인 것처럼 두지
  // 않는다 — 이 화면에서 날짜가 근거로 제시되기 때문이다.
  const demo = life.pastState === 'demo';

  if (!found.length) {
    // 맞춰 볼 지난 회기가 아예 없으면(첫 회기) 조용히 있는 편이 맞다.
    // 없는 것을 못 읽은 것처럼 적으면 그것도 사실이 아니다.
    if (!life.past.length) return null;
    return (
      <StatusLine>
        {demo ? '예시 지난 회기' : '지난 회기 이야기'} {life.past.length}개와 맞춰
        봤어요. 어긋나는 곳은 없어요.
      </StatusLine>
    );
  }

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
          const u = UNIT_SUFFIX[c.unit];
          return (
            <li key={c.id} className="rounded-[14px] bg-surface-strong p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-surface-sunk px-2.5 py-1 text-[0.8125rem] font-bold text-ink-700">
                  {c.earlier.when} · {c.values[0]}
                  {u}
                </span>
                <span className="text-ink-300">→</span>
                <span className="rounded-full bg-brand-100 px-2.5 py-1 text-[0.8125rem] font-bold text-brand-800">
                  이번 회기 · {c.values[1]}
                  {u}
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

      {demo ? (
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
          지금은 둘러보기라 지난 회기 기록이 예시예요. 기관 계정으로 로그인하면
          이 어르신의 실제 지난 회기와 대조해요.
        </p>
      ) : null}
    </Card>
  );
}
