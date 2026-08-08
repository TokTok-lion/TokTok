'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Art } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chevron, Chip, PrimaryButton } from '@/components/ui';
import { IconInfo, IconPlus } from '@/components/icons';
import { TOTAL_STEPS } from '@/lib/flow';
import {
  FAMILY_AVAILABILITY_LABELS,
  SEED_ELDERS,
  SERVICE_STATUS_LABELS,
  type ElderSummary,
  type ServiceStatus,
} from '@/lib/seed';
import { useSession } from '@/lib/store';
import type { ArtKey } from '@/lib/art';

const FILTERS: { id: ServiceStatus | 'all'; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'active', label: '이용 중' },
  { id: 'paused', label: '일시중지' },
  { id: 'ended', label: '종료' },
];

/** 검색은 2자 이상부터 (F-SW-PTC-002). */
const MIN_QUERY = 2;

/**
 * 어르신 목록 (SW-PTC-L · 12 functions)
 *
 * The deck has no frame for this, but the spec does, and the app needs it:
 * a centre runs ~22 people at once and the tab used to open straight into a
 * single hard-coded profile.
 *
 * Only what the work needs is on screen — 가명, 내부번호, 진행 단계, 다음
 * 일정. 명세서 F-SW-PTC-002 forbids searching by resident number or health
 * information, so search covers name, code and topic only.
 */
export default function ElderListPage() {
  const { s, set } = useSession();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<ServiceStatus | 'all'>('all');

  const query = q.trim();
  const list = useMemo(() => {
    const byStatus = SEED_ELDERS.filter(
      (e) => filter === 'all' || e.status === filter,
    );
    if (query.length < MIN_QUERY) return byStatus;
    const needle = query.toLowerCase();
    return byStatus.filter((e) =>
      [e.displayName, e.code, e.topic, e.worker].some((v) =>
        v.toLowerCase().includes(needle),
      ),
    );
  }, [filter, query]);

  const open = (e: ElderSummary) => {
    // switching elder switches the whole working context
    set('elder', {
      ...s.elder,
      id: e.id,
      displayName: e.displayName,
      honorific: `${e.displayName} 어르신`,
      avatar: e.avatar,
      stage: e.step,
      nextTopic: e.topic,
    });
    set('topic', e.topic);
    router.push('/elder/profile');
  };

  const attention = SEED_ELDERS.filter(
    (e) => e.consentExpiresInDays !== null && e.consentExpiresInDays <= 14,
  ).length;

  return (
    <Screen
      back={false}
      menu
      bell
      title="어르신"
      subtitle={`이용 중 ${SEED_ELDERS.filter((e) => e.status === 'active').length}명`}
      decoration={<Ornaments variant="leafRight" />}
      footer={
        <PrimaryButton
          href="/elder/profile"
          leading={
            <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/90">
              <IconPlus size={16} />
            </span>
          }
        >
          어르신 등록
        </PrimaryButton>
      }
    >
      <label htmlFor="elder-search" className="sr-only">
        어르신 검색
      </label>
      <input
        id="elder-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="이름 · 내부번호 · 주제로 찾기"
        className="min-h-[52px] w-full rounded-[16px] border border-hairline bg-surface-strong px-4 text-[1rem] text-ink-900 placeholder:text-ink-500"
      />
      {query.length > 0 && query.length < MIN_QUERY ? (
        <p className="mt-1.5 px-1 text-[0.8125rem] font-semibold text-brand-700">
          {MIN_QUERY}자 이상 입력해 주세요.
        </p>
      ) : null}

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="이용 상태">
        {FILTERS.map((f) => {
          const on = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setFilter(f.id)}
              // 19px/800 keeps white-on-orange in WCAG "large text", where the
              // deck's vivid fill clears the 3:1 bar
              className={`min-h-[44px] shrink-0 rounded-full px-4 text-[1.1875rem] font-extrabold ${
                on ? 'tk-cta text-white' : 'border border-hairline bg-surface-strong text-ink-700'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {attention > 0 ? (
        <p className="mt-3 flex items-start gap-2 rounded-[14px] bg-amber-100/70 px-3.5 py-2.5 text-[0.875rem] font-semibold text-amber-700">
          <IconInfo size={17} className="mt-0.5 shrink-0" />
          동의 만료가 2주 안에 다가온 어르신이 {attention}명 있어요.
        </p>
      ) : null}

      <ul className="mt-3 space-y-2.5">
        {list.map((e) => (
          <Card as="li" key={e.id} className="p-3">
            <button
              type="button"
              onClick={() => open(e)}
              className="flex w-full items-center gap-3.5 text-left"
            >
              <Art
                name={e.avatar as ArtKey}
                size={56}
                alt=""
                className={`shrink-0 ${e.status === 'active' ? '' : 'opacity-60'}`}
              />

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[1.1875rem] font-extrabold text-ink-900">
                    {e.displayName}
                  </span>
                  <span className="text-[0.8125rem] font-semibold text-ink-500">
                    {e.code}
                  </span>
                  {e.status !== 'active' ? (
                    <Chip tone="neutral" size="sm">
                      {SERVICE_STATUS_LABELS[e.status]}
                    </Chip>
                  ) : null}
                  {e.consentExpiresInDays !== null && e.consentExpiresInDays <= 14 ? (
                    <Chip tone="amber" size="sm">
                      동의 D-{e.consentExpiresInDays}
                    </Chip>
                  ) : null}
                </span>

                <span className="mt-1 block text-[0.9375rem] text-ink-500">
                  {e.topic}
                </span>

                <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-ink-500">
                  <span className="font-semibold text-leaf-700">
                    {e.step}/{TOTAL_STEPS}단계
                  </span>
                  <span>담당 {e.worker}</span>
                  <span>{e.nextSession}</span>
                </span>

                <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-track">
                  <span
                    className="block h-full rounded-full bg-leaf-500"
                    style={{ width: `${(e.step / TOTAL_STEPS) * 100}%` }}
                  />
                </span>
              </span>

              <Chevron />
            </button>

            {e.family !== 'available' ? (
              <p className="mt-2 pl-[70px] text-[0.8125rem] text-ink-500">
                {FAMILY_AVAILABILITY_LABELS[e.family]} · 가족 없이도 끝까지 진행할 수
                있어요
              </p>
            ) : null}
          </Card>
        ))}
      </ul>

      {list.length === 0 ? (
        <p className="mt-10 text-center text-[1rem] font-semibold text-ink-500">
          찾는 어르신이 없어요.
        </p>
      ) : null}

      <p className="mt-4 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
        목록에는 업무에 필요한 최소 정보만 표시해요. 주민등록번호나 건강정보는
        저장하지도, 검색하지도 않습니다.
      </p>
    </Screen>
  );
}
