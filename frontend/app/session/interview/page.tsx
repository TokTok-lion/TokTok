'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Art } from '@/components/Art';
import { SpeakButton } from '@/components/SpeakButton';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chip, IconCircle, NoteBar, PrimaryButton, Waveform } from '@/components/ui';
import { IconInfo, IconMic, IconSave, IconShield, IconSkip } from '@/components/icons';
import { QUESTION_LEVELS, hasConsent, type QuestionLevel } from '@/lib/domain';
import { mmss, releaseRecording, useRecorder } from '@/lib/recorder';
import { SEED_MEMORY_CARDS } from '@/lib/seed';
import { currentSession, setSessionField, useSession } from '@/lib/store';
import { useTranscribeStatus } from '@/lib/transcribeJob';

// the deck's own glyphs (p.21), cut by scripts/prepare-ui-icons.py
const PROMPT_ART = ['ui_people', 'ui_reaction', 'ui_bulb'] as const;

/**
 * 기억 카드별 질문.
 *
 * 예전에는 이 화면 전체가 '첫 월급으로 무엇을 하셨나요?' 한 문장이었다. 앞의
 * 두 화면에서 기억 카드(놀이·명절…)와 질문 단계(선택형·단답형·회상형)를 고르게
 * 해 놓고 그 선택을 한 글자도 쓰지 않았으니, 인지 수준에 맞춰 질문을 조절한다는
 * 이 앱의 핵심 기능이 화면에 도달하지 못했다.
 *
 * 이 표는 모델이 지어낸 문장이 아니라 우리가 쓴 질문이다. 그래서 어르신 앞에서
 * 무슨 말이 나올지 미리 알 수 있고, 회기마다 같은 카드·같은 단계면 같은 질문이
 * 나온다. 카드를 추가하려면 lib/seed.ts 의 SEED_MEMORY_CARDS 와 여기에 한 줄씩
 * 더하면 된다 — 화면은 고치지 않는다.
 */
const CARD_QUESTIONS: Record<string, Record<QuestionLevel, string>> = {
  friends: {
    1: '어릴 적에는 친구들과 밖에서 노는 게 좋으셨어요, 집에서 노는 게 좋으셨어요?',
    2: '가장 친하게 지내신 친구는 누구였나요?',
    3: '그 친구와 함께 지낸 이야기를 들려주세요.',
  },
  family: {
    1: '어릴 적에 어머니와 더 많이 지내셨어요, 아버지와 더 많이 지내셨어요?',
    2: '가족과 함께 살던 집은 어떤 집이었나요?',
    3: '가족과 함께한 날 중에 기억에 남는 날을 이야기해 주세요.',
  },
  school: {
    1: '학교 가는 길은 가까웠어요, 멀었어요?',
    2: '어느 학교에 다니셨나요?',
    3: '학교에서 있었던 일 중 기억에 남는 일을 이야기해 주세요.',
  },
  play: {
    1: '어릴 때는 뛰노는 놀이가 좋으셨어요, 조용한 놀이가 좋으셨어요?',
    2: '어릴 때 가장 자주 하시던 놀이는 무엇이었나요?',
    3: '그 놀이를 하며 지낸 하루를 이야기해 주세요.',
  },
  holiday: {
    1: '명절에는 집에 계셨어요, 다른 집에 다녀오셨어요?',
    2: '명절에 가장 기다려지던 음식은 무엇이었나요?',
    3: '기억에 남는 명절 하루를 이야기해 주세요.',
  },
};

/** 카드를 아직 안 고른 회기. 오늘 주제를 그대로 넣어 묻는다. */
const TOPIC_QUESTIONS: Record<QuestionLevel, (topic: string) => string> = {
  1: (t) => `오늘은 「${t}」 이야기를 들어보려 해요. 지금 떠오르는 게 있으세요?`,
  2: (t) => `「${t}」 하면 가장 먼저 무엇이 떠오르세요?`,
  3: (t) => `「${t}」에 대해 기억나는 일을 이야기해 주세요.`,
};

/**
 * 카드도 주제도 없는 회기.
 *
 * 실제 기관 회기는 주제 없이 시작한다 — 참가자 표에 주제 칸이 없다
 * (lib/useElders.ts). 그 빈자리에 '—'가 들어오던 시절에는 이 화면이 가장 큰
 * 글씨로 「—」 이야기를 들어보려 해요를 띄웠고, 읽어주기 버튼이 어르신께 그
 * 문장을 그대로 읽어 드렸다. 주제를 지어내는 대신 주제 없이도 물을 수 있는
 * 문장을 따로 둔다. 단계(선택형·단답형·회상형)는 그대로 지킨다.
 */
const OPEN_QUESTIONS: Record<QuestionLevel, string> = {
  1: '오늘은 어릴 적 이야기가 좋으세요, 요즘 이야기가 좋으세요?',
  2: '요즘 가장 자주 떠오르는 일은 무엇인가요?',
  3: '오늘 들려주고 싶은 이야기를 편하게 이야기해 주세요.',
};

/** 이어서 여쭐 보조 질문. 순서는 누구 · 기분 · 그다음이며 PROMPT_ART 와 맞춘다. */
const CARD_FOLLOW_UPS: Record<string, string[]> = {
  friends: [
    '그 친구는 어떤 분이셨어요?',
    '그 친구를 만나면 기분이 어떠셨어요?',
    '둘이서 주로 무엇을 하고 지내셨어요?',
  ],
  family: [
    '그 자리에 누가 함께 계셨어요?',
    '그때 마음이 어떠셨어요?',
    '집에서는 주로 무엇을 하며 지내셨어요?',
  ],
  school: [
    '학교에서 누구와 가까이 지내셨어요?',
    '학교 가는 길은 어떤 기분이었어요?',
    '수업이 끝나면 무엇을 하셨어요?',
  ],
  play: [
    '누구와 함께 노셨어요?',
    '그때 기분은 어떠셨어요?',
    '그 놀이는 어떻게 하는 거였어요?',
  ],
  holiday: [
    '명절에는 누가 모이셨어요?',
    '그날 기분은 어떠셨어요?',
    '명절에 무엇을 하며 지내셨어요?',
  ],
};

const DEFAULT_FOLLOW_UPS = [
  '그 자리에 누가 함께 계셨어요?',
  '그때 기분은 어떠셨어요?',
  '그다음엔 어떻게 되었어요?',
];

const LEVELS: QuestionLevel[] = [1, 2, 3];

const levelName = (level: QuestionLevel) =>
  QUESTION_LEVELS.find((q) => q.level === level)?.name ?? '';

/**
 * 오늘 물을 질문들.
 *
 * 고른 단계의 질문이 맨 앞이고, 나머지 단계가 뒤를 잇는다. '질문 건너뛰기'가
 * 이 차례를 돈다 — 회상형이 어려우시면 단답형·선택형으로 내려갈 수 있어야
 * 한다(명세서: 말문이 트이지 않으면 선택형부터).
 */
function questionsFor(card: string | null, topic: string, level: QuestionLevel) {
  const bank = card ? CARD_QUESTIONS[card] : undefined;
  const t = topic.trim();
  const order = [level, ...LEVELS.filter((l) => l !== level)];
  return order.map((l) => ({
    level: l,
    text: bank ? bank[l] : t ? TOPIC_QUESTIONS[l](t) : OPEN_QUESTIONS[l],
  }));
}

/** 인터뷰 진행 중 (deck p.21) */
export default function InterviewPage() {
  const { s } = useSession();
  const rec = useRecorder();
  const { origin } = useTranscribeStatus();
  const [asked, setAsked] = useState(0);

  const card = SEED_MEMORY_CARDS.find((c) => c.id === s.memoryCard) ?? null;
  const questions = questionsFor(s.memoryCard, s.topic, s.questionLevel);
  const question = questions[asked % questions.length];
  const followUps = s.memoryCard
    ? CARD_FOLLOW_UPS[s.memoryCard] ?? DEFAULT_FOLLOW_UPS
    : DEFAULT_FOLLOW_UPS;

  // 녹음 동의가 없으면 마이크는 시작조차 하지 않는다 (F-SW-INT-001)
  const canRecord = hasConsent(s.elder.consents, 'recording');

  // 화면을 벗어나면 마이크를 확실히 끈다. 켜진 채로 남으면 어르신 앞에서
  // 무엇이 녹음되는지 아무도 모르게 된다. 끄면서 녹음본은 마무리된다.
  //
  // 훅이 돌려주는 rec 은 렌더마다 새 객체라 의존성에 넣으면 안 된다 —
  // 넣었더니 매 렌더 정리가 돌아 녹음이 시작하자마자 멈췄다. 모듈 함수를
  // 직접 부르면 참조가 고정된다.
  useEffect(() => () => releaseRecording(), []);

  /*
   * 체크리스트를 거치지 않고 들어온 회기도 인터뷰 시작 시각을 남긴다.
   *
   * 진행 시간의 기준점은 체크리스트의 '인터뷰 시작' 버튼이지만, 그 화면을 꼭
   * 지나서 오는 것은 아니다 — 회기 단계 표시(lib/flow.ts)에서 3단계를 바로
   * 누르면 여기가 그날의 첫 화면이 된다. 그 회기만 활동일지에서 "재지 못했다"로
   * 남으면, 복지사는 자기가 뭘 빠뜨렸는지 알 수 없는 채로 손으로 적어야 한다.
   *
   * 녹음 시작에 걸지 않은 이유도 같다. 녹음 동의가 없는 회기는 마이크를 켜지
   * 않으므로(F-SW-INT-001) 그 회기는 영영 시간을 못 재게 된다. 마이크를 켜든
   * 복지사가 받아 적든 인터뷰가 시작되는 자리는 이 화면이다.
   *
   * 훅이 준 s 가 아니라 지금 상태를 읽는다. 마운트 직후의 s 는 저장소가 아직
   * 복원되기 전 값일 수 있어, 그걸로 판단하면 이미 찍혀 있는 시각을 덮는다.
   * 이미 있으면 두는 것이 규칙이다 — 질문을 넘기다 되돌아왔다고 인터뷰가 다시
   * 시작되지는 않는다.
   */
  useEffect(() => {
    if (currentSession().interviewStartedAt) return;
    setSessionField('interviewStartedAt', new Date().toISOString());
  }, []);

  const listening = rec.state === 'recording';

  /*
   * 지금 마이크를 누르면 앞 녹음이 지워지는가.
   *
   * startRecording() 은 새 녹음을 시작하면서 기기에 있던 녹음을 지운다 —
   * 조각이 섞이면 엉뚱한 소리가 이어 붙기 때문이라 그 자체는 맞는 처리다.
   * 문제는 그 일이 경고 없이 일어났다는 것이다. 한 시간 들은 이야기가
   * 버튼 한 번에 사라지고, 남은 전사와 이야기의 출처는 이제 없는 녹음을
   * 가리킨다. 되돌릴 수 없는 일은 누르기 전에 말해야 한다.
   *
   * 녹음 중·일시정지 중에 누르면 멈추거나 이어 하는 것이라 해당하지 않는다.
   */
  const replacing =
    rec.savedAt !== null && rec.state !== 'recording' && rec.state !== 'paused';
  // 그 녹음이 지금 화면들의 출처이기도 한가 — 지우면 들려드릴 수 없게 된다.
  const sourcesPointHere = origin === 'thisRecording';

  return (
    <Screen
      title="인터뷰 진행 중"
      subtitle="질문을 천천히 읽고 이야기를 들어요"
      decoration={<Ornaments variant="notes" />}
      footer={
        /*
         * 예전 라벨은 '이야기 저장'이었는데 저장하는 것이 없었다. 다음 화면으로
         * 넘어갈 뿐이고, 녹음은 이미 1초마다 기기에 쌓이고 있다. 그런데 그
         * 이름 때문에 "녹음을 눌러 이야기가 됐다"고 읽혔다 — 29초를 녹음하고
         * 이 버튼을 누른 사람이 다음 화면의 예시 이야기를 자기 이야기로 보고
         * "왜 그대로냐"고 물었다. 녹음을 글로 옮기는 일은 4단계에서 따로
         * 일어난다. 버튼은 자기가 하는 일만 말한다.
         */
        <PrimaryButton href="/session/confirm" leading={<IconSave size={22} />}>
          {rec.savedAt ? '녹음 마치고 다음으로' : '다음으로'}
        </PrimaryButton>
      }
    >
      {/* 주제가 있는 회기에만 붙는 이름표다. 주제가 없을 때 빈 알약을 띄우면
          무엇이 빠졌는지 알 수 없다 — 아래 안내가 대신 말해 준다. */}
      {s.topic ? (
        <div className="flex justify-center">
          <Chip tone="brand">
            <BagGlyph />
            <span className="ml-1.5">{s.topic}</span>
          </Chip>
        </div>
      ) : null}

      <Card className="mt-3.5 px-4 pb-4 pt-5">
        <div className="flex justify-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-500 text-[1.25rem] font-black text-white">
            Q
          </span>
        </div>
        <h2 className="mt-3 text-center text-[1.5rem] font-extrabold leading-snug text-ink-900">
          {question.text}
        </h2>

        {/* 이 질문이 왜 이 질문인지 한 줄로 보인다. 복지사가 화면을 믿으려면
            어디서 나온 문장인지 알 수 있어야 한다. */}
        <p className="mt-2 text-center text-[0.875rem] font-semibold text-ink-500">
          {card
            ? `기억 카드 · ${card.label}`
            : s.topic
              ? '오늘 주제'
              : '주제 없이 여는 질문'}{' '}
          · {question.level}단계{' '}
          {levelName(question.level)}
          {questions.length > 1 ? ` · 질문 ${(asked % questions.length) + 1}/${questions.length}` : ''}
        </p>

        {/* 글씨가 잘 안 보이는 어르신께 읽어 드린다. 질문은 우리가 쓴 문장이라
            어르신 개인정보가 밖으로 나가지 않는다 — 외부 AI 동의와 무관하다. */}
        <div className="mt-3 flex justify-center">
          <SpeakButton text={question.text} label="질문 읽어주기" />
        </div>

        {/* 보조 질문은 복지사가 읽고 이어 물으라고 적어 둔 쪽지다. 예전에는
            눌리는 것처럼 생겼는데 아무 일도 하지 않았다 — 누를 수 없게 두는
            편이 정직하다. */}
        <ul className="mt-4 space-y-2.5">
          {followUps.map((text, i) => (
            <li
              key={text}
              className="flex min-h-[64px] w-full items-center gap-3 rounded-[16px] border border-hairline bg-surface-strong px-3.5"
            >
              <IconCircle tone={i === 1 ? 'brand' : 'leaf'} size={42}>
                <Art name={PROMPT_ART[i] ?? 'ui_bulb'} size={23} alt="" />
              </IconCircle>
              <span className="flex-1 text-[1.0625rem] font-bold text-ink-900">
                {text}
              </span>
            </li>
          ))}
        </ul>

        {!s.memoryCard ? (
          <p className="mt-3 text-center text-[0.875rem] leading-relaxed text-ink-500">
            {/* 주제가 없다고 여기서 멈추게 하지 않는다. 지금 나온 질문이
                무엇인지 밝히고, 더 좋은 질문을 얻는 길을 같이 적는다. */}
            {s.topic
              ? ''
              : '오늘 주제가 없어 어떤 이야기든 여쭐 수 있는 질문으로 시작해요. '}
            기억 카드를 고르시면 그 기억에 맞는 질문을 준비해 드려요.{' '}
            <Link
              href="/session/cards"
              className="font-bold text-brand-700 underline underline-offset-2"
            >
              기억 카드 고르기
            </Link>
          </p>
        ) : null}
      </Card>

      {/* 누르기 전에 말한다. 누른 뒤에 뜨는 안내는 사과문이지 안내가 아니다. */}
      {replacing ? (
        <div id="rec-replace-warning" className="mt-5">
          <NoteBar tone="amber" icon={<IconInfo size={20} />}>
            이미 <strong>{mmss(rec.seconds)}</strong> 녹음이 있어요. 다시 녹음을
            시작하면 앞 녹음은 지워지고 되돌릴 수 없습니다.
            {sourcesPointHere
              ? ' 지금 전사와 이야기의 출처가 이 녹음을 가리키고 있어서, 지우면 그 대목을 어르신께 다시 들려드릴 수 없어요.'
              : ''}{' '}
            앞 녹음을 남기시려면{' '}
            <Link href="/session/transcript" className="font-bold underline underline-offset-2">
              전사 교정
            </Link>
            에서 먼저 글로 옮겨 주세요.
          </NoteBar>
        </div>
      ) : null}

      {/* mic */}
      <div className="mt-5 flex items-center justify-center gap-3">
        <Waveform bars={9} height={30} tone="muted" seed={3} />
        <button
          type="button"
          aria-pressed={listening}
          disabled={!canRecord || rec.state === 'unsupported'}
          aria-describedby={replacing ? 'rec-replace-warning' : undefined}
          onClick={() => void rec.toggle()}
          className={`relative flex h-[124px] w-[124px] shrink-0 flex-col items-center justify-center gap-1 rounded-full text-white shadow-[0_10px_26px_rgba(216,88,12,0.35)] disabled:opacity-50 ${
            listening ? 'tk-cta' : 'bg-ink-500'
          }`}
        >
          {listening ? (
            <span
              className="absolute inset-[-12px] rounded-full bg-brand-500/20 motion-safe:animate-ping"
              aria-hidden
            />
          ) : null}
          <IconMic size={40} />
          {/* 19px/800 -> WCAG "large text" on the vivid orange fill */}
          <span className="text-[1.1875rem] font-extrabold">
            {!canRecord
              ? '녹음 불가'
              : rec.state === 'recording'
                ? '말씀 듣는 중'
                : rec.state === 'paused'
                  ? '일시정지'
                  : rec.state === 'denied'
                    ? '마이크 없음'
                    : replacing
                      ? // 같은 '눌러서 시작'이 두 가지 일을 하면 안 된다.
                        // 이쪽은 앞 녹음을 지우고 처음부터 다시 하는 일이다.
                        '새로 녹음'
                      : '눌러서 시작'}
          </span>
        </button>
        <Waveform bars={9} height={30} tone="muted" seed={11} />
      </div>

      <p className="mt-2 text-center text-[0.9375rem] font-semibold tabular-nums text-ink-500">
        {mmss(rec.seconds)} 녹음됨
      </p>

      {rec.error ? (
        <p
          role="alert"
          className="mt-2 rounded-[12px] bg-surface-sunk px-3.5 py-2.5 text-center text-[0.875rem] font-bold text-danger-600"
        >
          {rec.error}
        </p>
      ) : null}

      {/* 넘기면 다음 질문이 실제로 바뀐다. 예전에는 핸들러가 없어 눌러도
          같은 문장이 그대로 있었다. */}
      <div className="mt-3 flex justify-center">
        <button
          type="button"
          onClick={() => setAsked((v) => v + 1)}
          className="flex min-h-[50px] items-center gap-2 rounded-full border-2 border-brand-300 bg-surface-strong px-6 text-[1.0625rem] font-bold text-brand-700"
        >
          질문 건너뛰기
          <IconSkip size={19} />
        </button>
      </div>

      <div className="mt-4">
        {canRecord ? (
          <NoteBar tone="leaf" icon={<IconShield size={20} />}>
            {/* 소리가 어디에 있는지 분명히 적는다.
                오래 "밖으로 보내지 않아요"라고만 적혀 있었는데, 전사 API 가
                붙은 뒤로 그 말은 참이 아니다 — 외부 AI 전송에 동의하신
                회기는 인터뷰를 마치는 순간 녹음이 전사 서버로 나간다.
                동의하신 분께도 그 사실은 이 화면에서 보여야 한다. */}
            {hasConsent(s.elder.consents, 'externalAi')
              ? '녹음은 이 기기에 저장되고, 인터뷰를 마치면 글로 옮기려고 외부 전사 서버로 보내요(동의하신 항목). 불편한 질문은 언제든 넘길 수 있어요.'
              : '녹음은 이 기기에만 남고 밖으로 보내지 않아요. 불편한 질문은 언제든 넘길 수 있어요.'}
          </NoteBar>
        ) : (
          <NoteBar tone="brand" icon={<IconShield size={20} />}>
            녹음 동의가 없어 마이크를 켜지 않았어요. 복지사가 말씀을 받아 적어
            기록할 수 있어요.
          </NoteBar>
        )}
      </div>
    </Screen>
  );
}

function BagGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.4 8.2h15.2l-1 11.4H5.4Z" />
      <path d="M9 8.2V6.4a3 3 0 0 1 6 0v1.8" />
    </svg>
  );
}
