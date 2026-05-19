// AluguelCuiabá — Service Worker (push notifications)
// Servido em / com scope /. NÃO faz cache de pages — só lida com push.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'AluguelCuiabá', body: event.data.text() }
  }

  const title = payload.title || 'AluguelCuiabá'
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    image: payload.image,
    tag: payload.tag || 'aluguelcuiaba',
    renotify: true,
    data: { url: payload.url || '/' },
    actions: payload.url ? [{ action: 'open', title: 'Ver imóvel' }] : undefined,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'

  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    // Se já tem aba aberta no site, foca e navega lá
    for (const client of clientsList) {
      try {
        const u = new URL(client.url)
        if (u.origin === self.location.origin) {
          await client.focus()
          if (client.url !== self.location.origin + url) {
            return client.navigate(url)
          }
          return
        }
      } catch {}
    }
    // Senão, abre nova
    return self.clients.openWindow(url)
  })())
})
