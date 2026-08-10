/*
 * 서비스 워커를 라우트로 낸다.
 *
 * public/sw.js 로 두었을 때 문제가 하나 있었다. 파일 내용이 배포마다
 * 똑같으니 브라우저가 "새 워커"로 보지 않는다. 새 워커가 없으면 updatefound
 * 도 controllerchange 도 일어나지 않고, 태블릿에 띄워 둔 앱은 처음 받은
 * 자바스크립트를 계속 쓴다. 고쳐서 배포해 놓고 "그대로인데요?"를 두 번
 * 들은 이유가 이것이었다 — 서버에는 올라가 있고 기기만 옛것을 붙들고 있었다.
 *
 * 그래서 배포마다 달라지는 값을 워커 안에 박는다. 바이트가 달라지면
 * 브라우저가 새 워커로 알아보고, skipWaiting → clients.claim 을 거쳐
 * 화면을 넘겨받는다. 그 순간을 components/ServiceWorker.tsx 가 듣고 있다가
 * 안전할 때 화면을 다시 연다.
 *
 * 이 라우트는 빌드 때 한 번 굳는다(force-static). 그래야 배포 하나에
 * 판 번호가 하나다 — 요청마다 값이 달라지면 열 때마다 새 워커가 되어
 * 화면이 계속 다시 열린다.
 */

export const dynamic = 'force-static';

/** Vercel 이 배포마다 넣어 주는 커밋 해시. 로컬에서는 없다. */
const BUILD =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
  process.env.NEXT_PUBLIC_BUILD_ID ??
  'dev';

const SOURCE = `/*
 * 똑똑 TokTok — service worker.
 *
 * Deliberately minimal. This app holds an elder's life story in localStorage
 * and nothing here should ever serve a stale screen over a fresh one, so:
 *
 *   - pages are network-first; the cache is only a fallback when offline
 *   - the illustrations and icons are cache-first, since they never change
 *     without a new filename
 *   - nothing under /_next/data or any API path is cached at all
 *
 * It exists mainly so the app is installable and so a centre with a flaky
 * connection still opens to something rather than a browser error page.
 */

const VERSION = 'toktok-${BUILD}';
const SHELL = VERSION + '-shell';
const ASSETS = VERSION + '-assets';
const OFFLINE_URL = '/home';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll([OFFLINE_URL])).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

const isImmutableAsset = (url) =>
  url.pathname.startsWith('/art/') ||
  url.pathname.startsWith('/brand/') ||
  url.pathname.startsWith('/icons/') ||
  url.pathname.startsWith('/_next/static/');

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 워커 자신은 절대 캐시에서 주지 않는다. 캐시에서 주면 새 판이 나와도
  // 브라우저가 옛 바이트를 보고 "바뀐 게 없다"고 판단한다.
  if (url.pathname === '/sw.js') return;

  // artwork and build output: cache-first, they are content-addressed
  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSETS).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // pages: always try the network first so a worker never sees stale content
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() =>
          caches
            .match(request)
            .then((hit) => hit || caches.match(OFFLINE_URL))
            .then((hit) => hit || Response.error()),
        ),
    );
  }
});

/* 알림을 눌렀을 때 앱으로 돌아오기.
   이미 열린 창이 있으면 그 창을 쓰고, 없으면 새로 연다 — 회기 중에 창이
   여러 개 뜨면 어느 것이 지금 회기인지 알 수 없게 된다. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/home';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ('focus' in client) {
            if ('navigate' in client) client.navigate(url).catch(() => {});
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
`;

export function GET() {
  return new Response(SOURCE, {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      // 워커 파일만은 캐시하지 않는다. 이 응답이 캐시되면 새 판을 내놓아도
      // 브라우저가 옛 바이트를 보고 갱신을 건너뛴다.
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Service-Worker-Allowed': '/',
    },
  });
}
