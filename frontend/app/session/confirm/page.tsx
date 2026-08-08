'use client';

import Link from 'next/link';
import { Art } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, CheckCircle, Chevron, NoteBar, PrimaryButton } from '@/components/ui';
import { IconChat, IconShield } from '@/components/icons';
import { lyricInputs } from '@/lib/domain';
import { useSession } from '@/lib/store';
import type { ArtKey } from '@/lib/art';

/** 인터뷰 내용 확인 (deck p.13) */
export default function ConfirmPage() {
  const { s } = useSession();
  const verified = lyricInputs(s.story);
  const followUps = s.story.filter((i) => i.status === 'unverified' && i.followUp);

  return (
    <Screen
      title="인터뷰 내용 확인"
      subtitle="기록된 이야기만 다음 단계로 보내요"
      decoration={<Ornaments variant="leafRight" />}
      footer={
        <>
          <PrimaryButton
            href="/session/transcript"
            trailing={<Chevron className="text-white" />}
          >
            확인하고 다음으로
          </PrimaryButton>
          <div className="mt-3 text-center">
            <Link
              href="/session/transcript"
              className="inline-flex min-h-[44px] items-center border-b-2 border-leaf-300 px-1 text-[1.0625rem] font-bold text-leaf-700"
            >
              직접 수정
            </Link>
          </div>
        </>
      }
    >
      <Card className="flex items-center gap-3.5 p-4">
        <Art name={s.elder.avatar as ArtKey} size={80} alt="" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[1.0625rem] text-ink-500">{s.elder.honorific}</p>
          <p className="mt-0.5 text-[1.375rem] font-extrabold leading-tight text-ink-900">
            {s.topic}
          </p>
        </div>
        <Art name="album_briefcase_coins" size={84} alt="" className="shrink-0" />
      </Card>

      <h2 className="mt-5 flex items-center gap-2 text-[1.125rem] font-extrabold text-leaf-700">
        <CheckCircle size={26} />
        확인된 이야기
      </h2>

      <ul className="mt-3 space-y-3">
        {verified.map((i) => (
          <Card as="li" key={i.id} className="flex items-center gap-3.5 p-4">
            <CheckCircle size={42} />
            <div className="min-w-0 flex-1">
              <p className="text-[1.125rem] font-bold leading-snug text-ink-900">
                {i.text}
              </p>
              {/* 출처 없는 문장은 여기 도달할 수 없다 (NFR-AI-002) */}
              <p className="mt-1 text-[0.8125rem] font-semibold text-ink-500">
                출처 · {i.sources.map((sc) => sc.label).join(', ')}
              </p>
            </div>
          </Card>
        ))}
      </ul>

      {followUps.length > 0 ? (
        <>
          <h2 className="mt-5 flex items-center gap-2 text-[1.125rem] font-extrabold text-brand-700">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100">
              <IconChat size={16} className="text-brand-600" />
            </span>
            추가로 물어보기
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {followUps.map((f) => (
              <Link
                key={f.id}
                href="/session/suggest"
                className="flex min-h-[62px] items-center gap-1 rounded-[16px] border-2 border-brand-200 bg-surface-strong px-3 text-[0.9375rem] font-bold leading-snug text-ink-900"
              >
                <span className="flex-1">{f.followUp}</span>
                <Chevron className="shrink-0" />
              </Link>
            ))}
          </div>
        </>
      ) : null}

      <div className="mt-4">
        <NoteBar tone="leaf" icon={<IconShield size={20} />}>
          확인된 내용만 가사로 반영됩니다
        </NoteBar>
      </div>
    </Screen>
  );
}
