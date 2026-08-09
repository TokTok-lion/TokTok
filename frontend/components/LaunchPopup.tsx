'use client';

import Image from 'next/image';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { chromeUrl, detectInstallEnv, type InstallEnv } from '@/lib/install';

/** Chrome's install event, which TypeScript does not ship a type for. */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/* 환경은 React 상태가 아니라 브라우저 사실이므로 외부 스토어로 읽는다.
 * 서버 스냅샷은 "아직 모른다" = 띄우지 않음이고, 그게 맞는 기본값이다. */
const SERVER_ENV: InstallEnv | null = null;
let envSnap: InstallEnv | null = SERVER_ENV;
let envRead = false;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  if (!envRead) {
    envRead = true;
    envSnap = detectInstallEnv();
  }
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function setEnv(next: InstallEnv) {
  envSnap = next;
  for (const l of listeners) l();
}

/* 한 번 로드에 한 번만 넘긴다. 이중 마운트(개발 모드 StrictMode)에서 두 번
 * 튀는 것을 막기 위해 컴포넌트 밖에 둔다. */
let handoffTried = false;

/**
 * 첫 화면 팝업 — 크롬으로 넘기기 + 홈 화면 설치.
 *
 * 카카오톡·인스타 링크로 들어오면 인앱 브라우저에 갇힌다. 거기서는 설치가
 * 아예 불가능하므로, 예전처럼 "설치할 수 없어요"라고 알리는 대신 바로
 * 크롬으로 넘긴다(안드로이드는 intent:, 아이폰은 googlechromes: 스킴).
 *
 * 다만 자동 이동이 100% 되지는 않는다 — 크롬이 안 깔려 있을 수도 있고,
 * 인앱 브라우저가 외부 스킴을 막아 두기도 한다. 그래서 넘기기를 시도하면서
 * 동시에 팝업을 띄워, 안 넘어갔을 때 직접 누를 버튼과 주소 복사를 남긴다.
 * 팝업은 X로 닫히고, 닫으면 첫 화면을 그대로 쓸 수 있다.
 */
export function LaunchPopup() {
  const env = useSyncExternalStore(subscribe, () => envSnap, () => SERVER_ENV);
  const promptRef = useRef<InstallPromptEvent | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);

  /*
   * 인앱 브라우저에서는 바로 띄운다 — 크롬으로 넘겨야 하고, 그게 이 화면에서
   * 가장 급한 일이다.
   *
   * 일반 브라우저에서는 조금 기다린다. 첫 화면에서 제일 먼저 보여야 할 것은
   * "무료로 시작하기"이지 설치 권유가 아니다. 설치 팝업이 그 버튼을 덮고
   * 있으면 새로 온 사람은 무엇을 해야 할지 모른 채 닫기부터 누른다.
   */
  const [dismissed, setDismissed] = useState(false);
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    if (!env || env.installed || env.inAppBrowser) return;
    const t = window.setTimeout(() => setWaited(true), 6000);
    return () => window.clearTimeout(t);
  }, [env]);

  // 인앱이면 기다릴 것 없이 바로다. 상태로 두면 렌더 중 setState 가 되므로
  // env 에서 그대로 계산한다.
  const open = !dismissed && Boolean(env?.inAppBrowser || waited);
  const setOpen = (v: boolean) => setDismissed(!v);

  // 인앱 브라우저면 곧바로 크롬으로 넘긴다
  useEffect(() => {
    if (!env || env.installed || !env.inAppBrowser) return;
    if (handoffTried) return;
    handoffTried = true;
    const target = chromeUrl(window.location.href, env.platform);
    if (!target) return;
    window.location.href = target;
  }, [env]);

  useEffect(() => {
    const onPrompt = (ev: Event) => {
      ev.preventDefault(); // 사용자가 설치를 누를 때까지 들고 있는다
      promptRef.current = ev as InstallPromptEvent;
      setCanPrompt(true);
    };
    const onInstalled = () => {
      if (envSnap) setEnv({ ...envSnap, installed: true });
      setOpen(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!env || env.installed || !open) return null;
  // 데스크톱에서는 설치 안내가 의미 없다 (인앱 브라우저인 경우만 예외)
  if (env.platform === 'desktop' && !env.inAppBrowser) return null;

  const install = async () => {
    const p = promptRef.current;
    if (!p) return;
    await p.prompt();
    const { outcome } = await p.userChoice;
    promptRef.current = null;
    setCanPrompt(false);
    if (outcome === 'accepted') setOpen(false);
  };

  const popup = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="launch-title"
      className="fixed inset-0 z-[60] flex items-center justify-center px-5"
    >
      {/* 바깥을 눌러도 닫힌다 — 팝업이 첫 화면을 인질로 잡지 않는다 */}
      <button
        type="button"
        aria-label="닫기"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-ink-900/35"
      />

      <div className="relative w-full max-w-[352px] rounded-[24px] bg-surface-strong p-5 shadow-[0_16px_44px_rgba(122,84,46,0.28)]">
        <button
          type="button"
          aria-label="팝업 닫기"
          onClick={() => setOpen(false)}
          className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-ink-500"
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>

        <div className="flex items-center gap-3 pr-10">
          <Image
            src="/icons/icon-192.png"
            alt=""
            width={48}
            height={48}
            className="rounded-[12px]"
          />
          <div className="min-w-0">
            <h2 id="launch-title" className="text-[1.1875rem] font-extrabold text-ink-900">
              {env.inAppBrowser ? '크롬으로 여는 중이에요' : '똑똑을 홈 화면에'}
            </h2>
            <p className="text-[0.875rem] text-ink-500">
              {env.inAppBrowser ? '잠시만 기다려 주세요' : '주소창 없이 앱처럼 열려요'}
            </p>
          </div>
        </div>

        {env.inAppBrowser ? (
          <ChromeHandoff env={env} />
        ) : env.platform === 'ios' ? (
          <IosSteps safari={env.iosSafari} />
        ) : (
          <AndroidInstall canPrompt={canPrompt} onInstall={install} />
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(popup, document.body) : null;
}

function ChromeHandoff({ env }: { env: InstallEnv }) {
  const [copied, setCopied] = useState(false);
  const href = typeof window === 'undefined' ? '' : window.location.href;
  const target = chromeUrl(href, env.platform);

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
      {/* 이 팝업이 보일 때는 이미 자동 이동을 시도한 뒤다. 그래서 문구를
          두 갈래로 나누지 않고, 안 넘어간 경우만 안내한다. */}
      <p className="text-[0.9375rem] leading-relaxed text-ink-700">
        크롬이 열리지 않으면 아래 버튼을 눌러 주세요.
      </p>

      {target ? (
        <a
          href={target}
          className="tk-cta mt-4 flex min-h-[56px] items-center justify-center rounded-[14px] text-[1.125rem] font-extrabold text-white"
        >
          크롬으로 열기
        </a>
      ) : null}

      {/* 크롬이 없는 기기도 있다. 그때는 주소를 옮겨 붙이는 길만 남는다. */}
      <button
        type="button"
        onClick={copy}
        className="mt-2.5 min-h-[52px] w-full rounded-[14px] border border-hairline bg-surface text-[1rem] font-bold text-ink-700"
      >
        {copied ? '주소를 복사했어요' : '주소 복사하기'}
      </button>

      {env.platform === 'ios' ? (
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
          크롬이 없다면 오른쪽 아래 <strong>···</strong> → <strong>Safari로 열기</strong>를
          눌러도 됩니다.
        </p>
      ) : null}
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
            설치해도 저장 공간을 거의 쓰지 않아요.
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
            브라우저가 설치 창을 아직 준비하지 못했어요. 메뉴에서 직접 추가할 수 있습니다.
          </p>
          <ol className="mt-4 space-y-2.5">
            <Step n={1}>
              오른쪽 위 <strong>⋮</strong> 메뉴를 누르세요
            </Step>
            <Step n={2}>
              <strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong>를 누르세요
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
          : '아이폰·아이패드는 사파리에서만 홈 화면에 추가할 수 있어요.'}
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
