'use client';

import Link from 'next/link';
import { Art } from '@/components/Art';
import { ElderCardSkeleton, NoElderCard } from '@/components/NoElderCard';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chevron, Chip, IconCircle } from '@/components/ui';
import {
  IconChat,
  IconEnvelopeOpen,
  IconPeople,
  IconSend,
} from '@/components/icons';
import { flowState } from '@/lib/flow';
import { useSession } from '@/lib/store';
import { useActiveElder } from '@/lib/useActiveElder';
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
  const elder = useActiveElder();
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

  // 이 화면은 "어느 어르신"이 정해져야 뜻이 있는 곳인데, 잠금이 없어서 회기가
  // 가리키는 사람이 없어도 씨앗 어르신(김○○)의 프로필이 그대로 떴다. 게다가
  // 여기서 가족 화면·회기 화면으로 그대로 들어갈 수 있었다.
  // /home·/session 과 같은 자물쇠를 건다.
  if (elder !== 'ok') {
    return (
      <Screen
        back
        title="어르신 프로필"
        subtitle={
          elder === 'checking' ? '불러오는 중이에요' : '어르신을 먼저 골라 주세요'
        }
        decoration={<Ornaments variant="leafRight" />}
      >
        {elder === 'checking' ? (
          <ElderCardSkeleton />
        ) : (
          <NoElderCard deleted={Boolean(s.remoteParticipantId)} />
        )}
      </Screen>
    );
  }

  return (
    <Screen back title="어르신 프로필" decoration={<Ornaments variant="leafRight" />}>
      <Card className="flex items-center gap-4 p-4">
        <Art name={e.avatar as ArtKey} size={88} alt="" className="shrink-0" />
        <div className="min-w-0">
          <p className="text-[1.625rem] font-extrabold leading-tight text-ink-900">
            {e.displayName}
          </p>
          {/* 단계는 어르신 목록에 실려 온 e.stage 를 쓰고 있었는데, 서버에서
              읽은 어르신은 그 값이 늘 0 이다(useElders.toSummary). 지금 회기의
              실제 진행도가 이 기기에 있으니 그것을 쓴다. */}
          <p className="mt-1.5">
            <Chip tone="brand" size="sm">
              진행 {flow.done}/{flow.total}단계
            </Chip>
          </p>
        </div>
      </Card>

      {/* 진행 중인 회기로 건너뛰기 — 목록은 회기 탭이 소유하므로 링크만 */}
      <Link
        href="/session"
        className="mt-3 flex min-h-[68px] items-center gap-3.5 rounded-[18px] bg-brand-50 px-4"
      >
        <IconCircle tone="brand" size={44}>
          <Art name="ui_music" size={24} alt="" />
        </IconCircle>
        <span className="min-w-0 flex-1">
          {/* 실제 기관 회기는 주제 없이 시작한다(lib/useElders.ts). 예전에는
              이 자리에 '진행 중: —'가 떴다 — 주제가 있는데 못 읽어 온 것처럼
              보인다. 없으면 회기가 있다는 사실만 적고, 무엇을 이어할지는
              아래 줄이 말해 준다. */}
          <span className="block text-[1rem] font-extrabold text-ink-900">
            {s.topic ? `진행 중: ${s.topic}` : '진행 중인 회기'}
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
          body={<Chips items={e.communication} tone="leaf" />}
        />
        <ProfileRow
          icon={<Art name="ui_music_pref" size={26} alt="" />}
          title="선호 음악"
          body={<Chips items={e.musicPreferences} tone="leaf" />}
        />
        <ProfileRow
          tone="brand"
          icon={<Art name="ui_avoid_topic" size={26} alt="" />}
          title="피하고 싶은 주제"
          body={<Chips items={e.avoidTopics} tone="brand" />}
        />
      </ul>
      {/* 예전 문구는 "피하고 싶은 주제는 질문 추천과 가사 생성에서 자동으로
          제외돼요"였다. 그 제외는 코드에 없다 — avoidTopics 는 화면에만 있고
          /api/lyrics 는 받지도 않는다(route.ts 의 Body 는 topic·facts·style).
          안전장치가 문구로만 있으면 복지사는 걸러진다고 믿고 넘어간다.
          지금 되는 것과 안 되는 것을 그대로 적는다. */}
      <p className="mt-2.5 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
        피하고 싶은 주제를 자동으로 걸러 주는 기능은 아직 없어요. 질문과 가사
        초안을 확인하실 때 복지사가 직접 살펴 주세요. 건강·질병 내용은 AI
        초안에 담기지 않도록 요청하고 있어요.
      </p>
      {/* 프로필을 이 화면에서 고칠 방법은 없다. 줄마다 달려 있던 버튼에는
          onClick 이 없었고, 아래 '프로필 저장' 버튼은 라벨만 "저장했어요"로
          바꿨을 뿐 아무것도 저장하지 않았다. 둘 다 걷어내고 읽기 전용으로
          둔다 — 저장되지 않은 것을 저장했다고 하지 않는다. */}
      <p className="mt-1.5 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
        프로필은 읽기 전용이에요. 어르신 등록 때 정한 이름 표기와 그림만
        저장되고, 여기서 고치는 기능은 준비 중입니다.
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
      {/* 여기에는 씨앗 회기 세 건이 '이 어르신의 회기'라는 제목을 달고 있었다.
          어느 어르신을 골라도 글자 하나까지 같은 세 건이었고, 세 제목은 다른
          씨앗 어르신들의 주제였다 — 김○○ 프로필에 남의 주제가 떴다는 뜻이다.
          ResumeCard 에는 어르신 식별자 자체가 없고, 어르신별로 회기를 읽는
          함수도 repo.ts 에 아직 없다. 그러니 목록을 만들 수 없다고 적는다. */}
      <h2 className="mt-6 text-[1.125rem] font-extrabold text-ink-900">
        이 어르신의 회기
      </h2>
      <Card className="mt-3 p-4">
        <p className="text-[1rem] font-bold text-ink-700">
          지난 회기 목록은 아직 없어요.
        </p>
        <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-500">
          어르신별로 지난 회기를 불러오는 기능은 준비 중입니다. 지금 진행 중인
          회기는 위에서 이어할 수 있어요.
        </p>
      </Card>
    </Screen>
  );
}

/**
 * 프로필 한 줄 — 읽기 전용.
 *
 * 예전에는 button 이었다. 누르면 고칠 수 있을 것처럼 보이는데 onClick 이
 * 없어서 아무 일도 일어나지 않았다. 고치는 화면이 생기기 전까지는 눌리지
 * 않는 줄로 둔다.
 */
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
    <li className="flex w-full items-center gap-3.5 rounded-[18px] bg-surface p-3.5 shadow-[0_2px_10px_rgba(122,84,46,0.06)]">
      <IconCircle tone={tone} size={48}>
        {icon}
      </IconCircle>
      <div className="min-w-0 flex-1">
        <p className="text-[1.0625rem] font-extrabold text-ink-900">{title}</p>
        <div className="mt-1">{body}</div>
      </div>
    </li>
  );
}

/**
 * 값이 비어 있을 수 있다. 의사소통 방식·선호 음악·피하고 싶은 주제를 입력하는
 * 화면이 아직 없어서, 실제로 등록한 어르신은 이 칸들이 비어 있는 것이 맞다.
 * 비었을 때 아무것도 안 그리면 "왜 안 보이지"가 되므로 비었다고 적는다.
 */
function Chips({ items, tone }: { items: string[]; tone: 'leaf' | 'brand' }) {
  if (items.length === 0) {
    return (
      <span className="text-[0.9375rem] text-ink-500">적어 둔 내용이 없어요</span>
    );
  }
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((c) => (
        <Chip key={c} tone={tone} size="sm">
          {c}
        </Chip>
      ))}
    </span>
  );
}
