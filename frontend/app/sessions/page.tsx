'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { Art, ArtBox } from '@/components/Art';
import { ElderCardSkeleton, NoElderCard } from '@/components/NoElderCard';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chevron, Chip, IconCircle, PrimaryButton } from '@/components/ui';
import { IconCalendar, IconClock } from '@/components/icons';
import { useAccount } from '@/lib/auth';
import { flowState } from '@/lib/flow';
import { SEED_SCHEDULE } from '@/lib/seed';
import { useSession } from '@/lib/store';
import { useActiveElder } from '@/lib/useActiveElder';
import type { ArtKey } from '@/lib/art';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** "2025년 5월 21일 (수)" — 기기 시계 기준. */
function dayLabel(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

// 서버 프리렌더 시각은 배포 서버의 시각이라 현장 태블릿의 오늘과 다를 수
// 있다. 서버 스냅샷은 비워 두고 기기에서만 채운다. 구독은 아무것도 알리지
// 않는다 — 날짜는 화면을 여는 순간 한 번만 필요하다.
const noSubscribe = () => () => {};
const noDate = () => '';

// Row glyphs are the deck's own (p.17), cut by scripts/prepare-ui-icons.py
const KIND = {
  interview: { art: 'ui_people' as const, tone: 'leaf' as const, time: 'text-brand-700' },
  music: { art: 'ui_music' as const, tone: 'leaf' as const, time: 'text-amber-700' },
  log: { art: 'ui_pencil' as const, tone: 'leaf' as const, time: 'text-leaf-700' },
};

/**
 * 회기 일정 (deck p.17)
 *
 * 이 화면은 원래 달력이었다. 그런데 그 달력이 그리던 것은 2025년 5월
 * 18~24일 일곱 칸으로 고정이었고, 이전/다음 달 화살표에는 핸들러가 없었고,
 * 어느 날짜를 눌러도 옆에는 "(수)"가 붙었다. 아래 목록은 씨앗 세 건이
 * 아무 표시 없이 진짜 일정처럼 떴고, 맨 아래 "오늘 3건 / 미완료 1건"은
 * 어떤 데이터에서도 나온 값이 아니었다 — SEED_SCHEDULE 에는 완료 여부
 * 필드조차 없다.
 *
 * 일정을 넣고 관리하는 기능은 서버에도 화면에도 아직 없다. 그래서 달력과
 * 집계는 걷어냈다. 대신 이 화면이 실제로 답할 수 있는 것만 남긴다 —
 * 오늘이 며칠인지, 지금 회기가 어디까지 왔는지, 다음에 무엇을 하는지.
 */
export default function SessionsPage() {
  const { s } = useSession();
  const { account } = useAccount();
  const elder = useActiveElder();
  const flow = flowState(s);
  const live = account.status === 'in';

  const today = useSyncExternalStore(
    noSubscribe,
    () => dayLabel(new Date()),
    noDate,
  );

  return (
    <Screen
      title="회기 일정"
      subtitle="오늘 어디까지 왔는지 확인해요"
      decoration={<Ornaments variant="notes" />}
      footer={
        // 예전 푸터는 '새 일정 추가'라고 적혀 있었지만 실제로는 /session/checklist
        // 로 가는 문이었다. 일정을 만드는 곳이 아니라 회기를 시작하는 곳이다.
        // 게다가 어르신을 고르지 않은 채 들어가면 참가자 없이 회기가 열려,
        // 7단계에서 곡 한도 검사(songQuotaLeft)가 통째로 건너뛰어진다.
        // 이름을 사실대로 바꾸고 /home·/session 과 같은 자물쇠를 건다.
        elder === 'checking' ? (
          <PrimaryButton disabled>불러오는 중…</PrimaryButton>
        ) : elder === 'missing' ? (
          <PrimaryButton href="/elder">먼저 어르신을 골라 주세요</PrimaryButton>
        ) : (
          <PrimaryButton href={flow.next.href}>
            {flow.complete
              ? '오늘 회기 마무리됨'
              : `${flow.next.index}단계 ${flow.next.label} 이어하기`}
          </PrimaryButton>
        )
      }
    >
      <Card className="flex items-center gap-3.5 p-4">
        <IconCircle tone="brand" size={48}>
          <Art name="ui_calendar_check" size={26} alt="" />
        </IconCircle>
        <div className="min-w-0">
          <p className="text-[0.875rem] font-bold text-brand-700">오늘</p>
          {/* 날짜가 채워지기 전에도 줄 높이가 흔들리지 않게 공백을 둔다.
              보통 공백은 HTML 에서 접히므로 줄바꿈 없는 공백을 쓴다. */}
          <p className="text-[1.25rem] font-extrabold text-ink-900">
            {today || ' '}
          </p>
        </div>
      </Card>

      {/* 진행 중인 회기 — 이 화면에서 유일하게 진짜인 정보 */}
      <h2 className="mt-5 flex items-center gap-2 text-[1.125rem] font-extrabold text-ink-900">
        <IconCalendar size={22} className="text-brand-600" />
        진행 중인 회기
      </h2>
      <div className="mt-3">
        {elder === 'checking' ? (
          <ElderCardSkeleton />
        ) : elder === 'missing' ? (
          <NoElderCard deleted={Boolean(s.remoteParticipantId)} actions={false} />
        ) : (
          <Card className="p-3.5">
            <Link href="/session" className="flex items-center gap-3.5">
              <ArtBox
                name={s.elder.avatar as ArtKey}
                className="h-[56px] w-[56px] shrink-0 rounded-full object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[1.0625rem] font-extrabold text-ink-900">
                  {s.elder.honorific}
                </span>
                <span className="block text-[0.875rem] text-ink-500">
                  {flow.complete
                    ? '아홉 단계 모두 끝났어요'
                    : `다음은 ${flow.next.label}`}
                </span>
              </span>
              <Chip tone="leaf" size="sm">
                {flow.done}/{flow.total}
              </Chip>
              <Chevron />
            </Link>
          </Card>
        )}
      </div>

      {/* 시간표.
          기관 계정에서는 씨앗 세 건을 아예 그리지 않는다. 어르신을 한 명도
          등록하지 않은 기관이 등록한 적 없는 김○○·박○○·이○○의 오늘 일정을
          보면, 이 화면의 다른 숫자도 같이 못 믿게 된다.
          둘러보기(로그인 전)에서는 화면 모양을 보여 드려야 하므로 남기되,
          예시라고 밝히고 누를 수 없게 둔다 — 예전에는 이 행들이
          /session/checklist 로 가는 또 하나의 잠기지 않은 문이었다. */}
      {live ? (
        <Card className="mt-5 p-4">
          <p className="text-[1rem] font-bold text-ink-700">
            일정을 넣는 기능은 아직 없어요.
          </p>
          <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-500">
            시간표를 만들고 알림을 거는 기능은 준비 중입니다. 지금은 어르신을
            고르고 회기를 시작하면, 진행 상태가 위에 남아요.
          </p>
        </Card>
      ) : (
        <>
          <h2 className="mt-5 flex items-center gap-2 text-[1.125rem] font-extrabold text-ink-900">
            <IconClock size={22} className="text-brand-600" />
            예시 일정
          </h2>
          <p className="mt-2 rounded-[12px] bg-surface-sunk px-3.5 py-2.5 text-[0.8125rem] leading-relaxed text-ink-700">
            아래 세 건은 화면 모양을 보여 드리기 위한 <strong>예시</strong>예요.
            일정을 직접 넣는 기능은 준비 중입니다.
          </p>
          <ul className="mt-3 space-y-3">
            {SEED_SCHEDULE.map((item) => {
              const k = KIND[item.kind];
              return (
                <Card as="li" key={item.time} className="p-4">
                  <div className="flex min-h-[70px] items-center gap-3.5">
                    <IconClock size={26} className={`shrink-0 ${k.time}`} />
                    <span className={`text-[1.375rem] font-extrabold ${k.time}`}>
                      {item.time}
                    </span>
                    <span className="h-10 w-px shrink-0 bg-hairline" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[1.1875rem] font-extrabold text-ink-900">
                        {item.who} {item.what}
                      </span>
                      <span className="mt-0.5 block text-[0.9375rem] text-ink-500">
                        {item.detail}
                      </span>
                    </span>
                    <IconCircle tone={k.tone} size={44}>
                      <Art name={k.art} size={24} alt="" />
                    </IconCircle>
                  </div>
                </Card>
              );
            })}
          </ul>
        </>
      )}
    </Screen>
  );
}
