'use client';

import { useState } from 'react';
import { Art, ArtBox } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chevron, IconCircle, PrimaryButton } from '@/components/ui';
import { IconChat, IconDoc, IconLink, IconSend } from '@/components/icons';

/** 가족 초대 (deck p.3) */
export default function InvitePage() {
  const [copied, setCopied] = useState(false);

  const actions = [
    {
      key: 'sms',
      href: '/family/mission',
      tone: 'brand' as const,
      icon: <IconChat size={26} className="text-brand-600" />,
      title: '문자 링크 보내기',
      desc: '가족에게 초대 링크를 문자로 보내요',
    },
    {
      key: 'copy',
      tone: 'leaf' as const,
      icon: <IconLink size={26} className="text-leaf-600" />,
      title: copied ? '링크를 복사했어요' : '초대 링크 복사',
      desc: '링크를 복사해 다른 앱으로 공유해요',
      onClick: async () => {
        try {
          await navigator.clipboard.writeText(
            `${location.origin}/family/mission`,
          );
        } catch {
          /* clipboard blocked — the link is still shown on the mission screen */
        }
        setCopied(true);
      },
    },
    {
      key: 'guide',
      href: '/guide',
      tone: 'amber' as const,
      icon: <IconDoc size={26} className="text-amber-700" />,
      title: '가족 미션 안내 보기',
      desc: '가족이 참여하는 방법을 안내해요',
    },
  ];

  return (
    <Screen
      title="가족 초대"
      subtitle="가족과 함께 따뜻한 기록을 완성해요"
      decoration={<Ornaments variant="leafRight" />}
      footer={
        <PrimaryButton
          href="/family/mission"
          leading={<IconSend size={22} />}
        >
          초대 보내기
        </PrimaryButton>
      }
    >
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 p-5 pr-0">
          <div className="min-w-0 flex-1">
            <p className="text-[1.5rem] font-extrabold leading-[1.3] text-ink-900">
              가족이 사진,
              <br />
              음성, 이야기를
              <br />
              남길 수 있어요
            </p>
            <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-500">
              가족 내용은 바로 가사에 쓰지 않고 확인 후 반영해요
            </p>
          </div>
          <ArtBox
            name="scene_family_phone"
            className="w-[148px] shrink-0"
            fit="contain"
          />
        </div>
      </Card>

      <ul className="mt-4 space-y-3.5">
        {actions.map((a) => {
          const inner = (
            <>
              <IconCircle tone={a.tone} size={54}>
                {a.icon}
              </IconCircle>
              <span className="min-w-0 flex-1">
                <span className="block text-[1.1875rem] font-extrabold text-ink-900">
                  {a.title}
                </span>
                <span className="mt-1 block text-[0.9375rem] text-ink-500">
                  {a.desc}
                </span>
              </span>
              <Chevron />
            </>
          );
          const cls =
            'flex w-full min-h-[84px] items-center gap-4 rounded-[20px] bg-surface px-4 py-4 text-left shadow-[0_2px_10px_rgba(122,84,46,0.06)]';
          return (
            <li key={a.key}>
              {a.href ? (
                <a href={a.href} className={cls}>
                  {inner}
                </a>
              ) : (
                <button type="button" onClick={a.onClick} className={cls}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <Card className="mt-4 p-4">
        <p className="text-[1rem] font-bold text-ink-900">초대 현황</p>
        <div className="mt-3 flex items-center">
          <div className="flex flex-1 items-center gap-2.5">
            <IconCircle tone="leaf" size={40}>
              <Art name="ui_people" size={22} alt="" />
            </IconCircle>
            <span className="text-[0.9375rem] text-ink-500">
              최근 초대: <span className="font-extrabold text-ink-900">1명</span>
            </span>
          </div>
          <span className="mx-2 h-9 w-px bg-hairline" />
          <div className="flex flex-1 items-center gap-2.5">
            <IconCircle tone="amber" size={40}>
              <Art name="ui_duration" size={22} alt="" />
            </IconCircle>
            <span className="text-[0.9375rem] text-ink-500">
              <span className="block font-bold text-ink-900">응답 대기</span>1명
            </span>
          </div>
        </div>
      </Card>
    </Screen>
  );
}
