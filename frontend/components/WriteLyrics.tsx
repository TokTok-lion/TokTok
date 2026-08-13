'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ConsentGate, missingConsents } from './ConsentGate';
import { hasConsent, lyricInputs, type LyricSection } from '@/lib/domain';
import { findContradictions } from '@/lib/contradiction';
import { useLifeStory } from '@/lib/useLifeStory';
import { useSession } from '@/lib/store';
import { quotesFor } from '@/lib/verbatim';

/**
 * 확인된 이야기로 가사 쓰기.
 *
 * 보내는 것은 lyricInputs() 를 통과한 문장뿐이다 — 어르신이 맞다고 확인했고
 * 출처가 붙은 것들. 미확인·제외 항목은 나가지 않는다. 이 걸러내기가 이
 * 서비스의 규칙 자체라, 화면에도 몇 개가 근거인지 적어 둔다.
 */
/** 가사를 만들고 나서 복지사가 알아야 하는 것들. */
type Note = {
  /** 피하고 싶은 주제와 겹쳐 아예 안 보낸 이야기 수. */
  withheld: number;
  /** 그래도 가사에 남은 낱말. */
  avoidHit: string[];
  /** 어르신 말씀 그대로 살린 표현 — 양쪽에서 확인된 것만. */
  kept: string[];
  /** 말투를 살릴 원문이 몇 줄 있었는가. */
  quotesUsed: number;
};

export function WriteLyrics() {
  const { s, set } = useSession();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const life = useLifeStory();

  // 생애사는 한 회기에 다 나오지 않는다. 기본을 "지금까지 모은 이야기"로
  // 두는 이유다 — 조각난 이야기로 만든 노래는 어르신께 얕게 들린다.
  const [scope, setScope] = useState<'all' | 'session'>('all');
  const basis = scope === 'all' ? life.all : life.thisSession;
  const allowed = hasConsent(s.elder.consents, 'externalAi');

  /*
   * 동의가 없으면 자동 생성은 하지 않는다. 다만 여기서 끝내지 않는다.
   *
   * 예전에는 이 자리에 안내 한 줄만 있었다. 그런데 이 화면의 아래쪽 버튼은
   * 가사가 없으면 '먼저 가사를 만들어 주세요'로 잠긴다 — 외부 AI 전송에
   * 동의하지 않으신 어르신은 6단계에서 나갈 방법이 하나도 없었다. 게다가 그
   * 안내에 붙던 CONSENT_FALLBACK.externalAi 는 "복지사가 직접 가사를 작성할
   * 수 있어요"라고 약속하는데 그런 화면이 없었다. 없는 기능을 안내하느니
   * 만든다 — 아래 HandwrittenLyrics 가 그 약속이다.
   */
  if (!allowed) {
    return (
      <ConsentGate
        missing={missingConsents(s.elder.consents, ['externalAi'])}
        title="가사를 자동으로 만들지 않아요"
        why="가사 생성은 어르신 이야기를 외부 사업자에 보내야 해서, 외부 AI 전송에 동의하셨을 때만 씁니다."
      >
        <HandwrittenLyrics />
      </ConsentGate>
    );
  }

  const run = async () => {
    setState('busy');
    setError(null);
    setNote(null);
    try {
      const res = await fetch('/api/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: s.topic,
          facts: basis.map((i) => i.text),
          style: s.style ?? 'ballad',
          // 어르신 기록에 적어 둔 주제. 라우트가 이걸로 재료를 먼저 덜어 낸다.
          avoid: s.elder.avoidTopics,
          /*
           * 그 사실들의 근거가 된 어르신 말씀 원문 — 말투를 살릴 재료다.
           *
           * 이번 회기 항목에서만 뽑는다. 지난 회기 사실은 이 기기의 전사에
           * 없어서 원문을 찾을 수 없다 — 없는 것을 찾은 척하지 않는다.
           */
          quotes: quotesFor(lyricInputs(s.story), s.transcript),
        }),
      });
      const json = (await res.json()) as {
        sections?: { label: string; tone: 'verse' | 'chorus'; lines: string[] }[];
        error?: string;
        withheld?: number;
        avoidHit?: string[];
        kept?: string[];
        quotesUsed?: number;
      };
      if (!res.ok || !json.sections) {
        setError(json.error ?? '가사를 만들지 못했어요.');
        setState('idle');
        return;
      }
      set('lyrics', json.sections);
      // 살아남은 말씨는 노래 완성 화면까지 들고 간다.
      set('lyricsKept', json.kept ?? []);
      setNote({
        withheld: json.withheld ?? 0,
        avoidHit: json.avoidHit ?? [],
        kept: json.kept ?? [],
        quotesUsed: json.quotesUsed ?? 0,
      });
      setState('done');
    } catch {
      setError('연결하지 못했어요.');
      setState('idle');
    }
  };

  // 고른 이야기들 사이에 어긋나는 것이 있으면 짚는다. 그대로 두면 어르신이
  // 열아홉에도 스물둘에도 공장에 들어간 노래가 나온다 — 본인 이야기인데
  // 앞뒤가 맞지 않는 노래를 드리게 된다.
  //
  // 막지는 않는다. 어느 쪽이 맞는지는 어르신만 아시고, 되묻기 전에 곡을
  // 만들어야 할 사정도 있다(원칙 1). 판단은 복지사가 한다.
  const clashes = findContradictions(
    basis.filter((f) => f.when !== '이번 회기'),
    basis.filter((f) => f.when === '이번 회기'),
  );

  const OPTIONS = [
    {
      id: 'all' as const,
      label: '지금까지 모은 이야기',
      count: life.all.length,
      note: '여러 회기가 모여 깊은 노래가 돼요',
    },
    {
      id: 'session' as const,
      label: '이번 회기만',
      count: life.thisSession.length,
      note: '오늘 들은 이야기로만',
    },
  ];

  return (
    <>
      {/* 무엇으로 만들지 먼저 고른다. 어떤 이야기가 노래가 되는지는
          복지사가 알고 있어야 하고, 화면에 개수로 보여야 안다. */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={scope === o.id}
            onClick={() => setScope(o.id)}
            className={`rounded-[14px] border-2 px-3 py-3 text-left ${
              scope === o.id
                ? 'border-brand-500 bg-brand-50'
                : 'border-hairline bg-surface'
            }`}
          >
            <span className="block text-[0.9375rem] font-extrabold text-ink-900">
              {o.label}
            </span>
            <span className="mt-0.5 block text-[0.875rem] font-bold text-brand-700">
              이야기 {o.count}개
            </span>
            <span className="mt-0.5 block text-[0.75rem] leading-snug text-ink-500">
              {o.note}
            </span>
          </button>
        ))}
      </div>

      {life.loading ? (
        <p className="mt-2 text-center text-[0.875rem] text-ink-500">
          지난 회기 이야기를 불러오는 중…
        </p>
      ) : null}

      {clashes.length ? (
        <div className="mt-3 rounded-[14px] border-2 border-brand-200 bg-brand-50 p-3.5">
          <p className="text-[0.9375rem] font-extrabold text-ink-900">
            서로 다른 이야기가 섞여 있어요
          </p>
          <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-700">
            {clashes[0].shared[0]} 이야기가 {clashes[0].values[0]}살과{' '}
            {clashes[0].values[1]}살로 갈립니다. 이대로 만들면 두 이야기가 한 노래에
            같이 들어가요.
          </p>
          <Link
            href="/session/story"
            className="mt-2.5 inline-flex min-h-[44px] items-center rounded-[12px] bg-brand-700 px-4 text-[0.9375rem] font-bold text-white"
          >
            이야기 정리에서 여쭤보기
          </Link>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void run()}
        disabled={state === 'busy' || basis.length === 0}
        className={`mt-3 min-h-[52px] w-full rounded-[14px] text-[1rem] font-bold ${
          state === 'busy' || basis.length === 0
            ? 'pointer-events-none bg-surface-sunk text-ink-500'
            : 'bg-brand-700 text-white'
        }`}
      >
        {basis.length === 0
          ? '확인된 이야기가 필요해요'
          : state === 'busy'
            ? '가사를 쓰는 중…'
            : state === 'done'
              ? '가사를 새로 썼어요 — 다시 쓰기'
              : `확인된 이야기 ${basis.length}개로 가사 만들기`}
      </button>

      {error ? (
        <p
          role="alert"
          className="mt-2 rounded-[12px] bg-surface-sunk px-3.5 py-2.5 text-[0.875rem] font-bold text-danger-600"
        >
          {error}
        </p>
      ) : null}

      {/*
        만들고 나서 복지사가 알아야 하는 것.

        여기 적는 것은 셋뿐이다 — 무엇을 뺐는지, 그래도 남은 것이 있는지,
        어르신 말씀을 그대로 살린 표현이 무엇인지. 셋 다 확인된 사실만 적는다.
      */}
      {note ? (
        <div className="mt-3 rounded-[14px] bg-surface-sunk p-3.5">
          {note.avoidHit.length ? (
            <p
              role="alert"
              className="text-[0.9375rem] font-bold leading-relaxed text-danger-600"
            >
              피하고 싶은 주제로 적어 두신 “{note.avoidHit.join(', ')}”가 가사에
              남아 있어요. 다시 만들거나, 아래에서 그 줄만 고쳐 주세요.
            </p>
          ) : null}

          {note.kept.length ? (
            <>
              <p className="text-[0.9375rem] font-bold text-ink-900">
                어르신 말씀 그대로 살린 표현 {note.kept.length}개
              </p>
              <p className="mt-1.5 flex flex-wrap gap-1.5">
                {note.kept.map((k) => (
                  <span
                    key={k}
                    className="rounded-full bg-leaf-50 px-2.5 py-1 text-[0.875rem] font-bold text-leaf-800"
                  >
                    {k}
                  </span>
                ))}
              </p>
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-500">
                녹음에서 어르신이 실제로 쓰신 말이 가사에 그대로 들어갔는지
                대조한 결과예요.
              </p>
            </>
          ) : note.quotesUsed > 0 ? (
            <p className="text-[0.875rem] leading-relaxed text-ink-500">
              이번 가사에는 어르신 말씀을 그대로 옮긴 표현이 없었어요. 다시
              만들면 살아나기도 합니다.
            </p>
          ) : (
            <p className="text-[0.875rem] leading-relaxed text-ink-500">
              말투를 살릴 녹음 원문이 이번 회기에는 없었어요. 지난 회기 이야기로
              만들면 다듬어진 문장만 재료가 됩니다.
            </p>
          )}

          {note.withheld > 0 ? (
            <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-500">
              피하고 싶은 주제와 겹치는 이야기 {note.withheld}개는 재료에서 빼고
              만들었어요.
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * 손으로 가사 쓰기
 * ------------------------------------------------------------------ */

/** 빈 줄로 나눈 덩어리 하나를 절로 본다. */
function parseLyrics(text: string): LyricSection[] {
  let verse = 0;
  return text
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      // 첫 줄에 '후렴'이라고 적으면 후렴으로 본다. 절 번호는 후렴을 건너뛴다.
      const chorus = lines.length > 0 && /^후렴/.test(lines[0]);
      const body = chorus ? lines.slice(1) : lines;
      if (!chorus && body.length > 0) verse += 1;
      return {
        label: chorus ? '후렴' : `${verse}절`,
        tone: chorus ? ('chorus' as const) : ('verse' as const),
        lines: body,
      };
    })
    .filter((sec) => sec.lines.length > 0);
}

/** 저장된 가사를 다시 글상자에 넣을 수 있는 모양으로. */
function lyricsToText(sections: LyricSection[]): string {
  return sections
    .map((sec) => (sec.tone === 'chorus' ? '후렴\n' : '') + sec.lines.join('\n'))
    .join('\n\n');
}

/**
 * 복지사가 직접 쓰는 가사.
 *
 * 외부 AI 전송에 동의하지 않으신 어르신도 노래까지 갈 수 있어야 한다.
 * 동의를 거절한 대가가 "여기서 끝"이면 그건 자유로운 선택이 아니다
 * (원칙 4 · F-SW-CONS-009).
 *
 * 여기서 쓴 글은 사람이 쓴 것이므로 AI 초안 검수 절차를 따로 두지 않는다.
 * 다음 화면의 '이 가사 확정'이 그대로 사람 검수의 도장이 된다(원칙 3).
 */
function HandwrittenLyrics() {
  const { s, set } = useSession();
  // 이미 써 둔 가사가 있으면 이어서 고친다. 다시 처음부터 치게 하면 회기
  // 중간에 손으로 쓴 것을 잃는다.
  const [text, setText] = useState(() => lyricsToText(s.lyrics));
  const [saved, setSaved] = useState(false);

  const sections = parseLyrics(text);
  const lineCount = sections.reduce((n, sec) => n + sec.lines.length, 0);

  return (
    <div className="mt-4 border-t border-hairline pt-4">
      <p className="text-[1.0625rem] font-extrabold text-ink-900">
        손으로 가사 쓰기
      </p>
      <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-500">
        어르신이 확인해 주신 이야기를 보면서 복지사가 직접 적어 주세요. 여기에
        적은 글은 기기 밖으로 나가지 않아요.
      </p>

      <label htmlFor="handwritten-lyrics" className="sr-only">
        가사
      </label>
      <textarea
        id="handwritten-lyrics"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        rows={10}
        placeholder={
          '첫 월급을 받던 날\n어머니 신발을 샀네\n\n후렴\n그 마음이 오래 남아\n오늘도 노래가 되네'
        }
        className="mt-2.5 w-full rounded-[14px] border-2 border-hairline bg-surface-strong px-3.5 py-3 text-[1.0625rem] font-semibold leading-[1.7] text-ink-900 outline-none focus-visible:border-brand-500"
      />
      <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-500">
        빈 줄을 넣으면 절이 나뉘어요. 후렴은 첫 줄에 <strong>후렴</strong>이라고
        적어 주세요.
      </p>

      <button
        type="button"
        disabled={sections.length === 0}
        onClick={() => {
          set('lyrics', sections);
          setSaved(true);
        }}
        className={`mt-3 min-h-[52px] w-full rounded-[14px] text-[1rem] font-bold ${
          sections.length === 0
            ? 'pointer-events-none bg-surface-sunk text-ink-500'
            : 'bg-brand-700 text-white'
        }`}
      >
        {sections.length === 0
          ? '가사를 적어 주세요'
          : `이 가사 저장 (${sections.length}묶음 · ${lineCount}줄)`}
      </button>

      {saved ? (
        <p className="mt-2 rounded-[12px] bg-leaf-50 px-3.5 py-2.5 text-[0.875rem] font-bold leading-relaxed text-leaf-800">
          저장했어요. 위쪽에서 가사를 확인하시고, 아래 &lsquo;이 가사 확정&rsquo;을
          누르면 다음 단계로 갑니다.
        </p>
      ) : null}
    </div>
  );
}
