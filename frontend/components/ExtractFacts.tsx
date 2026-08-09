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
        facts?: { text: string; sources: { at: number; quote: string }[] }[];
        dropped?: number;
        error?: string;
      };
      if (!res.ok || !json.facts) {
        setError(json.error ?? '이야기를 뽑지 못했어요.');
        setState('idle');
        return;
      }
      if (!json.facts.length) {
        setError('사실로 옮길 만한 말씀을 찾지 못했어요. 전사를 확인해 주세요.');
        setState('idle');
        return;
      }

      // 출처는 여기서 붙는다. 복지사가 시각을 손으로 적을 수는 없으니,
      // 자동으로 붙지 않으면 출처 규칙은 현실에서 지켜지지 않는다.
      const items: StoryItem[] = json.facts.map((f, i) => ({
        id: `fact-${i}-${f.sources[0]?.at ?? 0}`,
        text: f.text,
        status: 'unverified',
        sources: f.sources.map((src) => ({
          kind: 'voice' as const,
          at: src.at,
          label: `어르신 음성 ${mmss(src.at)}`,
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
        <HandwrittenStory />
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
            ? `전사 ${s.transcript.length}줄에서 사실만 골라 옵니다. 각 항목에는 그 말씀이 나온 시각이 출처로 붙어요.`
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

      <HandwrittenStory />
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
function HandwrittenStory() {
  const { s, set } = useSession();
  const canSend = hasConsent(s.elder.consents, 'externalAi');
  // 자동 정리가 막힌 회기에서는 이것이 유일한 길이라 펼쳐 둔다.
  const [open, setOpen] = useState(!canSend);
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
      onToggle={(e) => setOpen(e.currentTarget.open)}
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
