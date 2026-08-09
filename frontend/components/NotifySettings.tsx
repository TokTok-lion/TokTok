'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, NoteBar } from './ui';
import {
  NOTIFY_LABELS,
  clearScheduled,
  scheduleAt,
  showNotification,
  useNotify,
  type NotifyKind,
} from '@/lib/notify';
import { flowState } from '@/lib/flow';
import { useSession } from '@/lib/store';

/*
 * 실제로 걸 수 있는 알림만 스위치로 둔다.
 *
 * 예전에는 세 개였다. 그중 '회기 시작 전'은 SEED_SCHEDULE — 시연용 예시
 * 일정 세 건 — 을 근거로 예약했다. /sessions 는 기관 계정에서 그 세 건을
 * 아예 감췄는데(등록한 적 없는 어르신의 일정이라) 알림만 그대로 남아,
 * 어르신이 0명인 기관의 태블릿이 "30분 뒤 김○○ 어르신"을 띄우고 화면에는
 * '오늘 3건'이라고 적혀 있었다. 일정을 넣는 기능이 생기기 전까지 이 알림은
 * 걸 시각 자체를 모른다.
 *
 * '동의 만료 임박'도 같은 처지다. 서버에서 만료일을 읽는 기능이 아직 없어서
 * (lib/useElders.ts 의 toSummary 가 consentExpiresInDays 를 null 로 둔다)
 * 예약하는 코드가 처음부터 없었고, 스위치만 켜지는 장식이었다.
 *
 * 둘 다 화면에서 뺐다. 대신 아래에 무엇이 없어서 못 하는지와, 그 정보를
 * 지금 어디서 볼 수 있는지를 같이 적는다 — 스위치만 지우면 찾던 사람이
 * 막다른 길에 선다.
 */
const ORDER: NotifyKind[] = ['logPending'];

/** 일지가 남았을 때 다시 알리기까지의 간격. */
const REMIND_AFTER_MIN = 30;

/**
 * 알림 설정 (더보기 안).
 *
 * 권한을 먼저 묻지 않는다. 화면에 들어오자마자 브라우저 권한 창을 띄우면
 * 대부분 반사적으로 "차단"을 누르고, 한 번 차단되면 앱에서는 되돌릴 방법이
 * 없다. 그래서 무엇을 위한 알림인지 먼저 보여주고 버튼을 누를 때만 묻는다.
 */
export function NotifySettings() {
  const { permission, prefs, request, setPref } = useNotify();
  const { s } = useSession();
  const [tested, setTested] = useState<'idle' | 'sent' | 'failed'>('idle');

  /*
   * "회기가 끝났는데 일지가 안 남았다"를 이 회기의 실제 진행에서 판정한다.
   *
   * 흐름의 첫 미완료 단계가 마무리(9단계)라는 것은 앞의 여덟 단계가 다
   * 끝났다는 뜻이고, 마무리 단계의 완료 조건이 곧 일지 저장이다. 예시
   * 일정의 마지막 시각(16:30) 대신 이 값을 본다 — 씨앗과 달리 어느
   * 태블릿에서든 참이다.
   */
  const flow = flowState(s);
  const logPending = !s.logSaved && flow.next.id === 'wrap';

  // 예약 여부는 아래 이펙트와 화면 문구가 같이 쓴다. 따로 state 에 담아 두면
  // 둘이 어긋나므로 렌더에서 한 번만 계산한다 — 화면이 "예약됐어요"라고
  // 적는 조건과 실제로 거는 조건은 같은 식이어야 한다.
  const scheduled = permission === 'granted' && prefs.logPending && logPending;

  useEffect(() => {
    // 조건이 풀리면 예약도 거둔다. 일지를 저장한 뒤에 "아직 저장되지
    // 않았어요"가 뜨면 그건 알림이 아니라 거짓말이다.
    if (!scheduled) {
      clearScheduled();
      return;
    }

    // 회기가 끝난 시각은 앱이 알 수 없다(끝났다고 누르는 자리가 없다).
    // 그래서 '언제부터 30분'이 아니라 '지금부터 30분 뒤에 한 번'이다.
    scheduleAt(
      'log-pending',
      new Date(Date.now() + REMIND_AFTER_MIN * 60_000),
      '활동일지가 아직 저장되지 않았어요',
      s.topic && s.topic !== '—'
        ? `${s.topic} 회기 기록을 마무리해 주세요`
        : '오늘 회기 기록을 마무리해 주세요',
      '/session/log',
    );
  }, [scheduled, s.topic]);

  const test = async () => {
    const ok = await showNotification(
      '똑똑 알림 테스트',
      '이렇게 보이면 알림이 잘 켜진 거예요.',
      { tag: 'test', url: '/more' },
    );
    setTested(ok ? 'sent' : 'failed');
  };

  return (
    <>
      <h2 className="mt-6 text-[1.1875rem] font-extrabold text-ink-900">알림</h2>

      {permission === 'unsupported' ? (
        <Card className="mt-3 p-4">
          <p className="text-[0.9375rem] leading-relaxed text-ink-700">
            이 브라우저는 알림을 지원하지 않아요. 크롬이나 사파리로 열면 쓸 수
            있습니다.
          </p>
        </Card>
      ) : permission === 'denied' ? (
        <Card className="mt-3 p-4">
          <p className="text-[0.9375rem] leading-relaxed text-ink-700">
            알림이 <strong>차단</strong>되어 있어요. 앱에서는 다시 켤 수 없어서,
            브라우저 주소창 왼쪽 자물쇠 → 알림 → 허용으로 바꿔 주세요.
          </p>
        </Card>
      ) : permission === 'default' ? (
        <Card className="mt-3 p-4">
          {/* 켜기 전에 무엇이 오는지 정확히 적는다. '회기 시작 전'까지
              적어 두었더니, 켠 사람은 오지 않는 알림을 기다리게 됐다. */}
          <p className="text-[0.9375rem] leading-relaxed text-ink-700">
            회기가 끝났는데 활동일지가 저장되지 않았을 때 이 기기로 알려드릴 수
            있어요.
          </p>
          <button
            type="button"
            onClick={() => void request()}
            className="tk-cta mt-3.5 flex min-h-[56px] w-full items-center justify-center rounded-[14px] text-[1.0625rem] font-extrabold text-white"
          >
            알림 켜기
          </button>
        </Card>
      ) : (
        <>
          <ul className="mt-3 space-y-3">
            {ORDER.map((kind) => (
              <li key={kind}>
                <Card className="flex items-center gap-3 p-4">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[1.0625rem] font-extrabold text-ink-900">
                      {NOTIFY_LABELS[kind].title}
                    </span>
                    <span className="block text-[0.875rem] leading-relaxed text-ink-500">
                      {NOTIFY_LABELS[kind].desc}
                    </span>
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={prefs[kind]}
                    aria-label={NOTIFY_LABELS[kind].title}
                    onClick={() => setPref(kind, !prefs[kind])}
                    className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
                      prefs[kind] ? 'bg-leaf-600' : 'bg-track'
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
                        prefs[kind] ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </Card>
              </li>
            ))}
          </ul>

          <div className="mt-3">
            <button
              type="button"
              onClick={() => void test()}
              className="min-h-[52px] w-full rounded-[14px] border border-hairline bg-surface text-[1rem] font-bold text-ink-700"
            >
              {tested === 'sent'
                ? '보냈어요 — 알림이 떴는지 확인해 보세요'
                : tested === 'failed'
                  ? '보내지 못했어요'
                  : '테스트 알림 보내기'}
            </button>
          </div>

          {/* 몇 건이라고 적기 전에, 그 건수가 실제 예약과 같은지 한 군데서만
              계산한다. 예전에는 예시 일정의 개수를 세어 '오늘 3건'이라고
              적었다 — 예약된 것도 올 것도 없는 3건이었다. */}
          <p className="mt-2 text-center text-[0.875rem] text-ink-500">
            {scheduled
              ? `활동일지 알림 1건이 ${REMIND_AFTER_MIN}분 뒤로 예약돼 있어요`
              : '지금 예약된 알림은 없어요'}
          </p>
        </>
      )}

      {permission !== 'unsupported' ? (
        <Card className="mt-3 p-4">
          <p className="text-[1rem] font-bold text-ink-700">
            아직 못 보내는 알림도 있어요
          </p>
          <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-500">
            <strong>회기 시작 전 알림</strong>은 일정을 넣는 기능이 생겨야 켤 수
            있어요. 알릴 시각을 알 방법이 아직 없습니다. 오늘 회기가 어디까지
            왔는지는{' '}
            <Link
              href="/sessions"
              className="font-bold text-leaf-700 underline underline-offset-2"
            >
              회기 일정
            </Link>
            에서 볼 수 있어요.
          </p>
          <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-500">
            <strong>동의 만료 임박 알림</strong>은 만료일을 서버에서 읽는 기능이
            준비 중이에요. 그때까지는 이 화면 위쪽 <strong>동의 관리</strong>에서
            직접 확인해 주세요.
          </p>
        </Card>
      ) : null}

      {permission === 'granted' || permission === 'default' ? (
        <div className="mt-3">
          {/* 못 하는 것을 적어 둔다. 오지 않는 알림을 믿게 만드는 것이
              알림이 없는 것보다 나쁘다. */}
          <NoteBar>
            알림은 앱이 켜져 있거나 홈 화면에 설치돼 있을 때 잘 도착해요. 브라우저를
            완전히 닫으면 오지 않을 수 있습니다.
          </NoteBar>
        </div>
      ) : null}
    </>
  );
}
