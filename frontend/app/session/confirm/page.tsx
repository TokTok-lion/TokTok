'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Art, ArtBox } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, CheckCircle, Chevron, NoteBar, PrimaryButton } from '@/components/ui';
import { IconChat, IconInfo, IconShield } from '@/components/icons';
import { lyricInputs } from '@/lib/domain';
import { mmss, useRecorder } from '@/lib/recorder';
import { sceneForTopic } from '@/lib/scenes';
import { useSession } from '@/lib/store';
import { autoTranscribe, useTranscribeStatus } from '@/lib/transcribeJob';
import type { ArtKey } from '@/lib/art';

/**
 * 인터뷰 내용 확인 (deck p.13)
 *
 * 이 화면이 오래 거짓말을 했다.
 *
 * 인터뷰에서 29초를 녹음하고 넘어오면 '확인된 이야기' 아래 네 줄이 떠 있다.
 * 그런데 그 네 줄은 둘러보기용 씨앗이고, 녹음은 아직 글로 옮겨지지도 않았다.
 * 옮기는 일은 4단계에서 버튼을 눌러야 일어난다. 화면에는 그 말이 어디에도
 * 없었고 제목은 '인터뷰 내용 확인'이었으니, 방금 말씀하신 내용이라고 읽지
 * 않을 도리가 없다.
 *
 * 그래서 순서를 바꿨다. 옮기지 않은 녹음이 있으면 그 사실이 화면에서 가장
 * 먼저 나오고, 예시 이야기에는 예시라고 적는다.
 */
export default function ConfirmPage() {
  const { s } = useSession();
  const rec = useRecorder();
  const { job, origin, device } = useTranscribeStatus();

  /*
   * 녹음은 여기 도착하는 순간 끝난다.
   *
   * 인터뷰 화면에는 '정지'가 없다 — 버튼은 시작과 일시정지뿐이고, 화면을
   * 벗어날 때 releaseRecording() 이 마이크를 닫는다. 그러니 이 화면에
   * 도착했다는 것이 곧 "녹음이 끝났다"는 뜻이다. 옮기는 일을 여기서 걸어
   * 두면, 복지사가 어르신과 마무리 인사를 나누는 동안 뒤에서 돌아간다.
   *
   * 동의가 없으면 autoTranscribe 가 조용히 아무것도 하지 않는다. 어르신
   * 목소리가 기기를 떠나는 일이라 그것만은 자동일 수 없다.
   */
  useEffect(() => {
    void autoTranscribe();
  }, []);

  const verified = lyricInputs(s.story);
  const followUps = s.story.filter((i) => i.status === 'unverified' && i.followUp);

  /*
   * 기기에 녹음이 있는데, 지금 화면의 전사가 그 녹음에서 나온 것이 아닌 상태.
   *
   * 예전에는 '전사 줄이 하나라도 있는가'만 봤다. 그래서 다시 녹음한 회기는
   * 이 안내가 아예 뜨지 않았다 — 화면의 전사·이야기·출처는 전부 지워진 앞
   * 녹음의 것인데, 화면은 다 됐다는 얼굴을 하고 있었다.
   *
   * 기기 DB 를 못 읽는 브라우저(사파리 프라이빗 등)에서는 녹음기 쪽 표시라도
   * 믿는다. 녹음이 있는데 없다고 말하는 편이 더 나쁘다.
   */
  const hasRecording = device !== null || rec.savedAt !== null;
  const seconds = device?.seconds ?? rec.seconds;
  const stale = origin === 'otherRecording';
  const waiting = hasRecording && origin !== 'thisRecording' && origin !== 'checking';
  // 다 옮긴 뒤에도 한 번은 말해 준다 — 안내가 소리 없이 사라지면 낭독으로
  // 듣는 사람에게는 아무 일도 일어나지 않은 것과 같다.
  const finished = !waiting && job.kind === 'done' && origin === 'thisRecording';
  const examples = verified.filter((i) => i.example).length;

  // 그림은 오늘 이야기에서 나온다(/records·/session/song 과 같은 해석기).
  // 여기만 'album_briefcase_coins' 한 장이 박혀 있어서, 손주 이야기를 확인하는
  // 화면에도 서류가방이 떴다. 주제가 없으면 특정 사건을 그리지 않는 기본
  // 그림이 나오므로 어르신의 이야기를 잘못 대변하지 않는다.
  const scene = sceneForTopic(s.topic);

  return (
    <Screen
      title="인터뷰 내용 확인"
      subtitle="기록된 이야기만 다음 단계로 보내요"
      decoration={<Ornaments variant="leafRight" />}
      footer={
        <>
          <PrimaryButton
            href="/session/transcript"
            trailing={<Chevron className="text-white" />}
          >
            {/* 옮기지 않은 녹음이 있으면 버튼이 그 일을 가리킨다.
                '확인하고 다음으로'는 무엇이 확인됐다는 것인지 말하지 않아서,
                이미 다 된 줄 알고 누르게 된다. */}
            {stale
              ? '새 녹음을 글로 옮기러 가기'
              : waiting
                ? '녹음을 글로 옮기러 가기'
                : '확인하고 다음으로'}
          </PrimaryButton>
          <div className="mt-3 text-center">
            <Link
              href="/session/transcript"
              className="inline-flex min-h-[44px] items-center border-b-2 border-leaf-300 px-1 text-[1.0625rem] font-bold text-leaf-700"
            >
              직접 수정
            </Link>
          </div>
        </>
      }
    >
      <Card className="flex items-center gap-3.5 p-4">
        <Art name={s.elder.avatar as ArtKey} size={80} alt="" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[1.0625rem] text-ink-500">{s.elder.honorific}</p>
          {/* 주제 없이 진행한 회기가 있다(lib/useElders.ts). 화면에서 가장 큰
              글씨 자리라 비워 두면 불러오다 만 것처럼 보인다. */}
          {s.topic ? (
            <p className="mt-0.5 text-[1.375rem] font-extrabold leading-tight text-ink-900">
              {s.topic}
            </p>
          ) : (
            <p className="mt-0.5 text-[1.0625rem] font-bold leading-snug text-ink-700">
              오늘 주제 없이 들은 이야기예요
            </p>
          )}
        </div>
        {/* 주제마다 그림 비율이 달라 폭만 잡으면 카드 높이가 주제에 따라
            널뛴다(/session/style 과 같은 처리). 상자를 고정하고 안에서 맞춘다. */}
        <ArtBox
          key={scene.id}
          name={scene.art}
          alt=""
          className="h-[76px] w-[88px] shrink-0"
          fit="contain"
        />
      </Card>

      {/*
        화면에서 가장 먼저 나와야 하는 사실 — 방금 녹음한 말씀은 아직 글이
        되지 않았다. 이 안내가 없으면 아래 목록이 오늘 인터뷰 결과로 읽힌다.

        낭독으로 듣는 사람에게도 같은 순서로 도착해야 한다. 예전에는 '옮기고
        있어요'가 '옮기지 못했어요'로 바뀌어도 아무 소리가 나지 않았다 —
        화면을 보고 있지 않으면 실패한 줄을 모른 채 다음으로 넘어갔다.
        오류일 때는 role="alert" 로 바꾸고, role 이 바뀌면 노드를 새로 심어
        (key) 보조기술이 그 자리를 새 알림으로 읽게 한다.
      */}
      <div
        key={job.kind === 'error' ? 'alert' : 'status'}
        role={job.kind === 'error' ? 'alert' : 'status'}
        aria-live={job.kind === 'error' ? 'assertive' : 'polite'}
      >
        {waiting ? (
          <Card className="mt-4 border-2 border-brand-300 p-4">
            <p className="flex items-center gap-2 text-[1.0625rem] font-extrabold text-brand-800">
              <IconInfo size={20} className="shrink-0" />
              {job.kind === 'busy'
                ? '녹음을 글로 옮기고 있어요'
                : job.kind === 'error'
                  ? '녹음을 글로 옮기지 못했어요'
                  : stale
                    ? '다시 녹음하셨어요 — 아래 내용은 앞 녹음이에요'
                    : origin === 'unmarked'
                      ? '아래 내용이 이 녹음에서 나온 것인지 확인할 수 없어요'
                      : '녹음은 아직 글로 옮기지 않았어요'}
            </p>

            {job.kind === 'busy' ? (
              <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-700">
                {mmss(seconds)} 녹음을 옮기는 중이에요. 어르신과 마무리
                인사를 나누시는 동안 뒤에서 계속 돌아가고, 다음 화면에서 결과를
                보실 수 있어요. 길면 1분이 넘습니다.
              </p>
            ) : job.kind === 'error' ? (
              <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-700">
                {job.message} 녹음은 이 기기에 그대로 남아 있어요 — 다음 화면의{' '}
                <strong>「녹음에서 옮기기」</strong>로 다시 시도하시거나, 복지사가
                직접 받아 적으셔도 됩니다.
              </p>
            ) : stale ? (
              /* 새로 녹음하면 앞 녹음은 그 자리에서 지워진다(lib/recorder.ts).
                 전사와 이야기만 남으므로, 화면은 지금 무엇이 무엇의 기록인지
                 밝혀야 한다. */
              <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-700">
                방금 하신 {mmss(seconds)} 녹음은 아직 글로 옮기지 않았어요.
                아래 이야기와 출처(<strong>어르신 음성 0:00</strong> 같은 표시)는
                그 앞 녹음에서 나온 것이고, 앞 녹음은 다시 녹음하실 때
                지워졌습니다 — 지금은 눌러도 그 대목을 들려드릴 수 없어요.
                다음 화면에서 <strong>「새 녹음에서 옮기기」</strong>를 누르면
                오늘 말씀으로 바뀝니다.
              </p>
            ) : (
              /* 자동으로 시작하지 못하는 경우는 사실상 하나다 — 녹음이나 외부 AI
                 전송에 동의하지 않으신 회기. 어르신 목소리가 기기를 떠나는 일이라
                 그것만은 자동일 수 없다. */
              <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-700">
                {mmss(seconds)} 녹음이 이 기기에 저장돼 있어요. 동의를 받으신
                뒤 다음 화면에서 <strong>「녹음에서 옮기기」</strong>를 누르면
                어르신 말씀이 글이 됩니다.
              </p>
            )}

            <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-500">
              아래 목록은 아직 오늘 들은 이야기가 아니에요. 옮긴 뒤 이야기 정리에서{' '}
              <strong>「이야기 뽑기」</strong>를 누르면 어르신 말씀으로 바뀝니다.
            </p>
          </Card>
        ) : finished ? (
          <Card className="mt-4 border-2 border-leaf-300 p-4">
            <p className="flex items-center gap-2 text-[1.0625rem] font-extrabold text-leaf-700">
              <CheckCircle size={22} />
              녹음을 글로 옮겼어요 — {job.lines}줄
            </p>
            <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-700">
              아직 이야기로 정리되기 전이에요. 이야기 정리에서{' '}
              <strong>「이야기 뽑기」</strong>를 누르면 어르신 말씀에서 사실을
              뽑고, 줄마다 들어볼 수 있는 출처가 붙습니다.
            </p>
          </Card>
        ) : null}
      </div>

      <h2 className="mt-5 flex items-center gap-2 text-[1.125rem] font-extrabold text-leaf-700">
        <CheckCircle size={26} />
        확인된 이야기
      </h2>

      {examples > 0 ? (
        <p className="mt-2 rounded-[12px] bg-surface-sunk px-3.5 py-2.5 text-[0.8125rem] font-bold leading-relaxed text-ink-700">
          아래 {examples}건은 둘러보기용 <strong>예시</strong>예요 — 어르신께서
          하신 말씀이 아닙니다.
        </p>
      ) : null}

      <ul className="mt-3 space-y-3">
        {verified.map((i) => (
          <Card as="li" key={i.id} className="flex items-center gap-3.5 p-4">
            <CheckCircle size={42} />
            <div className="min-w-0 flex-1">
              <p className="text-[1.125rem] font-bold leading-snug text-ink-900">
                {i.text}
              </p>
              {/* 목록 위 안내만으로는 부족하다. 줄마다 '출처 · 어르신 음성
                  0:42'가 붙어 있어서, 방금 녹음한 사람은 그 시각이 자기
                  녹음의 시각이라고 읽는다. */}
              {i.example ? (
                <p className="mt-1 inline-block rounded-full bg-surface-sunk px-2 py-0.5 text-[0.75rem] font-extrabold text-ink-700">
                  예시 · 실제 녹음이 아니에요
                </p>
              ) : null}
              {/* 출처 없는 문장은 여기 도달할 수 없다 (NFR-AI-002) */}
              <p className="mt-1 text-[0.8125rem] font-semibold text-ink-500">
                출처 · {i.sources.map((sc) => sc.label).join(', ')}
              </p>
            </div>
          </Card>
        ))}
      </ul>

      {followUps.length > 0 ? (
        <>
          <h2 className="mt-5 flex items-center gap-2 text-[1.125rem] font-extrabold text-brand-700">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100">
              <IconChat size={16} className="text-brand-600" />
            </span>
            추가로 물어보기
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {followUps.map((f) => (
              <Link
                key={f.id}
                href="/session/suggest"
                className="flex min-h-[62px] items-center gap-1 rounded-[16px] border-2 border-brand-200 bg-surface-strong px-3 text-[0.9375rem] font-bold leading-snug text-ink-900"
              >
                <span className="flex-1">{f.followUp}</span>
                <Chevron className="shrink-0" />
              </Link>
            ))}
          </div>
        </>
      ) : null}

      <div className="mt-4">
        <NoteBar tone="leaf" icon={<IconShield size={20} />}>
          확인된 내용만 가사로 반영됩니다
        </NoteBar>
      </div>
    </Screen>
  );
}
