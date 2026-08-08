'use client';

import Image from 'next/image';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { chromeIntentUrl, detectInstallEnv, type InstallEnv } from '@/lib/install';

/** Chrome's install event, which TypeScript does not ship a type for. */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISSED = 'toktok.install.dismissed.v1';

/* The environment and the "don't show again" flag are browser facts, not React
 * state, so they are read through an external store. The server snapshot hides
 * the banner, which is also the right answer while we do not yet know. */
type Snap = { env: InstallEnv | null; dismissed: boolean };

const SERVER_SNAP: Snap = { env: null, dismissed: true };
let snap: Snap = SERVER_SNAP;
let read = false;
const listeners = new Set<() => void>();

function readEnv(): Snap {
  let dismissed = false;
  try {
    dismissed = localStorage.getItem(DISMISSED) === '1';
  } catch {
    /* storage blocked — showing the hint is harmless */
  }
  return { env: detectInstallEnv(), dismissed };
}

function subscribeEnv(cb: () => void) {
  if (!read) {
    read = true;
    snap = readEnv();
  }
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function updateSnap(next: Partial<Snap>) {
  snap = { ...snap, ...next };
  for (const l of listeners) l();
}

/**
 * 홈 화면에 설치 안내.
 *
 * Three situations, three different answers:
 *
 *   카카오톡·인스타 등 인앱 브라우저 — install is impossible here. Android gets
 *     a one-tap hand-off to Chrome; iOS gets the menu path, because no URL
 *     scheme can escape an in-app browser on iOS.
 *   Android Chrome — the real install prompt, triggered by our own button so
 *     it appears when the worker asked for it.
 *   iOS Safari — no programmatic install exists; show the share-sheet steps.
 *
 * It is a sheet, not a full-screen takeover: this runs on a tablet used beside
 * an elder, and the app must never be unusable because of a promo.
 */
export function InstallGate() {
  const { env, dismissed } = useSyncExternalStore(
    subscribeEnv,
    () => snap,
    () => SERVER_SNAP,
  );
  const [open, setOpen] = useState(false);
  const promptRef = useRef<InstallPromptEvent | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);

  useEffect(() => {
    const onPrompt = (ev: Event) => {
      ev.preventDefault(); // keep it until the worker taps 설치
      promptRef.current = ev as InstallPromptEvent;
      setCanPrompt(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    const onInstalled = () => {
      if (snap.env) updateSnap({ env: { ...snap.env, installed: true } });
      setOpen(false);
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // register the service worker; without it there is no install prompt at all
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const id = window.setTimeout(() => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* offline support is a bonus, never a blocker */
      });
    }, 1200);
    return () => window.clearTimeout(id);
  }, []);

  if (!env || env.installed) return null;
  if (env.platform === 'desktop' && !env.inAppBrowser) return null;

  const hide = () => {
    setOpen(false);
    updateSnap({ dismissed: true });
    try {
      localStorage.setItem(DISMISSED, '1');
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    const p = promptRef.current;
    if (!p) return;
    await p.prompt();
    const { outcome } = await p.userChoice;
    promptRef.current = null;
    setCanPrompt(false);
    if (outcome === 'accepted') hide();
  };

  const bar = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex w-full items-center gap-3 rounded-[16px] border border-brand-200 bg-brand-50 px-4 py-3 text-left"
    >
      <Image src="/icons/icon-192.png" alt="" width={36} height={36} className="rounded-[9px]" />
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-extrabold text-ink-900">
          {env.inAppBrowser
            ? `${env.inAppBrowser}에서는 설치할 수 없어요`
            : '홈 화면에 설치하기'}
        </span>
        <span className="block text-[0.8125rem] text-ink-700">
          {env.inAppBrowser
            ? '브라우저로 열면 앱처럼 쓸 수 있어요'
            : '주소창 없이 앱처럼 쓸 수 있어요'}
        </span>
      </span>
      <span className="shrink-0 text-[0.875rem] font-bold text-brand-700">보기</span>
    </button>
  );

  // The sheet must escape <main>, which sits in its own stacking context —
  // otherwise the bottom tab bar renders over it and swallows the taps.
  const sheet = open ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-title"
      className="fixed inset-0 z-[60] flex items-end justify-center"
    >
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink-900/40"
          />
          <div className="relative mx-auto w-full max-w-[440px] rounded-t-[24px] bg-surface-strong px-5 pb-7 pt-5 shadow-[0_-8px_30px_rgba(122,84,46,0.22)]">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-hairline" />

            <div className="flex items-center gap-3">
              <Image
                src="/icons/icon-192.png"
                alt=""
                width={52}
                height={52}
                className="rounded-[13px]"
              />
              <div className="min-w-0">
                <h2 id="install-title" className="text-[1.25rem] font-extrabold text-ink-900">
                  똑똑을 홈 화면에
                </h2>
                <p className="text-[0.875rem] text-ink-500">
                  주소창 없이 앱처럼 열려요
                </p>
              </div>
            </div>

            {env.inAppBrowser ? (
              <InAppHandoff env={env} />
            ) : env.platform === 'ios' ? (
              <IosSteps safari={env.iosSafari} />
            ) : (
              <AndroidInstall canPrompt={canPrompt} onInstall={install} />
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-[52px] flex-1 rounded-[14px] border border-hairline bg-surface text-[1rem] font-bold text-ink-700"
              >
                나중에
              </button>
              {/* 처음이신가요? 카드에도 같은 이름의 버튼이 있어, 무엇을 그만
                  보겠다는 것인지 분명히 적는다 */}
              <button
                type="button"
                onClick={hide}
                className="min-h-[52px] flex-1 rounded-[14px] bg-surface-sunk text-[1rem] font-bold text-ink-500"
              >
                설치 안내 그만 보기
              </button>
            </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {!dismissed && !open ? <div className="mb-3">{bar}</div> : null}
      {sheet && typeof document !== 'undefined'
        ? createPortal(sheet, document.body)
        : null}
    </>
  );
}

function InAppHandoff({ env }: { env: InstallEnv }) {
  const [copied, setCopied] = useState(false);
  const href = typeof window === 'undefined' ? '' : window.location.href;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mt-4">
      <p className="text-[0.9375rem] leading-relaxed text-ink-700">
        지금은 <strong>{env.inAppBrowser} 안의 브라우저</strong>라서 설치할 수
        없어요. 크롬이나 사파리로 열면 설치 버튼이 나타납니다.
      </p>

      {env.platform === 'android' ? (
        <a
          href={chromeIntentUrl(href)}
          className="tk-cta mt-4 flex min-h-[56px] items-center justify-center rounded-[14px] text-[1.125rem] font-extrabold text-white"
        >
          크롬으로 열기
        </a>
      ) : (
        <ol className="mt-4 space-y-2.5">
          <Step n={1}>
            오른쪽 아래 <strong>···</strong> 또는 <strong>공유</strong> 버튼을
            누르세요
          </Step>
          <Step n={2}>
            <strong>Safari로 열기</strong> (또는 다른 브라우저로 열기)를
            선택하세요
          </Step>
          <Step n={3}>열린 사파리에서 이 안내를 다시 보고 설치하세요</Step>
        </ol>
      )}

      <button
        type="button"
        onClick={copy}
        className="mt-3 min-h-[52px] w-full rounded-[14px] border border-hairline bg-surface text-[1rem] font-bold text-ink-700"
      >
        {copied ? '주소를 복사했어요' : '주소 복사하기'}
      </button>
    </div>
  );
}

function AndroidInstall({
  canPrompt,
  onInstall,
}: {
  canPrompt: boolean;
  onInstall: () => void;
}) {
  return (
    <div className="mt-4">
      {canPrompt ? (
        <>
          <p className="text-[0.9375rem] leading-relaxed text-ink-700">
            설치해도 저장 공간을 거의 쓰지 않아요. 기록은 지금과 똑같이 이
            기기에만 남습니다.
          </p>
          <button
            type="button"
            onClick={onInstall}
            className="tk-cta mt-4 flex min-h-[56px] w-full items-center justify-center rounded-[14px] text-[1.125rem] font-extrabold text-white"
          >
            홈 화면에 설치
          </button>
        </>
      ) : (
        <>
          <p className="text-[0.9375rem] leading-relaxed text-ink-700">
            브라우저가 설치 창을 아직 준비하지 못했어요. 메뉴에서 직접 추가할 수
            있습니다.
          </p>
          <ol className="mt-4 space-y-2.5">
            <Step n={1}>
              오른쪽 위 <strong>⋮</strong> 메뉴를 누르세요
            </Step>
            <Step n={2}>
              <strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong>를
              누르세요
            </Step>
          </ol>
        </>
      )}
    </div>
  );
}

function IosSteps({ safari }: { safari: boolean }) {
  return (
    <div className="mt-4">
      <p className="text-[0.9375rem] leading-relaxed text-ink-700">
        {safari
          ? '아이폰·아이패드는 사파리 공유 메뉴에서 추가해요. 두 번만 누르면 됩니다.'
          : '아이폰·아이패드는 사파리에서만 홈 화면에 추가할 수 있어요. 사파리로 이 주소를 연 뒤 아래대로 하세요.'}
      </p>
      <ol className="mt-4 space-y-2.5">
        <Step n={1}>
          아래쪽 <strong>공유</strong> 버튼(위로 향한 화살표)을 누르세요
        </Step>
        <Step n={2}>
          목록을 내려 <strong>홈 화면에 추가</strong>를 누르세요
        </Step>
        <Step n={3}>
          오른쪽 위 <strong>추가</strong>를 누르면 끝이에요
        </Step>
      </ol>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[0.875rem] font-extrabold text-brand-800">
        {n}
      </span>
      <span className="text-[0.9375rem] leading-relaxed text-ink-900">{children}</span>
    </li>
  );
}
