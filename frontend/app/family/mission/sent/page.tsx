'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArtBox } from '@/components/Art';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, NoteBar, OutlineButton, PrimaryButton, SectionLabel } from '@/components/ui';
import { IconCopy, IconExport, IconInfo, IconSend, IconShield } from '@/components/icons';
import { FAMILY_MISSION_LABELS } from '@/lib/domain';
import { printLog, todayStamp } from '@/lib/export';
import { useSession } from '@/lib/store';

/* 기기 능력은 바뀌지 않으므로 구독할 것이 없다 — 스냅샷만 읽는다. */
const subscribeNothing = () => () => {};
const shareSupported = () =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function';
const notShareable = () => false;

/**
 * 가족 미션 전달 (deck p.25)
 *
 * 원래 이 화면은 "전송 완료 · 보낸 대상 3명 · 전송 방법 카카오톡 · 응답 마감
 * 이번 주 금요일"이라고 적혀 있었다. 전부 화면에 박아 둔 글자였다. 앞 화면의
 * 「가족에게 보내기」가 하던 일은 set('missionSent', true) 하나뿐이었고(그
 * 버튼은 이제 「전할 내용 만들기」다), 이 저장소에는
 * 카카오톡·문자로 내보내는 코드가 없다 — API 라우트도, 발송 기록을 남기는
 * 곳도 없다. '딸·아들·손녀'도 이 어르신의 가족과 아무 상관 없는 고정 문자열
 * 이었다. 복지사는 연락이 나갔다고 믿고 어르신께 "가족분들께 연락드렸어요"
 * 라고 말하게 되는데, 실제로는 아무 데도 가지 않았고 답장도 영영 오지 않는다.
 *
 * 그래서 없는 기능을 있는 척하지 않고, 지금 정말로 할 수 있는 일만 남겼다:
 * 가족에게 보낼 문구를 세션에 실제로 입력된 값(어르신·미션 종류·미션 내용)
 * 으로 만들어 주고, 복사·공유·인쇄로 복지사가 자기 손으로 전달하게 한다.
 * 발송은 사람이 하고, 앱은 문장을 만들어 드리는 데까지만 책임진다.
 */
export default function MissionSentPage() {
  const { s } = useSession();
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');

  // OS 공유창은 있는 기기에서만 버튼을 띄운다. 데스크톱 브라우저에는 없는
  // 경우가 많은데, 눌러도 아무 일 없는 버튼을 두는 것이 이 화면이 원래
  // 저지른 잘못이다. 서버에는 navigator 가 없으므로 서버 스냅샷은 false 로
  // 두고, 하이드레이션 뒤에 실제 값으로 바뀐다.
  const canShare = useSyncExternalStore(subscribeNothing, shareSupported, notShareable);

  const ask = FAMILY_MISSION_LABELS[s.missionKind];
  const body = s.missionBody.trim();

  /*
   * 가족에게 그대로 보낼 문구. 화면에 보이는 것과 복사되는 것이 같아야
   * 복사가 막힌 기기에서 직접 긁어 복사할 수 있다.
   *
   * 마지막 안내만 매체에 따라 갈라진다. 대화창에 붙여 넣는 글에는 "이 대화로
   * 답장"이 가리킬 곳이 있지만, 인쇄한 종이에는 없다 — 종이를 받은 가족이
   * 화면을 향해 답장할 수는 없다. 종이에는 이 종이를 드린 복지사에게 전해
   * 달라고 적고, 연락처는 앱이 모르므로 손으로 적을 빈칸만 둔다(없는 번호를
   * 지어내느니 비워 두는 편이 낫다 — 인쇄본은 세션 밖으로 나가는 물건이다).
   */
  const compose = (via: 'chat' | 'paper') =>
    [
      `[똑똑 생애여정 음악지도] 가족 참여 요청`,
      ``,
      `${s.elder.honorific}의 이야기로 노래를 만들고 있어요.`,
      `가족분께 이것을 부탁드려요 — ${ask}`,
      ...(body ? [``, body] : []),
      ``,
      via === 'chat'
        ? `사진·글·음성은 이 대화로 답장해 주시면,`
        : `사진·글·음성은 이 종이를 드린 복지사에게 전해 주시면,`,
      `복지사가 어르신과 확인한 뒤 노래에 반영합니다.`,
    ].join('\n');

  const message = compose('chat');
  const printMessage = compose('paper');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied('ok');
    } catch {
      // 복사가 막히는 기기가 있다(권한·구형 웹뷰). 조용히 성공한 척하면
      // 복지사는 붙여넣기가 안 되는 이유를 모른 채 빈 메시지를 보낸다.
      setCopied('fail');
    }
  };

  const share = async () => {
    try {
      await navigator.share({ text: message });
    } catch {
      /* 사용자가 공유 창을 닫은 경우 — 알릴 것이 없다 */
    }
  };

  return (
    <Screen
      title="가족에게 전달하기"
      subtitle="문구는 만들어 드려요. 보내기는 복지사님이 해요"
      decoration={<Ornaments variant="leafRight" />}
      footer={
        <>
          <PrimaryButton onClick={() => void copy()} leading={<IconCopy size={22} />}>
            전할 내용 복사하기
          </PrimaryButton>

          {/*
            복사 결과는 버튼 곁에서 말해야 한다. 예전에는 실패 안내가 본문
            가운데 있었는데 버튼은 고정 푸터라, 실패해도 화면 밖에서 조용히
            떠 있었다 — 복지사는 빈 붙여넣기를 하고 나서야 알았다.

            성공도 알린다. 예전에는 실패에만 role=alert 이 있어서, 화면을 못
            보는 사용자에게는 눌렀는데 아무 일도 안 일어난 것과 같았다.
            live 영역을 빈 채로 미리 붙여 두는 이유는, 나중에 들어온 문장을
            스크린리더가 읽으려면 영역이 먼저 있어야 하기 때문이다.
          */}
          <div aria-live="polite">
            {copied === 'ok' ? (
              <p className="mt-3 rounded-[12px] bg-leaf-50 px-3.5 py-3 text-[0.9375rem] font-bold leading-relaxed text-leaf-800">
                복사했어요. 카카오톡이나 문자에 붙여 넣어 보내 주세요.
              </p>
            ) : null}
          </div>
          <div aria-live="assertive">
            {copied === 'fail' ? (
              <p className="mt-3 rounded-[12px] bg-surface-sunk px-3.5 py-3 text-[0.9375rem] font-bold leading-relaxed text-danger-600">
                이 기기에서는 복사가 막혀 있어요. 위 「가족에게 전할 내용」 칸의
                글을 길게 눌러 직접 복사해 주세요.
              </p>
            ) : null}
          </div>

          <div className="mt-3 text-center">
            <Link
              href="/family/mission"
              className="inline-flex min-h-[44px] items-center text-[1.0625rem] font-bold text-brand-700"
            >
              미션 내용 다시 쓰기
            </Link>
          </div>
        </>
      }
    >
      {/* 이 화면에서 제일 먼저 읽혀야 하는 문장. 어르신께 "연락드렸어요"라고
          말하기 전에 복지사가 알아야 한다. */}
      <NoteBar tone="amber" icon={<IconInfo size={19} />}>
        아직 아무것도 보내지 않았어요. 이 앱에는 카카오톡·문자로 가족에게 직접
        보내는 기능이 없습니다.
      </NoteBar>

      <Card className="mt-4 flex items-center justify-center px-4 py-5">
        <ArtBox
          name="icon_envelope_open"
          alt="아직 부치지 않은 편지 그림"
          className="w-[212px]"
          fit="contain"
          priority
        />
      </Card>

      <SectionLabel className="mt-5">가족에게 전할 내용</SectionLabel>
      <Card className="mt-3 p-4">
        <p className="whitespace-pre-line text-[1.0625rem] leading-relaxed text-ink-900">
          {message}
        </p>
      </Card>

      {body ? null : (
        // 막다른 길로 두지 않는다 — 지금 무엇을 하면 되는지 적는다.
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-500">
          미션 내용을 아직 적지 않으셨어요.{' '}
          <Link href="/family/mission" className="font-bold text-brand-700 underline">
            내용을 적으면
          </Link>{' '}
          가족이 무엇을 하면 되는지 더 분명해져요.
        </p>
      )}

      {/* 복사 성공·실패 안내는 버튼이 있는 고정 푸터로 옮겼다 — 여기 있으면
          누른 사람의 눈이 닿지 않는다. */}

      <SectionLabel className="mt-5">전달하는 방법</SectionLabel>
      <Card className="mt-3 p-4">
        <p className="text-[0.9375rem] leading-relaxed text-ink-500">
          복사한 내용을 복지사님의 카카오톡이나 문자에 붙여 넣어 보내 주세요.
          앱이 대신 보내지 않으므로, 어느 가족에게 갔는지도 복지사님만 알 수
          있어요.
        </p>
        {/* 인쇄본은 위 글과 마지막 줄이 다르다. 인쇄해 놓고 화면과 다른 것을
            나중에 발견하면 잘못 나온 줄 안다 — 먼저 적어 둔다. */}
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-500">
          인쇄본에는 「이 대화로 답장」 대신 「이 종이를 드린 복지사에게 전해
          달라」고 적히고, 연락처를 손으로 적을 빈칸이 함께 나와요.
        </p>
        <div className="mt-3 grid gap-2">
          {canShare ? (
            <OutlineButton
              tone="leaf"
              onClick={() => void share()}
              leading={<IconSend size={20} />}
            >
              공유하기 (카카오톡·문자)
            </OutlineButton>
          ) : null}
          <OutlineButton onClick={printLog} leading={<IconExport size={20} />}>
            인쇄 · PDF로 저장
          </OutlineButton>
        </div>
      </Card>

      {/* 답장이 실제로 기록돼 있을 때만 그 화면으로 보낸다. 비어 있는 화면으로
          보내는 링크는 그 자체가 막다른 길이다. "받은"이라고 쓰지 않는 이유는,
          이 요청으로 도착한 답장이 아니기 때문이다 — 지금 회기에 들어 있는
          기록일 뿐이다. */}
      {s.familyReplies.length > 0 ? (
        <div className="mt-4">
          <OutlineButton href="/family/replies">
            {/* 시연 기기에는 씨앗 답장이 남아 있다. 저쪽 화면이 예시라고
                밝히는 것과 같은 말을 여기서도 해 둔다 — 버튼 글자에서만
                '기록된'이면 누르기 전까지 진짜인 줄 안다. */}
            {s.remoteParticipantId === null ? '예시' : '기록된'} 가족 답장{' '}
            {s.familyReplies.length}건 보기
          </OutlineButton>
        </div>
      ) : null}

      <div className="mt-4">
        <NoteBar tone="brand" icon={<IconShield size={19} />}>
          답장은 앱으로 자동으로 들어오지 않아요. 가족이 보내온 사진·글·음성은
          어르신과 확인한 뒤 복지사님이 「이야기 정리」에 기록해요.
        </NoteBar>
      </div>

      {/* 종이로 들고 나갈 때. 화면에서는 숨어 있다가 인쇄할 때만 보인다
          (globals.css 의 @media print 규칙이 main 의 직계 자식만 본다). */}
      <div data-print className="hidden">
        <h1 style={{ fontSize: '18pt', fontWeight: 800, marginBottom: '4mm' }}>
          가족 참여 요청
        </h1>
        <p style={{ fontSize: '12pt', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
          {printMessage}
        </p>
        {/* 종이에는 앱으로 돌아올 길이 없다. 받는 곳을 손으로 적을 자리를
            남긴다 — 기관 연락처를 세션이 모르므로 지어내지 않는다. */}
        <p style={{ marginTop: '8mm', fontSize: '11pt' }}>
          받는 분(복지사) 연락처: ______________________
        </p>
        <p style={{ marginTop: '6mm', fontSize: '9pt', color: '#555' }}>
          작성일 {todayStamp()} · 똑똑 생애여정 음악지도
        </p>
      </div>
    </Screen>
  );
}
