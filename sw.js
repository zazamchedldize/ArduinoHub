
const CACHE_NAME = 'arduinohub-v3'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)

  if (url.origin !== self.location.origin) return

  if (
    url.pathname.includes('icon') ||
    url.pathname.includes('manifest')
  ) {
    event.respondWith(fetch(event.request))
  }
})
