'use client';

import Link from 'next/link';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chevron, PrimaryButton, SectionLabel } from '@/components/ui';
import { IconInfo } from '@/components/icons';
import { LyricEditor } from '@/components/LyricEditor';
import { hasConsent, lyricInputs } from '@/lib/domain';
import { WriteLyrics } from '@/components/WriteLyrics';
import { useSession } from '@/lib/store';

/** 가사 검수 (deck p.7) */
export default function LyricsPage() {
  const { s, set } = useSession();
  const basis = lyricInputs(s.story);
  const hasLyrics = s.lyrics.length > 0;

  // 아래 WriteLyrics 가 갈라지는 조건과 같은 값이다. 동의가 있으면 자동
  // 생성기만, 없으면 손으로 쓰는 글상자만 나온다 — 안내 문구도 그 갈래를
  // 따라가야 화면 안에서 말이 어긋나지 않는다.
  const canAutoWrite = hasConsent(s.elder.consents, 'externalAi');

  return (
    <Screen
      title="가사 검수"
      subtitle="생애 이야기를 바탕으로 만든 가사를 확인해 주세요"
      decoration={<Ornaments variant="both" />}
      footer={
        // 없는 가사를 확정할 수는 없다. 확정은 원칙 3(사람 검수)의 도장이라,
        // 빈 화면에서 눌리면 그 도장이 뜻을 잃는다.
        <PrimaryButton
          href={hasLyrics ? '/session/style' : undefined}
          disabled={!hasLyrics}
          onClick={hasLyrics ? () => set('lyricsApproved', true) : undefined}
          trailing={hasLyrics ? <Chevron className="text-white" /> : undefined}
        >
          {hasLyrics ? '이 가사 확정' : '먼저 가사를 만들어 주세요'}
        </PrimaryButton>
      }
    >
      {hasLyrics ? (
        <Card className="px-4 py-5">
          {s.lyrics.map((sec, i) => (
            <div
              key={sec.label}
              className={i > 0 ? 'mt-5 border-t border-dashed border-brand-200 pt-5' : ''}
            >
              <div className="flex items-start gap-4">
                <span
                  className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full text-[1.0625rem] font-extrabold ${
                    sec.tone === 'chorus'
                      ? 'bg-leaf-100 text-leaf-700'
                      : 'bg-brand-100 text-brand-800'
                  }`}
                >
                  {sec.label}
                </span>
                <p className="flex-1 whitespace-pre-line text-[1.375rem] font-extrabold leading-[1.55] tracking-[-0.01em] text-ink-900">
                  {sec.lines.join('\n')}
                </p>
              </div>
            </div>
          ))}
        </Card>
      ) : (
        // 실제 기관 회기는 가사가 빈 채로 시작한다(beginSession). 빈 카드만
        // 덩그러니 두면 고장으로 보이므로, 무엇을 하면 되는지 적는다.
        <Card className="px-4 py-6 text-center">
          <p className="text-[1.0625rem] font-bold text-ink-900">아직 가사가 없어요</p>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-500">
            어르신이 확인해 주신 이야기로 아래에서 가사를 만들어 주세요.
          </p>
        </Card>
      )}

      {/* 여기에는 '가사 수정'·'다시 생성'이라고 적힌 큰 카드 두 개가 있었다.
          둘 다 onClick 이 없었고, 진짜로 도는 생성기는 그 아래 WriteLyrics
          하나뿐이었다. 예쁜 쪽이 위에 있으니 복지사는 그것부터 눌렀고,
          "눌렀는데 안 바뀌네" 하고 씨앗 가사를 그대로 확정할 수 있었다.
          그래서 죽은 카드는 지우고 진짜 생성기를 이 자리에 올린다. */}
      <SectionLabel className="mt-5">가사 만들기</SectionLabel>
      <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-500">
        {canAutoWrite
          ? '어르신이 확인해 주신 이야기에서만 가사가 나와요. 마음에 들지 않으면 몇 번이든 다시 만들 수 있어요.'
          : '어르신이 확인해 주신 이야기에서만 가사가 나와요. 아래 글상자에 복지사가 직접 적어 저장할 수 있어요.'}
      </p>

      {/* 확인된 이야기만 가사가 된다. 그 걸러내기가 이 서비스의 규칙이다. */}
      <WriteLyrics />

      {/* 만들어진 가사를 한 줄씩 다듬는 자리. 어르신이 들으시고 "그건 아니고
          이렇게" 하시는 순간이 이 제품이 바라던 장면이고, 그걸 하려고 이야기
          정리로 되돌아가면 마음에 들었던 나머지 줄까지 전부 바뀐다. */}
      {canAutoWrite ? <LyricEditor /> : null}

      {/* 이 문단은 "손으로 고치는 기능은 아직 없어요" 한 줄로 고정돼 있었다.
          그런데 외부 AI 미동의일 때 WriteLyrics 는 바로 위에 손으로 쓰는
          글상자를 펼친다 — 입력칸과 "그런 기능은 없다"가 세로로 나란히 붙어
          같은 화면에서 서로를 부정했다. 지금 실제로 되는 쪽만 적는다. */}
      <p className="mt-3 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
        {canAutoWrite ? (
          <>
            절을 더하거나 빼시려면{' '}
            <Link href="/session/story" className="font-bold text-brand-700 underline">
              이야기 정리
            </Link>
            에서 어르신과 사실을 다듬은 뒤 다시 만들어 주세요.
          </>
        ) : (
          <>
            위 글상자에서 문장을 고쳐 다시 저장하면 그대로 반영돼요. 사실
            자체가 어긋나면{' '}
            <Link href="/session/story" className="font-bold text-brand-700 underline">
              이야기 정리
            </Link>
            에서 어르신과 확인한 뒤 적어 주세요.
          </>
        )}
      </p>

      {/* 원칙 2: 가사가 어떤 사실에서 나왔는지 항상 되짚을 수 있어야 한다.
          예전 문장은 "이 가사는 확정된 이야기 N건만을 바탕으로 생성되었습니다"
          였는데, 아래 목록은 이번 회기 것만이고 WriteLyrics 는 지난 회기
          이야기까지 쓸 수 있어서 N이 실제 근거 수와 어긋났다. 지킬 수 있는
          약속(확인된 것만 쓴다)만 남기고, 숫자는 목록의 범위대로 적는다. */}
      <details className="mt-4 rounded-[16px] bg-brand-50 p-4">
        <summary className="flex cursor-pointer items-start gap-3 text-[0.9375rem] font-bold leading-relaxed text-ink-900 marker:content-none">
          <IconInfo size={22} className="mt-0.5 shrink-0 text-brand-700" />
          <span>
            가사는 어르신이 확인해 주신 이야기에서만 나옵니다.
            <span className="mt-1 block text-[0.875rem] font-medium text-ink-700">
              이번 회기에서 확인된 이야기 {basis.length}건 보기
            </span>
          </span>
        </summary>
        {basis.length ? (
          <ul className="mt-2.5 space-y-1.5 border-t border-brand-200 pt-2.5">
            {basis.map((b) => (
              <li key={b.id} className="text-[0.875rem] font-semibold text-ink-700">
                · {b.text}{' '}
                <span className="font-normal text-ink-500">
                  ({b.sources.map((x) => x.label).join(', ')})
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2.5 border-t border-brand-200 pt-2.5 text-[0.875rem] leading-relaxed text-ink-700">
            이번 회기에 확인된 이야기가 아직 없어요. 이야기 정리에서 어르신과
            하나씩 확인해 주세요.
          </p>
        )}
      </details>
    </Screen>
  );
}
