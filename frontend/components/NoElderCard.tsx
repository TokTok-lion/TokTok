'use client';

import Link from 'next/link';
import { Art } from '@/components/Art';
import { Card } from './ui';

/**
 * 진행 중인 회기가 가리킬 어르신이 없을 때.
 *
 * 막다른 길로 두지 않는다. 왜 비어 있는지 한 줄로 말하고, 바로 다음에 할
 * 일(어르신 고르기 / 등록하기)을 준다.
 */
/**
 * 서버에 물어보는 동안 자리를 지키는 카드.
 *
 * 확인이 끝나기 전에 기기에 남은 회기를 그대로 그렸더니, 지워진 어르신
 * 이름이 1초쯤 떴다가 "목록에 없어요"로 바뀌었다. 그 1초가 바로 앞에서
 * 고치려던 그 문제다 — 없는 사람 이름을 보여 주는 것.
 *
 * 잠깐 비어 있는 편이 잠깐 틀린 것보다 낫다. 카드 크기는 진짜 카드와
 * 같게 잡아서 확인이 끝나도 화면이 튀지 않는다.
 */
export function ElderCardSkeleton() {
  return (
    <Card className="p-4" aria-busy="true">
      <span className="sr-only">회기를 불러오는 중입니다</span>
      <div className="flex items-center gap-3">
        <div className="h-[56px] w-[56px] shrink-0 rounded-full bg-surface-sunk" />
        <div className="min-w-0 flex-1">
          <div className="h-4 w-32 rounded-full bg-surface-sunk" />
          <div className="mt-2 h-3 w-20 rounded-full bg-surface-sunk" />
        </div>
      </div>
      <div className="mt-3.5 h-[92px] rounded-[14px] bg-surface-sunk" />
      <div className="mt-2.5 h-2 rounded-full bg-track" />
    </Card>
  );
}

export function NoElderCard({
  deleted,
  /** 화면 아래에 이미 같은 버튼이 있으면 끈다. 같은 말을 두 번 하지 않는다. */
  actions = true,
}: {
  deleted?: boolean;
  actions?: boolean;
}) {
  return (
    <Card className="p-5 text-center">
      <Art name="ui_people" size={44} alt="" className="mx-auto" />
      <p className="mt-2 text-[1.125rem] font-extrabold text-ink-900">
        {deleted ? '이 회기의 어르신이 목록에 없어요' : '진행 중인 회기가 없어요'}
      </p>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-500">
        {deleted
          ? '기관 목록에서 지워진 것 같아요. 어르신을 다시 고르면 이어서 진행할 수 있어요.'
          : '어르신을 고르면 그때부터 회기가 시작돼요.'}
      </p>
      {actions ? (
        <>
          <Link
            href="/elder"
            className="tk-cta mt-4 flex min-h-[56px] items-center justify-center rounded-[14px] text-[1.0625rem] font-extrabold text-white"
          >
            어르신 고르기
          </Link>
          <Link
            href="/elder/new"
            className="mt-2 flex min-h-[52px] items-center justify-center rounded-[14px] border border-hairline bg-surface text-[1rem] font-bold text-ink-700"
          >
            새 어르신 등록하기
          </Link>
        </>
      ) : null}
    </Card>
  );
}
