/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

// Allow the page to force activation of a waiting SW (kiosk/TPV auto-update)
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Injected by vite-plugin-pwa at build time
precacheAndRoute(self.__WB_MANIFEST);

// Supabase: always network, never cache
registerRoute(
  ({ url }: { url: URL }) => url.hostname.includes('supabase.co'),
  new NetworkOnly(),
);

// Google Fonts stylesheets
registerRoute(
  ({ url }: { url: URL }) => url.hostname === 'fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// Google Fonts files
registerRoute(
  ({ url }: { url: URL }) => url.hostname === 'fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// ─── Push notification handler ────────────────────────────────────────────────
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  let data: { title?: string; body?: string; icon?: string; badge?: string; url?: string } = {};
  try {
    data = event.data.json();
  } catch {
    data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title ?? '🍕 Nueva reserva en Lo Zio', {
      body: data.body,
      icon: data.icon ?? '/pwa-192x192.png',
      badge: data.badge ?? '/pwa-192x192.png',
      // Unique tag so back-to-back reservations don't replace each other
      tag: `res-${Date.now()}`,
      requireInteraction: true,
      // Vibrate on Android (iOS uses system sound automatically)
      vibrate: [200, 100, 200, 100, 200],
      renotify: true,
      data: { url: data.url ?? '/admin' },
    } as NotificationOptions),
  );
});

// ─── Notification click: open / focus the admin page ─────────────────────────
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url: string = (event.notification.data?.url as string) ?? '/admin';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ('focus' in client) return (client as WindowClient).focus();
        }
        return self.clients.openWindow(url);
      }),
  );
});
