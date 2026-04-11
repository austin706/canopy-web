// ═══════════════════════════════════════════════════════════════
// Canopy Home Service Worker
// ═══════════════════════════════════════════════════════════════
// Handles Web Push notifications from the Canopy backend.
//
// Push notification payload format:
// {
//   "title": "string",
//   "body": "string",
//   "icon": "/canopy-icon-192.png",
//   "badge": "/canopy-icon-192.png",
//   "data": {
//     "action_url": "/path/to/page",
//     ...other metadata
//   }
// }

// ─── Service Worker Lifecycle ───

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  // Claim clients immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  // Take control of all clients
  event.waitUntil(clients.claim());
});

// ─── Push Notification Handling ───

self.addEventListener('push', (event) => {
  console.log('[SW] Push event received', event);

  if (!event.data) {
    console.warn('[SW] Push event has no data');
    return;
  }

  let pushData = {};
  try {
    pushData = event.data.json();
  } catch (e) {
    console.warn('[SW] Failed to parse push JSON, using text:', e);
    pushData = {
      title: 'Canopy Notification',
      body: event.data.text(),
    };
  }

  const title = pushData.title || 'Canopy Home';
  const options = {
    body: pushData.body || '',
    icon: pushData.icon || '/canopy-icon-192.png',
    badge: pushData.badge || '/canopy-icon-192.png',
    tag: pushData.tag || 'canopy-notification',
    // Store action_url in data for notificationclick handler
    data: {
      action_url: pushData.data?.action_url || '/',
      ...pushData.data,
    },
    // Allow user to close notification
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(title, options).catch((err) => {
      console.error('[SW] Failed to show notification:', err);
    })
  );
});

// ─── Notification Click Handling ───

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked', event);
  event.notification.close();

  const actionUrl = event.notification.data?.action_url || '/';
  const fullUrl = new URL(actionUrl, self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url === fullUrl && 'focus' in client) {
            return client.focus();
          }
        }
        // Open app if not already open
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      })
      .catch((err) => {
        console.error('[SW] Failed to handle notification click:', err);
      })
  );
});
