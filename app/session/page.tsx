'use client';

import Link from 'next/link';
import { Art } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chevron, Chip, IconCircle } from '@/components/ui';
import { IconMusicNote } from '@/components/icons';
import { lyricInputs } from '@/lib/domain';
import { useSession } from '@/lib/store';
import type { ArtKey } from '@/lib/art';

/**
 * 콘텐츠 탭 홈 — 오늘 회기의 진행 지도.
 *
 * The deck draws each step as its own frame; this hub exists so the tab bar
 * always has somewhere to land and the worker can jump back into any step
 * without retracing the whole flow.
 */
export default function SessionHubPage() {
  const { s } = useSession();
  const verified = lyricInputs(s.story).length;

  const steps: {
    href: string;
    art: ArtKey;
    title: string;
    desc: string;
    done: boolean;
  }[] = [
    {
      href: '/session/checklist',
      art: 'icon_clipboard',
      title: '회기 시작 체크리스트',
      desc: '동의·기억 카드·장비를 점검해요',
      done: Object.values(s.checklist).every(Boolean),
    },
    {
      href: '/session/cards',
      art: 'card_family',
      title: '기억 카드 선택',
      desc: '어떤 기억부터 시작할지 골라요',
      done: !!s.memoryCard,
    },
    {
      href: '/session/level',
      art: 'icon_speech_bubble',
      title: '질문 방식 선택',
      desc: `현재 ${s.questionLevel}단계`,
      done: true,
    },
    {
      href: '/session/interview',
      art: 'icon_mic_live',
      title: '인터뷰 진행',
      desc: '질문을 읽고 이야기를 들어요',
      done: s.transcript.length > 0,
    },
    {
      href: '/session/transcript',
      art: 'icon_document_green',
      title: '전사 교정',
      desc: '기록된 내용을 다듬어요',
      done: s.transcriptConfirmed,
    },
    {
      href: '/session/story',
      art: 'icon_people_shield',
      title: '이야기 정리',
      desc: `확인된 이야기 ${verified}건`,
      done: verified > 0,
    },
    {
      href: '/session/lyrics',
      art: 'icon_note_green',
      title: '가사 검수',
      desc: '확인된 이야기로 만든 가사를 봐요',
      done: s.lyricsApproved,
    },
    {
      href: '/session/style',
      art: 'style_ballad',
      title: '음악 스타일 선택',
      desc: '이야기에 어울리는 분위기를 골라요',
      done: !!s.style,
    },
    {
      href: '/session/preview',
      art: 'icon_record_note',
      title: '노래 미리듣기 · 완성',
      desc: '버전을 고르고 곡을 확정해요',
      done: s.songStatus === 'complete',
    },
    {
      href: '/session/sing',
      art: 'icon_mic_orange',
      title: '함께 부르기',
      desc: '완성된 후렴을 다 같이 불러요',
      done: false,
    },
  ];

  const doneCount = steps.filter((x) => x.done).length;

  return (
    <Screen
      menu
      back={false}
      bell
      title="오늘의 회기"
      subtitle="어느 단계든 눌러서 이어갈 수 있어요"
      decoration={<Ornaments variant="leafRight" />}
    >
      <Card className="flex items-center gap-3.5 p-3.5">
        <Art name={s.elder.avatar as ArtKey} size={72} alt="" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[1.3125rem] font-extrabold text-ink-900">
            {s.elder.honorific}
          </p>
          <p className="mt-1 text-[1rem] text-ink-500">{s.topic}</p>
        </div>
        <Chip tone="leaf" size="sm">
          {doneCount}/{steps.length} 완료
        </Chip>
      </Card>

      <Link
        href="/library"
        className="mt-4 flex min-h-[72px] items-center gap-3.5 rounded-[20px] bg-surface px-4 shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
      >
        <IconCircle tone="brand" size={48}>
          <IconMusicNote size={24} className="text-brand-600" />
        </IconCircle>
        <span className="flex-1 text-[1.125rem] font-extrabold text-ink-900">
          내 노래 보관함
        </span>
        <Chevron />
      </Link>

      <ol className="mt-4 space-y-3">
        {steps.map((st, i) => (
          <li key={st.href}>
            <Link
              href={st.href}
              className="flex min-h-[80px] items-center gap-3.5 rounded-[20px] bg-surface px-3.5 shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
            >
              <span className="relative shrink-0">
                <Art name={st.art} size={52} alt="" />
                {st.done ? (
                  <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-leaf-600 ring-2 ring-surface">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m5 13 4.5 4.5L19 7" />
                    </svg>
                  </span>
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.8125rem] font-bold text-ink-500">
                  {i + 1}단계
                </span>
                <span className="block text-[1.125rem] font-extrabold text-ink-900">
                  {st.title}
                </span>
                <span className="block text-[0.875rem] text-ink-500">{st.desc}</span>
              </span>
              <Chevron />
            </Link>
          </li>
        ))}
      </ol>
    </Screen>
  );
}
