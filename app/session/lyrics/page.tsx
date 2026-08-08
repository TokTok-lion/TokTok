'use client';

import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chevron, PrimaryButton } from '@/components/ui';
import { IconEdit, IconInfo, IconRefresh } from '@/components/icons';
import { lyricInputs } from '@/lib/domain';
import { SEED_LYRICS } from '@/lib/seed';
import { useSession } from '@/lib/store';

/** 가사 검수 (deck p.7) */
export default function LyricsPage() {
  const { s, set } = useSession();
  const basis = lyricInputs(s.story);

  return (
    <Screen
      title="가사 검수"
      subtitle="생애 이야기를 바탕으로 만든 가사를 확인해 주세요"
      decoration={<Ornaments variant="both" />}
      footer={
        <PrimaryButton
          href="/session/style"
          onClick={() => set('lyricsApproved', true)}
          trailing={<Chevron className="text-white" />}
        >
          이 가사 확정
        </PrimaryButton>
      }
    >
      <Card className="px-4 py-5">
        {SEED_LYRICS.map((sec, i) => (
          <div
            key={sec.label}
            className={i > 0 ? 'mt-5 border-t border-dashed border-brand-200 pt-5' : ''}
          >
            <div className="flex items-start gap-4">
              <span
                className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full text-[1.0625rem] font-extrabold ${
                  sec.tone === 'chorus'
                    ? 'bg-leaf-100 text-leaf-700'
                    : 'bg-brand-100 text-brand-800'
                }`}
              >
                {sec.label}
              </span>
              <p className="flex-1 whitespace-pre-line text-[1.375rem] font-extrabold leading-[1.55] tracking-[-0.01em] text-ink-900">
                {sec.lines.join('\n')}
              </p>
            </div>
          </div>
        ))}
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          className="flex min-h-[80px] flex-col items-center justify-center gap-1 rounded-[16px] bg-surface px-3 shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
        >
          <span className="flex items-center gap-2 text-[1.0625rem] font-extrabold text-ink-900">
            <IconEdit size={22} className="text-brand-600" />
            가사 수정
          </span>
          <span className="text-[0.8125rem] leading-snug text-ink-500">
            일부 내용을 수정할 수 있어요
          </span>
        </button>
        <button
          type="button"
          className="flex min-h-[80px] flex-col items-center justify-center gap-1 rounded-[16px] bg-surface px-3 shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
        >
          <span className="flex items-center gap-2 text-[1.0625rem] font-extrabold text-ink-900">
            <IconRefresh size={22} className="text-leaf-600" />
            다시 생성
          </span>
          <span className="text-[0.8125rem] leading-snug text-ink-500">
            새로운 가사를 만들어 드려요
          </span>
        </button>
      </div>

      {/* 원칙 2: 가사가 어떤 사실에서 나왔는지 항상 되짚을 수 있어야 한다 */}
      <details className="mt-4 rounded-[16px] bg-brand-50 p-4">
        <summary className="flex cursor-pointer items-start gap-3 text-[0.9375rem] font-bold leading-relaxed text-ink-900 marker:content-none">
          <IconInfo size={22} className="mt-0.5 shrink-0 text-brand-700" />
          <span>
            이 가사는 확정된 이야기 {basis.length}건만을 바탕으로 생성되었습니다.
            <span className="mt-1 block text-[0.875rem] font-medium text-ink-700">
              근거가 된 이야기 보기
            </span>
          </span>
        </summary>
        <ul className="mt-2.5 space-y-1.5 border-t border-brand-200 pt-2.5">
          {basis.map((b) => (
            <li key={b.id} className="text-[0.875rem] font-semibold text-ink-700">
              · {b.text}{' '}
              <span className="font-normal text-ink-500">
                ({b.sources.map((x) => x.label).join(', ')})
              </span>
            </li>
          ))}
        </ul>
      </details>
    </Screen>
  );
}
