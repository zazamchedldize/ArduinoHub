/* =========================================================
   ArduinoHub — Winter Mode (winter.js)
   დამოუკიდებელი ფაილი: script.js-ს არ ეხება.
   - /winter და /winterstop (მხოლოდ ადმინისთვის, როგორც /poll)
   - სინქრონი Supabase Realtime-ით (ცხრილი site_modes)
   - მდგომარეობა რჩება refresh-ის შემდეგაც
   - თოვლი (canvas), გირლანდა, ნაძვის ტოტები
   - მუსიკა: autoplay ცდა, დაბლოკვისას პირველი ინტერაქცია, loop, ღილაკის გარეშე
   ========================================================= */
(() => {
  'use strict'

  if (window.__arduinoHubWinter) return
  window.__arduinoHubWinter = true

  const MODE_ID = 'winter'
  const CACHE_KEY = 'arduinohub_winter_mode'
  const MUSIC_SRC = '/sounds/winter.mp3'
  const MUSIC_VOLUME = 0.55
  const UNLOCK_EVENTS = ['pointerdown', 'touchend', 'click', 'keydown']

  let enabled = false
  let music = null
  let diagnosed = false
  let unlockBound = false
  let channel = null
  let snow = null

  /* ---------- დამხმარე ---------- */

  const getClient = () =>
    window.supabase && typeof window.supabase.from === 'function'
      ? window.supabase
      : null

  const readCache = () => {
    try { return localStorage.getItem(CACHE_KEY) === '1' } catch { return false }
  }

  const writeCache = value => {
    try { localStorage.setItem(CACHE_KEY, value ? '1' : '0') } catch {}
  }

  let toastTimer = 0
  function toast(message) {
    let el = document.getElementById('winter-toast')
    if (!el) {
      el = document.createElement('div')
      el.id = 'winter-toast'
      el.className = 'toast'
      document.body.appendChild(el)
    }
    el.textContent = message
    requestAnimationFrame(() => el.classList.add('show'))
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200)
  }

  /* ---------- მუსიკა ---------- */

  function ensureAudio() {
    if (music) return music

    music = new Audio(MUSIC_SRC)
    music.loop = true
    music.preload = 'auto'
    music.volume = MUSIC_VOLUME

    music.addEventListener('error', diagnoseAudio)

    // დამატებითი დაზღვევა: თუ loop რომელიმე ბრაუზერში არ იმუშავა
    music.addEventListener('ended', () => {
      if (!enabled) return
      music.currentTime = 0
      music.play().catch(() => {})
    })

    return music
  }

  async function diagnoseAudio() {
    if (diagnosed) return
    diagnosed = true

    const mediaErr = music && music.error ? music.error.code : null

    try {
      const res = await fetch(MUSIC_SRC, { method: 'HEAD', cache: 'no-store' })
      const type = res.headers.get('content-type') || '(არ არის)'
      const size = res.headers.get('content-length') || '(უცნობი)'

      console.warn(
        `[Winter] მუსიკის დიაგნოსტიკა → URL: ${MUSIC_SRC} | status: ${res.status} | Content-Type: ${type} | ზომა: ${size} | MediaError: ${mediaErr}`
      )

      if (!res.ok) {
        console.warn('[Winter] ფაილი სერვერზე ვერ მოიძებნა. შეამოწმე გზა და ფაილის სახელი (დიდი/პატარა ასოები).')
      } else if (/text\/html/i.test(type)) {
        console.warn('[Winter] სერვერმა mp3-ის ნაცვლად HTML დააბრუნა (არასწორი გზა ან catch-all route).')
      } else if (!/audio|mpeg|octet-stream/i.test(type)) {
        console.warn('[Winter] Content-Type არ არის აუდიო. სასურველია: audio/mpeg')
      } else {
        console.warn('[Winter] ფაილი მოდის, მაგრამ ბრაუზერი ვერ კითხულობს. გადააკოდირე: ffmpeg -i winter.mp3 -vn -c:a libmp3lame -b:a 128k -ar 44100 -ac 2 winter-fixed.mp3')
      }
    } catch (err) {
      console.warn('[Winter] მუსიკის დიაგნოსტიკა ვერ შესრულდა:', err)
    }
  }

  async function tryPlay() {
    if (!enabled) return

    const audio = ensureAudio()

    try {
      await audio.play()
      unbindUnlock()
    } catch (err) {
      if (err && err.name === 'NotAllowedError') {
        bindUnlock()          // autoplay დაიბლოკა → პირველი ინტერაქცია ჩართავს
      } else if (err && err.name === 'AbortError') {
        // play() შეწყვიტა pause()-მა — ნორმალურია
      } else {
        console.warn('[Winter] მუსიკა ვერ ჩაირთო:', err)
        diagnoseAudio()
      }
    }
  }

  function onUnlock() {
    tryPlay()
  }

  function bindUnlock() {
    if (unlockBound) return
    unlockBound = true
    UNLOCK_EVENTS.forEach(name =>
      document.addEventListener(name, onUnlock, { capture: true, passive: true })
    )
  }

  function unbindUnlock() {
    if (!unlockBound) return
    unlockBound = false
    UNLOCK_EVENTS.forEach(name =>
      document.removeEventListener(name, onUnlock, { capture: true })
    )
  }

  function stopMusic() {
    unbindUnlock()
    if (!music) return
    music.pause()
    try { music.currentTime = 0 } catch {}
  }

  /* ---------- დეკორი ---------- */

  function addBranches(parent) {
    if (!parent) return
    ;['tl', 'tr'].forEach(pos => {
      const branch = document.createElement('div')
      branch.className = `winter-branch ${pos}`
      branch.setAttribute('aria-hidden', 'true')
      parent.appendChild(branch)
    })
  }

  function mountDecor() {
    if (document.getElementById('winter-garland')) return

    const garland = document.createElement('div')
    garland.id = 'winter-garland'
    garland.setAttribute('aria-hidden', 'true')

    const canvas = document.createElement('canvas')
    canvas.id = 'winter-snow'
    canvas.setAttribute('aria-hidden', 'true')

    document.body.append(garland, canvas)

    // ტოტები hero-სა და footer-ის კუთხეებში (header-ს არ ფარავს)
    addBranches(document.querySelector('.hero'))
    addBranches(document.querySelector('footer'))
  }

  function unmountDecor() {
    document.getElementById('winter-garland')?.remove()
    document.getElementById('winter-snow')?.remove()
    document.querySelectorAll('.winter-branch').forEach(node => node.remove())
  }

  /* ---------- თოვლი ---------- */

  function startSnow() {
    if (snow) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const canvas = document.getElementById('winter-snow')
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0
    let h = 0
    let raf = 0
    let last = 0
    let resizeTimer = 0
    const flakes = []

    const make = initial => ({
      x: Math.random() * w,
      y: initial ? Math.random() * h : -10,
      r: Math.random() * 2.1 + 0.8,
      speed: Math.random() * 0.9 + 0.4,
      phase: Math.random() * Math.PI * 2,
      sway: Math.random() * 0.5 + 0.15,
      alpha: Math.random() * 0.5 + 0.4
    })

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // მობილურზე ნაკლები ნაწილაკი
      const target = Math.round(Math.min(110, Math.max(35, w / 13)))
      while (flakes.length < target) flakes.push(make(true))
      flakes.length = target
    }

    const frame = time => {
      raf = requestAnimationFrame(frame)

      const dt = Math.min((time - last) / 16.7 || 1, 3)
      last = time

      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#ffffff'

      for (const f of flakes) {
        f.phase += 0.012 * dt
        f.y += f.speed * dt
        f.x += Math.sin(f.phase) * f.sway * dt

        if (f.y > h + 10) Object.assign(f, make(false), { x: Math.random() * w })
        if (f.x > w + 10) f.x = -10
        if (f.x < -10) f.x = w + 10

        ctx.globalAlpha = f.alpha
        ctx.beginPath()
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.globalAlpha = 1
    }

    const onResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(resize, 150)
    }

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf)
        raf = 0
      } else if (!raf) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
    }

    resize()
    raf = requestAnimationFrame(frame)
    window.addEventListener('resize', onResize, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)

    snow = {
      stop() {
        cancelAnimationFrame(raf)
        clearTimeout(resizeTimer)
        window.removeEventListener('resize', onResize)
        document.removeEventListener('visibilitychange', onVisibility)
      }
    }
  }

  function stopSnow() {
    if (!snow) return
    snow.stop()
    snow = null
  }

  /* ---------- რეჟიმის ჩართვა / გამორთვა ---------- */

  function apply(on) {
    on = Boolean(on)
    if (on === enabled && document.body.classList.contains('winter-mode') === on) return

    enabled = on
    writeCache(on)

    if (on) {
      document.documentElement.classList.add('winter-mode')
      document.body.classList.add('winter-mode')
      mountDecor()
      startSnow()
      tryPlay()
    } else {
      document.documentElement.classList.remove('winter-mode')
      document.body.classList.remove('winter-mode')
      stopSnow()
      stopMusic()
      unmountDecor()
    }
  }

  /* ---------- Supabase: მდგომარეობა და Realtime ---------- */

  async function fetchState() {
    const db = getClient()
    if (!db) return

    const { data, error } = await db
      .from('site_modes')
      .select('enabled')
      .eq('id', MODE_ID)
      .maybeSingle()

    if (error) {
      console.warn('[Winter] მდგომარეობის წაკითხვა ვერ მოხერხდა (გაქვს თუ არა SQL გაშვებული?):', error.message)
      return
    }

    apply(Boolean(data?.enabled))
  }

  function subscribe() {
    const db = getClient()
    if (!db || channel) return

    channel = db
      .channel('site-mode-winter')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_modes', filter: `id=eq.${MODE_ID}` },
        payload => {
          if (payload.eventType === 'DELETE') return apply(false)
          apply(Boolean(payload.new?.enabled))
        }
      )
      .subscribe(status => {
        // კავშირის აღდგენისას გამოტოვებული ცვლილებები ისევ წამოვიღოთ
        if (status === 'SUBSCRIBED') fetchState()
      })
  }

  /* ---------- ბრძანებები: /winter და /winterstop ---------- */

  async function runCommand(turnOn) {
    const db = getClient()

    if (!db) {
      toast('Supabase კავშირი მიუწვდომელია')
      return
    }

    const { data } = await db.auth.getSession()
    const user = data?.session?.user

    if (!user) {
      toast('ამ მოქმედებისთვის ადმინისტრატორის უფლებებია საჭირო')
      return
    }

    const { data: admin } = await db
      .from('admin_users')
      .select('username')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!admin) {
      toast('ამ მოქმედებისთვის ადმინისტრატორის უფლებებია საჭირო')
      return
    }

    const { error } = await db.from('site_modes').upsert({
      id: MODE_ID,
      enabled: turnOn,
      updated_at: new Date().toISOString(),
      updated_by: user.id
    })

    if (error) {
      console.error('[Winter] შენახვის შეცდომა:', error)
      toast('რეჟიმის შეცვლა ვერ მოხერხდა. შეამოწმე winter.sql')
      return
    }

    apply(turnOn)
    toast(turnOn ? 'საახალწლო რეჟიმი ჩაირთო 🎄' : 'საახალწლო რეჟიმი გამოირთო')
  }

  // იგივე პრინციპი, რაც /poll-ზე: submit-ის capture ფაზა, სხვა handler-ებამდე
  document.addEventListener(
    'submit',
    async event => {
      const form = document.getElementById('ai-chat-form')
      const input = document.getElementById('ai-chat-input')

      if (!form || !input || event.target !== form) return

      const command = input.value.trim().toLowerCase()
      if (command !== '/winter' && command !== '/winterstop') return

      event.preventDefault()
      event.stopImmediatePropagation()
      input.value = ''

      await runCommand(command === '/winter')
    },
    true
  )

  /* ---------- გაშვება ---------- */

  function init() {
    // მყისიერად აღვადგინოთ ბოლო ცნობილი მდგომარეობა (ციმციმის გარეშე)
    if (readCache()) apply(true)

    fetchState()
    subscribe()

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) fetchState()
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true })
  } else {
    init()
  }
})()
