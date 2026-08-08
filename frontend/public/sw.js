/*
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

const VERSION = 'toktok-v1';
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;
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
