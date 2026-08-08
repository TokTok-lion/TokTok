'use client';

import { useState } from 'react';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, CheckCircle, PrimaryButton, Waveform } from '@/components/ui';
import { IconEdit, IconRewind } from '@/components/icons';
import { SEED_UNCERTAIN_WORDS } from '@/lib/seed';
import { useSession } from '@/lib/store';

/** 전사 교정 (deck p.5) */
export default function TranscriptPage() {
  const { s, set } = useSession();
  const [lines, setLines] = useState(s.transcript.map((t) => t.text));

  const save = () => {
    set(
      'transcript',
      s.transcript.map((t, i) => ({ ...t, text: lines[i] })),
    );
    set('transcriptConfirmed', true);
  };

  return (
    <Screen
      title="전사 교정"
      subtitle="기록된 내용을 확인하고 정확하게 다듬어 주세요"
      decoration={<Ornaments variant="both" />}
      footer={
        <PrimaryButton
          href="/session/story"
          onClick={save}
          leading={<IconEdit size={22} />}
        >
          수정 완료
        </PrimaryButton>
      }
    >
      <Card className="p-4">
        <p className="text-[1rem] font-bold text-ink-500">전사 내용</p>

        <ul className="mt-2">
          {s.transcript.map((t, i) => (
            <li key={t.id} className="border-b border-hairline py-3 last:border-0">
              <label htmlFor={`line-${t.id}`} className="sr-only">
                전사 {i + 1}번째 문장
              </label>
              <input
                id={`line-${t.id}`}
                value={lines[i]}
                onChange={(e) => {
                  const next = [...lines];
                  next[i] = e.target.value;
                  setLines(next);
                }}
                className="w-full bg-transparent text-[1.1875rem] font-bold leading-snug text-ink-900 outline-none focus-visible:rounded-lg focus-visible:bg-brand-50"
              />
            </li>
          ))}
        </ul>

        <div className="mt-2 flex items-center gap-3 border-t border-hairline pt-3">
          <button
            type="button"
            className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-full pr-2 text-[1.0625rem] font-bold text-brand-700"
          >
            <IconRewind size={26} />
            다시 듣기
          </button>
          <Waveform bars={40} height={28} tone="brand" seed={5} className="flex-1 overflow-hidden" />
        </div>
      </Card>

      <Card className="mt-4 p-4">
        <p className="text-[1rem] font-bold text-ink-500">헷갈린 단어</p>
        <p className="mt-1 text-[0.875rem] text-ink-500">
          자동 전사가 확신하지 못한 단어예요. 눌러서 고칠 수 있어요.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          {SEED_UNCERTAIN_WORDS.map((w) => (
            <button
              key={w}
              type="button"
              className="min-h-[52px] rounded-[14px] bg-brand-50 px-6 text-[1.125rem] font-bold text-ink-900"
            >
              {w}
            </button>
          ))}
        </div>
      </Card>

      <Card className="mt-4 flex items-center gap-3 bg-leaf-50 p-4 shadow-none">
        <CheckCircle size={40} />
        <p className="text-[1.0625rem] font-bold text-leaf-800">
          복지사가 쉽게 고칠 수 있어요
        </p>
      </Card>
    </Screen>
  );
}
