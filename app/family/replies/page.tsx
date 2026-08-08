'use client';

import { ArtBox } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, IconCircle, NoteBar, PrimaryButton, Waveform } from '@/components/ui';
import { IconClock, IconHeart, IconImage, IconMic, IconPlay } from '@/components/icons';
import { formatDuration } from '@/lib/domain';
import { useSession } from '@/lib/store';
import type { ArtKey } from '@/lib/art';

/** 가족 답장 보기 (deck p.16) */
export default function FamilyRepliesPage() {
  const { s, setContributionState } = useSession();
  const accepted = s.familyReplies.filter((r) => r.state === 'accepted').length;

  return (
    <Screen
      menu
      back={false}
      bell
      title="가족 답장 보기"
      subtitle="가족이 남긴 따뜻한 답장을 확인해요"
      decoration={<Ornaments variant="leafRight" />}
      footer={
        <PrimaryButton href="/session/story" disabled={accepted === 0}>
          {accepted === 0 ? '반영할 내용을 선택해 주세요' : '선택 내용 저장'}
        </PrimaryButton>
      }
    >
      <ul className="space-y-4">
        {s.familyReplies.map((r) => (
          <Card as="li" key={r.id} className="p-4">
            <div className="flex gap-3.5">
              {r.art ? (
                <ArtBox
                  name={r.art as ArtKey}
                  alt={`${r.from}이 보낸 ${r.title}`}
                  className="h-[104px] w-[104px] shrink-0 rounded-[14px] object-cover"
                />
              ) : (
                <IconCircle tone="brand" size={64}>
                  <span className="text-[1.875rem] font-black leading-none text-brand-400">
                    &rdquo;
                  </span>
                </IconCircle>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-[1.1875rem] font-extrabold text-ink-900">
                    {r.kind === 'photo' ? (
                      <IconCircle tone="amber" size={34}>
                        <IconImage size={18} className="text-amber-700" />
                      </IconCircle>
                    ) : r.kind === 'voice' ? (
                      <IconCircle tone="brand" size={34}>
                        <IconMic size={18} className="text-brand-600" />
                      </IconCircle>
                    ) : null}
                    {r.title}
                  </h2>
                  {r.state === 'accepted' ? (
                    <span className="shrink-0 rounded-full bg-leaf-100 px-2.5 py-1 text-[0.8125rem] font-bold text-leaf-700">
                      ✓ 반영됨
                    </span>
                  ) : r.state === 'held' ? (
                    <span className="shrink-0 rounded-full bg-surface-sunk px-2.5 py-1 text-[0.8125rem] font-bold text-ink-500">
                      보류
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-leaf-100 px-2.5 py-1 text-[0.8125rem] font-bold text-leaf-700">
                      ✓ 확인됨
                    </span>
                  )}
                </div>

                {r.body ? (
                  <p
                    className={`mt-2 text-[1rem] leading-relaxed ${
                      r.kind === 'quote'
                        ? 'text-[1.1875rem] font-bold text-ink-900'
                        : 'text-ink-500'
                    }`}
                  >
                    {r.body}
                  </p>
                ) : null}

                {r.durationSec ? (
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`${r.title} 재생`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white"
                    >
                      <IconPlay size={16} />
                    </button>
                    <Waveform bars={22} height={22} tone="muted" seed={4} />
                    <span className="shrink-0 text-[0.875rem] font-semibold text-ink-500">
                      {formatDuration(r.durationSec)}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* 가족 제보는 어르신 확인 전까지 사실이 아니다 (원칙 2) */}
            <div className="mt-3.5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                aria-pressed={r.state === 'accepted'}
                onClick={() =>
                  setContributionState(
                    'familyReplies',
                    r.id,
                    r.state === 'accepted' ? 'pending' : 'accepted',
                  )
                }
                className={`flex min-h-[52px] items-center justify-center gap-1.5 rounded-[14px] text-[1.0625rem] font-bold ${
                  r.state === 'accepted'
                    ? 'bg-leaf-600 text-white'
                    : 'bg-leaf-50 text-leaf-700'
                }`}
              >
                <CheckGlyph />
                반영
              </button>
              <button
                type="button"
                aria-pressed={r.state === 'held'}
                onClick={() =>
                  setContributionState(
                    'familyReplies',
                    r.id,
                    r.state === 'held' ? 'pending' : 'held',
                  )
                }
                className={`flex min-h-[52px] items-center justify-center gap-1.5 rounded-[14px] text-[1.0625rem] font-bold ${
                  r.state === 'held'
                    ? 'bg-brand-600 text-white'
                    : 'bg-brand-50 text-brand-700'
                }`}
              >
                <IconClock size={19} />
                보류
              </button>
            </div>
          </Card>
        ))}
      </ul>

      <div className="mt-4">
        <NoteBar tone="brand" icon={<IconHeart size={19} />}>
          가족 내용은 어르신 확인 후 반영돼요
        </NoteBar>
      </div>
    </Screen>
  );
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 13 4.5 4.5L19 7" />
    </svg>
  );
}
