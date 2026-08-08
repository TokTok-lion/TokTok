import Link from 'next/link';
import { Art, ArtBox } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Divider, IconCircle, NoteBar, PrimaryButton } from '@/components/ui';
import { IconBell } from '@/components/icons';

const RECIPIENTS = [
  { art: 'label_daughter', label: '딸' },
  { art: 'label_son', label: '아들' },
  { art: 'label_granddaughter', label: '손녀' },
] as const;

/** 가족 미션 전송 완료 (deck p.25) */
export default function MissionSentPage() {
  return (
    <Screen
      title="가족 미션 전송 완료"
      subtitle="따뜻한 참여 요청을 보냈어요"
      decoration={<Ornaments variant="leafRight" />}
      footer={
        <>
          <PrimaryButton href="/family/replies">가족 답장 보러가기</PrimaryButton>
          <div className="mt-3 text-center">
            <Link
              href="/family/mission"
              className="inline-flex min-h-[44px] items-center text-[1.0625rem] font-bold text-brand-700"
            >
              다른 가족 추가
            </Link>
          </div>
        </>
      }
    >
      <Card className="flex items-center justify-center px-4 py-6">
        <ArtBox
          name="icon_envelope_success"
          alt="가족에게 초대 편지를 보냈다는 그림"
          className="w-[248px]"
          fit="contain"
          priority
        />
      </Card>

      <Card className="mt-4 px-4">
        <Row
          icon={
            <IconCircle tone="leaf" size={44}>
              <Art name="ui_people" size={24} alt="" />
            </IconCircle>
          }
          label="보낸 대상"
          value={<span className="text-brand-700">3명</span>}
        />
        <Divider />
        <Row
          icon={
            <IconCircle tone="amber" size={44}>
              <span className="text-[0.5rem] font-black text-ink-900">TALK</span>
            </IconCircle>
          }
          label="전송 방법"
          value="카카오톡"
        />
        <Divider />
        <Row
          icon={
            <IconCircle tone="brand" size={44}>
              <Art name="ui_calendar_check" size={24} alt="" />
            </IconCircle>
          }
          label="응답 마감"
          value={<span className="text-brand-700">이번 주 금요일</span>}
        />
      </Card>

      <ul className="mt-4 grid grid-cols-3 gap-2.5">
        {RECIPIENTS.map((r) => (
          <li
            key={r.label}
            className="flex min-h-[54px] items-center justify-center gap-1.5 rounded-full bg-leaf-50 px-2"
          >
            <Art name={r.art} size={30} alt="" />
            <span className="text-[1rem] font-bold text-leaf-700">{r.label}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <NoteBar tone="amber" icon={<IconBell size={19} />}>
          답장이 오면 알림으로 알려드릴게요
        </NoteBar>
      </div>
    </Screen>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[68px] items-center gap-3">
      {icon}
      <span className="flex-1 text-[1.0625rem] font-semibold text-ink-700">{label}</span>
      <span className="text-[1.1875rem] font-extrabold text-ink-900">{value}</span>
    </div>
  );
}
