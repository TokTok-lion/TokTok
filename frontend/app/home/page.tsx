'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Art, ArtBox } from '@/components/Art';
import { NoElderCard } from '@/components/NoElderCard';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chevron, Chip, IconCircle, PrimaryButton } from '@/components/ui';
import {
  IconCalendar,
  IconChat,
  IconClock,
} from '@/components/icons';
import { flowState } from '@/lib/flow';
import { SEED_RESUME, SEED_SCHEDULE } from '@/lib/seed';
import { useSession } from '@/lib/store';
import { useActiveElder } from '@/lib/useActiveElder';
import type { ArtKey } from '@/lib/art';

// same glyphs the deck uses on 회기 일정 (p.17)
const KIND_ART = {
  interview: 'ui_people',
  music: 'ui_music',
  log: 'ui_pencil',
} as const;

/**
 * 오늘 (홈)
 *
 * Answers one question: what do I do next? The single orange button is the
 * next unfinished step of the active session — everything else on this screen
 * is context. Nothing here is a second copy of a screen that lives elsewhere;
 * 회기 단계는 회기 탭, 완성된 것은 기록 탭이 각각 소유한다.
 */
export default function TodayPage() {
  const { s, set } = useSession();
  const router = useRouter();
  const flow = flowState(s);
  const elder = useActiveElder();

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

  const resume = (title: string) => {
    set('topic', title);
    router.push(flowState(s).next.href);
  };

  return (
    <Screen
      back={false}
      menu
      bell
      title="오늘"
      subtitle="지금 이어서 할 일을 알려드려요"
      decoration={<Ornaments variant="leafRight" />}
      footer={
        elder === 'missing' ? (
          <PrimaryButton href="/elder">어르신 고르기</PrimaryButton>
        ) : (
          <PrimaryButton href={flow.next.href}>
            {flow.complete ? '오늘 회기 마무리됨' : `${flow.next.label} 이어하기`}
          </PrimaryButton>
        )
      }
    >
      {/* 지금 할 일 — 화면에서 가장 큰 한 가지.
          단, 가리킬 어르신이 없으면 진행 중인 척하지 않는다. */}
      {elder === 'missing' ? (
        <NoElderCard deleted={Boolean(s.remoteParticipantId)} />
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
          <span className="text-[0.9375rem] font-semibold text-ink-500">
            5월 21일 (수)
          </span>
        </h2>
        <Link
          href="/sessions"
          className="inline-flex min-h-[24px] shrink-0 items-center text-[0.875rem] font-bold text-leaf-700 underline underline-offset-2"
        >
          전체 일정
        </Link>
      </div>
      <ul className="mt-3 space-y-2.5">
        {SEED_SCHEDULE.map((item) => {
          const art = KIND_ART[item.kind];
          return (
            <Card as="li" key={item.time} className="p-0">
              <Link
                href="/session"
                className="flex min-h-[74px] items-center gap-3 p-3.5"
              >
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
              </Link>
            </Card>
          );
        })}
      </ul>

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

      {/* 다른 어르신 회기로 갈아타기 */}
      <h2 className="mt-5 text-[1.125rem] font-extrabold text-ink-900">
        다른 회기 이어하기
      </h2>
      <ul className="mt-3 space-y-2.5">
        {SEED_RESUME.filter((c) => !c.done).map((c) => (
          <Card as="li" key={c.id} className="p-3">
            <button
              type="button"
              onClick={() => resume(c.title)}
              className="flex w-full items-center gap-3 text-left"
            >
              <ArtBox
                name={c.art as ArtKey}
                className="h-[56px] w-[56px] shrink-0 rounded-[12px] object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[1.0625rem] font-extrabold text-ink-900">
                  {c.title}
                </span>
                <span className="block text-[0.875rem] text-ink-500">{c.status}</span>
              </span>
              <Chevron />
            </button>
          </Card>
        ))}
      </ul>

      <p className="mt-4 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
        완성된 노래와 지난 활동일지는 <strong>기록</strong> 탭에 있어요.
      </p>
    </Screen>
  );
}
