'use client';

import Link from 'next/link';
import { ArtBox } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chevron, Chip, IconCircle } from '@/components/ui';
import { IconCalendar, IconDoc, IconMusicNote, IconTextSize } from '@/components/icons';
import { sceneForTopic, songTitleForTopic } from '@/lib/scenes';
import { useDeviceSong } from '@/lib/useDeviceSong';
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
  const { s } = useSession();
  const song = useDeviceSong();

  // 표지와 제목은 회기 화면(/session/song·generating)과 같은 규칙을 쓴다.
  // 여기만 'album_briefcase_coins' 한 장으로 박혀 있어서, 손주 이야기로 만든
  // 노래가 기록 탭에서는 서류가방 그림으로 남았다 — 같은 곡이 화면마다 다른
  // 표지를 달고 있었다.
  //
  // 곡은 어르신마다 한 칸씩 저장되고(songStore 의 `song:<어르신>` 키) 그 곡에
  // 주제를 함께 저장하지는 않는다. 그래서 지금 회기의 주제를 쓴다. 어르신을
  // 바꾸면 그 어르신 칸의 지난 곡은 beginSession 이 지우고, 화면은 항상 지금
  // 어르신 칸만 읽으므로 남의 노래에 이 제목이 붙는 일은 없다.
  //
  // 서버에서 온 어르신은 아직 주제가 없어 '—'로 들어온다(useElders.toSummary).
  // 그 문자열을 그대로 제목에 넣으면 '— 이야기'가 되므로 빈 값으로 본다.
  const topic = s.topic === '—' ? '' : s.topic;
  const scene = sceneForTopic(topic);
  const songTitle = songTitleForTopic(topic);

  return (
    <Screen
      root
      title="기록"
      subtitle="완성된 노래와 지난 기록을 모았어요"
      decoration={<Ornaments variant="leafRight" />}
    >
      {/* 완성된 노래 — 이 기기에 실제로 있는 것만 센다.
          예시 곡 세 개를 "완성된 노래 3곡"으로 적어 두었더니, 보관함은
          "아직 없어요"라고 해서 두 화면이 서로 다른 말을 했다. */}
      <h2 className="flex items-center gap-2 text-[1.125rem] font-extrabold text-ink-900">
        <IconMusicNote size={21} className="text-brand-500" />
        완성된 노래
        <span className="text-[0.9375rem] font-semibold text-ink-500">
          {song ? 1 : 0}곡
        </span>
      </h2>
      {song ? (
        <Card className="mt-3 p-3">
          <Link href="/library" className="flex items-center gap-3.5">
            <ArtBox
              name={scene.art as ArtKey}
              alt=""
              className="h-[64px] w-[64px] shrink-0 rounded-[12px] object-cover"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[1.0625rem] font-extrabold text-ink-900">
                {songTitle}
              </span>
              <span className="block text-[0.875rem] text-ink-500">
                이 기기에 있음 · 보관함에서 듣기
              </span>
            </span>
            <Chevron className="shrink-0 text-ink-300" />
          </Link>
        </Card>
      ) : (
        <Card className="mt-3 p-4">
          <p className="text-[1rem] font-bold text-ink-700">
            아직 완성된 노래가 없어요.
          </p>
          <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-500">
            어떤 소리가 나오는지 먼저 보시려면 보관함의 예시 곡을 들어 보세요.
          </p>
        </Card>
      )}
      <div className="mt-3">
        <Link
          href="/library"
          className="flex min-h-[52px] items-center justify-center gap-1.5 rounded-[14px] border-2 border-brand-300 bg-surface-strong text-[1rem] font-bold text-brand-700"
        >
          노래 보관함 전체 보기
          <Chevron />
        </Link>
      </div>

      {/* 지난 회기.
          여기에는 씨앗 카드 한 장('가장 자랑스러운 순간')이 지난 회기인 척
          놓여 있었다. 어느 어르신을 골라도 같은 한 건이 떴고, 누르면 지금
          회기의 주제를 그 제목으로 덮어쓴 뒤 마무리 화면으로 보냈다 —
          현재 어르신 이름 아래 남의 주제가 붙었다.
          어르신별 회기를 서버에서 읽는 함수가 repo.ts 에 아직 없다. 그러니
          목록도 아직 없다고 적는다. */}
      <h2 className="mt-6 flex items-center gap-2 text-[1.125rem] font-extrabold text-ink-900">
        <IconCalendar size={21} className="text-leaf-600" />
        지난 회기
      </h2>
      <Card className="mt-3 p-4">
        <p className="text-[1rem] font-bold text-ink-700">
          지난 회기 목록은 아직 없어요.
        </p>
        <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-500">
          이 기기에는 진행 중인 회기 하나만 남습니다. 마무리한 회기는 아래
          활동일지를 내보내서 기관 양식에 남겨 주세요.
        </p>
      </Card>

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
              {/* '가족에게 공유'라고 적혀 있었지만, 가사 카드 화면은 같은
                  기능을 두고 "가족에게 바로 보내는 기능은 아직 없어요"라고
                  적는다. 보내는 코드가 이 저장소에 없으니 그쪽이 맞다 —
                  들어가 보기 전에 기대를 만들지 않는다. */}
              <span className="block text-[0.875rem] text-ink-500">
                어르신과 큰 글씨로 함께 읽기
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
