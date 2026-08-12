'use client';

import { useState } from 'react';

import { Art } from '@/components/Art';
import { ConsentAsk, RESULT_CONSENTS, SESSION_CONSENTS, UnrecordedConsents } from '@/components/ConsentGate';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, IconCircle, NoteBar, PrimaryButton } from '@/components/ui';
import { IconChat, IconClock, IconInfo, IconMic, IconShield } from '@/components/icons';
import { checkMicrophone } from '@/lib/recorder';
import { hasConsent } from '@/lib/domain';
import { useSession } from '@/lib/store';
import { PREP_CHECKS, type PrepCheck } from '@/lib/flow';
import type { ArtKey } from '@/lib/art';
import type { ComponentType } from 'react';

/*
 * 점검할 항목의 목록은 흐름표(lib/flow.ts)가 들고 있다.
 *
 * 여기 배열과 저기 완료 판정이 따로 살아 있어서, 한쪽만 고치면 이 화면은
 * '4건 남음'이라 말하고 회기 화면은 같은 1단계를 '완료'로 그리게 된다.
 * Record 로 받으면 항목을 빠뜨렸을 때 타입이 먼저 잡는다.
 */
const ITEMS: Record<
  PrepCheck,
  {
    label: string;
    Icon: ComponentType<{ size?: number; className?: string }>;
    tone: 'leaf' | 'amber';
  }
> = {
  // 넷이 있었다. 앱이 이미 아는 것(어르신 선택)과 다음 화면에서 하는 일
  // (기억 카드)까지 사람에게 다시 체크시키던 칸들이라 지웠다 — lib/flow.ts
  // 의 PREP_CHECKS 주석에 경위를 적었다. 남은 하나는 사람이 소리를 내 봐야
  // 알 수 있는 것이고, 틀리면 어르신 이야기가 통째로 사라진다.
  mic: { label: '마이크에 소리가 들어오나요?', Icon: IconMic, tone: 'amber' },
};

/** ISO 시각 → '오전 10:05'. 기기 시간대를 그대로 쓴다. */
function clockLabel(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const half = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${half} ${h12}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 회기 시작 체크리스트 (deck p.20) */
export default function ChecklistPage() {
  const { s, set, setConsent, toggleChecklist } = useSession();
  /*
   * 마이크 확인 결과. 이 화면에서만 쓰고 회기에 담지 않는다 — 권한은 기기가
   * 들고 있는 것이라 회기 기록에 적을 사실이 아니다.
   */
  const [micNote, setMicNote] = useState<string | null>(null);
  const [micBusy, setMicBusy] = useState(false);

  /*
   * '마이크에 소리가 들어오나요?'가 실제로 마이크를 열어 본다.
   *
   * 예전에는 사람이 눈으로 보고 누르는 체크박스였다. 그래서 브라우저 권한
   * 팝업은 인터뷰 화면에서 녹음 버튼을 누를 때 처음 떴다 — 어르신과 마주
   * 앉은 뒤다. 확인했다고 체크하고 들어가서 팝업을 만나는 구조였다.
   *
   * 여기서 한 번 열면 팝업이 준비 단계에서 뜨고, 허용은 기기에 남아 다음
   * 회기부터는 뜨지 않는다. 녹음은 하지 않는다(곧바로 닫는다).
   *
   * 녹음 동의를 거절하신 회기에서는 열지 않는다. 시험 삼아 여는 것도 마이크를
   * 켜는 일이고, 그 회기는 받아 적기로 간다.
   */
  const onCheck = async (key: PrepCheck) => {
    /*
     * 도는 동안에는 두 번째 누름을 받지 않는다.
     *
     * 예전에는 aria-busy 만 붙이고 버튼을 잠그지 않았다. 권한 팝업이 떠 있는
     * 동안 한 번 더 누르면 두 호출이 나란히 s.checklist.mic === false 를 보고
     * 통과했고, 둘 다 성공해서 toggleChecklist 가 두 번 돌았다 — 마이크는
     * 확인됐는데 체크는 풀린 채로 남는다. 그러면 복지사는 다시 누르고,
     * getUserMedia 가 또 열린다.
     */
    if (micBusy) return;
    if (key !== 'mic' || s.checklist.mic) {
      toggleChecklist(key);
      return;
    }
    if (!hasConsent(s.elder.consents, 'recording')) {
      toggleChecklist(key);
      setMicNote('녹음 동의가 없어 마이크는 열지 않았어요. 받아 적기로 진행합니다.');
      return;
    }
    setMicBusy(true);
    const out = await checkMicrophone();
    setMicBusy(false);
    if (out === 'ok') {
      toggleChecklist(key);
      setMicNote(null);
      return;
    }
    // 못 열었으면 체크하지 않는다. 확인되지 않은 것을 확인됐다고 적으면
    // 복지사는 어르신 앞에서야 알게 된다.
    setMicNote(
      out === 'denied'
        ? '마이크를 쓸 수 없어요. 브라우저 주소창의 마이크 표시에서 허용해 주신 뒤 다시 눌러 주세요. 그대로 진행하시려면 받아 적기로 하실 수 있어요.'
        : '이 브라우저는 녹음을 지원하지 않아요. 받아 적기로 진행해 주세요.',
    );
  };

  /**
   * 아직 답하지 않은 것들. 준비 확인 + 이번 회기에 필요한 동의.
   *
   * 동의는 '아직 안 여쭤본 것'만 센다 — 어르신이 이미 거절하신 항목을
   * 이 버튼이 허용으로 뒤집으면 안 된다. 그건 대신 답하는 것이 아니라
   * 뜻을 바꾸는 것이다.
   */
  const undoneChecks = PREP_CHECKS.filter((k) => !s.checklist[k]);
  const unsetConsents = SESSION_CONSENTS.filter(
    (k) => (s.elder.consents[k] ?? 'unset') === 'unset',
  );
  const remaining = undoneChecks.length + unsetConsents.length;

  const confirmAll = () => {
    for (const k of undoneChecks) toggleChecklist(k);
    for (const k of unsetConsents) setConsent(k, true);
  };

  /*
   * 아직 여쭙지 못한 동의도 '남은 일'이다.
   *
   * 회기는 어르신마다 동의 unset 으로 시작한다. 그 상태로 인터뷰까지 가면
   * 녹음·전사·사실 추출·가사·곡 생성이 차례로 막히고, 6단계에서는 나갈 길이
   * 아예 없다. 마주 앉기 전에 여쭤야 할 일이라 준비물과 같은 자리에서 세고,
   * 같은 숫자로 보여 준다.
   */
  const unasked = SESSION_CONSENTS.filter(
    (kind) => (s.elder.consents[kind] ?? 'unset') === 'unset',
  ).length;
  const pending =
    PREP_CHECKS.filter((key) => !s.checklist[key]).length + unasked;

  return (
    <Screen
      title="회기 시작 체크리스트"
      subtitle="오늘 진행 전에 함께 확인해요"
      decoration={<Ornaments variant="leafRight" />}
      footer={
        <PrimaryButton
          href="/session/cards"
          onClick={() => {
            /*
             * 인터뷰를 시작한 시각을 여기서 찍는다.
             *
             * 예전에는 이 자리에서 remoteStartedAt 을 채우려 했다. 그런데 그
             * 값은 어르신을 고르는 순간에 이미 찍힌다(store.beginSession) —
             * 조건이 한 번도 참이 된 적이 없었고, 활동일지의 '진행 시간'은
             * 결국 어르신 목록에서 이름을 누른 시각부터 재고 있었다. 목록을
             * 띄워 놓고 점심을 먹고 오면 그 시간이 전부 들어간다. 그렇게 하지도
             * 않은 86분이 기관 제출용 CSV·인쇄본에 찍혔다.
             *
             * 그래서 진행 시간의 기준점은 따로 둔다. 준비를 마치고 어르신과
             * 마주 앉는 이 순간이다. 이미 찍혀 있으면 덮지 않는다 —
             * 체크리스트로 되돌아왔다고 해서 회기가 다시 시작되는 것은 아니다.
             */
            if (!s.interviewStartedAt) {
              set('interviewStartedAt', new Date().toISOString());
            }
          }}
        >
          인터뷰 시작 {pending > 0 ? `(${pending}건 남음)` : ''}
        </PrimaryButton>
      }
    >
      <Card className="flex items-center gap-4 p-4">
        {/* 등록 화면에서 고른 아바타를 쓴다. 이름은 김○○ 어르신인데 그림은
            늘 할머니였다 — 어르신을 눈으로 확인하는 자리에서 그림이 다른 분을
            가리키면 화면을 믿을 수 없게 된다. */}
        <Art name={s.elder.avatar as ArtKey} size={104} alt="" className="shrink-0" />
        <div className="min-w-0">
          <p className="text-[1.625rem] font-extrabold leading-tight text-ink-900">
            {s.elder.honorific}
          </p>
          {/* 라벨만 있고 값이 없는 칸이었다. 기관 회기는 주제 없이 시작하는
              것이 정상이라(lib/useElders.ts) 빈 자리가 뜨는데, 그러면 값을
              불러오지 못한 것처럼 보인다. 비었다고 말하고, 어디서 정해지는
              값인지는 카드 아래에 적는다. */}
          <p className="mt-2.5 flex items-center gap-2 border-b border-hairline pb-2 text-[0.9375rem]">
            <IconChat size={19} className="shrink-0 text-brand-600" />
            <span className="flex-1 text-ink-500">오늘의 주제</span>
            {s.topic ? (
              <span className="font-extrabold text-brand-700">{s.topic}</span>
            ) : (
              <span className="font-bold text-ink-500">아직 없어요</span>
            )}
          </p>
          {/* 예약 시각을 아는 값이 세션에 없어서 '오전 10:00'이 박혀 있었다.
              지어낸 시각 대신 실제로 아는 것만 적는다.

              한동안은 remoteStartedAt 을 '시작 시각'이라 적었는데, 그건 어르신
              목록에서 이름을 누른 시각이다. 인터뷰를 시작하지도 않았는데 시작
              시각이 이미 적혀 있으니, 아래 버튼을 누르기 전에 화면이 먼저
              시작했다고 말하는 셈이었다. 라벨과 값을 같은 것으로 맞춘다 —
              여기 뜨는 시각이 활동일지의 진행 시간을 재는 기준점 그대로다. */}
          <p className="mt-2 flex items-center gap-2 text-[0.9375rem]">
            <IconClock size={19} className="shrink-0 text-brand-600" />
            <span className="flex-1 text-ink-500">인터뷰 시작</span>
            {s.interviewStartedAt ? (
              <span className="font-extrabold text-brand-700">
                {clockLabel(s.interviewStartedAt)}
              </span>
            ) : (
              <span className="font-bold text-ink-500">아직 시작 전</span>
            )}
          </p>
        </div>
      </Card>

      {/* 주제를 고치는 화면은 앱 안에 없다. 비었을 때 "어디서 정하느냐"는
          물음에 답할 곳이 여기뿐이라, 기억 카드 화면과 같은 말로 적는다
          (app/session/cards/page.tsx — 고른 카드가 오늘의 질문이 된다). */}
      {s.topic ? null : (
        <p className="mt-3 rounded-[12px] bg-surface-sunk px-3.5 py-2.5 text-[0.8125rem] leading-relaxed text-ink-700">
          주제는 <strong>어르신 고르기</strong>에서 회기를 시작할 때 어르신 기록에서
          따라와요. 기관 어르신 기록에는 주제 칸이 없어 대개 비어 있고, 그럴 때는
          다음 화면에서 고르는 <strong>기억 카드</strong>가 오늘의 질문이 됩니다.
        </p>
      )}

      {/*
        한 번에 끝내는 버튼.

        복지사가 어르신과 마주 앉아 하나씩 누르는 것이 현장에서 너무 길다고
        해서 만들었다. 누르면 아직 답하지 않은 것들이 한꺼번에 '확인·동의'로
        들어간다.

        묶음 동의를 금지한 규칙(원칙 4 · F-SW-CONS-009)과 이 버튼이 어떻게
        같이 서는지 적어 둔다. 대신 눌러 주는 범위가 좁아서다.

        - 동의는 이 회기에 필요한 둘뿐이다(SESSION_CONSENTS — 녹음·외부 AI
          전송). 없으면 마이크가 열리지 않고 말씀이 글이 되지 않는, 마주 앉기
          전에 답이 필요한 것들이다.
        - 결과물 셋(시설 재생·가족 공유·홍보 공개)은 들어오지 않는다. 노래를
          들어 보고 정하시는 값이라 회기 마무리에서 따로 여쭙고, 그중 홍보
          공개는 필수화 자체가 막혀 있다(lib/center.ts · canRequireConsent).
        - 이미 '동의 안 하셨어요'를 받은 항목은 건드리지 않는다. 대상은 unset,
          곧 아직 여쭙지 못한 것뿐이다 — 대신 답하는 것과 뜻을 바꾸는 것은
          다르다.
        - 누른 뒤에도 항목마다 따로 바꿀 수 있고, 바꾼 것이 최종 기록이 된다.

        그래도 이 한 번이 어르신의 동의 기록이 된다. 누르는 사람이 무엇을 대신
        답하는지 알아야 해서 버튼에 그대로 적는다 — 몇 건인지, 그리고 여쭙고
        나서 누르라는 말.

        범위를 넓히려면 이 목록부터 다시 읽어야 한다. 결과물 동의가 여기 들어
        오는 순간 위 근거는 전부 무너진다.
      */}
      {(remaining > 0) ? (
        <button
          type="button"
          onClick={confirmAll}
          className="mt-4 flex min-h-[64px] w-full flex-col items-center justify-center rounded-[18px] bg-brand-700 px-4 text-white"
        >
          <span className="text-[1.125rem] font-extrabold">
            모두 확인했어요 ({remaining}건)
          </span>
          <span className="mt-0.5 text-[0.8125rem] font-semibold text-white/90">
            어르신께 여쭙고 동의를 받으신 경우에만 눌러 주세요
          </span>
        </button>
      ) : null}

      <ul className="mt-4 space-y-3">
        {PREP_CHECKS.map((key) => {
          const it = ITEMS[key];
          const done = !!s.checklist[key];
          return (
            <li key={key}>
              <button
                type="button"
                role="switch"
                aria-checked={done}
                onClick={() => void onCheck(key)}
                disabled={micBusy && key === 'mic'}
                aria-busy={micBusy && key === 'mic' ? true : undefined}
                className="flex min-h-[80px] w-full items-center gap-4 rounded-[20px] bg-surface px-4 text-left shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
              >
                <IconCircle tone={done ? 'leaf' : it.tone} size={54}>
                  {done ? (
                    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-leaf-600" aria-hidden="true">
                      <path d="m5 13 4.5 4.5L19 7" />
                    </svg>
                  ) : (
                    <it.Icon size={24} className="text-amber-700" />
                  )}
                </IconCircle>
                <span className="flex-1 text-[1.1875rem] font-extrabold text-ink-900">
                  {it.label}
                </span>
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[2.5px] ${
                    done ? 'border-leaf-600 text-leaf-600' : 'border-brand-500'
                  }`}
                >
                  {done ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m5 13 4.5 4.5L19 7" />
                    </svg>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* 못 연 이유는 그 자리에서 말한다. 낭독으로 듣는 사람에게도 닿아야 해서
          alert 로 둔다 — 체크가 안 된 채로 조용히 넘어가면, 복지사는 어르신
          앞에서야 마이크가 안 된다는 것을 알게 된다. */}
      {micNote ? (
        <p
          role="alert"
          className="mt-3 rounded-[14px] bg-surface-sunk px-3.5 py-3 text-[1rem] font-bold leading-relaxed text-ink-900"
        >
          {micNote}
        </p>
      ) : null}

      {/*
        동의를 여쭙는 자리.

        예전에는 이 앱에서 동의를 켤 수 있는 곳이 「더보기」 설정의 스위치
        다섯 개뿐이었다. 정작 동의가 필요한 회기 화면들은 "동의가 없어 하지
        않아요"라고만 하고 그 스위치를 가리키지 않았다. 동의를 받는 자리는
        어르신과 마주 앉기 직전인 여기가 맞다 — 화면 이름이 이미 '회기 시작
        체크리스트'이고, 흐름표(lib/flow.ts)도 1단계를 '동의와 장비를
        점검해요'라고 적어 두었다.

        다섯 가지를 한 번에 받는 버튼은 없다. 쓰임이 서로 달라서, 한 번에
        받으면 어르신은 무엇에 동의했는지 알 수 없다 (원칙 4 · F-SW-CONS-009).
        위 '모두 확인했어요'가 대신 누르는 것은 이 회기에 필요한 둘뿐이고,
        왜 그것만은 묶어도 되는지는 그 버튼 자리에 적어 두었다.
      */}
      <h2 className="mt-6 flex items-center gap-2 text-[1.1875rem] font-extrabold text-ink-900">
        <IconShield size={22} className="text-leaf-600" />
        동의 확인
        <span className="ml-auto rounded-full bg-surface-sunk px-3 py-1 text-[0.875rem] font-bold text-ink-700">
          {SESSION_CONSENTS.length - unasked} / {SESSION_CONSENTS.length} 여쭘
        </span>
      </h2>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-500">
        {s.elder.honorific}께 목적마다 따로 여쭙고, 그대로 기록해요. 하나를
        거절하셔도 회기는 계속할 수 있어요.
      </p>
      <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-500">
        {/* 어디에 남는지까지 말해야 어르신께 설명할 수 있다. 서버에 남기지
            못하는 상태를 남는 것처럼 적지 않는다.

            "표시가 되돌아가면 기록에 남기지 못한 것"이라고 단언하던 자리다.
            절반만 맞는 말이었다 — 되돌아가는 것은 허용뿐이고, 동의 안 하심·
            철회는 기록에 실패해도 표시가 그대로다. 그래서 못 남긴 철회를
            남긴 것으로 읽게 만들었다. 두 갈래를 갈라서 적는다. */}
        {s.remoteParticipantId
          ? '받은 동의는 이 어르신 기록에도 남기고, 「더보기」에서 언제든 거두실 수 있어요. 기록에 남기지 못하면 — 허용은 표시가 되돌아가고, 동의 안 하심은 이 기기에 남긴 뒤 아래에 적어 둡니다.'
          : '아직 기관 계정으로 고른 어르신이 아니라, 이 동의는 이 기기에만 남아요.'}
      </p>

      {/* 나머지는 언제 여쭙는지 여기서 밝힌다. 말없이 사라지면 복지사는
          동의를 빠뜨린 줄 안다. */}
      <p className="mt-2 rounded-[12px] bg-surface-sunk px-3.5 py-2.5 text-[0.8125rem] font-semibold leading-relaxed text-ink-700">
        나머지 {RESULT_CONSENTS.length}가지(시설 재생·가족 공유·홍보 공개)는
        노래가 나온 뒤 <strong>회기 마무리</strong>에서 여쭤요. 무엇에 동의하시는지
        들어 보고 정하시는 편이 맞아서요.
      </p>

      <ul className="mt-3 space-y-3">
        {SESSION_CONSENTS.map((kind) => (
          <ConsentAsk
            key={kind}
            kind={kind}
            state={s.elder.consents[kind] ?? 'unset'}
            onDecide={(granted) => setConsent(kind, granted)}
          />
        ))}
      </ul>

      {/* 마주 앉기 전에 보여야 하는 목록이다. 지난 회기에 못 남긴 철회가 남아
          있으면 오늘 그 항목을 다시 여쭙기 전에 알아야 한다. */}
      <UnrecordedConsents />

      <div className="mt-4">
        <NoteBar tone="amber" icon={<IconInfo size={20} />}>
          준비가 끝나면
          <br />
          바로 인터뷰를 시작할 수 있어요
        </NoteBar>
      </div>
    </Screen>
  );
}
