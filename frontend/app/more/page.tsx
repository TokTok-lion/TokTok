'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Art } from '@/components/Art';
import {
  CONSENT_ORDER,
  CONSENT_PURPOSE,
  CONSENT_SCREEN,
  consentStateLabel,
} from '@/components/ConsentGate';
import { Ornaments, Screen } from '@/components/Shell';
import { Card, Chevron, IconCircle, NoteBar, OutlineButton } from '@/components/ui';
import { IconInfo, IconShield } from '@/components/icons';
import { CONSENT_FALLBACK, CONSENT_LABELS, DEFAULT_CONSENTS } from '@/lib/domain';
import { useSession } from '@/lib/store';
import { forgetRecording } from '@/lib/recorder';
import { deleteSong } from '@/lib/songStore';
import { useAccount } from '@/lib/auth';
import { NotifySettings } from '@/components/NotifySettings';
import { StoredAudio } from '@/components/StoredAudio';

/**
 * 더보기 — 동의 관리 · 글자 크기 · 데이터.
 *
 * 동의 관리 is P0 in the spec (SW-CONS) but has no frame in the deck, so it
 * lives here: five independent switches, each with the alternative path that
 * applies when it is refused (F-SW-CONS-009). Nothing is bundled.
 *
 * 처음 여쭙는 자리는 여기가 아니라 회기 준비 화면(CONSENT_SCREEN)이다. 이
 * 화면은 이미 받은 동의를 바꾸거나 거두는 자리다 — 목적·순서·문구는
 * components/ConsentGate 에서 함께 가져와 두 화면이 갈라지지 않게 한다.
 */
export default function MorePage() {
  const { s, setConsent, set, reset } = useSession();
  const { account } = useAccount();
  const [confirmReset, setConfirmReset] = useState(false);
  /** 지우고 난 뒤 어디로 가면 되는지 알려주기 위한 표시 */
  const [cleared, setCleared] = useState(false);

  /**
   * 이 기기의 기록 지우기.
   *
   * reset() 하나로는 두 군데가 빈다.
   *
   * 첫째, 녹음과 노래 파일은 저장소가 따로다(IndexedDB). 부르지 않으면 앞
   * 어르신 목소리가 기기에 그대로 남는다 — 지웠다고 말한 뒤에 남아 있는 것이
   * 가장 나쁘다.
   *
   * 둘째, reset() 은 시연용 씨앗을 도로 채운다. 시연 기기에서는 그게 맞지만
   * 기관 계정에서는 아니다. 지어낸 김○○ 어르신의 전사·이야기·가사가
   * 실제 센터의 태블릿에 되살아나고, 더 나쁘게는 그분의 동의 네 개가 '허용'
   * 으로 켜진다. 아무도 한 적 없는 동의가 켜지는 순간 원음성 전송의 문이
   * 열린다 — 지난 회차에 어렵게 막은 바로 그 구멍이다.
   */
  const wipe = () => {
    reset();
    void forgetRecording();
    void deleteSong();

    if (account.status === 'in') {
      // 씨앗 대신 빈자리를 둔다. 다음 회기는 어르신 목록에서 고르는 것으로
      // 시작하고, 그때 beginSession 이 서버에서 이 분의 동의를 다시 읽어 온다.
      set('elder', {
        id: '',
        displayName: '미선택',
        honorific: '어르신을 고르지 않았어요',
        // 얼굴 그림을 두면 없는 분이 있는 것처럼 보인다.
        avatar: 'icon_people_green',
        stage: 0,
        nextTopic: '',
        communication: [],
        musicPreferences: [],
        avoidTopics: [],
        consents: DEFAULT_CONSENTS,
      });
      // 아래는 씨앗이 채워 넣는 시연 내용이다. beginSession 의 실제 회기
      // 분기와 같은 것들을 비운다.
      set('topic', '');
      set('memoryCard', null);
      set('checklist', {});
      set('transcript', []);
      set('story', []);
      set('lyrics', []);
      set('reactions', []);
      set('reactionNote', '');
      set('logDraft', '');
      set('wrapNote', '');
      set('nextTopic', '');
      set('familyStories', []);
      set('familyReplies', []);
    }

    setConfirmReset(false);
    setCleared(true);
  };

  return (
    <Screen
      root
      title="더보기"
      subtitle="동의와 사용 환경을 관리해요"
      decoration={<Ornaments variant="leafRight" />}
    >
      <h2 className="flex items-center gap-2 text-[1.1875rem] font-extrabold text-ink-900">
        <IconShield size={22} className="text-leaf-600" />
        동의 관리
      </h2>
      {/*
        이 스위치는 기기 설정이 아니라 사람의 동의다.

        생김새가 글자 크기·알림 설정과 똑같아서 "이 태블릿의 설정"으로 읽혔다.
        실제로는 지금 선택된 어르신 한 분의 동의이고, 어르신을 바꾸면 그분의
        동의가 여기에 뜬다. 누구의 무엇을 켜고 끄는지 화면에 적어 둔다.
      */}
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-500">
        지금 보시는 것은 <strong className="text-ink-900">{s.elder.honorific}</strong>
        의 동의예요. 기기 설정이 아니라 이 어르신께 받은 동의라, 어르신을 바꾸면
        그분의 동의가 나옵니다. 목적마다 따로 선택할 수 있고, 하나를 거부해도
        서비스는 계속 쓸 수 있어요.
      </p>
      <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-500">
        {s.remoteParticipantId
          ? '여기서 바꾼 내용은 이 어르신 기록에 남아요.'
          : '아직 기관 계정으로 고른 어르신이 아니라, 바꾼 내용은 이 기기에만 남아요.'}{' '}
        <Link href={CONSENT_SCREEN} className="font-bold text-brand-700 underline">
          회기 준비
        </Link>
        에서 처음 여쭙고, 여기서는 언제든 거두실 수 있어요.
      </p>

      <ul className="mt-3 space-y-3">
        {CONSENT_ORDER.map((kind) => {
          const state = s.elder.consents[kind] ?? 'unset';
          const granted = state === 'granted';
          return (
            <Card as="li" key={kind} className="p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[1.125rem] font-extrabold text-ink-900">
                    {CONSENT_LABELS[kind]}
                  </p>
                  <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-500">
                    {CONSENT_PURPOSE[kind]}
                  </p>
                  {/* 꺼진 스위치 하나로는 '아직 안 여쭤봄'과 '거절하심'이
                      구분되지 않는다. 복지사가 할 일이 남았는지 아닌지가
                      달라지므로 글자로 적는다. */}
                  <p
                    className={`mt-1.5 text-[0.875rem] font-bold ${
                      granted ? 'text-leaf-700' : 'text-brand-700'
                    }`}
                  >
                    {consentStateLabel(state)}
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={granted}
                  aria-label={`${s.elder.honorific}의 ${CONSENT_LABELS[kind]} 동의`}
                  onClick={() => setConsent(kind, !granted)}
                  className={`relative h-[38px] w-[68px] shrink-0 rounded-full transition-colors ${
                    granted ? 'bg-leaf-600' : 'bg-ink-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 h-[30px] w-[30px] rounded-full bg-white transition-[left] ${
                      granted ? 'left-[34px]' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {!granted ? (
                <p className="mt-3 rounded-[12px] bg-brand-50 px-3.5 py-2.5 text-[0.875rem] font-semibold leading-relaxed text-brand-800">
                  대신 이렇게 할 수 있어요 · {CONSENT_FALLBACK[kind]}
                </p>
              ) : null}
            </Card>
          );
        })}
      </ul>

      <h2 className="mt-6 text-[1.1875rem] font-extrabold text-ink-900">글자 크기</h2>
      <Card className="mt-3 flex items-center gap-3 p-4">
        <Art name="icon_text_size" size={48} alt="" />
        <div className="flex flex-1 gap-2" role="group" aria-label="글자 크기 선택">
          {[
            { v: 1, label: '보통' },
            { v: 1.15, label: '크게' },
            { v: 1.3, label: '아주 크게' },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              aria-pressed={s.textScale === o.v}
              onClick={() => set('textScale', o.v)}
              className={`min-h-[52px] flex-1 rounded-[14px] text-[1rem] font-bold ${
                s.textScale === o.v
                  ? 'bg-leaf-600 text-white'
                  : 'bg-leaf-100 text-leaf-700'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </Card>

      {/* 음성이 어디에 얼마나 남아 있는지 보이고, 한 번에 지울 수 있어야 한다 */}
      <StoredAudio />

      <NotifySettings />

      <h2 className="mt-6 text-[1.1875rem] font-extrabold text-ink-900">안내</h2>
      <ul className="mt-3 space-y-3">
        {/* 서버를 안 쓰는 배포에서는 로그인 자체가 의미 없으므로 감춘다 */}
        {account.status !== 'local' ? (
          <li>
            <Link
              href="/login"
              className="flex min-h-[72px] items-center gap-3.5 rounded-[20px] bg-surface px-4 shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
            >
              <IconCircle tone="leaf" size={46}>
                <IconShield size={23} className="text-leaf-700" />
              </IconCircle>
              <span className="min-w-0 flex-1">
                <span className="block text-[1.125rem] font-extrabold text-ink-900">
                  {account.status === 'in' ? '기관 계정' : '기관 로그인'}
                </span>
                <span className="block text-[0.875rem] text-ink-500">
                  {account.status === 'in'
                    ? `${account.tenantName} · 기록이 기관에도 저장돼요`
                    : '로그인하면 기록이 기관에도 저장돼요'}
                </span>
              </span>
              <Chevron />
            </Link>
          </li>
        ) : null}
        <li>
          <Link
            href="/guide"
            className="flex min-h-[72px] items-center gap-3.5 rounded-[20px] bg-surface px-4 shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
          >
            <IconCircle tone="amber" size={46}>
              <IconInfo size={23} className="text-amber-700" />
            </IconCircle>
            <span className="flex-1 text-[1.125rem] font-extrabold text-ink-900">
              이용 안내 · 자주 묻는 질문
            </span>
            <Chevron />
          </Link>
        </li>
        <li>
          <Link
            href="/elder"
            className="flex min-h-[72px] items-center gap-3.5 rounded-[20px] bg-surface px-4 shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
          >
            <Art name="avatar_grandfather" size={46} alt="" className="shrink-0" />
            <span className="flex-1 text-[1.125rem] font-extrabold text-ink-900">
              어르신 프로필
            </span>
            <Chevron />
          </Link>
        </li>
        <li>
          <Link
            href="/center"
            className="flex min-h-[72px] items-center gap-3.5 rounded-[20px] bg-surface px-4 shadow-[0_2px_10px_rgba(122,84,46,0.06)]"
          >
            <IconCircle tone="brand" size={46}>
              <IconShield size={23} className="text-brand-700" />
            </IconCircle>
            <span className="flex-1">
              <span className="block text-[1.125rem] font-extrabold text-ink-900">
                센터장 콘솔
              </span>
              <span className="block text-[0.875rem] text-ink-500">
                직원·정책·요금·삭제 승인 (센터장 권한)
              </span>
            </span>
            <Chevron />
          </Link>
        </li>
      </ul>

      <h2 className="mt-6 text-[1.1875rem] font-extrabold text-ink-900">데이터</h2>
      <div className="mt-3">
        {/* 기관 계정으로 쓰는 태블릿에서는 "이 기기에만 저장돼요"가 사실이
            아니다. 회기와 동의는 기관 서버에도 남는다. */}
        <NoteBar tone="leaf" icon={<IconShield size={20} />}>
          {account.status === 'in'
            ? `회기 기록은 이 기기와 ${account.tenantName} 기록에 함께 남아요. 아래 버튼은 이 기기 것만 지웁니다.`
            : '모든 기록은 이 기기에만 저장돼요. 공용 태블릿이라면 회기가 끝난 뒤 지워 주세요.'}
        </NoteBar>
      </div>

      <div className="mt-3">
        {confirmReset ? (
          <div className="rounded-[16px] bg-brand-50 p-4">
            <p className="text-[1rem] font-bold text-ink-900">
              이 기기의 회기 기록을 모두 지울까요?
            </p>

            {/* 무엇이 지워지고 무엇이 남는지 적지 않으면 지운 사람도 모른다.
                특히 기관 서버 기록은 이 버튼으로 지워지지 않는다. */}
            <p className="mt-2.5 text-[0.875rem] font-extrabold text-ink-900">
              지워지는 것
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-[0.875rem] leading-relaxed text-ink-700">
              <li>이 기기에 저장된 녹음과 노래 파일</li>
              <li>이 회기의 전사·이야기·가사·반응·활동일지 초안</li>
              <li>화면에 보이던 동의 표시 (이 기기의 사본)</li>
              <li>글자 크기 — 다시 &lsquo;보통&rsquo;으로 돌아가요</li>
            </ul>

            <p className="mt-2.5 text-[0.875rem] font-extrabold text-ink-900">
              남는 것
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-[0.875rem] leading-relaxed text-ink-700">
              {account.status === 'in' ? (
                <>
                  <li>
                    {account.tenantName}에 저장된 회기·동의 기록 — 이 버튼은
                    기관 기록을 건드리지 않아요
                  </li>
                  <li>기관 로그인 상태</li>
                  <li>
                    지운 뒤에는 고른 어르신이 없는 상태가 돼요. 어르신 목록에서
                    다시 골라 주세요.
                  </li>
                </>
              ) : (
                <li>
                  이 기기는 기관 계정이 아니라, 지우면 시연용 예시 기록(김○○
                  어르신)이 다시 채워져요.
                </li>
              )}
            </ul>

            <p className="mt-2.5 text-[0.875rem] font-bold text-ink-900">
              되돌릴 수 없어요.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="min-h-[52px] rounded-[14px] border-2 border-hairline bg-surface-strong text-[1.0625rem] font-bold text-ink-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={wipe}
                className="min-h-[52px] rounded-[14px] bg-danger-600 text-[1.0625rem] font-bold text-white"
              >
                모두 지우기
              </button>
            </div>
          </div>
        ) : (
          <OutlineButton onClick={() => setConfirmReset(true)}>
            이 기기의 기록 지우기
          </OutlineButton>
        )}
      </div>

      {/* 지운 뒤 빈 화면만 남기지 않는다 — 다음에 무엇을 하면 되는지 적는다 */}
      {cleared ? (
        <div className="mt-3 rounded-[16px] bg-leaf-50 p-4">
          <p className="text-[1rem] font-bold text-leaf-800">
            이 기기의 기록을 지웠어요.
          </p>
          <p className="mt-1 text-[0.875rem] leading-relaxed text-leaf-800">
            {account.status === 'in'
              ? '녹음과 노래 파일도 함께 지웠습니다. 다음 회기는 어르신을 고르는 것부터 시작해요.'
              : '녹음과 노래 파일도 함께 지웠습니다. 시연용 예시 기록이 다시 채워졌어요.'}
          </p>
          <Link
            href="/elder"
            className="mt-3 flex min-h-[52px] w-full items-center justify-center rounded-[14px] border-2 border-leaf-300 bg-surface-strong px-4 text-[1rem] font-bold text-leaf-700"
          >
            어르신 목록으로 가기
          </Link>
        </div>
      ) : null}

      <p className="mt-5 px-1 text-[0.8125rem] leading-relaxed text-ink-500">
        똑똑은 문화·인지 활동 도구예요. 치매·우울을 진단하거나 치료 효과를
        보장하지 않습니다.
      </p>
    </Screen>
  );
}
