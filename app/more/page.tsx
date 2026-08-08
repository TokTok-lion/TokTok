'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Art } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chevron, IconCircle, NoteBar, OutlineButton } from '@/components/ui';
import { IconInfo, IconShield } from '@/components/icons';
import {
  CONSENT_FALLBACK,
  CONSENT_LABELS,
  type ConsentKind,
} from '@/lib/domain';
import { useSession } from '@/lib/store';

const ORDER: ConsentKind[] = [
  'recording',
  'externalAi',
  'facilityPlay',
  'familyShare',
  'promotion',
];

const PURPOSE: Record<ConsentKind, string> = {
  recording: '대화를 녹음하고 글로 옮기는 데 사용해요.',
  externalAi: '전사·이야기 정리·가사 생성을 위해 외부 사업자에 보내요.',
  facilityPlay: '센터 안에서 노래를 함께 듣는 범위를 정해요.',
  familyShare: '가족에게 곡·가사·사진을 보여줄 범위를 정해요.',
  promotion: '외부 홍보나 공모전에 쓰는 것을 따로 정해요.',
};

/**
 * 더보기 — 동의 관리 · 글자 크기 · 데이터.
 *
 * 동의 관리 is P0 in the spec (SW-CONS) but has no frame in the deck, so it
 * lives here: five independent switches, each with the alternative path that
 * applies when it is refused (F-SW-CONS-009). Nothing is bundled.
 */
export default function MorePage() {
  const { s, setConsent, set, reset } = useSession();
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <Screen
      back={false}
      menu={false}
      title="더보기"
      subtitle="동의와 사용 환경을 관리해요"
      decoration={<Ornaments variant="leafRight" />}
    >
      <h2 className="flex items-center gap-2 text-[1.1875rem] font-extrabold text-ink-900">
        <IconShield size={22} className="text-leaf-600" />
        동의 관리
      </h2>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-500">
        목적마다 따로 선택할 수 있어요. 하나를 거부해도 서비스는 계속 쓸 수
        있습니다.
      </p>

      <ul className="mt-3 space-y-3">
        {ORDER.map((kind) => {
          const granted = s.elder.consents[kind] === 'granted';
          return (
            <Card as="li" key={kind} className="p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[1.125rem] font-extrabold text-ink-900">
                    {CONSENT_LABELS[kind]}
                  </p>
                  <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-500">
                    {PURPOSE[kind]}
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={granted}
                  aria-label={`${CONSENT_LABELS[kind]} 동의`}
                  onClick={() => setConsent(kind, !granted)}
                  className={`relative h-[38px] w-[68px] shrink-0 rounded-full transition-colors ${
                    granted ? 'bg-leaf-600' : 'bg-ink-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 h-[30px] w-[30px] rounded-full bg-white transition-[left] ${
                      granted ? 'left-[34px]' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {!granted ? (
                <p className="mt-3 rounded-[12px] bg-brand-50 px-3.5 py-2.5 text-[0.875rem] font-semibold leading-relaxed text-brand-800">
                  대신 이렇게 할 수 있어요 · {CONSENT_FALLBACK[kind]}
                </p>
              ) : null}
            </Card>
          );
        })}
      </ul>

      <h2 className="mt-6 text-[1.1875rem] font-extrabold text-ink-900">글자 크기</h2>
      <Card className="mt-3 flex items-center gap-3 p-4">
        <Art name="icon_text_size" size={48} alt="" />
        <div className="flex flex-1 gap-2" role="group" aria-label="글자 크기 선택">
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
              className={`min-h-[52px] flex-1 rounded-[14px] text-[1rem] font-bold ${
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

      <h2 className="mt-6 text-[1.1875rem] font-extrabold text-ink-900">안내</h2>
      <ul className="mt-3 space-y-3">
        <li>
          <Link
            href="/guide"
            className="flex min-h-[72px] items-center gap-3.5 rounded-[20px] bg-surface px-4 shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
          >
            <IconCircle tone="amber" size={46}>
              <IconInfo size={23} className="text-amber-700" />
            </IconCircle>
            <span className="flex-1 text-[1.125rem] font-extrabold text-ink-900">
              이용 안내 · 자주 묻는 질문
            </span>
            <Chevron />
          </Link>
        </li>
        <li>
          <Link
            href="/elder"
            className="flex min-h-[72px] items-center gap-3.5 rounded-[20px] bg-surface px-4 shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
          >
            <Art name="avatar_grandfather" size={46} alt="" className="shrink-0" />
            <span className="flex-1 text-[1.125rem] font-extrabold text-ink-900">
              어르신 프로필
            </span>
            <Chevron />
          </Link>
        </li>
      </ul>

      <h2 className="mt-6 text-[1.1875rem] font-extrabold text-ink-900">데이터</h2>
      <div className="mt-3">
        <NoteBar tone="leaf" icon={<IconShield size={20} />}>
          모든 기록은 이 기기에만 저장돼요. 공용 태블릿이라면 회기가 끝난 뒤
          지워 주세요.
        </NoteBar>
      </div>

      <div className="mt-3">
        {confirmReset ? (
          <div className="rounded-[16px] bg-brand-50 p-4">
            <p className="text-[1rem] font-bold text-ink-900">
              이 기기의 회기 기록을 모두 지울까요?
            </p>
            <p className="mt-1 text-[0.875rem] text-ink-700">
              되돌릴 수 없어요.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="min-h-[52px] rounded-[14px] border-2 border-hairline bg-surface-strong text-[1.0625rem] font-bold text-ink-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  reset();
                  setConfirmReset(false);
                }}
                className="min-h-[52px] rounded-[14px] bg-danger-600 text-[1.0625rem] font-bold text-white"
              >
                모두 지우기
              </button>
            </div>
          </div>
        ) : (
          <OutlineButton onClick={() => setConfirmReset(true)}>
            이 기기의 기록 지우기
          </OutlineButton>
        )}
      </div>

      <p className="mt-5 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
        똑똑은 문화·인지 활동 도구예요. 치매·우울을 진단하거나 치료 효과를
        보장하지 않습니다.
      </p>
    </Screen>
  );
}
