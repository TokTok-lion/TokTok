'use client';

import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chevron, NoteBar, PrimaryButton } from '@/components/ui';
import { IconHeart, IconMinus, IconQuestion } from '@/components/icons';
import {
  STORY_STATUS_LABELS,
  lyricInputs,
  type StoryItem,
  type StoryStatus,
} from '@/lib/domain';
import { useSession } from '@/lib/store';

const GROUPS: {
  status: StoryStatus;
  tone: 'leaf' | 'amber' | 'neutral';
  head: string;
  count: string;
}[] = [
  { status: 'verified', tone: 'leaf', head: 'text-leaf-700', count: 'bg-leaf-100 text-leaf-700' },
  { status: 'unverified', tone: 'amber', head: 'text-brand-700', count: 'bg-brand-100 text-brand-800' },
  { status: 'excluded', tone: 'neutral', head: 'text-ink-700', count: 'bg-surface-sunk text-ink-500' },
];

/** 이야기 정리 · 사실 확인 (deck p.6) */
export default function StoryPage() {
  const { s, set, setStoryStatus } = useSession();
  const ready = lyricInputs(s.story).length > 0;

  return (
    <Screen
      title="이야기 정리"
      subtitle="확인된 이야기를 바탕으로 가사를 만들어요"
      decoration={<Ornaments variant="both" />}
      footer={
        <PrimaryButton
          href="/session/lyrics"
          disabled={!ready}
          onClick={() => set('storyConfirmed', true)}
          trailing={<Chevron className="text-white" />}
        >
          {ready ? '가사로 보내기' : '확인된 이야기가 필요해요'}
        </PrimaryButton>
      }
    >
      <div className="space-y-4">
        {GROUPS.map((g) => {
          const items = s.story.filter((i) => i.status === g.status);
          return (
            <Card key={g.status} className="p-4">
              <div className="flex items-center gap-3">
                <StatusGlyph status={g.status} />
                <h2 className={`flex-1 text-[1.3125rem] font-extrabold ${g.head}`}>
                  {STORY_STATUS_LABELS[g.status]}
                </h2>
                <span
                  className={`rounded-full px-3 py-1 text-[0.9375rem] font-bold ${g.count}`}
                >
                  {items.length}개
                </span>
              </div>

              <ul className="mt-3 rounded-[16px] bg-surface-strong px-3">
                {items.map((i) => (
                  <li
                    key={i.id}
                    className="border-b border-hairline py-3 last:border-0"
                  >
                    <StoryRow item={i} onMove={setStoryStatus} />
                  </li>
                ))}
                {items.length === 0 ? (
                  <li className="py-4 text-center text-[0.9375rem] text-ink-500">
                    항목이 없어요
                  </li>
                ) : null}
              </ul>
            </Card>
          );
        })}
      </div>

      <div className="mt-4">
        <NoteBar tone="amber" icon={<IconHeart size={19} className="text-brand-500" />}>
          확인된 이야기만 가사에 반영돼요
        </NoteBar>
      </div>
    </Screen>
  );
}

function StoryRow({
  item,
  onMove,
}: {
  item: StoryItem;
  onMove: (id: string, status: StoryStatus) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0">
        <StatusGlyph status={item.status} small />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[1.0625rem] font-bold leading-snug text-ink-900">
          {item.text}
        </span>
        <span className="mt-0.5 block text-[0.8125rem] font-semibold text-ink-500">
          출처 · {item.sources.map((s) => s.label).join(', ')}
        </span>

      </span>

      {/* 어르신이 언제든 판단을 바꿀 수 있어야 한다 (원칙 1 · 본인 최종 통제) */}
      <span className="flex shrink-0 gap-1.5">
        {(['verified', 'unverified', 'excluded'] as StoryStatus[])
          .filter((st) => st !== item.status)
          .map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => onMove(item.id, st)}
              title={`${STORY_STATUS_LABELS[st]}(으)로 옮기기`}
              aria-label={`"${item.text}" 항목을 ${STORY_STATUS_LABELS[st]}(으)로 옮기기`}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-surface"
            >
              <StatusGlyph status={st} small />
            </button>
          ))}
      </span>
    </div>
  );
}

function StatusGlyph({
  status,
  small = false,
}: {
  status: StoryStatus;
  small?: boolean;
}) {
  const size = small ? 24 : 44;
  const inner = small ? 13 : 24;
  const bg =
    status === 'verified'
      ? 'bg-leaf-600'
      : status === 'unverified'
        ? 'bg-amber-400'
        : 'bg-ink-300';
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${bg}`}
      style={{ width: size, height: size }}
    >
      {status === 'verified' ? (
        <svg viewBox="0 0 24 24" width={inner} height={inner} fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m5 13 4.5 4.5L19 7" />
        </svg>
      ) : status === 'unverified' ? (
        <IconQuestion size={inner} className="text-ink-900" strokeWidth={2.6} />
      ) : (
        <IconMinus size={inner} className="text-white" />
      )}
    </span>
  );
}
