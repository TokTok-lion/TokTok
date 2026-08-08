'use client';

import Link from 'next/link';
import { Art } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chevron, Chip } from '@/components/ui';
import { lyricInputs } from '@/lib/domain';
import { useSession } from '@/lib/store';
import type { ArtKey } from '@/lib/art';

/** 기록 탭 홈 — 확인·검수·일지 화면 모음 */
export default function RecordsPage() {
  const { s } = useSession();
  const pendingFamily = s.familyStories.filter((f) => f.state === 'pending').length;
  const unverified = s.story.filter((i) => i.status === 'unverified').length;

  const rows: {
    href: string;
    art: ArtKey;
    title: string;
    desc: string;
    badge?: { label: string; tone: 'brand' | 'leaf' | 'amber' };
  }[] = [
    {
      href: '/session/confirm',
      art: 'icon_people_shield',
      title: '인터뷰 내용 확인',
      desc: '기록된 이야기를 어르신과 확인해요',
    },
    {
      href: '/session/transcript',
      art: 'icon_document_green',
      title: '전사 교정',
      desc: '들은 내용을 정확하게 다듬어요',
      badge: s.transcriptConfirmed
        ? { label: '완료', tone: 'leaf' }
        : { label: '확인 필요', tone: 'brand' },
    },
    {
      href: '/session/story',
      art: 'icon_note_green',
      title: '이야기 정리 · 사실 확인',
      desc: '확인된 이야기만 가사로 보내요',
      badge:
        unverified > 0
          ? { label: `확인 필요 ${unverified}`, tone: 'amber' }
          : { label: `확인 ${lyricInputs(s.story).length}건`, tone: 'leaf' },
    },
    {
      href: '/family/stories',
      art: 'icon_envelope_open',
      title: '가족이 남긴 이야기',
      desc: '가족 제보를 확인 후 반영해요',
      badge:
        pendingFamily > 0
          ? { label: `${pendingFamily}건 대기`, tone: 'brand' }
          : undefined,
    },
    {
      href: '/session/lyric-card',
      art: 'icon_text_size',
      title: '가사 카드',
      desc: '큰 글씨로 함께 읽어요',
    },
    {
      href: '/session/reactions',
      art: 'react_smile',
      title: '관찰 반응 기록',
      desc: '오늘 보인 행동을 남겨요',
    },
    {
      href: '/session/log',
      art: 'icon_note_pencil',
      title: '활동일지 편집',
      desc: '초안을 확인하고 내보내요',
      badge: s.logSaved ? { label: '저장됨', tone: 'leaf' } : undefined,
    },
    {
      href: '/session/wrap',
      art: 'icon_calendar_check',
      title: '회기 마무리',
      desc: '반응·다음 주제를 정리해요',
    },
  ];

  return (
    <Screen
      menu
      back={false}
      bell
      title="기록"
      subtitle="확인하고 남기는 화면을 모았어요"
      decoration={<Ornaments variant="leafRight" />}
    >
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.href}>
            <Link
              href={r.href}
              className="flex min-h-[84px] items-center gap-3.5 rounded-[20px] bg-surface px-3.5 shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
            >
              <Art name={r.art} size={52} alt="" className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[1.125rem] font-extrabold text-ink-900">
                    {r.title}
                  </span>
                  {r.badge ? (
                    <Chip tone={r.badge.tone} size="sm">
                      {r.badge.label}
                    </Chip>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-[0.9375rem] text-ink-500">
                  {r.desc}
                </span>
              </span>
              <Chevron />
            </Link>
          </li>
        ))}
      </ul>

      <Card className="mt-4 p-4">
        <p className="text-[0.9375rem] leading-relaxed text-ink-700">
          기록은 이 기기에만 저장돼요. 어르신의 음성·이야기·가사는 서비스 밖으로
          자동 전송되지 않습니다.
        </p>
      </Card>
    </Screen>
  );
}
