'use client';

import { useState } from 'react';
import { Art } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chevron, Chip, IconCircle, OutlineButton, PrimaryButton } from '@/components/ui';
import { IconCopy, IconExport } from '@/components/icons';
import { REACTIONS } from '@/lib/domain';
import { useSession } from '@/lib/store';

const MAX = 1000;

/**
 * 활동일지 편집 (deck p.10)
 *
 * The draft is AI-written and stays a draft until the social worker saves it
 * (원칙 3 · 사람 검수 필수). Export is copy/PDF/Excel shaped so it slots into
 * the centre's existing paperwork rather than replacing it (원칙 8).
 */
export default function LogPage() {
  const { s, set } = useSession();
  const [copied, setCopied] = useState(false);
  const selected = REACTIONS.filter((r) => s.reactions.includes(r.id));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(s.logDraft);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Screen
      bell
      title="활동일지 편집"
      subtitle="오늘의 기록을 정리하고 저장해보세요"
      decoration={<Ornaments variant="both" />}
      footer={
        <>
          <div className="mb-3">
            <OutlineButton tone="leaf" onClick={copy} leading={<IconCopy size={22} />}>
              {copied ? '복사했어요' : '복사하기'}
            </OutlineButton>
          </div>
          <PrimaryButton
            href="/session/wrap"
            onClick={() => set('logSaved', true)}
            leading={<IconExport size={22} />}
          >
            저장하고 내보내기
          </PrimaryButton>
        </>
      }
    >
      <Card className="flex min-h-[72px] items-center gap-3.5 px-4">
        <IconCircle tone="leaf" size={48}>
          <Art name="ui_program" size={26} alt="" />
        </IconCircle>
        <span className="flex-1 text-[1.125rem] font-bold text-ink-900">프로그램명</span>
        <span className="text-[1.125rem] font-extrabold text-ink-900">{s.topic}</span>
      </Card>

      <Card className="mt-3 flex min-h-[72px] items-center gap-3.5 px-4">
        <IconCircle tone="brand" size={48}>
          <Art name="ui_duration" size={26} alt="" />
        </IconCircle>
        <span className="flex-1 text-[1.125rem] font-bold text-ink-900">진행 시간</span>
        <span className="text-[1.25rem] font-extrabold text-ink-900">30분</span>
      </Card>

      <Card className="mt-3 p-4">
        <div className="flex items-center gap-3.5">
          <IconCircle tone="amber" size={48}>
            <Art name="ui_reaction" size={26} alt="" />
          </IconCircle>
          <span className="text-[1.125rem] font-bold text-ink-900">관찰된 반응</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {selected.length > 0 ? (
            selected.map((r) => (
              <Chip key={r.id} tone="brand">
                {r.label}
              </Chip>
            ))
          ) : (
            <p className="text-[0.9375rem] text-ink-500">
              선택된 반응이 없어요. 관찰 반응 기록에서 먼저 남겨 주세요.
            </p>
          )}
        </div>
      </Card>

      <Card className="mt-3 flex min-h-[72px] items-center gap-3.5 px-4">
        <IconCircle tone="leaf" size={48}>
          <Art name="ui_next_topic" size={26} alt="" />
        </IconCircle>
        <span className="flex-1 text-[1.125rem] font-bold text-ink-900">
          다음 추천 주제
        </span>
        <span className="text-[1.0625rem] font-extrabold text-ink-900">
          {s.nextTopic}
        </span>
        <Chevron className="text-ink-300" />
      </Card>

      <Card className="mt-3 p-4">
        <div className="flex items-center gap-3">
          <IconCircle tone="brand" size={44}>
            <Art name="ui_draft" size={26} alt="" />
          </IconCircle>
          <label htmlFor="draft" className="text-[1.125rem] font-bold text-ink-900">
            활동일지 초안{' '}
            <span className="text-[0.9375rem] font-medium text-ink-500">(수정 가능)</span>
          </label>
        </div>

        <textarea
          id="draft"
          rows={7}
          maxLength={MAX}
          value={s.logDraft}
          onChange={(e) => set('logDraft', e.target.value)}
          className="mt-3 w-full resize-none rounded-[16px] bg-surface-strong p-4 text-[1rem] leading-[1.75] text-ink-900"
        />
        <p className="mt-1 text-right text-[0.875rem] text-ink-500">
          {s.logDraft.length} / {MAX}
        </p>

        <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-500">
          AI가 쓴 초안이에요. 복지사가 확인하고 고친 내용만 최종 기록이 됩니다.
        </p>
      </Card>
    </Screen>
  );
}
