'use client';

import { Art } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, IconCircle, PrimaryButton } from '@/components/ui';
import { SEED_LYRIC_CARD } from '@/lib/seed';
import { useSession } from '@/lib/store';

/** 가사 카드 보기 (deck p.27) */
export default function LyricCardPage() {
  const { s, set } = useSession();

  const actions = [
    { key: 'image', art: 'icon_image_orange' as const, label: '이미지 저장' },
    { key: 'share', art: 'icon_people_green' as const, label: '가족에게 공유' },
    { key: 'edit', art: 'icon_pencil_orange' as const, label: '다시 수정' },
  ];

  return (
    <Screen
      title="가사 카드 보기"
      subtitle="가족에게 전할 문장을 큰 글씨로 확인해요"
      decoration={<Ornaments variant="notes" />}
      footer={
        <PrimaryButton
          href="/session/sing"
          leading={
            <IconCircle tone="neutral" size={30}>
              <Art name="ui_music" size={17} alt="" />
            </IconCircle>
          }
        >
          노래와 함께 저장
        </PrimaryButton>
      }
    >
      <Card className="p-3.5">
        <p className="flex items-center justify-center gap-2 text-[1.0625rem] font-bold text-ink-900">
          <Art name="leaf_sprig" size={22} alt="" />
          첫 월급 이야기
          <Art name="leaf_sprig" size={22} alt="" className="-scale-x-100" />
        </p>

        <div className="relative mt-3 overflow-hidden rounded-[18px] border border-brand-200 bg-[#fdf5e8] px-4 py-9">
          <span className="absolute left-4 top-4 text-[1.375rem] text-brand-300" aria-hidden>
            ♥
          </span>
          <span className="absolute bottom-4 right-4 text-[1.375rem] text-brand-300" aria-hidden>
            ♥
          </span>
          <Art
            name="leaf_branch_1"
            size={70}
            alt=""
            className="absolute -right-2 top-1 opacity-70"
          />
          <Art
            name="leaf_branch_2"
            size={58}
            alt=""
            className="absolute -left-1 bottom-2 opacity-60"
          />

          <p className="relative text-center text-[1.625rem] font-extrabold leading-[1.6] tracking-[-0.01em] text-ink-900">
            {SEED_LYRIC_CARD.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </p>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            className="flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-[18px] bg-surface px-2 shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
          >
            <Art name={a.art} size={40} alt="" />
            <span className="text-[0.9375rem] font-bold text-ink-900">{a.label}</span>
          </button>
        ))}
      </div>

      {/* 글자 크기 조절 — 카드가 실제로 커진다 (NFR-A11Y-003) */}
      <Card className="mt-4 p-3.5">
        <div className="flex items-center gap-3">
          <Art name="icon_text_size" size={48} alt="" className="shrink-0" />
          <p className="flex-1 text-[0.9375rem] leading-snug text-ink-700">
            큰 글씨로 보여드려 어르신이 함께 읽기 쉬워요
          </p>
        </div>
        <div className="mt-3 flex gap-2" role="group" aria-label="글자 크기">
          {[
            { v: 1, label: '보통' },
            { v: 1.15, label: '크게' },
            { v: 1.3, label: '아주 크게' },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              aria-pressed={s.textScale === o.v}
              onClick={() => set('textScale', o.v)}
              className={`min-h-[48px] flex-1 rounded-[12px] text-[0.9375rem] font-bold ${
                s.textScale === o.v
                  ? 'bg-leaf-600 text-white'
                  : 'bg-leaf-100 text-leaf-700'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </Card>
    </Screen>
  );
}
