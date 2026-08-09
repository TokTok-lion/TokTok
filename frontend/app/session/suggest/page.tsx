'use client';

import Link from 'next/link';
import { Art } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, NoteBar, PrimaryButton } from '@/components/ui';
import { IconInfo } from '@/components/icons';
import {
  STORY_STATUS_LABELS,
  lyricInputs,
  type StoryItem,
  type StoryStatus,
} from '@/lib/domain';
import { useSession } from '@/lib/store';

/**
 * 다음 질문 추천 (deck p.22)
 *
 * 덱은 이 화면을 'AI 질문 추천'이라 부르지만 질문을 만드는 모델은 아직 없다.
 * 예전에는 그 이름 아래 씨앗 질문 세 개('어떤 신발을 사드렸나요?' …)가 항상
 * 떴다 — 바다 이야기를 하신 어르신께도 신발을 물었다. 화면은 "확인된 이야기만
 * 바탕으로 질문을 추천해요"라고 적어 두고 파생 로직은 없었으니, 지키지 않는
 * 약속을 화면에 인쇄한 셈이다.
 *
 * 지금은 이번 회기의 이야기 목록에서만 만든다. 어르신이 하신 말씀을 그대로
 * 인용해 되묻는 형태라 없는 이야기가 섞일 자리가 없다. 만들 게 없으면 없다고
 * 적는다.
 *
 * 고른 질문을 인터뷰 화면으로 넘기지는 않는다 — 회기 상태에 "고른 질문"을
 * 담을 자리가 없기 때문이다. 없는 연결을 있는 척하지 않으려고 목록은 읽는
 * 쪽지로만 두었다.
 */

const MAX = 3;

type Suggestion = { id: string; text: string; from: string; status: StoryStatus };

function sourceLabel(item: StoryItem): string {
  return item.sources.map((sc) => sc.label).join(', ');
}

/**
 * 확인이 필요한 이야기가 먼저다 — 되물어야 할 것을 놔두고 새 이야기로
 * 넘어가면 그 항목은 영영 미확인으로 남는다. 그다음이 방금 확인된 이야기를
 * 더 듣는 질문이고, 최근 것부터 올린다.
 */
function suggestionsFrom(story: StoryItem[]): Suggestion[] {
  const out: Suggestion[] = [];

  for (const i of story.filter((x) => x.status === 'unverified')) {
    out.push({
      id: `u-${i.id}`,
      // followUp 이 있으면 사람이 적어 둔 문장이 낫다
      text: i.followUp ?? `「${i.text}」 이렇게 들었는데, 맞으실까요?`,
      from: sourceLabel(i),
      status: 'unverified',
    });
  }

  for (const i of [...lyricInputs(story)].reverse()) {
    out.push({
      id: `v-${i.id}`,
      text: `「${i.text}」 그때 이야기를 조금 더 들려주시겠어요?`,
      from: sourceLabel(i),
      status: 'verified',
    });
  }

  return out.slice(0, MAX);
}

export default function SuggestPage() {
  const { s } = useSession();
  const verified = lyricInputs(s.story);
  // 가장 마지막에 확인된 이야기가 '앞선 답변'이다
  const summary = verified.at(-1)?.text ?? '';
  const suggestions = suggestionsFrom(s.story);

  return (
    <Screen
      title="다음 질문 추천"
      subtitle="어르신이 하신 말씀에서 뽑은 질문이에요"
      decoration={<Ornaments variant="notes" />}
      footer={
        <>
          <PrimaryButton href="/session/interview">인터뷰로 돌아가기</PrimaryButton>
          <div className="mt-3 text-center">
            <Link
              href="/session/story"
              className="inline-flex min-h-[44px] items-center border-b-2 border-leaf-300 px-1 text-[1.0625rem] font-bold text-leaf-700"
            >
              이야기 정리 보기
            </Link>
          </div>
        </>
      }
    >
      <Card className="flex items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[1rem] font-bold text-amber-700">
            <SparkGlyph />앞선 답변 요약
          </p>
          {summary ? (
            <p className="mt-1.5 text-[1.1875rem] font-extrabold leading-snug text-ink-900">
              {summary}
            </p>
          ) : (
            <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-500">
              아직 확인된 이야기가 없어요. 이야기 정리에서 어르신과 함께 확인하시면
              여기에 보여요.
            </p>
          )}
        </div>
        <Art name="avatar_daughter" size={92} alt="" className="shrink-0" />
      </Card>

      {suggestions.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {suggestions.map((q, i) => (
            <li
              key={q.id}
              className="flex min-h-[76px] w-full items-start gap-3.5 rounded-[20px] bg-surface p-4 shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[1.25rem] font-extrabold text-brand-700">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[1.125rem] font-bold leading-snug text-ink-900">
                  {q.text}
                </span>
                {/* 어느 이야기에서 나온 질문인지 적는다. 근거가 안 보이면
                    이것도 그냥 어디선가 온 문장이 된다. */}
                <span className="mt-1 block text-[0.8125rem] font-semibold text-ink-500">
                  {STORY_STATUS_LABELS[q.status]}
                  {q.from ? ` · 출처 ${q.from}` : ''}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="mt-4 p-4">
          <p className="text-[1.0625rem] font-extrabold text-ink-900">
            아직 추천할 질문이 없어요
          </p>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-700">
            이 화면은 이번 회기에서 나온 이야기로만 질문을 만들어요. 인터뷰에서
            더 들으신 뒤 전사 교정과 이야기 정리를 거치면 여기에 모입니다.
          </p>
        </Card>
      )}

      <div className="mt-4">
        <NoteBar tone="leaf" icon={<IconInfo size={20} className="text-leaf-600" />}>
          어르신이 하신 말씀만 인용해 질문을 만들어요. 여기 없는 질문은 복지사가
          직접 여쭤보셔도 좋아요.
        </NoteBar>
      </div>
    </Screen>
  );
}

function SparkGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
      <path d="m12 2.6 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" />
    </svg>
  );
}
