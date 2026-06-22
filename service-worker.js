self.addEventListener("install", event => { self.skipWaiting(); });
self.addEventListener("activate", event => { event.waitUntil(self.clients.claim()); });

self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (e) { data = { body: event.data ? event.data.text() : "" }; }

  event.waitUntil(
    self.registration.showNotification(data.title || "Как настроение?", {
      body: data.body || "Оставь короткую заметку.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/" },
      tag: data.tag || "kak-ya-reminder",
      renotify: false
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientsArr => {
      for (const client of clientsArr) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
