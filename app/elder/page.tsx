'use client';

import { useState } from 'react';
import { Art } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chevron, Chip, IconCircle, PrimaryButton } from '@/components/ui';
import { IconChat, IconMusicNote, IconPeople } from '@/components/icons';
import { useSession } from '@/lib/store';
import type { ArtKey } from '@/lib/art';

/** 어르신 프로필 (deck p.2) */
export default function ElderProfilePage() {
  const { s } = useSession();
  const [saved, setSaved] = useState(false);
  const e = s.elder;

  const rows = [
    {
      key: 'honorific',
      icon: <IconPeople size={26} className="text-leaf-600" />,
      title: '호칭',
      body: <span className="text-[1rem] text-ink-500">{e.honorific}</span>,
    },
    {
      key: 'communication',
      icon: <IconChat size={26} className="text-leaf-600" />,
      title: '의사소통 방식',
      body: (
        <span className="flex flex-wrap gap-2">
          {e.communication.map((c) => (
            <Chip key={c} tone="leaf" size="sm">
              {c}
            </Chip>
          ))}
        </span>
      ),
    },
    {
      key: 'music',
      icon: <IconMusicNote size={24} className="text-leaf-600" />,
      title: '선호 음악',
      body: (
        <span className="flex flex-wrap gap-2">
          {e.musicPreferences.map((c) => (
            <Chip key={c} tone="leaf" size="sm">
              {c}
            </Chip>
          ))}
        </span>
      ),
    },
    {
      key: 'avoid',
      icon: <WarnGlyph />,
      title: '피하고 싶은 주제',
      tone: 'brand' as const,
      body: (
        <span className="flex flex-wrap gap-2">
          {e.avoidTopics.map((c) => (
            <Chip key={c} tone="brand" size="sm">
              {c}
            </Chip>
          ))}
        </span>
      ),
    },
  ];

  return (
    <Screen
      title="어르신 프로필"
      decoration={<Ornaments variant="leafRight" />}
      footer={
        <PrimaryButton onClick={() => setSaved(true)}>
          {saved ? '저장했어요' : '프로필 저장'}
        </PrimaryButton>
      }
    >
      <Card className="flex items-center gap-4 p-4">
        <Art name={e.avatar as ArtKey} size={92} alt="" className="shrink-0" />
        <div className="min-w-0">
          <p className="text-[1.75rem] font-extrabold leading-tight text-ink-900">
            {e.displayName}
          </p>
          <p className="mt-1.5">
            <Chip tone="brand" size="sm">
              진행 {e.stage}단계
            </Chip>
          </p>
          <p className="mt-2 text-[1rem] text-ink-500">
            다음 회기:{' '}
            <span className="font-bold text-ink-900">{e.nextTopic}</span>
          </p>
        </div>
      </Card>

      <ul className="mt-4 space-y-3.5">
        {rows.map((r) => (
          <li key={r.key}>
            <button
              type="button"
              className="flex w-full items-center gap-4 rounded-[20px] bg-surface p-4 text-left shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
            >
              <IconCircle tone={r.tone ?? 'leaf'} size={56}>
                {r.icon}
              </IconCircle>
              <span className="min-w-0 flex-1">
                <span className="block text-[1.1875rem] font-extrabold text-ink-900">
                  {r.title}
                </span>
                <span className="mt-1.5 block">{r.body}</span>
              </span>
              <Chevron className="text-ink-300" />
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-4 px-1 text-[0.875rem] leading-relaxed text-ink-500">
        피하고 싶은 주제는 질문 추천과 가사 생성에서 자동으로 제외돼요. 의학적
        상태나 진단은 기록하지 않아요.
      </p>
    </Screen>
  );
}

function WarnGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="26"
      height="26"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-brand-600"
      aria-hidden="true"
    >
      <path d="M12 3.8 21 19.4H3Z" />
      <path d="M12 9.6v4.2" />
      <circle cx="12" cy="16.6" r="1.05" fill="currentColor" stroke="none" />
    </svg>
  );
}
