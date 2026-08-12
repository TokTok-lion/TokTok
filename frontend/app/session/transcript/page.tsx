'use client';

import { Ornaments, Screen } from '@/components/Shell';
import { TranscribeButton } from '@/components/TranscribeButton';
import { UploadRecording } from '@/components/UploadRecording';
import { ServerRecordingNote } from '@/components/ServerRecordingNote';
import { recordingReplaced } from '@/lib/transcribeJob';
import { Card, CheckCircle, PrimaryButton } from '@/components/ui';
import { IconEdit } from '@/components/icons';
import { useRecorder } from '@/lib/recorder';
import { useSession } from '@/lib/store';

type Speaker = 'elder' | 'worker';

const WHO: Record<Speaker, string> = { elder: '어르신', worker: '복지사' };
const other = (v: Speaker): Speaker => (v === 'elder' ? 'worker' : 'elder');

/** 전사 교정 (deck p.5) */
export default function TranscriptPage() {
  const { s, set } = useSession();
  const rec = useRecorder();
  const empty = s.transcript.length === 0;
  const examples = s.transcript.filter((t) => t.example).length;

  // 화자 분리가 붙은 줄. 하나도 없으면 아래 안내와 버튼을 아예 그리지 않는다 —
  // 못 가른 회기에 '바꾸기' 버튼만 떠 있으면 뭘 바꾸라는 건지 알 수 없다.
  const elderLines = s.transcript.filter((t) => t.speaker === 'elder').length;
  const workerLines = s.transcript.filter((t) => t.speaker === 'worker').length;
  const split = elderLines + workerLines > 0;

  // 고친 내용을 화면 안에 따로 들고 있지 않는다. 예전엔 useState 로 복사해
  // 뒀는데, 자동 전사가 전사 내용을 통째로 바꾸면 화면이 옛 문장을 계속
  // 보여줬다. 저장소 하나만 보면 어긋날 자리가 없다.
  const edit = (id: string, text: string) =>
    set('transcript', s.transcript.map((t) => (t.id === id ? { ...t, text } : t)));

  /*
   * 화자가 통째로 뒤집혔을 때 한 번에 되돌리는 길.
   *
   * 누가 어르신인지는 기계가 알 수 없다. 전사 쪽은 "말씀을 더 오래 하신 쪽"을
   * 어르신으로 보는데, 복지사가 길게 설명한 날이나 어르신이 짧게만 답하신 날은
   * 그대로 반대가 된다. 그러면 사실 추출이 복지사 질문에서 생애를 뽑고 어르신
   * 말씀은 버린다 — 회기 하나가 통째로 어긋난다.
   *
   * 스무 줄을 하나씩 눌러 고치게 두면 아무도 안 고친다. 한 번에 뒤집는다.
   */
  const swapAll = () =>
    set(
      'transcript',
      s.transcript.map((t) => (t.speaker ? { ...t, speaker: other(t.speaker) } : t)),
    );

  const setSpeaker = (id: string, speaker: Speaker) =>
    set('transcript', s.transcript.map((t) => (t.id === id ? { ...t, speaker } : t)));

  // 빈 전사에는 '교정 완료' 표시를 찍지 않는다. 이 값이 lib/flow.ts 의 4단계
  // 완료 판정이라, 한 줄도 없는 회기가 "전사까지 끝난 회기"로 남는다.
  // 그렇다고 다음 화면을 막지는 않는다 — 동의가 없어 자동 전사를 못 쓰는
  // 회기도 이야기 정리로는 갈 수 있어야 한다.
  const save = () => {
    if (!empty) set('transcriptConfirmed', true);
  };

  return (
    <Screen
      title="전사 교정"
      subtitle="기록된 내용을 확인하고 정확하게 다듬어 주세요"
      decoration={<Ornaments variant="both" />}
      footer={
        <PrimaryButton
          href="/session/story"
          onClick={save}
          leading={<IconEdit size={22} />}
        >
          {empty ? '전사 없이 다음으로' : '수정 완료'}
        </PrimaryButton>
      }
    >
      {/* 녹음이 있으면 여기서 자동으로 옮기고, 아래에서 사람이 고친다 */}
      <TranscribeButton />

      {/*
        밖에서 녹음해 온 파일도 여기서 받는다.

        이 자리인 이유: 이 화면이 '녹음을 글로 옮기는' 자리다. 인터뷰 화면에
        두면 어르신과 마주 앉은 중에 파일 고르기 창이 뜨고, 그 화면은 앱이
        직접 녹음하는 자리라 두 가지 녹음이 한 화면에서 다툰다.

        올린 파일은 이 회기의 녹음이 되므로, 바로 위 버튼이 그것을 옮긴다.
      */}
      <div className="mt-3">
        {/* 올리고 나면 위 버튼이 그 녹음을 알아야 한다. 안 알려 주면 카드는
            '올렸어요', 버튼은 '녹음이 없어요'라고 같은 화면에서 말한다. */}
        <UploadRecording onSaved={() => void recordingReplaced()} />
      </div>

      <Card className="mt-3 p-4">
        <p className="text-[1rem] font-bold text-ink-500">전사 내용</p>

        {/* 둘러보기 기기에는 예시 전사 세 줄이 미리 들어 있다. 고칠 수 있는
            입력칸에 담겨 있어서, 방금 녹음한 사람이 자기 말이 옮겨진 줄로
            읽는다. 위 '녹음에서 옮기기'가 성공하면 통째로 교체되므로 이
            안내도 같이 사라진다. */}
        {examples > 0 ? (
          <p className="mt-2 rounded-[12px] bg-surface-sunk px-3 py-2 text-[0.8125rem] font-bold leading-relaxed text-ink-700">
            아래 {examples}줄은 둘러보기용 <strong>예시</strong>예요 — 실제 녹음을
            옮긴 것이 아닙니다. 위에서 녹음을 옮기면 이 줄들은 사라집니다.
          </p>
        ) : null}

        {/* 화자 분리는 추정이다. 기계는 "1번 목소리·2번 목소리"까지만 알고,
            그중 누가 어르신인지는 모른다. 말씀을 더 오래 하신 쪽을 어르신으로
            봤다는 것까지 밝혀야, 복지사가 그 판단이 맞는지 볼 수 있다.
            숫자를 함께 적는 이유도 같다 — 어르신 2줄·복지사 18줄이면 한눈에
            뒤집혔다는 걸 안다. */}
        {split ? (
          <div className="mt-2 rounded-[12px] bg-amber-100 px-3 py-2.5">
            <p className="text-[0.8125rem] font-bold leading-relaxed text-amber-700">
              누가 한 말인지는 목소리로 나눈 <strong>추정</strong>이에요. 말씀을
              더 오래 하신 쪽을 어르신으로 봤습니다 — 어르신 {elderLines}줄 ·
              복지사 {workerLines}줄.
            </p>
            <button
              type="button"
              onClick={swapAll}
              className="mt-2 min-h-[44px] w-full rounded-[12px] bg-surface px-3 text-[0.9375rem] font-bold text-amber-700"
            >
              어르신 ↔ 복지사 통째로 바꾸기
            </button>
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-amber-700">
              한 줄만 틀렸으면 그 줄의 이름표를 눌러 바꾸세요. 이야기 뽑기는
              어르신 말씀에서만 사실을 찾습니다.
            </p>
          </div>
        ) : null}

        {empty ? (
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-500">
            아직 옮긴 내용이 없어요. 위에서 녹음을 글로 옮기면 문장이 하나씩
            여기에 나타나고, 눌러서 바로 고칠 수 있어요.
          </p>
        ) : (
          <ul className="mt-2">
            {s.transcript.map((t, i) => {
              // t.speaker 를 그대로 좁히면 아래 콜백 안에서 다시 undefined 가
              // 된다. 한 번 꺼내 두고 쓴다.
              const who = t.speaker;
              return (
                <li key={t.id} className="border-b border-hairline py-3 last:border-0">
                  {who ? (
                    <button
                      type="button"
                      onClick={() => setSpeaker(t.id, other(who))}
                      aria-label={`${i + 1}번째 문장은 ${WHO[who]} 말씀으로 되어 있어요. 눌러서 ${WHO[other(who)]} 말씀으로 바꿉니다.`}
                      // 이름표는 작지만 잘못 누르면 회기 기록이 어긋난다.
                      // 태블릿에서 손가락으로 정확히 짚을 만큼은 키운다.
                      className={`mb-1 inline-flex min-h-[40px] items-center rounded-full px-3.5 text-[0.8125rem] font-bold ${
                        who === 'elder'
                          ? 'bg-brand-100 text-brand-800'
                          : 'bg-surface-sunk text-ink-700'
                      }`}
                    >
                      {WHO[who]}
                    </button>
                  ) : null}
                  <label htmlFor={`line-${t.id}`} className="sr-only">
                    전사 {i + 1}번째 문장
                  </label>
                  <input
                    id={`line-${t.id}`}
                    value={t.text}
                    onChange={(e) => edit(t.id, e.target.value)}
                    className="w-full bg-transparent text-[1.1875rem] font-bold leading-snug text-ink-900 outline-none focus-visible:rounded-lg focus-visible:bg-brand-50"
                  />
                </li>
              );
            })}
          </ul>
        )}

        {/* 예전에는 '다시 듣기' 버튼과 파형 그림이 있었는데 둘 다 장식이었다 —
            눌러도 아무 소리가 안 났다. 기기에 있는 이 회기 녹음을 그대로
            재생한다. 녹음이 없으면 왜 없는지 적는다. 안 들리는 재생 버튼이
            남아 있으면 복지사는 고장으로 여긴다. */}
        <div className="mt-2 border-t border-hairline pt-3">
          <p className="text-[0.9375rem] font-bold text-ink-700">이 회기 녹음</p>
          {rec.url ? (
            <audio
              src={rec.url}
              controls
              preload="metadata"
              className="mt-2 w-full"
            />
          ) : (
            <>
              <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-500">
                이 기기에 녹음이 없어요. 인터뷰 화면에서 녹음하면 여기서 들으며
                고칠 수 있어요.
              </p>
              {/*
                다른 태블릿에서 이어받은 회기라면 녹음은 기관 저장소에 있다.
                받아 오는 길을 여기 둔다 — 출처를 눌렀는데 소리가 안 나는 것이
                이 화면에서 제일 답답한 자리다.

                자동으로 받지 않는다. 원음성은 열어 보는 일 자체가 기록에 남는
                자료라(기본 미열람), 사람이 눌러야 열린다.
              */}
              <ServerRecordingNote />
            </>
          )}
        </div>
      </Card>

      {/* 예전에는 이 자리에 '헷갈린 단어' 칩 두 개('신발'·'공장')가 있었다.
          씨앗 상수였고, 어떤 어르신의 어떤 전사에서도 같은 두 단어가 떴다.
          전사 제공자(lib/providers)가 단어별 신뢰도를 주지 않아서 만들 수가
          없다. 틀린 신호는 없는 것보다 나쁘다 — 복지사가 그 두 단어만 보고
          나머지를 통과시키게 된다. 신뢰도가 파이프라인에 생기면 그때 되살린다. */}
      <Card className="mt-4 flex items-start gap-3 bg-leaf-50 p-4 shadow-none">
        <CheckCircle size={40} />
        <p className="text-[1rem] leading-relaxed text-leaf-800">
          <span className="font-bold">문장을 눌러 바로 고칠 수 있어요.</span>
          <br />
          자동 전사는 어느 단어를 잘못 들었는지 스스로 알려주지 못해요. 처음부터
          끝까지 한 번 읽어 주세요.
        </p>
      </Card>
    </Screen>
  );
}
