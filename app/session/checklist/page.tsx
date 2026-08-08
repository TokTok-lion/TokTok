'use client';

import { Art } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, IconCircle, NoteBar, PrimaryButton } from '@/components/ui';
import { IconChat, IconClock, IconEdit, IconImage, IconInfo, IconMic } from '@/components/icons';
import { useSession } from '@/lib/store';

const ITEMS = [
  { key: 'elder', label: '어르신 선택 완료', Icon: IconChat, tone: 'leaf' as const },
  { key: 'cards', label: '기억 카드 준비 완료', Icon: IconImage, tone: 'leaf' as const },
  { key: 'familyNote', label: '가족 메모 확인 완료', Icon: IconEdit, tone: 'leaf' as const },
  { key: 'mic', label: '마이크 테스트 필요', Icon: IconMic, tone: 'amber' as const },
];

/** 회기 시작 체크리스트 (deck p.20) */
export default function ChecklistPage() {
  const { s, toggleChecklist } = useSession();
  const pending = ITEMS.filter((i) => !s.checklist[i.key]).length;

  return (
    <Screen
      menu
      back={false}
      bell
      title="회기 시작 체크리스트"
      subtitle="오늘 진행 전에 함께 확인해요"
      decoration={<Ornaments variant="leafRight" />}
      footer={
        <PrimaryButton href="/session/cards">
          인터뷰 시작 {pending > 0 ? `(${pending}건 남음)` : ''}
        </PrimaryButton>
      }
    >
      <Card className="flex items-center gap-4 p-4">
        <Art name="avatar_grandmother" size={104} alt="" className="shrink-0" />
        <div className="min-w-0">
          <p className="text-[1.625rem] font-extrabold leading-tight text-ink-900">
            {s.elder.honorific}
          </p>
          <p className="mt-2.5 flex items-center gap-2 border-b border-hairline pb-2 text-[0.9375rem]">
            <IconChat size={19} className="shrink-0 text-brand-600" />
            <span className="flex-1 text-ink-500">오늘의 주제</span>
            <span className="font-extrabold text-brand-700">{s.topic}</span>
          </p>
          <p className="mt-2 flex items-center gap-2 text-[0.9375rem]">
            <IconClock size={19} className="shrink-0 text-brand-600" />
            <span className="flex-1 text-ink-500">시간</span>
            <span className="font-extrabold text-brand-700">오전 10:00</span>
          </p>
        </div>
      </Card>

      <ul className="mt-4 space-y-3">
        {ITEMS.map((it) => {
          const done = !!s.checklist[it.key];
          return (
            <li key={it.key}>
              <button
                type="button"
                role="switch"
                aria-checked={done}
                onClick={() => toggleChecklist(it.key)}
                className="flex min-h-[80px] w-full items-center gap-4 rounded-[20px] bg-surface px-4 text-left shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
              >
                <IconCircle tone={done ? 'leaf' : it.tone} size={54}>
                  {done ? (
                    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-leaf-600" aria-hidden="true">
                      <path d="m5 13 4.5 4.5L19 7" />
                    </svg>
                  ) : (
                    <it.Icon size={24} className="text-amber-700" />
                  )}
                </IconCircle>
                <span className="flex-1 text-[1.1875rem] font-extrabold text-ink-900">
                  {it.label}
                </span>
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[2.5px] ${
                    done ? 'border-leaf-600 text-leaf-600' : 'border-brand-500'
                  }`}
                >
                  {done ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m5 13 4.5 4.5L19 7" />
                    </svg>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-4">
        <NoteBar tone="amber" icon={<IconInfo size={20} />}>
          준비가 끝나면
          <br />
          바로 인터뷰를 시작할 수 있어요
        </NoteBar>
      </div>
    </Screen>
  );
}
