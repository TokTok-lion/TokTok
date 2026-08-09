'use client';

import Link from 'next/link';
import { Art, ArtBox } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chip, IconCircle, NoteBar, OutlineButton, PrimaryButton } from '@/components/ui';
import { IconClock, IconEdit, IconInfo, IconMic } from '@/components/icons';
import { formatDuration } from '@/lib/domain';
import { useSession } from '@/lib/store';
import type { ArtKey } from '@/lib/art';

/**
 * 가족 답장 보기 (deck p.16)
 *
 * 이 화면은 "가족이 남긴 따뜻한 답장을 확인해요"라고 적고 씨앗 3건을 실제로
 * 도착한 답장처럼 늘어놓았다. 아무것도 도착한 적이 없다 — 가족에게 나가는
 * 경로도(앞 화면 주석), 답장이 들어오는 경로도 이 저장소에 없다. 재생 버튼과
 * 파형까지 있어서 소리가 나는 물건처럼 보였지만 눌러도 아무 일이 없었다.
 *
 * 그래서 두 갈래로 나눈다.
 *
 *  - 실제 기관 회기(어르신을 고른 회기)는 beginSession 이 familyReplies 를
 *    비우므로 목록이 비어 있다. 예전에는 그 상태에서 빈 목록 + 눌리지 않는
 *    버튼만 남아 막다른 길이었다. 지금은 왜 비어 있는지와 어디로 가면 되는지를
 *    같은 화면에 적는다.
 *  - 시연 기기에는 씨앗이 남아 있다. 지우면 보여 줄 것이 없어지므로 남기되,
 *    예시라고 밝힌다. 밝히지 않으면 이 화면은 남의 가족 이야기를 이 어르신의
 *    답장으로 보여 주는 화면이 된다.
 */
export default function FamilyRepliesPage() {
  const { s, setContributionState } = useSession();

  // 실제 기관 회기인지. 어르신을 고른 회기에는 participantId 가 붙는다.
  const live = s.remoteParticipantId !== null;
  const replies = s.familyReplies;
  // 이 회기에 답장을 넣는 코드가 없으므로, 시연 기기에 남아 있는 것은 전부 씨앗이다.
  const example = !live && replies.length > 0;
  const pending = replies.filter((r) => r.state === 'pending').length;

  return (
    <Screen
      title="가족 답장 보기"
      subtitle="이 회기에 기록된 가족 답장을 어르신과 함께 확인해요"
      decoration={<Ornaments variant="leafRight" />}
      footer={
        /*
         * 예전 버튼은 하나도 고르지 않으면 눌리지 않았다("반영할 내용을
         * 선택해 주세요"). 반영할 것이 하나도 없는 회기가 정상인데도 그 경우가
         * 막혀 있었다 — 게다가 이 버튼은 저장하는 것이 없고 다음 화면으로
         * 넘어갈 뿐이다(반영 표시는 누르는 즉시 저장된다). 그래서 이름을
         * 사실대로 바꾸고 잠금을 없앤다.
         */
        replies.length === 0 ? (
          <>
            <PrimaryButton href="/family/mission" leading={<IconEdit size={22} />}>
              가족에게 부탁할 내용 만들기
            </PrimaryButton>
            <div className="mt-3 text-center">
              <Link
                href="/session/story"
                className="inline-flex min-h-[44px] items-center text-[1.0625rem] font-bold text-brand-700"
              >
                이야기 정리로 가기
              </Link>
            </div>
          </>
        ) : (
          <PrimaryButton href="/session/story">이야기 정리로 가기</PrimaryButton>
        )
      }
    >
      {example ? (
        // 목록보다 먼저 읽혀야 한다. 아래 카드들은 실물처럼 생겼다.
        <div className="mb-4">
          <NoteBar tone="amber" icon={<IconInfo size={19} />}>
            아래 3건은 <strong className="font-extrabold">예시</strong>예요. 화면을
            보여 드리려고 넣어 둔 자료이며, 이 어르신의 가족이 보낸 것이 아닙니다.
          </NoteBar>
        </div>
      ) : null}

      {replies.length === 0 ? (
        // 막다른 길로 두지 않는다 — 왜 비어 있는지와 지금 무엇을 하면 되는지.
        <Card className="p-5">
          <h2 className="text-[1.1875rem] font-extrabold text-ink-900">
            이 회기에 기록된 가족 답장이 없어요
          </h2>
          <p className="mt-2 text-[1rem] leading-relaxed text-ink-500">
            이 앱은 가족이 보낸 사진·글·음성을 자동으로 받아오지 않아요. 가족이
            복지사님께 카카오톡·문자로 보내온 자료가 있다면, 어르신과 함께
            확인하며 「이야기 정리」에 직접 적어 주세요.
          </p>
          <div className="mt-4">
            <OutlineButton href="/session/story">이야기 정리 열기</OutlineButton>
          </div>
        </Card>
      ) : (
        <ul className="space-y-4">
          {replies.map((r) => (
            <Card as="li" key={r.id} className="p-4">
              <div className="flex gap-3.5">
                {r.art ? (
                  <ArtBox
                    name={r.art as ArtKey}
                    alt={
                      example
                        ? `예시 그림 — ${r.title}`
                        : `${r.from}이 보낸 ${r.title}`
                    }
                    className="h-[104px] w-[104px] shrink-0 rounded-[14px] object-cover"
                  />
                ) : (
                  <IconCircle tone="brand" size={64}>
                    <span className="text-[1.875rem] font-black leading-none text-brand-400">
                      &rdquo;
                    </span>
                  </IconCircle>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="flex items-center gap-2 text-[1.1875rem] font-extrabold text-ink-900">
                      {r.kind === 'photo' ? (
                        <IconCircle tone="amber" size={34}>
                          <Art name="ui_image" size={19} alt="" />
                        </IconCircle>
                      ) : r.kind === 'voice' ? (
                        <IconCircle tone="brand" size={34}>
                          <Art name="ui_mic" size={19} alt="" />
                        </IconCircle>
                      ) : null}
                      {r.title}
                    </h2>
                    {/* 확인 전 항목에 '✓ 확인됨'이 붙어 있었다. 씨앗 3건은 전부
                        state 가 pending 인데 화면은 셋 다 확인이 끝난 것처럼
                        보였다 — 복지사가 확인할 일이 남았다는 신호가 사라진다.
                        '반영됨'도 '반영 표시'로 고쳤다: 표시해도 이야기 목록에
                        저절로 들어가지는 않기 때문이다(아래 안내 참고). */}
                    {r.state === 'accepted' ? (
                      <span className="shrink-0 rounded-full bg-leaf-100 px-2.5 py-1 text-[0.8125rem] font-bold text-leaf-700">
                        ✓ 반영 표시
                      </span>
                    ) : r.state === 'held' ? (
                      <span className="shrink-0 rounded-full bg-surface-sunk px-2.5 py-1 text-[0.8125rem] font-bold text-ink-500">
                        보류
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-brand-100 px-2.5 py-1 text-[0.8125rem] font-bold text-brand-800">
                        확인 전
                      </span>
                    )}
                  </div>

                  {example ? (
                    <div className="mt-2">
                      <Chip tone="amber" size="sm">
                        예시
                      </Chip>
                    </div>
                  ) : null}

                  {r.body ? (
                    <p
                      className={`mt-2 text-[1rem] leading-relaxed ${
                        r.kind === 'quote'
                          ? 'text-[1.1875rem] font-bold text-ink-900'
                          : 'text-ink-500'
                      }`}
                    >
                      {r.body}
                    </p>
                  ) : null}

                  {r.durationSec ? (
                    // 재생 버튼과 파형이 있었지만 눌러도 소리가 나지 않았다.
                    // 이 항목에 딸린 소리 파일이 애초에 없다 — 길이만 적고,
                    // 들을 수 없다는 것을 그 자리에서 말한다.
                    <p className="mt-2.5 flex items-start gap-1.5 text-[0.9375rem] leading-relaxed text-ink-500">
                      <IconMic size={17} className="mt-0.5 shrink-0" />
                      <span>
                        음성 {formatDuration(r.durationSec)} · 이 앱에는 소리
                        파일이 없어 들을 수 없어요
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>

              {/* 가족 제보는 어르신 확인 전까지 사실이 아니다 (원칙 2) */}
              <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  aria-pressed={r.state === 'accepted'}
                  onClick={() =>
                    setContributionState(
                      'familyReplies',
                      r.id,
                      r.state === 'accepted' ? 'pending' : 'accepted',
                    )
                  }
                  className={`flex min-h-[52px] items-center justify-center gap-1.5 rounded-[14px] text-[1.0625rem] font-bold ${
                    r.state === 'accepted'
                      ? 'bg-leaf-600 text-white'
                      : 'bg-leaf-50 text-leaf-700'
                  }`}
                >
                  <CheckGlyph />
                  반영
                </button>
                <button
                  type="button"
                  aria-pressed={r.state === 'held'}
                  onClick={() =>
                    setContributionState(
                      'familyReplies',
                      r.id,
                      r.state === 'held' ? 'pending' : 'held',
                    )
                  }
                  className={`flex min-h-[52px] items-center justify-center gap-1.5 rounded-[14px] text-[1.0625rem] font-bold ${
                    r.state === 'held'
                      ? 'bg-brand-600 text-white'
                      : 'bg-brand-50 text-brand-700'
                  }`}
                >
                  <IconClock size={19} />
                  보류
                </button>
              </div>
            </Card>
          ))}
        </ul>
      )}

      {pending > 0 ? (
        <p className="mt-4 text-[0.9375rem] font-bold text-brand-700">
          아직 확인하지 않은 답장 {pending}건
        </p>
      ) : null}

      {replies.length > 0 ? (
        <div className="mt-4">
          {/* '반영'은 이 회기에 남기는 표시일 뿐이다. 누른 내용이 이야기
              목록으로 자동으로 넘어가는 코드는 없다 — 넘어간다고 적으면
              복지사는 옮겨 적기를 건너뛰고, 그 이야기는 어디에도 안 남는다. */}
          <NoteBar tone="brand" icon={<IconInfo size={19} />}>
            반영으로 표시해도 이야기 목록에 저절로 들어가지는 않아요. 어르신과
            확인한 내용은 「이야기 정리」에 적어 주세요.
          </NoteBar>
        </div>
      ) : null}
    </Screen>
  );
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 13 4.5 4.5L19 7" />
    </svg>
  );
}
