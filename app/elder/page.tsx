'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Art, ArtBox } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chevron, Chip, IconCircle, PrimaryButton } from '@/components/ui';
import {
  IconChat,
  IconEnvelopeOpen,
  IconMusicNote,
  IconPeople,
  IconSend,
} from '@/components/icons';
import { flowState } from '@/lib/flow';
import { SEED_RESUME } from '@/lib/seed';
import { useSession } from '@/lib/store';
import type { ArtKey } from '@/lib/art';

/**
 * 어르신 — 사람 축.
 *
 * Owns everything that belongs to a person rather than to today's work:
 * the profile, the family collaboration screens, and this elder's past
 * sessions. The four family screens used to be unreachable from any tab;
 * this is their home.
 */
export default function ElderPage() {
  const { s } = useSession();
  const [saved, setSaved] = useState(false);
  const e = s.elder;
  const flow = flowState(s);

  const pendingFamily = s.familyStories.filter((f) => f.state === 'pending').length;
  const pendingReplies = s.familyReplies.filter((f) => f.state === 'pending').length;

  const family = [
    {
      href: '/elder/invite',
      icon: <IconSend size={22} className="text-brand-600" />,
      tone: 'brand' as const,
      title: '가족 초대',
      desc: '문자·링크로 가족을 초대해요',
    },
    {
      href: '/family/mission',
      icon: <IconChat size={22} className="text-leaf-600" />,
      tone: 'leaf' as const,
      title: '가족 미션 보내기',
      desc: '사진·응원 글·음성을 부탁해요',
    },
    {
      href: '/family/replies',
      icon: <IconEnvelopeOpen size={22} className="text-amber-700" />,
      tone: 'amber' as const,
      title: '가족 답장 보기',
      desc: '가족이 보낸 자료를 확인해요',
      badge: pendingReplies > 0 ? `${pendingReplies}건` : undefined,
    },
    {
      href: '/family/stories',
      icon: <IconPeople size={22} className="text-leaf-600" />,
      tone: 'leaf' as const,
      title: '가족이 남긴 이야기',
      desc: '확인 후 생애 기록에 반영해요',
      badge: pendingFamily > 0 ? `${pendingFamily}건 대기` : undefined,
    },
  ];

  return (
    <Screen
      back={false}
      menu
      bell
      title="어르신"
      decoration={<Ornaments variant="leafRight" />}
      footer={
        <PrimaryButton onClick={() => setSaved(true)}>
          {saved ? '저장했어요' : '프로필 저장'}
        </PrimaryButton>
      }
    >
      <Card className="flex items-center gap-4 p-4">
        <Art name={e.avatar as ArtKey} size={88} alt="" className="shrink-0" />
        <div className="min-w-0">
          <p className="text-[1.625rem] font-extrabold leading-tight text-ink-900">
            {e.displayName}
          </p>
          <p className="mt-1.5">
            <Chip tone="brand" size="sm">
              진행 {e.stage}단계
            </Chip>
          </p>
          <p className="mt-2 text-[0.9375rem] text-ink-500">
            다음 회기: <span className="font-bold text-ink-900">{e.nextTopic}</span>
          </p>
        </div>
      </Card>

      {/* 진행 중인 회기로 건너뛰기 — 목록은 회기 탭이 소유하므로 링크만 */}
      <Link
        href="/session"
        className="mt-3 flex min-h-[68px] items-center gap-3.5 rounded-[18px] bg-brand-50 px-4"
      >
        <IconCircle tone="brand" size={44}>
          <IconMusicNote size={22} className="text-brand-600" />
        </IconCircle>
        <span className="min-w-0 flex-1">
          <span className="block text-[1rem] font-extrabold text-ink-900">
            진행 중: {s.topic}
          </span>
          <span className="block text-[0.875rem] text-ink-500">
            {flow.done}/{flow.total}단계 · 다음은 {flow.next.label}
          </span>
        </span>
        <Chevron />
      </Link>

      {/* ---- 프로필 ---- */}
      {/* Glyphs are the deck's own, cut by scripts/prepare-ui-icons.py — not
          look-alikes drawn by hand. */}
      <h2 className="mt-5 text-[1.125rem] font-extrabold text-ink-900">프로필</h2>
      <ul className="mt-3 space-y-2.5">
        <ProfileRow
          icon={<Art name="ui_honorific" size={26} alt="" />}
          title="호칭"
          body={<span className="text-[0.9375rem] text-ink-500">{e.honorific}</span>}
        />
        <ProfileRow
          icon={<Art name="ui_communication" size={26} alt="" />}
          title="의사소통 방식"
          body={
            <span className="flex flex-wrap gap-1.5">
              {e.communication.map((c) => (
                <Chip key={c} tone="leaf" size="sm">
                  {c}
                </Chip>
              ))}
            </span>
          }
        />
        <ProfileRow
          icon={<Art name="ui_music_pref" size={26} alt="" />}
          title="선호 음악"
          body={
            <span className="flex flex-wrap gap-1.5">
              {e.musicPreferences.map((c) => (
                <Chip key={c} tone="leaf" size="sm">
                  {c}
                </Chip>
              ))}
            </span>
          }
        />
        <ProfileRow
          tone="brand"
          icon={<Art name="ui_avoid_topic" size={26} alt="" />}
          title="피하고 싶은 주제"
          body={
            <span className="flex flex-wrap gap-1.5">
              {e.avoidTopics.map((c) => (
                <Chip key={c} tone="brand" size="sm">
                  {c}
                </Chip>
              ))}
            </span>
          }
        />
      </ul>
      <p className="mt-2.5 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
        피하고 싶은 주제는 질문 추천과 가사 생성에서 자동으로 제외돼요. 의학적
        상태나 진단은 기록하지 않아요.
      </p>

      {/* ---- 가족 ---- */}
      <h2 className="mt-6 text-[1.125rem] font-extrabold text-ink-900">가족</h2>
      <ul className="mt-3 space-y-2.5">
        {family.map((f) => (
          <li key={f.href}>
            <Link
              href={f.href}
              className="flex min-h-[76px] items-center gap-3.5 rounded-[18px] bg-surface px-4 shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
            >
              <IconCircle tone={f.tone} size={46}>
                {f.icon}
              </IconCircle>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[1.0625rem] font-extrabold text-ink-900">
                    {f.title}
                  </span>
                  {f.badge ? (
                    <Chip tone="brand" size="sm">
                      {f.badge}
                    </Chip>
                  ) : null}
                </span>
                <span className="block text-[0.875rem] text-ink-500">{f.desc}</span>
              </span>
              <Chevron />
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-2.5 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
        가족이 참여하지 않아도 인터뷰부터 노래·활동일지까지 모두 끝까지 진행할
        수 있어요.
      </p>

      {/* ---- 이 어르신의 회기 ---- */}
      <h2 className="mt-6 text-[1.125rem] font-extrabold text-ink-900">
        이 어르신의 회기
      </h2>
      <ul className="mt-3 space-y-2.5">
        {SEED_RESUME.map((c) => (
          <Card as="li" key={c.id} className="p-3">
            <Link
              href={c.done ? '/records' : '/session'}
              className="flex items-center gap-3.5"
            >
              <ArtBox
                name={c.art as ArtKey}
                className="h-[52px] w-[52px] shrink-0 rounded-[12px] object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[1rem] font-extrabold text-ink-900">
                  {c.title}
                </span>
                <span className="block text-[0.8125rem] text-ink-500">{c.status}</span>
              </span>
              <Chevron />
            </Link>
          </Card>
        ))}
      </ul>
    </Screen>
  );
}

function ProfileRow({
  icon,
  title,
  body,
  tone = 'leaf',
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
  tone?: 'leaf' | 'brand';
}) {
  return (
    <li>
      <button
        type="button"
        className="flex w-full items-center gap-3.5 rounded-[18px] bg-surface p-3.5 text-left shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
      >
        <IconCircle tone={tone} size={48}>
          {icon}
        </IconCircle>
        <span className="min-w-0 flex-1">
          <span className="block text-[1.0625rem] font-extrabold text-ink-900">
            {title}
          </span>
          <span className="mt-1 block">{body}</span>
        </span>
        <Chevron className="text-ink-300" />
      </button>
    </li>
  );
}

