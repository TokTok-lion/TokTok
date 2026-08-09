'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { Art, ArtBox } from '@/components/Art';
import { ElderCardSkeleton, NoElderCard } from '@/components/NoElderCard';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chevron, Chip, IconCircle, PrimaryButton } from '@/components/ui';
import {
  IconCalendar,
  IconChat,
  IconClock,
} from '@/components/icons';
import { useAccount } from '@/lib/auth';
import { flowState } from '@/lib/flow';
import { SEED_SCHEDULE } from '@/lib/seed';
import { useSession } from '@/lib/store';
import { useActiveElder } from '@/lib/useActiveElder';
import type { ArtKey } from '@/lib/art';

// same glyphs the deck uses on 회기 일정 (p.17)
const KIND_ART = {
  interview: 'ui_people',
  music: 'ui_music',
  log: 'ui_pencil',
} as const;

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** "5월 21일 (수)" — 기기 시계 기준. */
function dayLabel(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

// 날짜는 서버에서 미리 그릴 때와 태블릿에서 그릴 때 값이 다르다. 배포 서버
// 시각을 그대로 찍으면 현장에서 어제 날짜가 뜰 수 있다. 서버 스냅샷은 비워
// 두고 기기에서만 채운다 — useSyncExternalStore 가 바로 이 상황을 위한
// 훅이다. 구독은 아무것도 알리지 않는다. 날짜는 화면을 여는 순간 한 번만
// 필요하고, 매초 다시 그릴 이유가 없다.
const noSubscribe = () => () => {};
const noDate = () => '';

/**
 * 오늘 (홈)
 *
 * Answers one question: what do I do next? The single orange button is the
 * next unfinished step of the active session — everything else on this screen
 * is context. Nothing here is a second copy of a screen that lives elsewhere;
 * 회기 단계는 회기 탭, 완성된 것은 기록 탭이 각각 소유한다.
 */
export default function TodayPage() {
  const { s } = useSession();
  const flow = flowState(s);
  const elder = useActiveElder();
  const { account } = useAccount();
  const live = account.status === 'in';

  // "오늘"이라는 이름의 화면이 5월 21일에 멈춰 있었다. 그 한 줄이 틀리면 그
  // 아래 진행 단계·대기 항목 같은 진짜 정보도 같이 못 믿게 된다.
  const today = useSyncExternalStore(
    noSubscribe,
    () => dayLabel(new Date()),
    noDate,
  );

  const pendingFamily = s.familyStories.filter((f) => f.state === 'pending').length;
  const unverified = s.story.filter((i) => i.status === 'unverified').length;
  const waiting = [
    pendingFamily > 0
      ? { label: `가족 제보 ${pendingFamily}건 확인`, href: '/family/stories', tone: 'brand' as const }
      : null,
    unverified > 0
      ? { label: `사실 확인 ${unverified}건`, href: '/session/story', tone: 'amber' as const }
      : null,
    !s.logSaved
      ? { label: '활동일지 미확정', href: '/session/log', tone: 'brand' as const }
      : null,
  ].filter(Boolean) as { label: string; href: string; tone: 'brand' | 'amber' }[];

  return (
    <Screen
      root
      title="오늘"
      subtitle="지금 이어서 할 일을 알려드려요"
      decoration={<Ornaments variant="leafRight" />}
      footer={
        elder === 'checking' ? (
          <PrimaryButton disabled>불러오는 중…</PrimaryButton>
        ) : elder === 'missing' ? (
          <PrimaryButton href="/elder">어르신 고르기</PrimaryButton>
        ) : (
          <PrimaryButton href={flow.next.href}>
            {flow.complete ? '오늘 회기 마무리됨' : `${flow.next.label} 이어하기`}
          </PrimaryButton>
        )
      }
    >
      {/* 지금 할 일 — 화면에서 가장 큰 한 가지.
          단, 가리킬 어르신이 없으면 진행 중인 척하지 않는다. 확인이 끝나기
          전에도 마찬가지다 — 그 사이에 옛 이름을 띄우면 1초짜리 거짓말이 된다. */}
      {elder === 'checking' ? (
        <ElderCardSkeleton />
      ) : elder === 'missing' ? (
        <NoElderCard deleted={Boolean(s.remoteParticipantId)} actions={false} />
      ) : (
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <ArtBox
            name={s.elder.avatar as ArtKey}
            className="h-[56px] w-[56px] shrink-0 rounded-full object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[1.0625rem] font-bold text-ink-900">
              {s.elder.honorific}
            </p>
            <p className="text-[0.875rem] text-ink-500">{s.topic}</p>
          </div>
          <Chip tone="leaf" size="sm">
            {flow.done}/{flow.total} 단계
          </Chip>
        </div>

        <div className="mt-3.5 rounded-[14px] bg-brand-50 p-4">
          <p className="text-[0.875rem] font-bold text-brand-700">
            {flow.complete ? '모든 단계 완료' : `다음 ${flow.next.index}단계`}
          </p>
          <p className="mt-0.5 text-[1.375rem] font-extrabold leading-tight text-ink-900">
            {flow.next.label}
          </p>
          <p className="mt-1 text-[0.9375rem] text-ink-700">{flow.next.action}</p>
        </div>

        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-track">
          <div
            className="h-full rounded-full bg-leaf-500"
            style={{ width: `${(flow.done / flow.total) * 100}%` }}
          />
        </div>
      </Card>
      )}

      {/* 오늘 일정 — 회기 일정을 여기로 합쳐 홈이 시간축을 온전히 담당한다 */}
      <div className="mt-5 flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[1.125rem] font-extrabold text-ink-900">
          <IconCalendar size={21} className="text-brand-600" />
          오늘 일정
          {/* 비어 있는 동안에도 줄 높이가 흔들리지 않도록 공백 한 칸을 둔다 */}
          <span className="text-[0.9375rem] font-semibold text-ink-500">
            {today || ' '}
          </span>
        </h2>
        <Link
          href="/sessions"
          className="inline-flex min-h-[24px] shrink-0 items-center text-[0.875rem] font-bold text-leaf-700 underline underline-offset-2"
        >
          전체 일정
        </Link>
      </div>

      {/* 일정을 서버에 넣는 기능은 아직 없다. 그래서 기관 계정에서는 씨앗 세
          건을 아예 그리지 않는다 — 어르신이 0명인데 "김○○ 인터뷰 10:00"이
          떠 있으면, 이 화면의 다른 숫자도 못 믿게 된다.
          예전에는 여기에 '예시' 딱지만 붙이고 목록은 그대로 그렸다. 그런데
          바로 위 '전체 일정'을 누르면 /sessions 는 기관 계정에서 그 세 건을
          감춘다 — 한 번 눌렀을 뿐인데 일정이 사라지니, 둘 중 어느 화면이
          맞는지 알 수 없었다. 두 화면이 같은 규칙을 쓰게 맞춘다.
          둘러보기(로그인 전)에서는 화면 모양을 보여 드려야 하므로 남기되,
          예시라고 밝히고 누를 수 없게 둔다 — 어느 행을 눌러도 지금 회기로
          갔으므로, 박○○ 줄을 눌러도 김○○ 회기가 열렸다. */}
      {live ? (
        <Card className="mt-3 p-4">
          <p className="text-[1rem] font-bold text-ink-700">
            일정을 넣는 기능은 아직 없어요.
          </p>
          <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-500">
            시간표를 만드는 기능은 준비 중입니다. 지금 진행 중인 회기는 위
            카드에 있고, 오늘 어디까지 왔는지는{' '}
            <Link
              href="/sessions"
              className="font-bold text-leaf-700 underline underline-offset-2"
            >
              회기 일정
            </Link>
            에서도 볼 수 있어요.
          </p>
        </Card>
      ) : (
        <>
          <p className="mt-2 rounded-[12px] bg-surface-sunk px-3.5 py-2.5 text-[0.8125rem] leading-relaxed text-ink-700">
            아래 세 건은 화면 모양을 보여 드리기 위한 <strong>예시</strong>예요.
            일정을 직접 넣는 기능은 준비 중입니다.
          </p>
          <ul className="mt-3 space-y-2.5">
            {SEED_SCHEDULE.map((item) => {
              const art = KIND_ART[item.kind];
              return (
                <Card as="li" key={item.time} className="p-0">
                  <div className="flex min-h-[74px] items-center gap-3 p-3.5">
                    <IconClock size={22} className="shrink-0 text-brand-600" />
                    <span className="text-[1.1875rem] font-extrabold text-brand-700">
                      {item.time}
                    </span>
                    <span className="h-9 w-px shrink-0 bg-hairline" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[1.0625rem] font-extrabold text-ink-900">
                        {item.who} {item.what}
                      </span>
                      <span className="block text-[0.875rem] text-ink-500">
                        {item.detail}
                      </span>
                    </span>
                    <IconCircle tone="leaf" size={38}>
                      <Art name={art} size={21} alt="" />
                    </IconCircle>
                  </div>
                </Card>
              );
            })}
          </ul>
        </>
      )}

      {/* 대기 중 — 남이 답을 줘야 넘어가는 것들 */}
      {waiting.length > 0 ? (
        <>
          <h2 className="mt-5 flex items-center gap-2 text-[1.125rem] font-extrabold text-ink-900">
            <IconChat size={21} className="text-amber-700" />
            확인이 필요해요
          </h2>
          <ul data-transient="확인이 필요해요" className="mt-3 space-y-2.5">
            {waiting.map((w) => (
              <li key={w.href}>
                <Link
                  href={w.href}
                  className="flex min-h-[62px] items-center gap-3 rounded-[16px] bg-surface px-4 shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
                >
                  <Chip tone={w.tone} size="sm">
                    확인
                  </Chip>
                  <span className="flex-1 text-[1rem] font-bold text-ink-900">
                    {w.label}
                  </span>
                  <Chevron />
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {/* 다른 어르신 회기로 갈아타기.
          여기에는 '다른 회기 이어하기'라는 이름으로 씨앗 카드 두 장(고향의
          바닷바람·우리 가족의 탄생)이 놓여 있었다. 누르면 회기가 바뀌는 게
          아니라 지금 회기의 주제 문자열만 그 제목으로 덮어썼다 — 어르신은
          다른 이야기를 하고 계신데 활동일지의 프로그램명, 곡 제목, 서버에
          올라가는 회기 주제만 갈아탔고 되돌리는 화면도 없었다.
          어르신별 회기 목록을 서버에서 읽는 기능이 아직 없으니 목록은 만들 수
          없다. 대신 실제로 되는 길 하나만 남긴다 — 어르신을 다시 고르면
          beginSession 이 그 어르신 회기로 넘어간다. */}
      <p className="mt-5 rounded-[14px] bg-surface-sunk px-3.5 py-3 text-[0.875rem] leading-relaxed text-ink-700">
        다른 어르신 회기로 넘어가려면{' '}
        <Link
          href="/elder"
          className="font-bold text-leaf-700 underline underline-offset-2"
        >
          어르신 고르기
        </Link>
        에서 다시 골라 주세요. 어르신별 지난 회기 목록은 아직 없어요.
      </p>

      <p className="mt-3 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
        완성된 노래와 지난 활동일지는 <strong>기록</strong> 탭에 있어요.
      </p>
    </Screen>
  );
}
