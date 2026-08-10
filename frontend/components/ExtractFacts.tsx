'use client';

import { useState } from 'react';
import { Card } from './ui';
import { ConsentGate, missingConsents } from './ConsentGate';
import { hasConsent, type StoryItem } from '@/lib/domain';
import { mmss } from '@/lib/recorder';
import { useSession } from '@/lib/store';

/**
 * 전사에서 이야기 뽑기.
 *
 * 지금까지 이 화면의 이야기 목록은 만들어 둔 예시였다. 녹음도 전사도 진짜인데
 * 그 사이가 끊겨 있어서, "출처 · 어르신 음성 0:42"가 실제로는 아무 데도
 * 가리키지 않았다. 이 버튼이 그 사이를 잇는다.
 *
 * 뽑힌 항목은 전부 '확인 필요'로 들어간다. 복지사가 어르신과 함께 하나씩
 * 확인해야 '확인된 이야기'가 되고, 거기까지 간 것만 가사로 넘어간다.
 * 기계가 확정한 사실은 이 제품에 없다.
 */
export function ExtractFacts() {
  const { s, set } = useSession();
  const [state, setState] = useState<'idle' | 'busy'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const canSend = hasConsent(s.elder.consents, 'externalAi');
  const hasTranscript = s.transcript.length > 0;
  // 화자가 갈린 회기면 무엇이 빠지는지 화면이 먼저 말한다. 복지사 질문이
  // 사실에서 빠지는 것은 좋은 일이지만, 말없이 빠지면 "왜 그 대목이
  // 안 나왔지"가 된다.
  const workerLines = s.transcript.filter((t) => t.speaker === 'worker').length;
  const split = s.transcript.some((t) => t.speaker);
  // 자동 정리가 빈손으로 돌아온 회기에서는 받아 적는 칸을 펼쳐 준다.
  // 오류만 띄우고 닫아 두면 여기서 회기가 멈춘다 — 아래 푸터도 '확인된
  // 이야기가 필요해요'로 잠겨 있어서 나갈 문이 하나도 없다.
  const [openNote, setOpenNote] = useState(false);

  const run = async () => {
    setState('busy');
    setError(null);
    setInfo(null);
    try {
      const res = await fetch('/api/facts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments: s.transcript, topic: s.topic }),
      });
      const json = (await res.json()) as {
        facts?: {
          text: string;
          sources: { at: number; quote: string; speaker?: 'elder' | 'worker' }[];
        }[];
        dropped?: number;
        error?: string;
      };
      if (!res.ok || !json.facts) {
        setError(json.error ?? '이야기를 뽑지 못했어요.');
        setState('idle');
        return;
      }
      if (!json.facts.length) {
        setError(
          '사실로 옮길 만한 말씀을 찾지 못했어요. ' +
            // 화자 추정이 통째로 뒤집힌 회기가 여기로 온다. 어르신 말씀이
            // 전부 복지사 줄로 붙어 있으면 뽑을 것이 없는 게 당연한데,
            // 그 이유를 말해 주지 않으면 전사만 몇 번 다시 읽게 된다.
            (split
              ? '누가 한 말인지가 뒤바뀌었을 수 있어요 — 전사 교정에서 ' +
                '「어르신 ↔ 복지사 통째로 바꾸기」를 눌러 확인해 주세요. '
              : '') +
            '전사가 어르신 말씀과 다르면 전사 교정에서 고친 뒤 다시 뽑아 주세요. ' +
            '아래 「손으로 이야기 적기」에 복지사가 직접 적으셔도 됩니다.',
        );
        setOpenNote(true);
        setState('idle');
        return;
      }

      // 출처는 여기서 붙는다. 복지사가 시각을 손으로 적을 수는 없으니,
      // 자동으로 붙지 않으면 출처 규칙은 현실에서 지켜지지 않는다.
      const items: StoryItem[] = json.facts.map((f, i) => ({
        id: `fact-${i}-${f.sources[0]?.at ?? 0}`,
        text: f.text,
        status: 'unverified',
        /*
         * 어느 목소리인지 아는 줄에만 '어르신 음성'이라고 적는다.
         *
         * 화자를 못 가른 줄(speaker 없음)도 근거로는 허용한다 — 못 가른
         * 것이지 복지사 말씀이라고 밝혀진 것이 아니다. 다만 그 대목에
         * 어르신 이름표를 다는 것은 출처가 아니라 주장이 된다. 눌러 보면
         * 복지사 목소리일 수도 있는 자리다.
         */
        sources: f.sources.map((src) => ({
          kind: 'voice' as const,
          at: src.at,
          label:
            src.speaker === 'elder'
              ? `어르신 음성 ${mmss(src.at)}`
              : `녹음 ${mmss(src.at)}`,
        })),
      }));

      set('story', items);
      set('storyConfirmed', false);
      setInfo(
        `${items.length}개를 뽑았어요.` +
          (json.dropped ? ` 근거를 못 찾은 ${json.dropped}개는 버렸습니다.` : ''),
      );
      setState('idle');
    } catch {
      setError('연결하지 못했어요. 전사는 그대로 남아 있습니다.');
      setState('idle');
    }
  };

  // 동의가 없으면 자동 정리는 하지 않는다. 대신 손으로 적는 길을 늘 열어
  // 둔다 — 아래 HandwrittenStory 가 그 길이다.
  if (!canSend) {
    return (
      <>
        <ConsentGate
          className="mt-4"
          missing={missingConsents(s.elder.consents, ['externalAi'])}
          title="자동 정리를 하지 않아요"
          why="전사에서 사실을 뽑는 일은 어르신 말씀을 외부 사업자에 보내야 해서, 외부 AI 전송에 동의하셨을 때만 씁니다."
        />
        <HandwrittenStory open />
      </>
    );
  }

  return (
    <>
      <Card className="mt-4 p-4">
        <p className="text-[1.0625rem] font-extrabold text-ink-900">
          전사에서 이야기 뽑기
        </p>
        <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-500">
          {hasTranscript
            ? `전사 ${s.transcript.length}줄에서 사실만 골라 옵니다.` +
              (split
                ? ` 복지사 질문 ${workerLines}줄은 문맥으로만 읽고 사실로 뽑지 않아요.`
                : '') +
              ' 각 항목에는 그 말씀이 나온 시각이 출처로 붙어요.'
            : '아직 전사가 없어요. 전사 교정 단계에서 녹음을 글로 옮긴 뒤에 쓸 수 있습니다.'}
        </p>

        <button
          type="button"
          disabled={!hasTranscript || state === 'busy'}
          onClick={() => void run()}
          className={`mt-3 min-h-[52px] w-full rounded-[14px] text-[1rem] font-bold ${
            !hasTranscript || state === 'busy'
              ? 'pointer-events-none bg-surface-sunk text-ink-500'
              : 'tk-cta text-white'
          }`}
        >
          {state === 'busy'
            ? '정리하는 중…'
            : s.story.length > 0
              ? '다시 뽑기'
              : '이야기 뽑기'}
        </button>

        {s.story.length > 0 ? (
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-500">
            다시 뽑으면 지금 목록과 확인 표시가 새로 만들어집니다.
          </p>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="mt-2 rounded-[12px] bg-surface-sunk px-3 py-2 text-[0.875rem] font-bold text-danger-600"
          >
            {error}
          </p>
        ) : null}
        {info ? (
          <p className="mt-2 rounded-[12px] bg-leaf-50 px-3 py-2 text-[0.875rem] font-bold text-leaf-800">
            {info}
          </p>
        ) : null}

        <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-ink-500">
          뽑은 항목은 전부 <strong>확인 필요</strong>로 들어갑니다. 어르신과 함께
          확인하신 것만 가사로 넘어가요.
        </p>
      </Card>

      <HandwrittenStory open={openNote} />
    </>
  );
}

/**
 * 손으로 이야기 적기.
 *
 * 두 가지 안내를 사실로 만드는 자리다. 녹음에 동의하지 않으시면 "복지사가
 * 받아 적어 기록할 수 있어요", 외부 AI 전송에 동의하지 않으시면 "복지사가
 * 직접 이야기를 작성할 수 있어요" — 둘 다 CONSENT_FALLBACK 에 적혀 있는데
 * 정작 받아 적을 자리가 앱에 없었다. 안내가 가리키는 곳이 없으면 그 안내는
 * 거짓말이다.
 *
 * 동의가 있는 회기에서도 열어 둔다. 녹음을 못 한 날, 전사가 놓친 말씀,
 * 어르신이 나중에 덧붙이신 이야기 — 손으로 적을 일은 동의와 무관하게 생긴다.
 *
 * 출처는 '복지사 기록'으로 붙는다. 출처 없는 사실은 만들 수 없고(원칙 2),
 * 상태는 자동 추출과 똑같이 '확인 필요'로 들어간다 — 복지사가 적었다는
 * 이유로 어르신 확인을 건너뛰지 않는다(원칙 1 · 3).
 */
function HandwrittenStory({ open: want = false }: { open?: boolean }) {
  const { s, set } = useSession();
  /*
   * 자동 정리가 막혔거나 빈손으로 돌아왔으면 이것이 유일한 길이라 펼쳐 둔다.
   *
   * 처음 값으로만 받으면 안 된다 — '이야기 뽑기'가 빈손으로 돌아오는 것은
   * 마운트가 아니라 그 뒤의 일이라, useState(want) 는 영영 닫힌 채로 남는다.
   * 그렇다고 want 를 그대로 따르게 하면 복지사가 닫아도 다시 열린다.
   * 그래서 손대기 전에는 want 를 따르고, 한 번 여닫은 뒤로는 그 선택을 지킨다.
   */
  const [choice, setChoice] = useState<boolean | null>(null);
  const open = choice ?? want;
  const [text, setText] = useState('');
  const [added, setAdded] = useState(0);

  const body = text.trim();

  const add = () => {
    if (!body) return;
    const item: StoryItem = {
      id: `note-${Date.now()}`,
      text: body,
      status: 'unverified',
      sources: [{ kind: 'staffNote', label: '복지사 기록' }],
    };
    set('story', [...s.story, item]);
    setText('');
    setAdded((n) => n + 1);
  };

  return (
    <details
      open={open}
      onToggle={(e) => setChoice(e.currentTarget.open)}
      className="mt-3 rounded-[20px] bg-surface p-4 shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
    >
      <summary className="cursor-pointer text-[1.0625rem] font-extrabold text-ink-900 marker:content-none">
        손으로 이야기 적기
        <span className="mt-1 block text-[0.875rem] font-medium leading-relaxed text-ink-500">
          녹음이나 자동 정리를 쓰지 않을 때, 어르신 말씀을 복지사가 직접
          적습니다.
        </span>
      </summary>

      <label htmlFor="handwritten-story" className="sr-only">
        어르신 말씀
      </label>
      <textarea
        id="handwritten-story"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="예) 첫 월급으로 어머니께 신발을 사드렸다"
        className="mt-3 w-full rounded-[14px] border-2 border-hairline bg-surface-strong px-3.5 py-3 text-[1.0625rem] font-semibold leading-relaxed text-ink-900 outline-none focus-visible:border-brand-500"
      />

      <button
        type="button"
        disabled={!body}
        onClick={add}
        className={`mt-2.5 min-h-[52px] w-full rounded-[14px] text-[1rem] font-bold ${
          !body
            ? 'pointer-events-none bg-surface-sunk text-ink-500'
            : 'bg-brand-700 text-white'
        }`}
      >
        이야기로 추가하기
      </button>

      {added > 0 ? (
        <p className="mt-2 rounded-[12px] bg-leaf-50 px-3 py-2 text-[0.875rem] font-bold leading-relaxed text-leaf-800">
          {added}개를 아래 &lsquo;확인 필요&rsquo;에 넣었어요. 어르신과 함께
          확인하시면 가사로 넘어갑니다.
        </p>
      ) : null}

      <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-ink-500">
        출처는 <strong>복지사 기록</strong>으로 남아요. 어르신 음성처럼 눌러서
        들을 수는 없습니다.
      </p>
    </details>
  );
}
