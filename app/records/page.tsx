'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArtBox } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chevron, Chip, IconCircle } from '@/components/ui';
import { IconCalendar, IconDoc, IconMusicNote, IconPlay, IconTextSize } from '@/components/icons';
import { formatDate } from '@/lib/domain';
import { SEED_LIBRARY, SEED_RESUME } from '@/lib/seed';
import { useSession } from '@/lib/store';
import type { ArtKey } from '@/lib/art';

/**
 * 기록 — 이미 만들어진 것들.
 *
 * The boundary with 회기 is tense, not topic: anything still being made lives
 * in 회기, anything finished lives here. That is why 전사 교정 and 이야기 정리
 * are not on this screen any more — they are steps 4 and 5 of the flow, and
 * listing them here was what made "어디로 가야 하지?" ambiguous.
 */
export default function RecordsPage() {
  const { s, set } = useSession();
  const router = useRouter();
  const finished = SEED_RESUME.filter((c) => c.done);

  const openPast = (title: string) => {
    set('topic', title);
    router.push('/session/wrap');
  };

  return (
    <Screen
      back={false}
      menu
      bell
      title="기록"
      subtitle="완성된 노래와 지난 기록을 모았어요"
      decoration={<Ornaments variant="leafRight" />}
    >
      {/* 완성된 노래 */}
      <h2 className="flex items-center gap-2 text-[1.125rem] font-extrabold text-ink-900">
        <IconMusicNote size={21} className="text-brand-500" />
        완성된 노래
        <span className="text-[0.9375rem] font-semibold text-ink-500">
          {SEED_LIBRARY.length}곡
        </span>
      </h2>
      <ul className="mt-3 space-y-2.5">
        {SEED_LIBRARY.map((song) => (
          <Card as="li" key={song.id} className="p-3">
            <Link href="/library" className="flex items-center gap-3.5">
              <ArtBox
                name={song.art as ArtKey}
                alt={`${song.title} 앨범 그림`}
                className="h-[64px] w-[64px] shrink-0 rounded-[12px] object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[1.0625rem] font-extrabold text-ink-900">
                  {song.title}
                </span>
                <span className="block text-[0.875rem] text-ink-500">
                  {song.style} · {formatDate(song.date)}
                </span>
              </span>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-strong text-brand-600 shadow">
                <IconPlay size={19} />
              </span>
            </Link>
          </Card>
        ))}
      </ul>
      <div className="mt-3">
        <Link
          href="/library"
          className="flex min-h-[52px] items-center justify-center gap-1.5 rounded-[14px] border-2 border-brand-300 bg-surface-strong text-[1rem] font-bold text-brand-700"
        >
          노래 보관함 전체 보기
          <Chevron />
        </Link>
      </div>

      {/* 지난 회기 */}
      <h2 className="mt-6 flex items-center gap-2 text-[1.125rem] font-extrabold text-ink-900">
        <IconCalendar size={21} className="text-leaf-600" />
        지난 회기
      </h2>
      <ul className="mt-3 space-y-2.5">
        {finished.map((c) => (
          <Card as="li" key={c.id} className="p-3">
            {/* Opening a past session makes it the active topic first, so the
                summary shown is that session's and not whatever was last open. */}
            <button
              type="button"
              onClick={() => openPast(c.title)}
              className="flex w-full items-center gap-3.5 text-left"
            >
              <ArtBox
                name={c.art as ArtKey}
                className="h-[56px] w-[56px] shrink-0 rounded-[12px] object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[1.0625rem] font-extrabold text-ink-900">
                  {c.title}
                </span>
                <span className="mt-1 block">
                  <Chip tone="leaf" size="sm">
                    {c.status}
                  </Chip>
                </span>
              </span>
              <Chevron />
            </button>
          </Card>
        ))}
        {finished.length === 0 ? (
          <p className="rounded-[14px] bg-surface px-4 py-5 text-center text-[0.9375rem] text-ink-500">
            아직 마무리된 회기가 없어요.
          </p>
        ) : null}
      </ul>

      {/* 산출물 바로가기 */}
      <h2 className="mt-6 text-[1.125rem] font-extrabold text-ink-900">
        만들어진 자료
      </h2>
      <ul className="mt-3 space-y-2.5">
        <li>
          <Link
            href="/session/log"
            className="flex min-h-[72px] items-center gap-3.5 rounded-[18px] bg-surface px-4 shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
          >
            <IconCircle tone="leaf" size={46}>
              <IconDoc size={23} className="text-leaf-600" />
            </IconCircle>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[1.0625rem] font-extrabold text-ink-900">
                  활동일지
                </span>
                {s.logSaved ? (
                  <Chip tone="leaf" size="sm">
                    저장됨
                  </Chip>
                ) : (
                  <Chip tone="brand" size="sm">
                    작성 중
                  </Chip>
                )}
              </span>
              <span className="block text-[0.875rem] text-ink-500">
                기관 양식으로 복사·내보내기
              </span>
            </span>
            <Chevron />
          </Link>
        </li>
        <li>
          <Link
            href="/session/lyric-card"
            className="flex min-h-[72px] items-center gap-3.5 rounded-[18px] bg-surface px-4 shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
          >
            <IconCircle tone="brand" size={46}>
              <IconTextSize size={23} className="text-brand-600" />
            </IconCircle>
            <span className="min-w-0 flex-1">
              <span className="block text-[1.0625rem] font-extrabold text-ink-900">
                가사 카드
              </span>
              <span className="block text-[0.875rem] text-ink-500">
                큰 글씨로 함께 읽고 가족에게 공유
              </span>
            </span>
            <Chevron />
          </Link>
        </li>
      </ul>

      <Card className="mt-5 p-4">
        <p className="text-[0.9375rem] leading-relaxed text-ink-700">
          기록은 이 기기에만 저장돼요. 어르신의 음성·이야기·가사는 서비스 밖으로
          자동 전송되지 않습니다.
        </p>
      </Card>

      <p className="mt-3 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
        아직 만드는 중인 단계(전사 교정·이야기 정리 등)는 <strong>회기</strong>{' '}
        탭에 있어요.
      </p>
    </Screen>
  );
}
