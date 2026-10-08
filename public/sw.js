// Muestra los avisos push (mensajes FCM solo-datos) aunque la app esté cerrada.
self.addEventListener('push', e => {
  let d = {};
  try { const j = e.data.json(); d = j.data || j; } catch (_) {}
  e.waitUntil(self.registration.showNotification(d.title || 'Recordatorio', {
    body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.title }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(c => c.length ? c[0].focus() : clients.openWindow('./')));
});
