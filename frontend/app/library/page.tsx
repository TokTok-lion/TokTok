'use client';

import { useState } from 'react';
import { ArtBox } from '@/components/Art';
import { SampleShelf } from '@/components/SamplePlayer';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, PrimaryButton } from '@/components/ui';
import { IconMusicNote, IconPause, IconPlay, IconPlus } from '@/components/icons';
import { MUSIC_STYLES } from '@/lib/domain';
import { formatBytes } from '@/lib/recordingStore';
import { sceneFor } from '@/lib/scenes';
import {
  DEMO_SESSION,
  LEGACY_SESSION,
  deleteAllSongs,
  deleteSongAt,
  type SongMeta,
} from '@/lib/songStore';
import { shelfSongDate, shelfSongTitle, useSongShelf } from '@/lib/useDeviceSong';
import { useSongShelfPlayer } from '@/lib/useMusic';
import { useSession } from '@/lib/store';
import { useActiveElder } from '@/lib/useActiveElder';
import type { ArtKey } from '@/lib/art';

/**
 * 내 노래 보관함 (deck p.9)
 *
 * 예전에는 예시 곡 세 개가 진짜 목록인 척 놓여 있었고, 재생 버튼은 눌러도
 * 아무 일이 없었다. 실제로 쓰는 서비스에서 그건 두 번 거짓말이다 — 만든
 * 적 없는 곡이 있다고 하고, 들려준다고 해 놓고 안 들려준다.
 *
 * 그래서 두 칸으로 나눴다. 위는 이 기기에 실제로 있는 곡, 아래는 예시라고
 * 밝힌 예시. 아래 것들은 진짜 소리가 난다.
 *
 * 위 칸은 오래 한 곡짜리였다. 곡이 어르신 한 분당 한 칸에만 저장돼서, 2회기
 * 곡이 1회기 곡을 덮어썼기 때문이다. 회기는 반복되는 것이 정상이고 "지난번
 * 노래 다시 들려드릴게요"가 이 제품의 핵심 장면이라, 보관은 회기별로 바뀌었고
 * (lib/songStore) 이 화면도 목록이 됐다. 어느 곡인지는 회기 날짜·주제·분위기로
 * 가린다 — 그 셋은 곡과 함께 저장된 값이고, 없는 곡에는 없다고 적는다.
 *
 * 소리는 언제나 하나만 난다. 두 칸이 소리까지 따로 놀던 시절, 어르신께 본인
 * 노래를 들려드리는 중에 예시를 누르면 둘이 겹쳐 흘렀다 — 나눠 놓은 이유가
 * "어느 것이 우리 어르신 것인지 알 수 있게"인데 겹쳐 흐르면 그 이유가
 * 무너진다. 목록의 곡끼리도 마찬가지라, 예시 선반과 같은 소리 주인 자리
 * (claimSound/releaseSound)를 나눠 쓴다.
 */
export default function LibraryPage() {
  const { s, set } = useSession();
  const shelf = useSongShelf();
  const player = useSongShelfPlayer();
  const elder = useActiveElder();

  /** 지우기는 두 번 여쭙는다. 어르신 노래는 되돌릴 수 없다. */
  const [asking, setAsking] = useState<string | null>(null);
  const [wiping, setWiping] = useState(false);

  const removeOne = async (m: SongMeta) => {
    // 지우려는 곡이 흐르고 있을 수 있다. 파일이 사라진 뒤에도 소리가 계속
    // 나면 지운 사람이 지웠는지 아닌지 알 수 없다.
    player.stop();
    await deleteSongAt(m.key);

    /*
     * 이번 회기 곡을 다 지웠으면 songKey 도 비운다.
     *
     * songKey 는 "이 가사로 만든 곡이 기기에 있다"는 표시다. 파일이 없는데
     * 표시만 남으면 회기 상태가 사실과 어긋난다.
     *
     * songStatus 는 건드리지 않는다. 그건 '파일이 있느냐'가 아니라 '이 단계를
     * 마쳤느냐'를 뜻해서, 되돌려 놓으면 오늘 화면이 '다음 할 일: 노래 만들기'를
     * 다시 내민다 — 요금이 나가는 일을 다시 하라고 권하는 셈이다.
     */
    const leftHere = shelf.songs.filter(
      (x) => x.sessionId === shelf.sessionId && x.key !== m.key,
    ).length;
    if (leftHere === 0 && s.songKey) set('songKey', null);

    setAsking(null);
    shelf.reload();
  };

  const wipeAll = async () => {
    player.stop();
    await deleteAllSongs();
    if (s.songKey) set('songKey', null);
    setWiping(false);
    shelf.reload();
  };

  return (
    <Screen
      title="내 노래 보관함"
      subtitle="기억을 담은 나만의 노래들을 만나보세요"
      decoration={<Ornaments variant="leafRight" />}
      footer={
        // 어르신을 고르지 않은 채로 이 문을 열면 회기 1단계가 참가자 없이
        // 시작된다. 그러면 7단계에서 songQuotaLeft() 가 null 을 돌려줘 곡
        // 한도 검사가 통째로 건너뛰어지고, uploadSong 도 실패해 서버 중복
        // 확인이 걸리지 않는다 — 기관 계정에서 크레딧만 계속 나간다.
        // /home·/session 과 같은 자물쇠를 여기에도 건다.
        elder === 'checking' ? (
          <PrimaryButton disabled>불러오는 중…</PrimaryButton>
        ) : elder === 'missing' ? (
          <PrimaryButton href="/elder">
            먼저 어르신을 골라 주세요
          </PrimaryButton>
        ) : (
          <PrimaryButton
            href="/session/checklist"
            leading={
              <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/90">
                <IconPlus size={16} />
              </span>
            }
          >
            새 노래 만들기
          </PrimaryButton>
        )
      }
    >
      <h2 className="text-[1.1875rem] font-extrabold text-ink-900">
        만든 노래
        {shelf.available && !shelf.loading ? (
          <span className="ml-2 text-[0.9375rem] font-semibold text-ink-500">
            {shelf.songs.length}곡
          </span>
        ) : null}
      </h2>
      {/* 누구의 목록인지 적는다. 이름 뒤에 조사를 붙이면 어르신을 고르지 않은
          상태의 안내문("어르신을 고르지 않았어요")과 이어 붙어 말이 되지
          않으므로, 호칭은 문장 끝에 그대로 둔다. */}
      <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-500">
        지금 보시는 것은 <strong className="text-ink-900">{s.elder.honorific}</strong>
        의 노래예요. 이 기기에 저장돼 있고, 회기마다 한 줄씩 쌓입니다.
      </p>

      {shelf.loading ? (
        <Card className="mt-3 p-5">
          <p role="status" className="text-[1rem] font-bold text-ink-700">
            보관함을 불러오는 중이에요…
          </p>
        </Card>
      ) : !shelf.available ? (
        /* 못 읽은 것을 '없음'으로 그리지 않는다. 여기서 "아직 없어요"라고
           말하면 있는 곡을 다시 만들라고 권하는 셈이 되고, 그건 요금이다. */
        <Card className="mt-3 p-5">
          <p className="text-[1rem] font-bold text-ink-700">
            이 기기의 보관함을 열지 못했어요.
          </p>
          <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-500">
            저장된 노래가 없다는 뜻은 아니에요. 브라우저의 비밀 모드에서는
            보관함을 쓸 수 없습니다. 앱을 다시 열어 보시고, 그래도 안 되면
            아래 예시 곡으로 어떤 소리가 나는지 먼저 들어 보세요.
          </p>
        </Card>
      ) : shelf.songs.length === 0 ? (
        <Card className="mt-3 p-5 text-center">
          <p className="text-[1rem] font-bold text-ink-700">
            아직 이 기기에 저장된 곡이 없어요.
          </p>
          <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-500">
            회기를 마치고 노래를 만들면 여기에 남습니다. 어떤 소리가 나오는지
            먼저 보시려면 아래 예시를 들어 보세요.
          </p>
        </Card>
      ) : (
        <ul className="mt-3 space-y-3.5">
          {shelf.songs.map((m) => {
            const st =
              player.sound.kind !== 'idle' && player.sound.key === m.key
                ? player.sound.kind
                : 'idle';
            const on = st === 'playing';
            const scene = sceneFor(m.topic, m.cover);
            const title = shelfSongTitle(m);
            const date = shelfSongDate(m);
            const styleName = MUSIC_STYLES.find((x) => x.id === m.style)?.name ?? null;
            const here = m.sessionId === shelf.sessionId;
            const when = here
              ? '이번 회기'
              : m.sessionId === LEGACY_SESSION
                ? '이전 판에서 만든 곡'
                : m.sessionId === DEMO_SESSION
                  ? '둘러보기 중 만든 곡'
                  : '지난 회기';

            return (
              <Card as="li" key={m.key} className="p-3.5">
                <div className="flex items-center gap-3.5">
                  <ArtBox
                    name={scene.art as ArtKey}
                    alt=""
                    className="h-[76px] w-[76px] shrink-0 rounded-[16px] object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[1.0625rem] font-extrabold leading-tight text-ink-900">
                      {title}
                    </h3>
                    <span
                      className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[0.8125rem] font-bold ${
                        here ? 'bg-leaf-100 text-leaf-700' : 'bg-brand-50 text-brand-700'
                      }`}
                    >
                      {when}
                    </span>
                    {/* 날짜·분위기는 곡과 함께 저장된 값이다. 없으면 없다고
                        적는다 — 목록이 그럴듯한 날짜를 지어내면, 어느 곡이
                        어느 회기 것인지 가리는 근거가 통째로 무너진다. */}
                    <p className="mt-1 text-[0.9375rem] text-ink-500">
                      {date ?? '만든 날짜가 남아 있지 않아요'}
                    </p>
                    {styleName ? (
                      <p className="mt-1 flex items-center gap-1.5 text-[0.9375rem] text-ink-500">
                        <IconMusicNote size={17} className="text-brand-400" />
                        {styleName}
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    aria-label={`${title} ${
                      on
                        ? '멈추기'
                        : st === 'loading'
                          ? '소리 준비 중, 눌러서 취소'
                          : '재생'
                    }`}
                    aria-busy={st === 'loading'}
                    onClick={() => player.toggle(m.key)}
                    className={`flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full shadow-[0_4px_12px_rgba(122,84,46,0.14)] ${
                      on ? 'tk-cta text-white' : 'bg-surface-strong text-brand-600'
                    }`}
                  >
                    {st === 'loading' ? (
                      <span
                        aria-hidden="true"
                        className="h-[22px] w-[22px] rounded-full border-[3px] border-brand-200 border-t-brand-600 motion-safe:animate-spin"
                      />
                    ) : on ? (
                      <IconPause size={24} />
                    ) : (
                      <IconPlay size={24} />
                    )}
                  </button>
                </div>

                {st === 'loading' ? (
                  <p role="status" className="mt-2.5 text-[0.875rem] font-bold text-ink-700">
                    노래를 준비하고 있어요… 잠시만 기다려 주세요.
                  </p>
                ) : null}
                {st === 'error' ? (
                  <p role="alert" className="mt-2.5 text-[0.875rem] font-bold text-danger-600">
                    이 노래를 열지 못했어요. 다시 눌러 보시겠어요?
                  </p>
                ) : null}

                {asking === m.key ? (
                  <div className="mt-3 rounded-[12px] bg-surface-sunk p-3.5">
                    <p className="text-[0.9375rem] font-bold text-ink-900">
                      이 노래를 지울까요? 되돌릴 수 없어요.
                    </p>
                    <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-700">
                      {date ? `${date}에 만든 ` : ''}
                      {title}이(가) 이 기기에서 사라집니다.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAsking(null)}
                        className="min-h-[48px] rounded-[12px] border border-hairline bg-surface-strong text-[0.9375rem] font-bold text-ink-700"
                      >
                        그대로 두기
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeOne(m)}
                        className="min-h-[48px] rounded-[12px] bg-danger-600 text-[0.9375rem] font-bold text-white"
                      >
                        지우기
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAsking(m.key)}
                    className="mt-2.5 min-h-[44px] w-full rounded-[12px] border border-hairline bg-surface text-[0.9375rem] font-bold text-danger-600"
                  >
                    이 노래 지우기
                  </button>
                )}
              </Card>
            );
          })}
        </ul>
      )}

      {/* 저장 공간.
          곡은 스스로 지워지지 않는다(lib/songStore 의 용량 정책). 그러면
          얼마나 쌓였는지는 반드시 보여야 한다 — 안 보이면 어느 날 저장이
          안 되고, 그때는 이미 요금을 낸 뒤다. */}
      {shelf.available && !shelf.loading && shelf.total > 0 ? (
        <>
          <h2 className="mt-7 text-[1.1875rem] font-extrabold text-ink-900">저장 공간</h2>
          <Card className="mt-3 p-4">
            <p className="text-[1.0625rem] font-extrabold text-ink-900">
              이 기기에 저장된 노래 {shelf.total}곡 · {formatBytes(shelf.totalBytes)}
            </p>
            <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-700">
              노래는 시간이 지나도 저절로 지워지지 않아요. 어르신께 드린
              결과물이라, 지우는 것은 지우겠다고 하실 때만 합니다. 필요 없는
              곡은 위에서 한 곡씩 지워 주세요.
            </p>
            {shelf.total > shelf.songs.length ? (
              <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-500">
                이 중 {shelf.total - shelf.songs.length}곡은 다른 어르신의
                노래예요. 이 화면에서는 열지 않아요 — 그 어르신을 고르시면 그분
                보관함에 나옵니다.
              </p>
            ) : null}

            {wiping ? (
              <div className="mt-3 rounded-[12px] bg-brand-50 p-3.5">
                <p className="text-[0.9375rem] font-bold text-ink-900">
                  이 기기의 노래 {shelf.total}곡을 모두 지울까요?
                </p>
                <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-700">
                  다른 어르신의 노래까지 함께 지워집니다. 되돌릴 수 없어요.
                  기관 서버에 올라간 곡은 이 버튼으로 지워지지 않아요.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setWiping(false)}
                    className="min-h-[48px] rounded-[12px] border border-hairline bg-surface-strong text-[0.9375rem] font-bold text-ink-700"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => void wipeAll()}
                    className="min-h-[48px] rounded-[12px] bg-danger-600 text-[0.9375rem] font-bold text-white"
                  >
                    모두 지우기
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setWiping(true)}
                className="mt-3 min-h-[52px] w-full rounded-[14px] border border-hairline bg-surface text-[1rem] font-bold text-danger-600"
              >
                이 기기의 노래 모두 지우기
              </button>
            )}
          </Card>
        </>
      ) : null}

      <SampleShelf />
    </Screen>
  );
}
