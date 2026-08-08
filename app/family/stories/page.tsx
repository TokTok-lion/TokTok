'use client';

import { ArtBox } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chip, NoteBar, PrimaryButton, Waveform } from '@/components/ui';
import { IconPeople, IconPlay } from '@/components/icons';
import { formatDuration } from '@/lib/domain';
import { useSession } from '@/lib/store';
import type { ArtKey } from '@/lib/art';

/** 가족이 남긴 이야기 (deck p.4) */
export default function FamilyStoriesPage() {
  const { s, setContributionState } = useSession();
  const remaining = s.familyStories.filter((f) => f.state === 'pending').length;

  return (
    <Screen
      bell
      title="가족이 남긴 이야기"
      subtitle="가족이 보내준 소중한 이야기들을 함께 확인해요"
      decoration={<Ornaments variant="leafLeft" />}
      footer={
        <PrimaryButton href="/session/story" disabled={remaining > 0}>
          {remaining > 0 ? `${remaining}건을 더 확인해 주세요` : '검토 완료'}
        </PrimaryButton>
      }
    >
      <ul className="space-y-4">
        {s.familyStories.map((f) => (
          <Card as="li" key={f.id} className="p-4">
            <div className="flex gap-3">
              <div className="min-w-0 flex-1">
                <Chip tone="brand" size="sm">
                  가족 제보
                </Chip>
                <h2 className="mt-2 text-[1.25rem] font-extrabold leading-tight text-ink-900">
                  {f.title}
                </h2>

                {f.state === 'pending' ? (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[0.9375rem] font-bold text-brand-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
                    확인 필요
                  </p>
                ) : null}

                {f.body ? (
                  <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-500">
                    {f.body}
                  </p>
                ) : null}

                {f.durationSec ? (
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`${f.title} 재생`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white"
                    >
                      <IconPlay size={17} />
                    </button>
                    <Waveform bars={20} height={22} tone="muted" seed={9} />
                    <span className="shrink-0 text-[0.875rem] font-semibold text-ink-500">
                      {formatDuration(f.durationSec)}
                    </span>
                  </div>
                ) : null}
              </div>

              {f.art ? (
                <ArtBox
                  name={f.art as ArtKey}
                  alt={`${f.from}이 보낸 자료`}
                  className="w-[124px] shrink-0 self-start"
                  fit="contain"
                />
              ) : null}
            </div>

            <div className="mt-3.5 grid grid-cols-[1.35fr_1fr] gap-2.5">
              <button
                type="button"
                aria-pressed={f.state === 'accepted'}
                onClick={() =>
                  setContributionState(
                    'familyStories',
                    f.id,
                    f.state === 'accepted' ? 'pending' : 'accepted',
                  )
                }
                className={`min-h-[54px] rounded-[14px] text-[1.0625rem] font-bold ${
                  f.state === 'accepted'
                    ? 'bg-brand-600 text-white'
                    : 'bg-brand-100 text-brand-800'
                }`}
              >
                {f.state === 'accepted' ? '반영함' : '확인 후 반영'}
              </button>
              <button
                type="button"
                aria-pressed={f.state === 'held'}
                onClick={() =>
                  setContributionState(
                    'familyStories',
                    f.id,
                    f.state === 'held' ? 'pending' : 'held',
                  )
                }
                className={`min-h-[54px] rounded-[14px] border-2 text-[1.0625rem] font-bold ${
                  f.state === 'held'
                    ? 'border-ink-500 bg-surface-sunk text-ink-700'
                    : 'border-hairline bg-surface-strong text-ink-700'
                }`}
              >
                보류
              </button>
            </div>
          </Card>
        ))}
      </ul>

      <Card className="mt-4 flex items-start gap-3 bg-leaf-50 p-4 shadow-none">
        <IconPeople size={30} className="mt-0.5 shrink-0 text-leaf-600" />
        <div>
          <p className="text-[1.0625rem] font-extrabold text-ink-900">
            어르신과 복지사 확인 뒤 반영해요
          </p>
          <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-700">
            제보된 이야기는 어르신과 복지사가 함께 확인한 뒤, 생애여정 기록에
            반영됩니다.
          </p>
        </div>
      </Card>

      <div className="mt-3">
        <NoteBar tone="brand">
          가족 제보는 그 자체로 사실이 되지 않아요. 어르신이 확인한 내용만
          가사에 쓰여요.
        </NoteBar>
      </div>
    </Screen>
  );
}
