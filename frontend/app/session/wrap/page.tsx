'use client';

import Link from 'next/link';
import { Art } from '@/components/Art';
import { ServerSaveNote } from '@/components/ServerSaveNote';
import { ConsentAsk, RESULT_CONSENTS } from '@/components/ConsentGate';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chip, OutlineButton, PrimaryButton } from '@/components/ui';
import { IconDoc, IconEdit, IconSmile } from '@/components/icons';
import { REACTIONS } from '@/lib/domain';
import { useSession } from '@/lib/store';
import type { ArtKey } from '@/lib/art';

/** 회기 마무리 (deck p.29) */
export default function WrapPage() {
  const { s, set, setConsent } = useSession();
  const selected = REACTIONS.filter((r) => s.reactions.includes(r.id));

  return (
    <Screen
      title="회기 마무리"
      subtitle="오늘의 반응과 다음 주제를 함께 정리해요"
      decoration={<Ornaments variant="notes" />}
      footer={
        <>
          {/* 활동일지 저장은 이 화면으로 넘어오면서 뒤에서 끝난다.
              결과를 여기서 말해 주지 않으면 아무도 못 본다. */}
          <div className="mb-3 empty:mb-0">
            <ServerSaveNote retry />
          </div>
          <div className="mb-3">
            <OutlineButton href="/session/log" leading={<IconDoc size={22} />}>
              초안 다시 보기
            </OutlineButton>
          </div>
          <PrimaryButton
            href="/home"
            leading={
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/25">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 13 4.5 4.5L19 7" />
                </svg>
              </span>
            }
          >
            저장하고 종료
          </PrimaryButton>
        </>
      }
    >
      <Card className="flex items-center gap-3 p-3">
        <Art name={s.elder.avatar as ArtKey} size={68} alt="" className="shrink-0" />
        <div className="min-w-0">
          <p className="text-[1.25rem] font-extrabold text-ink-900">
            {s.elder.honorific}
          </p>
          {/* 주제 없이 진행한 회기가 있다(lib/useElders.ts). 빈 줄을 남기면
              불러오다 만 것처럼 보이므로 그럴 때는 그렇다고 적는다. */}
          <p className="mt-0.5 text-[1.0625rem] text-ink-500">
            {s.topic || '오늘 주제는 적어 두지 않았어요'}
          </p>
        </div>
      </Card>

      <Card className="mt-4 p-4">
        <div className="flex items-center gap-3">
          <StepDot n={1} />
          <h2 className="flex-1 text-[1.1875rem] font-extrabold text-ink-900">
            오늘의 반응
          </h2>
          <IconSmile size={24} className="text-brand-600" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {selected.map((r) => (
            <Chip key={r.id} tone="leaf">
              {r.label}
            </Chip>
          ))}
          {selected.length === 0 ? (
            <p className="text-[0.9375rem] text-ink-500">기록된 반응이 없어요.</p>
          ) : null}
        </div>
      </Card>

      {/* '다음 추천 주제'가 아니다. 다음 주제를 계산하는 코드는 앱 어디에도
          없고, 활동일지 화면에서 복지사가 손으로 적는 값이다. 라벨과 빈 값
          문구를 관찰 반응 기록·활동일지와 같은 말로 맞춘다 — 한 값을 세
          화면이 서로 다르게 부르면 어느 것이 진짜인지 알 수 없다.
          예전에는 빈 값 폴백도 없어서 실제 회기에서는 반짝이 표시만 붙은 빈
          알약이 AI 추천인 척 떠 있었다. */}
      <Card className="mt-3.5 p-4">
        <div className="flex items-center gap-3">
          <StepDot n={2} />
          <h2 className="flex-1 text-[1.1875rem] font-extrabold text-ink-900">
            다음 회기 주제
          </h2>
          <Art name="ui_next_topic" size={26} alt="" />
        </div>
        {s.nextTopic ? (
          <p className="mt-3 rounded-[14px] bg-amber-100 py-3.5 text-center text-[1.25rem] font-extrabold text-brand-700">
            {s.nextTopic}
          </p>
        ) : (
          /* 막다른 길로 두지 않는다 — 어디서 적는지 같은 화면에서 알린다. */
          <p className="mt-3 rounded-[14px] bg-surface-strong px-3.5 py-3 text-[0.9375rem] leading-relaxed text-ink-700">
            아직 정하지 않았어요.{' '}
            <Link
              href="/session/log"
              className="font-bold text-leaf-700 underline underline-offset-2"
            >
              활동일지
            </Link>
            에서 적으면 기관 서식에도 함께 나갑니다.
          </p>
        )}
      </Card>

      <Card className="mt-3.5 p-4">
        <div className="flex items-center gap-3">
          <StepDot n={3} />
          <h2 className="flex-1 text-[1.1875rem] font-extrabold text-ink-900">
            한 줄 메모
          </h2>
          <IconEdit size={22} className="text-leaf-600" />
        </div>
        <div className="mt-3 flex items-start gap-3 rounded-[14px] bg-surface-strong p-3.5">
          <Art name="leaf_branch_2" size={40} alt="" className="mt-0.5 shrink-0" />
          <label htmlFor="wrapNote" className="sr-only">
            회기 한 줄 메모
          </label>
          <textarea
            id="wrapNote"
            rows={2}
            value={s.wrapNote}
            onChange={(e) => set('wrapNote', e.target.value)}
            className="flex-1 resize-none bg-transparent text-[1.0625rem] font-medium leading-relaxed text-ink-900 outline-none"
          />
        </div>
      </Card>

      {/*
        노래를 어떻게 쓸지는 노래가 나온 뒤에 여쭙는다.
        예전에는 다섯 가지를 전부 회기 준비에서 한꺼번에 받았다. 그런데 시설
        재생·가족 공유·홍보 공개는 전부 '만들어진 노래'에 대한 물음이라,
        노래가 없는 자리에서 미리 답을 받으면 무엇에 동의하시는지 알 수 없는
        채로 답하시게 된다. 개수를 줄이려는 것이 아니라 물어야 할 때 묻는
        것이다 — 회기 준비에는 지금 없으면 진행이 안 되는 둘만 남겼다.
      */}
      <h2 className="mt-6 text-[1.1875rem] font-extrabold text-ink-900">
        이 노래를 어떻게 쓸까요
      </h2>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-500">
        {s.elder.honorific}께 여쭙고 그대로 기록해요. 지금 정하지 않으셔도
        되고, 「더보기」에서 언제든 바꾸실 수 있어요.
      </p>
      <ul className="mt-3 space-y-3">
        {RESULT_CONSENTS.map((kind) => (
          <ConsentAsk
            key={kind}
            kind={kind}
            state={s.elder.consents[kind] ?? 'unset'}
            onDecide={(granted) => setConsent(kind, granted)}
          />
        ))}
      </ul>
    </Screen>
  );
}

function StepDot({ n }: { n: number }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[1.0625rem] font-extrabold text-brand-800">
      {n}
    </span>
  );
}

