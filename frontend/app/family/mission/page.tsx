'use client';

import { useRouter } from 'next/navigation';
import { Art } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, NoteBar, PrimaryButton, SectionLabel } from '@/components/ui';
import { IconLink, IconChat, IconSend, IconShield } from '@/components/icons';
import { FAMILY_MISSION_LABELS, type FamilyMissionKind } from '@/lib/domain';
import { useSession } from '@/lib/store';
import type { ArtKey } from '@/lib/art';

const KINDS: { id: FamilyMissionKind; art: ArtKey; label: string }[] = [
  { id: 'photo', art: 'icon_image_orange', label: '고향 사진\n보내기' },
  { id: 'note', art: 'icon_chat_heart', label: '짧은 응원 글\n남기기' },
  { id: 'voice', art: 'icon_mic_green', label: '축하 음성\n보내기' },
];

const CHANNELS = [
  { id: 'kakao', label: '카카오톡' },
  { id: 'sms', label: '문자' },
  { id: 'link', label: '링크 복사' },
] as const;

/** 가족 미션 작성 (deck p.24) */
export default function FamilyMissionPage() {
  const { s, set } = useSession();
  const router = useRouter();

  const send = () => {
    set('missionSent', true);
    router.push('/family/mission/sent');
  };

  return (
    <Screen
      title="가족 미션 작성"
      subtitle="가족에게 남길 부탁을 쉽게 보낼 수 있어요"
      decoration={<Ornaments variant="leafRight" />}
      footer={
        <PrimaryButton onClick={send} leading={<IconSend size={22} />}>
          가족에게 보내기
        </PrimaryButton>
      }
    >
      <Card className="flex items-center gap-4 p-4">
        <Art name="avatar_grandmother" size={82} alt="" className="shrink-0" />
        <div>
          <p className="text-[1.375rem] font-extrabold text-ink-900">
            {s.elder.honorific}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[1rem] font-semibold text-leaf-700">
            <PinGlyph />내가 태어난 곳
          </p>
        </div>
      </Card>

      <SectionLabel className="mt-5">미션 종류 선택</SectionLabel>
      <fieldset className="mt-3">
        <legend className="sr-only">가족에게 부탁할 미션 종류</legend>
        <div className="grid grid-cols-3 gap-3">
          {KINDS.map((k) => {
            const on = s.missionKind === k.id;
            return (
              <label
                key={k.id}
                className={`relative flex min-h-[150px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[18px] p-3 text-center transition-colors ${
                  on
                    ? 'bg-brand-50 ring-2 ring-brand-500'
                    : 'bg-surface shadow-[0_2px_10px_rgba(122,84,46,0.06)]'
                }`}
              >
                <input
                  type="radio"
                  name="missionKind"
                  value={k.id}
                  checked={on}
                  onChange={() => set('missionKind', k.id)}
                  className="sr-only"
                />
                {on ? <SelectedDot /> : null}
                <Art name={k.art} size={56} alt="" />
                <span
                  className={`whitespace-pre-line text-[0.9375rem] font-bold leading-snug ${
                    on ? 'text-brand-700' : 'text-ink-900'
                  }`}
                >
                  {k.label}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <SectionLabel className="mt-5">미션 내용</SectionLabel>
      <div className="mt-3">
        <label htmlFor="missionBody" className="sr-only">
          가족에게 전할 미션 내용
        </label>
        <textarea
          id="missionBody"
          value={s.missionBody}
          maxLength={200}
          onChange={(e) => set('missionBody', e.target.value)}
          placeholder={`가족이 기억하는 ${
            FAMILY_MISSION_LABELS[s.missionKind] === '축하 음성 보내기'
              ? '목소리'
              : '고향 사진'
          }이나\n짧은 이야기를 남겨 주세요`}
          className="h-[136px] w-full resize-none rounded-[18px] bg-surface p-4 text-[1rem] leading-relaxed text-ink-900 shadow-[0_2px_10px_rgba(122,84,46,0.06)] placeholder:text-ink-500"
        />
        <p className="mt-1 pr-1 text-right text-[0.875rem] text-ink-500">
          {s.missionBody.length} / 200
        </p>
      </div>

      <SectionLabel className="mt-3">보내기 방법</SectionLabel>
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {CHANNELS.map((c) => (
          <button
            key={c.id}
            type="button"
            className="flex min-h-[54px] items-center justify-center gap-1.5 rounded-full bg-surface px-2 text-[0.9375rem] font-bold text-ink-900 shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
          >
            {c.id === 'kakao' ? (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#191600] text-[0.5rem] font-black text-[#FEE500]">
                TALK
              </span>
            ) : c.id === 'sms' ? (
              <IconChat size={19} className="text-leaf-600" />
            ) : (
              <IconLink size={19} className="text-leaf-600" />
            )}
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <NoteBar tone="brand" icon={<IconShield size={19} />}>
          가족이 보낸 내용은 확인 후 반영돼요
        </NoteBar>
      </div>
    </Screen>
  );
}

function SelectedDot() {
  return (
    <span className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-brand-500">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m5 13 4.5 4.5L19 7" />
      </svg>
    </span>
  );
}

function PinGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 10.4c0 5.2-7 11-7 11s-7-5.8-7-11a7 7 0 1 1 14 0Z" />
      <circle cx="12" cy="10.2" r="2.5" />
    </svg>
  );
}
