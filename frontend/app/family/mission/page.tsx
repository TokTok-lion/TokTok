'use client';

import { Art } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, NoteBar, PrimaryButton, SectionLabel } from '@/components/ui';
import { IconEdit, IconShield } from '@/components/icons';
import { type FamilyMissionKind } from '@/lib/domain';
import { useSession } from '@/lib/store';
import type { ArtKey } from '@/lib/art';

const KINDS: { id: FamilyMissionKind; art: ArtKey; label: string }[] = [
  { id: 'photo', art: 'icon_image_orange', label: '고향 사진\n보내기' },
  { id: 'note', art: 'icon_chat_heart', label: '짧은 응원 글\n남기기' },
  { id: 'voice', art: 'icon_mic_green', label: '축하 음성\n보내기' },
];

/**
 * 미션 종류마다 적어야 할 것이 다르다.
 *
 * 예전에는 '축하 음성 보내기'만 갈라내고 나머지는 전부 '고향 사진'이라고
 * 적어, 응원 글을 부탁하는 중에도 사진을 적으라고 안내했다.
 */
const BODY_HINT: Record<FamilyMissionKind, string> = {
  photo: '어떤 사진이면 좋을지 적어 주세요\n(예: 고향 마을이 보이는 옛날 사진)',
  note: '가족이 어떤 이야기를 적어 주면 좋을지\n한두 줄로 알려 주세요',
  voice: '어떤 목소리를 부탁드릴지 적어 주세요\n(예: 생신 축하 인사 한마디)',
};

/**
 * 가족 미션 작성 (deck p.24)
 *
 * 「보내기 방법」 자리에 카카오톡·문자·링크 복사 칩 세 개가 있었다. 셋 다
 * onClick 도 선택 상태도 없는 그림이었고, 아래 버튼은 「가족에게 보내기」였다.
 * 이 앱에는 가족에게 내보내는 코드가 없어서(경위는 다음 화면 상단 주석),
 * 복지사는 버튼을 누른 뒤에야 아무 데도 가지 않았다는 걸 알았다.
 *
 * 그래서 칩은 지우고, 버튼은 실제로 하는 일 — 가족에게 전할 문구를 만들어
 * 주는 일 — 을 그대로 이름으로 삼는다. 못 보내는 것은 다음 화면이 아니라
 * 여기서 미리 밝힌다.
 */
export default function FamilyMissionPage() {
  const { s, set } = useSession();

  return (
    <Screen
      title="가족 미션 작성"
      subtitle="가족에게 부탁할 내용을 여기서 적어요"
      decoration={<Ornaments variant="leafRight" />}
      footer={
        // 예전에는 여기서 set('missionSent', true) 를 찍고 넘어갔다. 보낸 적이
        // 없는데 '보냄'으로 남는 값이라 더 이상 쓰지 않는다 — 읽는 화면도 없다.
        <PrimaryButton href="/family/mission/sent" leading={<IconEdit size={22} />}>
          전할 내용 만들기
        </PrimaryButton>
      }
    >
      <Card className="flex items-center gap-4 p-4">
        {/* 그림도 주제도 이 회기 값에서 온다. 예전에는 어느 어르신이든 늘
            할머니 그림에 '내가 태어난 곳'이 붙어 있었다 — 오늘 무슨 이야기를
            부탁하러 왔는지 알려 주는 자리가 남의 회기를 가리키고 있었다. */}
        <Art name={s.elder.avatar as ArtKey} size={82} alt="" className="shrink-0" />
        <div className="min-w-0">
          <p className="text-[1.375rem] font-extrabold text-ink-900">
            {s.elder.honorific}
          </p>
          <p className="mt-1 text-[1rem] font-semibold text-leaf-700">
            오늘 주제 · {s.topic || '아직 정하지 않음'}
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
          placeholder={BODY_HINT[s.missionKind]}
          className="h-[136px] w-full resize-none rounded-[18px] bg-surface p-4 text-[1rem] leading-relaxed text-ink-900 shadow-[0_2px_10px_rgba(122,84,46,0.06)] placeholder:text-ink-500"
        />
        <p className="mt-1 pr-1 text-right text-[0.875rem] text-ink-500">
          {s.missionBody.length} / 200
        </p>
      </div>

      <SectionLabel className="mt-5">보내는 방법</SectionLabel>
      <Card className="mt-3 p-4">
        {/* 카카오톡·문자·링크 복사 칩이 있던 자리. 고를 수 있는 것처럼 보였지만
            셋 다 아무 데도 연결돼 있지 않았다. 지금 정말 할 수 있는 일만
            적고, 다음에 어디로 가면 되는지도 같이 적는다. */}
        <p className="text-[0.9375rem] leading-relaxed text-ink-500">
          이 앱은 카카오톡·문자로 가족에게 직접 보내지 못해요. 다음 화면에서
          전할 문구를 만들어 드리면, 복지사님이 쓰시던 카카오톡·문자에 붙여
          넣어 보내시거나 인쇄해서 전해 주세요.
        </p>
      </Card>

      <div className="mt-4">
        <NoteBar tone="brand" icon={<IconShield size={19} />}>
          가족이 보내온 사진·글·음성은 어르신과 확인한 뒤에 기록해요
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
