'use client';

import { Ornaments, Screen } from '@/components/Shell';
import { TranscribeButton } from '@/components/TranscribeButton';
import { Card, CheckCircle, PrimaryButton } from '@/components/ui';
import { IconEdit } from '@/components/icons';
import { useRecorder } from '@/lib/recorder';
import { useSession } from '@/lib/store';

/** 전사 교정 (deck p.5) */
export default function TranscriptPage() {
  const { s, set } = useSession();
  const rec = useRecorder();
  const empty = s.transcript.length === 0;

  // 고친 내용을 화면 안에 따로 들고 있지 않는다. 예전엔 useState 로 복사해
  // 뒀는데, 자동 전사가 전사 내용을 통째로 바꾸면 화면이 옛 문장을 계속
  // 보여줬다. 저장소 하나만 보면 어긋날 자리가 없다.
  const edit = (id: string, text: string) =>
    set('transcript', s.transcript.map((t) => (t.id === id ? { ...t, text } : t)));

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

      <Card className="mt-3 p-4">
        <p className="text-[1rem] font-bold text-ink-500">전사 내용</p>

        {empty ? (
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-500">
            아직 옮긴 내용이 없어요. 위에서 녹음을 글로 옮기면 문장이 하나씩
            여기에 나타나고, 눌러서 바로 고칠 수 있어요.
          </p>
        ) : (
          <ul className="mt-2">
            {s.transcript.map((t, i) => (
              <li key={t.id} className="border-b border-hairline py-3 last:border-0">
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
            ))}
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
            <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-500">
              이 기기에 녹음이 없어요. 인터뷰 화면에서 녹음하면 여기서 들으며
              고칠 수 있어요.
            </p>
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
