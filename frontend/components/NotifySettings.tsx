'use client';

import { useEffect, useState } from 'react';
import { Card, NoteBar } from './ui';
import {
  NOTIFY_LABELS,
  scheduleAt,
  showNotification,
  todayAt,
  useNotify,
  type NotifyKind,
} from '@/lib/notify';
import { SEED_SCHEDULE } from '@/lib/seed';
import { useSession } from '@/lib/store';

const ORDER: NotifyKind[] = ['sessionStart', 'logPending', 'consentExpiring'];
const MINUTES_BEFORE = 30;

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

  // 몇 건이 잡히는지는 설정만 보면 정확히 나온다. 예약 결과를 따로 state 에
  // 담아 두면 둘이 어긋날 수 있어서 렌더에서 계산한다.
  const count =
    permission !== 'granted'
      ? 0
      : (prefs.sessionStart ? SEED_SCHEDULE.length : 0) +
        (prefs.logPending && !s.logSaved ? 1 : 0);

  // 켜 둔 항목만 실제로 예약한다. 화면이 다시 그려질 때마다 처음부터 건다.
  useEffect(() => {
    if (permission !== 'granted') return;

    if (prefs.sessionStart) {
      for (const item of SEED_SCHEDULE) {
        const at = new Date(todayAt(item.time).getTime() - MINUTES_BEFORE * 60_000);
        scheduleAt(
          `session-${item.time}`,
          at,
          `${MINUTES_BEFORE}분 뒤 ${item.who} 어르신`,
          `${item.what} · ${item.detail}`,
          '/home',
        );
      }
    }

    if (prefs.logPending && !s.logSaved) {
      // 마지막 회기 30분 뒤에 한 번
      const last = SEED_SCHEDULE[SEED_SCHEDULE.length - 1];
      scheduleAt(
        'log-pending',
        new Date(todayAt(last.time).getTime() + MINUTES_BEFORE * 60_000),
        '활동일지가 아직 저장되지 않았어요',
        `${s.topic} 회기 기록을 마무리해 주세요`,
        '/session/log',
      );
    }
  }, [permission, prefs, s.logSaved, s.topic]);

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
          <p className="text-[0.9375rem] leading-relaxed text-ink-700">
            회기 시작 전이나 일지가 남았을 때 이 기기로 알려드릴 수 있어요.
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

          <p className="mt-2 text-center text-[0.875rem] text-ink-500">
            오늘 예약된 알림 {count}건
          </p>
        </>
      )}

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
