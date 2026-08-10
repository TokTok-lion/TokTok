'use client';

import { Contradictions } from '@/components/Contradictions';
import { ExtractFacts } from '@/components/ExtractFacts';
import { Ornaments, Screen } from '@/components/Shell';
import { SourceChips } from '@/components/SourcePlayer';
import { Card, Chevron, NoteBar, PrimaryButton } from '@/components/ui';
import { IconHeart, IconInfo, IconMinus, IconQuestion } from '@/components/icons';
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
  const examples = s.story.filter((i) => i.example).length;

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
      {/* 둘러보기 기기에는 씨앗 이야기가 미리 들어 있다. 화면 모양을 보여
          주려고 넣은 것인데 실제 추출 결과와 생김새가 같아서, 직접 녹음해
          본 사람이 "내 녹음이 반영된 건가?" 하고 묻는 일이 실제로 있었다.
          목록 위에서 한 번, 항목마다 한 번 더 밝힌다. */}
      {examples > 0 ? (
        <NoteBar tone="amber" icon={<IconInfo size={19} className="text-brand-600" />}>
          아래 {examples}건은 <strong>둘러보기용 예시</strong>예요. 녹음에서 이야기를
          뽑으면 예시는 사라지고 어르신 말씀만 남습니다.
        </NoteBar>
      ) : null}

      {/* 지난 회기와 어긋나는 곳부터 보여준다 — 정리하기 전에 알아야 한다 */}
      <Contradictions />

      {/* 목록이 비어 있으면 여기가 시작점이다. 녹음 → 전사 → 이야기가
          여기서 이어지고, 출처 시각이 자동으로 붙는다. */}
      <ExtractFacts />

      <div className="mt-4 space-y-4">
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
        {/* 예시라는 말을 항목 안에 붙인다. 목록 위 안내문만으로는 부족했다 —
            줄마다 '출처 · 어르신 음성 0:42'가 붙어 있어서, 방금 녹음한
            사람이 자기 녹음이 반영된 줄로 읽는다. */}
        {item.example ? (
          <span className="mt-1 inline-block rounded-full bg-surface-sunk px-2 py-0.5 text-[0.75rem] font-extrabold text-ink-700">
            예시 · 실제 녹음이 아니에요
          </span>
        ) : null}
        {/* 출처를 글자로만 적어 두면 주장이다. 눌러서 그 대목을 들을 수
            있어야 근거가 된다. */}
        <span className="mt-1 block">
          <SourceChips sources={item.sources} />
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
