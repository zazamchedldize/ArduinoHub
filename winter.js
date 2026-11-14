/* =========================================================
   ArduinoHub — Winter Mode (winter.js) · v5 Premium Christmas Experience
   დამოუკიდებელი ფაილი: script.js-ს არ ეხება.
   - /winter და /winterstop (მხოლოდ ადმინისთვის, როგორც /poll)
   - სინქრონი Supabase Realtime-ით (ცხრილი site_modes) — უცვლელია
   - მდგომარეობა რჩება refresh-ის შემდეგაც
   - თოვლი (canvas): 4 სიღრმის ფენა, კრისტალური ფიფქები, ცოცხალი ქარი, ოქროსფერი
     მტვერი, მოციმციმე ვარსკვლავები, მაუსის ნაპერწკლები, ცვივა ვარსკვლავი, ფეიერვერკი
   - ინდივიდუალურად მოციმციმე ნათურების გირლანდა, ქანაობადი ორნამენტები,
     დეკორირებული ნაძვის ხეები (ვარსკვლავი, განათებები, საჩუქრები), ოქროსფერი ზარები,
     გვირგვინები, ბაფთები, ნაძვის ტოტების გირლანდა, ლოლოები, ყინვა, aurora
   - მუსიკა: ერთი გლობალური Audio, სხვა მუსიკის დათრგუნვა (/winter) და აღდგენა (/winterstop),
     გვერდებს შორის პოზიციის გაგრძელება, autoplay-ის დაცვა
   ========================================================= */
(() => {
  'use strict'

  if (window.__arduinoHubWinter) return
  window.__arduinoHubWinter = true

  const MODE_ID = 'winter'
  const CACHE_KEY = 'arduinohub_winter_mode'
  const POS_KEY = 'arduinohub_winter_pos'                   // ძველი ფორმატი (თავსებადობისთვის)
  const STATE_KEY = 'arduinohub_winter_music_state'         // {pos, ts, playing}
  const OWNER_KEY = 'arduinohub_winter_music_owner'         // რომელი ტაბი უკრავს
  // ძირითადი გზა უცვლელია; თუ ფაილი სხვა საქაღალდეშია, ბრაუზერი თავისით სცდის შემდეგ გზებს
  const MUSIC_SOURCES = ['/sounds/winter.mp3', '/sound/winter.mp3', '/winter.mp3']
  const MUSIC_VOLUME = 0.55
  const UNLOCK_EVENTS = ['pointerdown', 'touchend', 'click', 'keydown']
  // ჩვეულებრივი მუსიკა, რომელსაც /winterstop-ზე თავიდან არ ვრთავთ (თავად ვიქტორინა მართავს)
  const RESUME_SKIP_IDS = ['quiz-music']

  let enabled = false
  let music = null
  let musicSrcIndex = 0
  let musicStart = null
  let musicBusy = false
  let diagnosed = false
  let unlockBound = false
  let channel = null
  let snow = null
  let react = null

  const nativePlay = HTMLMediaElement.prototype.play
  const TAB_ID = Math.random().toString(36).slice(2)
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const isSmall = () => window.innerWidth < 700
  const rnd = (a, b) => a + Math.random() * (b - a)

  /* ---------- დამხმარე ---------- */

  const BASE_URL = document.currentScript ? document.currentScript.src : location.href
  let clientPromise = null

  // ყველა გვერდზე მუშაობს: ჯერ ვცდით გვერდის უკვე შექმნილ კლიენტს,
  // თუ არ არის — ვქმნით ახალს script.js-ის იგივე supabase-config.js-იდან.
  function getClient() {
    if (window.supabase && typeof window.supabase.from === 'function') {
      return Promise.resolve(window.supabase)
    }

    if (!clientPromise) {
      clientPromise = (async () => {
        try {
          const cfg = await import(new URL('./supabase-config.js', BASE_URL).href)
          if (!cfg.supabaseIsConfigured) return null
          const lib = await import('https://esm.sh/@supabase/supabase-js@2')
          return lib.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
            auth: { persistSession: true, autoRefreshToken: true }
          })
        } catch (err) {
          console.warn('[Winter] Supabase კლიენტის შექმნა ვერ მოხერხდა:', err)
          return null
        }
      })()
    }

    return clientPromise
  }

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

  /* ---------- სხვა მუსიკის მართვა (index.html-ის არსებული სისტემა) ----------
     საიტზე არსებული ფონური მუსიკა: <audio id="doom-music"> (ავტომატურად იწყება),
     <audio id="quiz-music"> (ვიქტორინა) და YouTube პლეერი (#music-youtube-player).
     /winter-ის დროს ისინი ჩერდება და ვერ ირთვება (მათ შორის დაგვიანებული
     "პირველ კლიკზე ჩართვის" fallback-იც), /winterstop-ზე კი ბრუნდება. */

  const suspended = new Set()   // ელემენტები, რომლებიც winter-მა გააჩერა / არ ჩართო
  let guardOn = false
  let patchedPlay = null

  function isSiteBackgroundMedia(el) {
    if (!(el instanceof HTMLMediaElement)) return false
    if (el.__winterOwn || el === music) return false
    if (el.hasAttribute('data-winter-allow')) return false
    if (el.tagName === 'AUDIO') {
      // გვერდზე ჩაწერილი <audio> = საიტის მუსიკა; უჯრედგარე Audio — მხოლოდ თუ loop-ია
      return el.isConnected ? true : el.loop
    }
    // ვიდეო: მხოლოდ ხმიანი ავტო/loop ფონური ვიდეო. მომხმარებლის მართვადი პლეერები
    // (controls) და უხმო ვიდეოები (live-host) არასდროს ირთვება/ჩერდება.
    return !el.controls && !el.muted && el.volume > 0 && (el.autoplay || el.loop)
  }

  function onAnyPlay(event) {
    const el = event.target
    if (!enabled || !isSiteBackgroundMedia(el)) return
    suspended.add(el)
    try { el.pause() } catch {}
  }

  function installMediaGuard() {
    if (guardOn) return
    guardOn = true

    patchedPlay = function () {
      if (enabled && isSiteBackgroundMedia(this)) {
        suspended.add(this)
        try { this.pause() } catch {}
        return Promise.resolve()   // ისე ვაჩვენებთ, თითქოს შესრულდა → site-ის fallback listener-ები აღარ ეძებენ კლიკს
      }
      return nativePlay.apply(this, arguments)
    }

    HTMLMediaElement.prototype.play = patchedPlay
    document.addEventListener('play', onAnyPlay, true)   // autoplay ატრიბუტით დაწყებულისთვის
  }

  function removeMediaGuard() {
    if (!guardOn) return
    guardOn = false
    if (HTMLMediaElement.prototype.play === patchedPlay) {
      HTMLMediaElement.prototype.play = nativePlay
    }
    document.removeEventListener('play', onAnyPlay, true)
    patchedPlay = null
  }

  function stopYouTubeMusic() {
    const frame = document.getElementById('music-youtube-player')
    if (!frame) return
    const src = frame.getAttribute('src') || ''
    if (!src || src === 'about:blank') return

    try {
      frame.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*'
      )
    } catch {}

    // საიტის საკუთარი "გაჩერება" ღილაკი → მისი შიდა მდგომარეობაც სწორად განახლდება
    const stop = document.getElementById('music-stop')
    if (stop) stop.click()
  }

  function silenceOthers() {
    document.querySelectorAll('audio, video').forEach(el => {
      if (el.__winterOwn) return
      // ჩაწერილი loop აუდიო = საიტის ფონური მუსიკა → მისი აღდგენა გვინდა /winterstop-ზე,
      // მაშინაც თუ autoplay დაბლოკილი იყო და ჯერ არ უკრავდა
      if (el.tagName === 'AUDIO' && el.loop) suspended.add(el)
      if (isSiteBackgroundMedia(el) && !el.paused) {
        suspended.add(el)
        try { el.pause() } catch {}
      }
    })
    stopYouTubeMusic()
  }

  function restoreOthers() {
    const items = [...suspended]
    suspended.clear()

    items.forEach(el => {
      if (RESUME_SKIP_IDS.includes(el.id)) return
      if (!el.isConnected && !el.loop) return
      if (!el.paused) return

      const retry = () => {
        document.addEventListener(
          'click',
          () => { nativePlay.call(el).catch(() => {}) },
          { once: true, capture: true }
        )
      }

      try {
        const p = nativePlay.call(el)
        if (p && p.catch) p.catch(err => { if (err?.name === 'NotAllowedError') retry() })
      } catch {}
    })
  }

  /* ---------- საახალწლო მუსიკა ---------- */

  const readPos = () => {
    try { return parseFloat(localStorage.getItem(POS_KEY)) || 0 } catch { return 0 }
  }

  function readState() {
    try {
      const s = JSON.parse(localStorage.getItem(STATE_KEY))
      if (s && Number.isFinite(s.pos)) return s
    } catch {}
    return { pos: readPos(), ts: 0, playing: false }
  }

  function writeState(playing, pos) {
    if (!music) return
    const p = pos == null ? (music.currentTime || 0) : pos
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify({ pos: p, ts: Date.now(), playing: Boolean(playing) }))
      localStorage.setItem(POS_KEY, String(p))
    } catch {}
  }

  // გვერდებს შორის გადასვლისას ვაგრძელებთ იქიდან, სადაც მუსიკა გაჩერდა
  function startPosition() {
    const s = readState()
    let pos = s.pos || 0
    if (s.playing && s.ts && Date.now() - s.ts < 20000) pos += (Date.now() - s.ts) / 1000
    return pos
  }

  function claimOwner() {
    try { localStorage.setItem(OWNER_KEY, `${TAB_ID}:${Date.now()}`) } catch {}
  }

  // სხვა ტაბში დაიწყო საახალწლო მუსიკა → ეს ტაბი ჩუმდება (არ უკრავს ორი ერთდროულად)
  window.addEventListener('storage', e => {
    if (e.key !== OWNER_KEY || !e.newValue || e.newValue.startsWith(`${TAB_ID}:`)) return
    if (music && !music.paused) music.pause()
  })

  function applyPendingStart() {
    if (!music || musicStart == null) return
    const d = music.duration
    if (!Number.isFinite(d) || d <= 0) return
    let pos = musicStart % d
    if (pos < 0 || pos > d - 1) pos = 0
    musicStart = null
    try { music.currentTime = pos } catch {}
  }

  function onAudioError() {
    if (musicSrcIndex < MUSIC_SOURCES.length - 1) {
      musicSrcIndex += 1
      musicStart = startPosition()
      music.src = MUSIC_SOURCES[musicSrcIndex]
      music.load()
      if (enabled) tryPlay()
      return
    }
    diagnoseAudio()
  }

  function ensureAudio() {
    if (music) return music

    music = new Audio()
    music.__winterOwn = true
    music.loop = true
    music.preload = 'auto'
    music.volume = MUSIC_VOLUME
    musicSrcIndex = 0
    musicStart = startPosition()
    music.src = MUSIC_SOURCES[0]

    try { music.currentTime = musicStart } catch {}

    music.addEventListener('error', onAudioError)
    music.addEventListener('loadedmetadata', applyPendingStart)
    music.addEventListener('playing', claimOwner)

    let lastSave = 0
    music.addEventListener('timeupdate', () => {
      const now = Date.now()
      if (now - lastSave < 500) return
      lastSave = now
      writeState(!music.paused)
    })

    music.addEventListener('ended', () => {
      if (!enabled) return
      music.currentTime = 0
      writeState(false, 0)
      music.play().catch(() => {})
    })

    return music
  }

  async function diagnoseAudio() {
    if (diagnosed) return
    diagnosed = true

    const src = music ? (music.currentSrc || music.src) : MUSIC_SOURCES[0]
    const mediaErr = music && music.error ? music.error.code : null

    try {
      const res = await fetch(MUSIC_SOURCES[0], { method: 'HEAD', cache: 'no-store' })
      const type = res.headers.get('content-type') || '(არ არის)'
      const size = res.headers.get('content-length') || '(უცნობი)'

      console.warn(
        `[Winter] მუსიკის დიაგნოსტიკა → URL: ${MUSIC_SOURCES[0]} | ბოლო ცდა: ${src} | status: ${res.status} | Content-Type: ${type} | ზომა: ${size} | MediaError: ${mediaErr}`
      )

      if (!res.ok) {
        console.warn('[Winter] ფაილი სერვერზე ვერ მოიძებნა. შეამოწმე გზა და ფაილის სახელი (დიდი/პატარა ასოები). თუ ფაილი სხვაგანაა, შეცვალე MUSIC_SOURCES winter.js-ის დასაწყისში.')
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

    // უკვე უკრავს → ახალი ჩართვა არ გვჭირდება (დუბლირება/თავიდან დაწყება გამორიცხულია)
    if (!audio.paused) { unbindUnlock(); return }
    if (musicBusy) return

    musicBusy = true
    try {
      await audio.play()
      if (!enabled) { audio.pause(); return }
      unbindUnlock()
    } catch (err) {
      if (err?.name === 'NotAllowedError') {
        bindUnlock()               // ბრაუზერი ითხოვს მომხმარებლის ინტერაქციას
      } else if (err?.name !== 'AbortError' && err?.name !== 'NotSupportedError') {
        console.warn('[Winter] მუსიკა ვერ ჩაირთო:', err)
        diagnoseAudio()
      }
    } finally {
      musicBusy = false
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
    musicStart = null
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify({ pos: 0, ts: 0, playing: false }))
      localStorage.setItem(POS_KEY, '0')
    } catch {}
  }

  /* ---------- დეკორი: დამხმარე გენერატორები ---------- */

  const BAUBLE_COLORS = [
    ['#ff5d6c', '#a91d2c'],
    ['#ffd966', '#b8902f'],
    ['#6fe39a', '#1f8a4f'],
    ['#9ad7ff', '#3b78b8'],
    ['#f6efd8', '#9aa4a0']
  ]
  const BAUBLE_KINDS = ['ball', 'star', 'ball', 'drop', 'ball', 'star', 'drop', 'ball', 'star']

  // ნათურების ფერები: წითელი, მწვანე, ოქროსფერი, ლურჯი  [ძირითადი, მუქი]
  const BULB_COLORS = [
    ['#ff4d5e', '#a91d2c'],
    ['#5fe08f', '#17803f'],
    ['#ffd45c', '#b8860b'],
    ['#6cb8ff', '#2a62b0']
  ]

  let uidN = 0
  const uid = () => `wn${++uidN}`

  // განმეორებადი "შემთხვევითობა": ერთი და იგივე ხე ყოველთვის ერთნაირად გამოიყურება
  function mulberry32(seed) {
    let a = seed | 0
    return () => {
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  const f1 = n => Math.round(n * 10) / 10

  function starPath(cx, cy, R, r) {
    let d = ''
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const rad = i % 2 ? r : R
      d += `${i ? 'L' : 'M'}${f1(cx + Math.cos(a) * rad)} ${f1(cy + Math.sin(a) * rad)}`
    }
    return `${d}Z`
  }

  // წითელი/ოქროსფერი ბაფთა (ცენტრი 0,0)
  function bowShape(color, dark) {
    return `
      <path d="M0 0C-5-10-16-9-14-2C-12 3-4 3 0 0Z" fill="${color}"/>
      <path d="M0 0C5-10 16-9 14-2C12 3 4 3 0 0Z" fill="${color}"/>
      <path d="M0 1C-3 8-7 13-10 19L-4 16L-1 21L1 3Z" fill="${color}"/>
      <path d="M0 1C3 8 7 13 10 19L4 16L1 21L-1 3Z" fill="${color}" opacity=".92"/>
      <path d="M-1 0C-5-6-10-6-11-3M1 0C5-6 10-6 11-3" fill="none" stroke="${dark}" stroke-width=".9" stroke-linecap="round" opacity=".55"/>
      <circle r="2.6" fill="${dark}"/>
      <circle cx="-.8" cy="-.9" r="1" fill="#fff" opacity=".45"/>`
  }

  function bowSVG(color = '#d62839', dark = '#8f1422') {
    return `<svg viewBox="-20 -14 40 38" aria-hidden="true" focusable="false">${bowShape(color, dark)}</svg>`
  }

  // საჩუქრის ყუთი: სხეული + თავსახური + ლენტი + ბაფთა
  function giftG(id, x, y, w, h, body, ribbon, bowDark) {
    const cx = x + w / 2
    return `
      <g>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.6" fill="${body}"/>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.6" fill="url(#sh${id})"/>
        <rect x="${f1(cx - 2.2)}" y="${y}" width="4.4" height="${h}" fill="${ribbon}"/>
        <rect x="${x - 1.6}" y="${f1(y - 4.2)}" width="${w + 3.2}" height="5.6" rx="1.4" fill="${body}"/>
        <rect x="${x - 1.6}" y="${f1(y - 4.2)}" width="${w + 3.2}" height="5.6" rx="1.4" fill="url(#sh${id})"/>
        <rect x="${f1(cx - 2.2)}" y="${f1(y - 4.2)}" width="4.4" height="5.6" fill="${ribbon}"/>
        <rect x="${x}" y="${y}" width="${w}" height="1.2" fill="#fff" opacity=".18"/>
        <g transform="translate(${f1(cx)} ${f1(y - 4.4)}) scale(${f1(Math.min(.75, w / 40 + .22))})">${bowShape(ribbon, bowDark)}</g>
      </g>`
  }

  const GIFT_SHADE = id => `
    <linearGradient id="sh${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity=".16"/>
      <stop offset=".55" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".30"/>
    </linearGradient>`

  /* ----- ნაძვის ხე ----- */
  function treeSVG(seed) {
    const id = uid()
    const rand = mulberry32(seed * 7919 + 13)
    const cx = 100
    const tiers = [
      { top: 34, bot: 104, hw: 42 },
      { top: 70, bot: 156, hw: 60 },
      { top: 114, bot: 210, hw: 79 },
      { top: 158, bot: 256, hw: 95 }
    ]

    const tierD = ({ top, bot, hw }) => {
      const n = Math.max(4, Math.round(hw / 12))
      const step = (hw * 2) / n
      const mid = top + (bot - top) * 0.56
      let d = `M${cx} ${top} Q${f1(cx + hw * 0.36)} ${f1(mid)} ${cx + hw} ${bot}`
      for (let i = 0; i < n; i++) {
        const x1 = cx + hw - i * step
        const x2 = x1 - step
        d += ` Q${f1((x1 + x2) / 2)} ${bot + 12} ${f1(x2)} ${bot}`
      }
      return `${d} Q${f1(cx - hw * 0.36)} ${f1(mid)} ${cx} ${top}Z`
    }

    let body = ''
    for (let ti = tiers.length - 1; ti >= 0; ti--) {
      const t = tiers[ti]
      const d = tierD(t)
      let needles = ''
      for (let k = 0; k < 9; k++) {
        const y = t.top + (t.bot - t.top) * (0.3 + rand() * 0.62)
        const half = t.hw * ((y - t.top) / (t.bot - t.top)) * 0.82
        const x = cx + (rand() * 2 - 1) * half
        const dir = x >= cx ? 1 : -1
        const dx = dir * (5 + rand() * 6)
        const dy = 5 + rand() * 4
        needles += `M${f1(x)} ${f1(y)}l${f1(dx)} ${f1(dy)}`
      }
      body += `
        <path d="${d}" fill="url(#g${id})"/>
        <path d="${d}" fill="url(#h${id})"/>
        <path d="${needles}" fill="none" stroke="#02150b" stroke-opacity=".28" stroke-width="1.5" stroke-linecap="round"/>
        <path d="${needles}" transform="translate(-1.6 -1.6)" fill="none" stroke="#7df0a8" stroke-opacity=".16" stroke-width="1.1" stroke-linecap="round"/>
        <path d="${d}" fill="none" stroke="#eaf6ff" stroke-opacity=".22" stroke-width="1"/>`
    }

    // განათებები: სადენი + ნათურები. ციმციმი ჯგუფებად (5 ჯგუფი) → ცოტა ანიმაცია, ბუნებრივი შედეგი
    const glow = [[], [], [], [], []]
    let cores = ''
    let wires = ''
    let bulbN = 0
    const swags = [[0.66], [0.66], [0.5, 0.86], [0.5, 0.86]]

    tiers.forEach((t, ti) => {
      swags[ti].forEach((frac, si) => {
        const y0 = t.top + (t.bot - t.top) * frac
        const halfW = t.hw * ((y0 - t.top) / (t.bot - t.top)) * 0.9
        const sag = 8 + ti * 2
        const n = [3, 4, 5, 6][ti] - (si ? 1 : 0)
        wires += `M${f1(cx - halfW)} ${f1(y0)}Q${cx} ${f1(y0 + sag * 2)} ${f1(cx + halfW)} ${f1(y0)}`

        for (let i = 0; i < n; i++) {
          const tt = (i + 0.5) / n
          const x = (1 - tt) * (1 - tt) * (cx - halfW) + 2 * (1 - tt) * tt * cx + tt * tt * (cx + halfW)
          const y = (1 - tt) * (1 - tt) * y0 + 2 * (1 - tt) * tt * (y0 + sag * 2) + tt * tt * y0 + 1.4
          const ci = (bulbN + ti + si) % 4
          const c = BULB_COLORS[ci][0]
          glow[(bulbN * 3 + ti) % 5].push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="8" fill="url(#gl${ci}${id})"/>`)
          cores += `<circle cx="${f1(x)}" cy="${f1(y)}" r="2.3" fill="${c}"/><circle cx="${f1(x - .6)}" cy="${f1(y - .7)}" r=".7" fill="#fff" opacity=".85"/>`
          bulbN++
        }
      })
    })

    const glowDefs = BULB_COLORS.map(([c], ci) => `
      <radialGradient id="gl${ci}${id}">
        <stop offset="0" stop-color="${c}" stop-opacity=".95"/>
        <stop offset=".42" stop-color="${c}" stop-opacity=".34"/>
        <stop offset="1" stop-color="${c}" stop-opacity="0"/>
      </radialGradient>`).join('')

    // ბურთულები
    const balls = [
      [86, 94, '#ff4d5e'], [113, 128, '#f2c14e'], [79, 150, '#9ad7ff'], [123, 178, '#ff4d5e'],
      [69, 198, '#f2c14e'], [132, 224, '#f6efd8'], [95, 240, '#ff4d5e'], [108, 64, '#f2c14e']
    ].map(([x, y, c]) => `
      <g transform="translate(${x} ${y})">
        <rect x="-1.3" y="-6.6" width="2.6" height="2.2" rx=".6" fill="#d9a62e"/>
        <circle r="4.6" fill="${c}"/>
        <circle r="4.6" fill="url(#bs${id})"/>
        <circle cx="-1.6" cy="-1.8" r="1.35" fill="#fff" opacity=".8"/>
      </g>`).join('')

    // საჩუქრები ძირში (ფერები seed-ის მიხედვით ცვლება)
    const sets = [
      ['#d62839', '#f2c14e', '#8f1422', '#1f8a4f', '#fbf7ee', '#0f5a33'],
      ['#1f8a4f', '#fbf7ee', '#0f5a33', '#d62839', '#f2c14e', '#8f1422']
    ]
    const [a1, a2, a3, b1, b2, b3] = sets[seed % 2]
    const gifts =
      giftG(id, 18, 252, 34, 28, a1, a2, a3) +
      giftG(id, 144, 257, 30, 23, b1, b2, b3) +
      giftG(id, 56, 264, 22, 16, '#f2c14e', '#d62839', '#8f1422') +
      giftG(id, 160, 267, 20, 14, '#f6efd8', '#d62839', '#8f1422')

    return `
<svg viewBox="0 -14 200 300" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2fae67"/><stop offset=".55" stop-color="#17703f"/><stop offset="1" stop-color="#0b3f24"/>
    </linearGradient>
    <linearGradient id="h${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#9dffc2" stop-opacity=".22"/><stop offset=".5" stop-color="#9dffc2" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".34"/>
    </linearGradient>
    <linearGradient id="tr${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#6b4423"/><stop offset=".5" stop-color="#4a2c14"/><stop offset="1" stop-color="#2b1a0e"/>
    </linearGradient>
    <radialGradient id="bs${id}"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></radialGradient>
    <radialGradient id="sg${id}"><stop offset="0" stop-color="#fff2b8" stop-opacity=".95"/><stop offset=".4" stop-color="#f2c14e" stop-opacity=".38"/><stop offset="1" stop-color="#f2c14e" stop-opacity="0"/></radialGradient>
    <linearGradient id="sf${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff7cf"/><stop offset=".5" stop-color="#ffd966"/><stop offset="1" stop-color="#c8921f"/></linearGradient>
    ${glowDefs}${GIFT_SHADE(id)}
  </defs>
  <ellipse cx="100" cy="278" rx="82" ry="6" fill="#000" opacity=".32"/>
  <rect x="90" y="250" width="20" height="26" fill="url(#tr${id})"/>
  ${body}
  <path d="${wires}" fill="none" stroke="#06150d" stroke-opacity=".7" stroke-width="1"/>
  ${glow.map((g, k) => `<g class="winter-tl g${k}">${g.join('')}</g>`).join('')}
  ${cores}
  ${balls}
  <circle class="winter-star-glow" cx="100" cy="24" r="34" fill="url(#sg${id})"/>
  <path class="winter-star-flare" d="M100 -8L102 24L100 56L98 24Z" fill="#fff7cf" opacity=".85"/>
  <path class="winter-star-flare f2" d="M64 24L100 22L136 24L100 26Z" fill="#fff7cf" opacity=".85"/>
  <path d="${starPath(100, 24, 14, 6)}" fill="url(#sf${id})" stroke="#b8821b" stroke-width=".6" stroke-linejoin="round"/>
  <path d="${starPath(100, 24, 7, 3)}" fill="#fffbe6" opacity=".7"/>
  ${gifts}
</svg>`
  }

  /* ----- ოქროსფერი ზარი ბაფთითა და ჰოლით ----- */
  function bellSVG() {
    const id = uid()
    return `
<svg viewBox="0 0 56 78" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="bg${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#8a5f12"/><stop offset=".22" stop-color="#e0a92b"/><stop offset=".42" stop-color="#fff1b8"/>
      <stop offset=".62" stop-color="#f2c14e"/><stop offset="1" stop-color="#7a520d"/>
    </linearGradient>
    <radialGradient id="bc${id}" cx=".35" cy=".3"><stop offset="0" stop-color="#fff1b8"/><stop offset=".6" stop-color="#e0a92b"/><stop offset="1" stop-color="#8a5f12"/></radialGradient>
  </defs>
  <circle cx="28" cy="8" r="5" fill="none" stroke="#d9a62e" stroke-width="2.2"/>
  <path d="M28 12C17 12 14 24 14 34C14 46 9 50 6 59L50 59C47 50 42 46 42 34C42 24 39 12 28 12Z" fill="url(#bg${id})"/>
  <path class="winter-glint" d="M21 21C18 29 18 38 17 47" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M6 59L50 59" stroke="#8a5f12" stroke-width="1.2" opacity=".5"/>
  <ellipse cx="28" cy="59" rx="22" ry="4.6" fill="#b8821b"/>
  <ellipse cx="28" cy="60" rx="18" ry="3" fill="#4d3206"/>
  <circle cx="28" cy="65" r="5" fill="url(#bc${id})"/>
  <g transform="translate(28 13) scale(.86)">${bowShape('#d62839', '#8f1422')}</g>
  <path d="M28 14C33 9 40 9 41 13C37 16 31 16 28 14Z" fill="#1f8a4f"/>
  <path d="M28 14C23 9 16 9 15 13C19 16 25 16 28 14Z" fill="#0f6a38"/>
  <circle cx="28" cy="16" r="2" fill="#ff4d5e"/><circle cx="25" cy="17" r="1.6" fill="#d62839"/><circle cx="31" cy="17" r="1.6" fill="#d62839"/>
</svg>`
  }

  /* ----- საშობაო გვირგვინი ----- */
  function wreathSVG(seed) {
    const id = uid()
    const rand = mulberry32(seed * 104729 + 7)
    const cx = 50
    const cy = 58
    const R = 31
    let leaves = ''
    const greens = ['#0f5a33', '#1f8a4f', '#2fae67', '#14683a']

    for (let i = 0; i < 52; i++) {
      const a = (i / 52) * 360 + rand() * 4
      const rad = ((a - 90) * Math.PI) / 180
      const rr = R + (rand() * 6 - 3)
      const x = cx + Math.cos(rad) * rr
      const y = cy + Math.sin(rad) * rr
      leaves += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(8 + rand() * 3)}" ry="3.4" transform="rotate(${f1(a + rand() * 40 - 20)} ${f1(x)} ${f1(y)})" fill="${greens[i % 4]}"/>`
    }
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * 360 + 6
      const rad = ((a - 90) * Math.PI) / 180
      const rr = R + (rand() * 5 - 2.5)
      const x = cx + Math.cos(rad) * rr
      const y = cy + Math.sin(rad) * rr
      leaves += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="7" ry="2.6" transform="rotate(${f1(a + 70 + rand() * 30)} ${f1(x)} ${f1(y)})" fill="#47c985" opacity=".55"/>`
    }

    let berries = ''
    for (let i = 0; i < 10; i++) {
      const a = rand() * 360
      const rad = ((a - 90) * Math.PI) / 180
      const rr = R + (rand() * 8 - 4)
      const x = cx + Math.cos(rad) * rr
      const y = cy + Math.sin(rad) * rr
      berries += `<circle cx="${f1(x)}" cy="${f1(y)}" r="2.3" fill="#e63946"/><circle cx="${f1(x - .6)}" cy="${f1(y - .7)}" r=".7" fill="#fff" opacity=".7"/>`
    }

    const golds = [200, 320, 95].map(a => {
      const rad = ((a - 90) * Math.PI) / 180
      const x = cx + Math.cos(rad) * R
      const y = cy + Math.sin(rad) * R
      return `<circle cx="${f1(x)}" cy="${f1(y)}" r="3.4" fill="#f2c14e"/><circle cx="${f1(x - 1)}" cy="${f1(y - 1.1)}" r="1" fill="#fff" opacity=".8"/>`
    }).join('')

    const lights = [[12, 0], [72, 1], [140, 2], [205, 3], [262, 0], [320, 1]].map(([a, ci], k) => {
      const rad = ((a - 90) * Math.PI) / 180
      const x = f1(cx + Math.cos(rad) * (R + 1))
      const y = f1(cy + Math.sin(rad) * (R + 1))
      return { k, svg: `<circle cx="${x}" cy="${y}" r="7.5" fill="url(#wl${ci}${id})"/>`, core: `<circle cx="${x}" cy="${y}" r="1.7" fill="${BULB_COLORS[ci][0]}"/>` }
    })

    const defs = BULB_COLORS.map(([c], ci) => `
      <radialGradient id="wl${ci}${id}">
        <stop offset="0" stop-color="${c}" stop-opacity=".95"/><stop offset=".45" stop-color="${c}" stop-opacity=".3"/><stop offset="1" stop-color="${c}" stop-opacity="0"/>
      </radialGradient>`).join('')

    return `
<svg viewBox="0 0 100 122" aria-hidden="true" focusable="false">
  <defs>${defs}</defs>
  <path d="M50 0L50 ${cy - R + 3}" stroke="#d9a62e" stroke-width="1.5"/>
  <path d="M46 ${cy - R + 6}L50 ${cy - R - 2}L54 ${cy - R + 6}Z" fill="#d9a62e"/>
  ${leaves}${berries}${golds}
  <g class="winter-tl g0">${lights.filter(l => l.k % 2 === 0).map(l => l.svg).join('')}</g>
  <g class="winter-tl g3">${lights.filter(l => l.k % 2 === 1).map(l => l.svg).join('')}</g>
  ${lights.map(l => l.core).join('')}
  <g transform="translate(50 ${cy + R - 1}) scale(1.35)">${bowShape('#d62839', '#8f1422')}</g>
</svg>`
  }

  /* ----- საჩუქრების ჯგუფი ----- */
  function giftsSVG() {
    const id = uid()
    return `
<svg viewBox="0 0 120 76" aria-hidden="true" focusable="false">
  <defs>${GIFT_SHADE(id)}</defs>
  <ellipse cx="60" cy="72" rx="56" ry="4" fill="#000" opacity=".3"/>
  ${giftG(id, 8, 36, 46, 34, '#d62839', '#f2c14e', '#b8821b')}
  ${giftG(id, 60, 46, 34, 24, '#1f8a4f', '#fbf7ee', '#cfc7b0')}
  ${giftG(id, 20, 18, 26, 14, '#f2c14e', '#d62839', '#8f1422')}
  ${giftG(id, 96, 56, 20, 14, '#f6efd8', '#d62839', '#8f1422')}
</svg>`
  }

  /* ----- ნაძვის ტოტების გირლანდა (გამეორებადი ნაჭერი) ----- */
  function swagSVG() {
    const id = uid()
    const rand = mulberry32(51)
    const greens = ['#0f5a33', '#1f8a4f', '#2fae67', '#14683a', '#3cc27a']
    const pt = t => {
      const x = (1 - t) * (1 - t) * -2 + 2 * (1 - t) * t * 80 + t * t * 162
      const y = (1 - t) * (1 - t) * 3 + 2 * (1 - t) * t * 50 + t * t * 3
      return [x, y]
    }

    let needles = ''
    for (let i = 0; i < 90; i++) {
      const t = 0.03 + rand() * 0.94
      const [x, y] = pt(t)
      const a = Math.PI / 2 + (rand() * 1.5 - 0.75) + (t < 0.5 ? -0.25 : 0.25)
      const len = 8 + rand() * 7
      needles += `<path d="M${f1(x)} ${f1(y)}l${f1(Math.cos(a) * len)} ${f1(Math.sin(a) * len)}" stroke="${greens[i % 5]}" stroke-width="2.1" stroke-linecap="round" fill="none"/>`
    }

    let berries = ''
    for (let i = 0; i < 8; i++) {
      const [x, y] = pt(0.08 + rand() * 0.84)
      berries += `<circle cx="${f1(x)}" cy="${f1(y + 3 + rand() * 6)}" r="2.1" fill="#e63946"/>`
    }

    let snow = ''
    for (let i = 0; i < 16; i++) {
      const [x, y] = pt(0.05 + rand() * 0.9)
      snow += `<path d="M${f1(x - 3)} ${f1(y + 1)}l${f1(5 + rand() * 3)} .6" stroke="#fff" stroke-opacity=".8" stroke-width="1.6" stroke-linecap="round"/>`
    }

    const [mx, my] = pt(0.5)
    const [lx, ly] = pt(0.22)
    const [rx, ry] = pt(0.78)
    const orn = (x, y, c, c2) => `
      <path d="M${f1(x)} ${f1(y)}v5" stroke="#d9a62e" stroke-width=".9"/>
      <circle cx="${f1(x)}" cy="${f1(y + 9)}" r="4.4" fill="${c}"/><circle cx="${f1(x)}" cy="${f1(y + 9)}" r="4.4" fill="url(#ob${id})"/>
      <circle cx="${f1(x - 1.4)}" cy="${f1(y + 7.6)}" r="1.2" fill="#fff" opacity=".8"/>`

    return `
<svg width="100%" height="56" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="ob${id}"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></radialGradient>
    <pattern id="sw${id}" width="160" height="56" patternUnits="userSpaceOnUse">
      <path d="M-2 3Q80 50 162 3" fill="none" stroke="#2b1a0e" stroke-width="3.2"/>
      ${needles}${berries}${snow}
      ${orn(lx, ly, '#f2c14e')}${orn(rx, ry, '#ff4d5e')}
      <g transform="translate(${f1(mx)} ${f1(my + 1)}) scale(.9)">${bowShape('#d62839', '#8f1422')}</g>
    </pattern>
  </defs>
  <rect width="100%" height="56" fill="url(#sw${id})"/>
</svg>`
  }

  /* ---------- დეკორი: განთავსება ---------- */

  const deco = (tag, cls, html, attrs = '') =>
    `<${tag} class="winter-deco ${cls}" aria-hidden="true" ${attrs}>${html}</${tag}>`

  const tree = (cls, seed, delay) =>
    deco('div', `winter-tree-wrap ${cls}`,
      `<div class="winter-tree-in">${treeSVG(seed)}</div>`,
      `data-winter-react=".5" style="--fd:${delay}s"`)

  const orn = (cls, inner, strength, dur, dl, w) =>
    deco('div', `winter-orn ${cls}`,
      `<div class="winter-orn-in" style="--dur:${dur}s;--dl:${dl}s">${inner}</div>`,
      `data-winter-react="${strength}" style="--ow:${w}px"`)

  function addBranches(parent) {
    if (!parent) return
    ;['tl', 'tr'].forEach(pos => {
      const branch = document.createElement('div')
      branch.className = `winter-branch ${pos}`
      branch.setAttribute('aria-hidden', 'true')
      const bow = document.createElement('i')
      bow.className = 'winter-bow'
      bow.innerHTML = bowSVG()
      branch.appendChild(bow)
      parent.appendChild(branch)
    })
  }

  // ორნამენტები გირლანდის სადენზე (მდებარეობა px-ებშია, ამიტომ resize-ზე თავიდან აიგება)
  function addBaubles(garland, joints) {
    joints.forEach((x, i) => {
      const [c1, c2] = BAUBLE_COLORS[(i * 2 + Math.floor(Math.random() * 2)) % BAUBLE_COLORS.length]
      const el = document.createElement('i')
      el.className = `winter-bauble ${BAUBLE_KINDS[i % BAUBLE_KINDS.length]}`
      el.setAttribute('aria-hidden', 'true')
      el.style.setProperty('--x', `${x}px`)
      el.style.setProperty('--len', `${7 + Math.random() * 7}px`)
      el.style.setProperty('--size', `${12 + Math.random() * 4}px`)
      el.style.setProperty('--c1', c1)
      el.style.setProperty('--c2', c2)
      el.style.setProperty('--dur', `${2.8 + Math.random() * 1.8}s`)
      el.style.setProperty('--delay', `${-Math.random() * 3}s`)
      garland.appendChild(el)
    })
  }

  // სადენი + ინდივიდუალურად მოციმციმე ნათურები (ფერები, ტემპი და ციმციმის ტიპი თითოეულს განსხვავებული)
  function buildGarland(garland) {
    garland.textContent = ''

    const w = window.innerWidth
    const small = w < 700
    const seg = small ? 92 : 150
    const n = Math.max(2, Math.round(w / seg))
    const segW = w / n
    const sag = small ? 8 : 12
    const y0 = 3
    const yc = y0 + sag * 2
    const perSeg = small ? 3 : 4
    const bw = small ? 6.5 : 8.5

    let d = `M0 ${y0}`
    for (let i = 0; i < n; i++) {
      d += ` Q${f1((i + 0.5) * segW)} ${yc} ${f1((i + 1) * segW)} ${y0}`
    }

    garland.insertAdjacentHTML(
      'beforeend',
      `<svg class="winter-wire" viewBox="0 0 ${w} 40" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="#467a56" stroke-width="1.7" stroke-linecap="round"/></svg>`
    )

    const frag = document.createDocumentFragment()
    let ci = Math.floor(Math.random() * 4)

    for (let i = 0; i < n; i++) {
      const x0 = i * segW
      const xc = x0 + segW / 2
      const x2 = x0 + segW

      for (let k = 1; k <= perSeg; k++) {
        const t = k / (perSeg + 1)
        const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * xc + t * t * x2
        const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * yc + t * t * y0
        const dx = 2 * (1 - t) * (xc - x0) + 2 * t * (x2 - xc)
        const dy = 2 * (1 - t) * (yc - y0) + 2 * t * (y0 - yc)
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI

        ci = (ci + 1 + (Math.random() < 0.3 ? 1 : 0)) % 4
        const [c1, c2] = BULB_COLORS[ci]

        const bulb = document.createElement('i')
        bulb.className = `winter-bulb v${Math.floor(Math.random() * 3)}`
        bulb.setAttribute('aria-hidden', 'true')
        bulb.style.cssText =
          `left:${f1(x)}px;top:${f1(y)}px;--c:${c1};--c2:${c2};--bw:${bw}px;` +
          `--r:${f1(angle * 0.5)}deg;--d:${f1(rnd(1.9, 5.4))}s;--dl:${f1(-rnd(0, 5))}s`
        bulb.appendChild(document.createElement('b'))
        frag.appendChild(bulb)
      }
    }
    garland.appendChild(frag)

    const joints = []
    for (let i = 1; i < n; i += 2) joints.push(f1(i * segW))
    addBaubles(garland, joints)
  }

  // ყინულის ლოლოები header-ის ქვედა კიდეზე
  function addIcicles() {
    const header = document.querySelector('.site-header')
    if (!header || header.querySelector('.winter-icicles')) return

    ensurePositioned(header)

    const ice = document.createElement('div')
    ice.className = 'winter-icicles'
    ice.setAttribute('aria-hidden', 'true')
    header.appendChild(ice)
  }

  // position:static ელემენტს ვხდით relative-ად (და მერე უკან ვაბრუნებთ)
  function ensurePositioned(el) {
    if (el && getComputedStyle(el).position === 'static') {
      el.style.position = 'relative'
      el.dataset.winterPos = '1'
    }
  }

  // სანტას ქუდი ლოგოზე
  function addHat() {
    const mark = document.querySelector('.brand-mark')
    if (!mark || mark.querySelector('.winter-hat')) return
    ensurePositioned(mark)
    const hat = document.createElement('i')
    hat.className = 'winter-hat'
    hat.setAttribute('aria-hidden', 'true')
    mark.appendChild(hat)
  }

  // თოვლის გროვა footer-ის ზედა კიდეზე
  function addDrift() {
    const footer = document.querySelector('footer')
    if (!footer || footer.querySelector('.winter-drift')) return
    ensurePositioned(footer)
    const drift = document.createElement('div')
    drift.className = 'winter-drift'
    drift.setAttribute('aria-hidden', 'true')
    footer.appendChild(drift)
  }

  // დეკორაციები ცალკეულ სექციებში — თავმოყრილი არ არის, ყველა თავისი ადგილას დგას
  function addSectionDecor() {
    const hero = document.querySelector('.hero')
    const film = document.querySelector('.arduinohub-film-section')
    const footer = document.querySelector('footer')

    // hero: ზარები ტოტებიდან ჩამოკიდებული
    if (hero) {
      ensurePositioned(hero)
      hero.insertAdjacentHTML('beforeend',
        orn('winter-bell hb-l1', bellSVG(), 1.6, 4.2, -0.4, 36) +
        orn('winter-bell hb-l2', bellSVG(), 1.2, 3.6, -1.9, 27) +
        orn('winter-bell hb-r1', bellSVG(), 1.6, 4.8, -2.6, 36) +
        orn('winter-bell hb-r2', bellSVG(), 1.2, 3.9, -0.9, 27))
    }

    // film სექცია: ტოტების გირლანდა ზემოთ, გვირგვინები გვერდებზე, პატარა ხეები ქვედა კუთხეებში
    if (film) {
      ensurePositioned(film)
      film.insertAdjacentHTML('beforeend',
        deco('div', 'winter-swag', swagSVG()) +
        orn('winter-wreath wl', wreathSVG(3), 1, 6.2, -1.2, 92) +
        orn('winter-wreath wr', wreathSVG(8), 1, 7.1, -3.4, 84) +
        tree('in l sm', 3, 0.7) +
        tree('in r sm', 4, 0.9))
    }

    // footer: ორი ხე თოვლის გროვაზე + საჩუქრების ჯგუფი
    if (footer) {
      ensurePositioned(footer)
      footer.insertAdjacentHTML('beforeend',
        tree('top l lg', 1, 0.5) +
        tree('top r md', 2, 0.8) +
        deco('div', 'winter-gifts', giftsSVG()))
    }
  }

  let garlandResizeTimer = 0
  let garlandWidth = 0
  function onGarlandResize() {
    clearTimeout(garlandResizeTimer)
    garlandResizeTimer = setTimeout(() => {
      const g = document.getElementById('winter-garland')
      if (!g || window.innerWidth === garlandWidth) return
      garlandWidth = window.innerWidth
      buildGarland(g)
    }, 250)
  }

  function mountDecor() {
    if (document.getElementById('winter-garland')) return

    const garland = document.createElement('div')
    garland.id = 'winter-garland'
    garland.setAttribute('aria-hidden', 'true')
    garlandWidth = window.innerWidth
    buildGarland(garland)

    const frost = document.createElement('div')
    frost.id = 'winter-frost'
    frost.setAttribute('aria-hidden', 'true')

    const aurora = document.createElement('div')
    aurora.id = 'winter-aurora'
    aurora.setAttribute('aria-hidden', 'true')

    const glow = document.createElement('div')
    glow.id = 'winter-glow'
    glow.setAttribute('aria-hidden', 'true')

    const canvas = document.createElement('canvas')
    canvas.id = 'winter-snow'
    canvas.setAttribute('aria-hidden', 'true')

    document.body.append(aurora, glow, garland, frost, canvas)

    // ტოტები hero-სა და footer-ის კუთხეებში (header-ს არ ფარავს)
    addBranches(document.querySelector('.hero'))
    addBranches(document.querySelector('footer'))
    addBranches(document.querySelector('.arduinohub-film-section'))

    addIcicles()
    addHat()
    addDrift()
    addSectionDecor()

    window.addEventListener('resize', onGarlandResize, { passive: true })
  }

  function unmountDecor() {
    window.removeEventListener('resize', onGarlandResize)
    clearTimeout(garlandResizeTimer)

    document.getElementById('winter-garland')?.remove()
    document.getElementById('winter-frost')?.remove()
    document.getElementById('winter-aurora')?.remove()
    document.getElementById('winter-glow')?.remove()
    document.getElementById('winter-snow')?.remove()
    document.querySelectorAll('.winter-branch, .winter-icicles, .winter-hat, .winter-drift, .winter-deco').forEach(node => node.remove())

    document.querySelectorAll('[data-winter-pos]').forEach(el => {
      el.style.position = ''
      delete el.dataset.winterPos
    })
  }

  /* ---------- თოვლი ---------- */

  // სპრაიტები ერთხელ იხატება და მერე მხოლოდ drawImage-ით გამოიყენება → სწრაფია
  function makeSprite(size, draw) {
    const c = document.createElement('canvas')
    c.width = c.height = size
    draw(c.getContext('2d'), size)
    return c
  }

  function buildSprites() {
    // რბილი ბურთულა
    const dot = makeSprite(32, (x, s) => {
      const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
      g.addColorStop(0, 'rgba(255,255,255,1)')
      g.addColorStop(0.4, 'rgba(255,255,255,.85)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      x.fillStyle = g
      x.fillRect(0, 0, s, s)
    })

    // ფოკუსგარეშე დიდი ფიფქი (bokeh) — ახლო ფენის სიღრმისთვის
    const bokeh = makeSprite(48, (x, s) => {
      const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
      g.addColorStop(0, 'rgba(255,255,255,.5)')
      g.addColorStop(0.7, 'rgba(255,255,255,.4)')
      g.addColorStop(0.92, 'rgba(255,255,255,.75)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      x.fillStyle = g
      x.fillRect(0, 0, s, s)
    })

    // ოქროსფერი მტვრის ნაწილაკი
    const gold = makeSprite(32, (x, s) => {
      const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
      g.addColorStop(0, 'rgba(255,240,184,1)')
      g.addColorStop(0.3, 'rgba(242,193,78,.7)')
      g.addColorStop(1, 'rgba(242,193,78,0)')
      x.fillStyle = g
      x.fillRect(0, 0, s, s)
    })

    // ექვსქიმიანი კრისტალური ფიფქი (3 ვარიანტი)
    const variants = [
      [[0.5, 0.26], [0.75, 0.18]],
      [[0.38, 0.2], [0.6, 0.3]],
      [[0.55, 0.3]]
    ]
    const crystals = variants.map(branches =>
      makeSprite(64, (x, s) => {
        const c = s / 2
        const R = s * 0.44
        x.translate(c, c)
        x.strokeStyle = '#ffffff'
        x.lineCap = 'round'
        x.lineWidth = s * 0.05
        x.shadowColor = 'rgba(190,225,255,.95)'
        x.shadowBlur = s * 0.09

        for (let i = 0; i < 6; i++) {
          x.save()
          x.rotate((i * Math.PI) / 3)
          x.beginPath()
          x.moveTo(0, 0)
          x.lineTo(0, -R)
          for (const [t, len] of branches) {
            const y = -R * t
            const l = R * len
            x.moveTo(0, y)
            x.lineTo(-l * 0.8, y - l * 0.7)
            x.moveTo(0, y)
            x.lineTo(l * 0.8, y - l * 0.7)
          }
          x.stroke()
          x.restore()
        }
        x.beginPath()
        x.arc(0, 0, s * 0.035, 0, Math.PI * 2)
        x.fillStyle = '#fff'
        x.fill()
      })
    )

    // ოთხქიმიანი ვარსკვლავი ნაპერწკლებისთვის
    const stars = ['#fff3c4', '#ffd966', '#ff8a94', '#ffffff'].map(color =>
      makeSprite(32, (x, s) => {
        const c = s / 2
        const g = x.createRadialGradient(c, c, 0, c, c, c)
        g.addColorStop(0, color)
        g.addColorStop(0.25, color)
        g.addColorStop(1, 'rgba(255,255,255,0)')
        x.globalAlpha = 0.55
        x.fillStyle = g
        x.fillRect(0, 0, s, s)
        x.globalAlpha = 1
        x.fillStyle = color
        x.beginPath()
        x.moveTo(c, 1)
        x.quadraticCurveTo(c, c, s - 1, c)
        x.quadraticCurveTo(c, c, c, s - 1)
        x.quadraticCurveTo(c, c, 1, c)
        x.quadraticCurveTo(c, c, c, 1)
        x.fill()
      })
    )

    return { dot, bokeh, gold, crystals, stars }
  }

  function startSnow() {
    if (snow) return
    if (reduceMotion()) return

    const canvas = document.getElementById('winter-snow')
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const sprites = buildSprites()
    const finePointer = window.matchMedia('(pointer: fine)').matches
    const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4

    let w = 0
    let h = 0
    let raf = 0
    let last = 0
    let resizeTimer = 0
    let nextShoot = 0
    let nextTwinkle = 0
    let mx = -9999
    let my = -9999
    let lastSX = -9999
    let lastSY = -9999
    let wind = 0
    let windTarget = 0
    let nextWind = 0
    let degraded = false
    let fpsAcc = 0
    let fpsN = 0
    const flakes = []
    const sparks = []
    const motes = []
    const twinks = []
    let shooter = null
    let rocket = null
    let nextFire = performance.now() + 9000 + Math.random() * 6000

    // 4 სიღრმის ფენა: შორეული (პატარა, ნელი) → ახლო (დიდი, სწრაფი) → ფოკუსგარეშე bokeh
    const make = initial => {
      const r = Math.random()
      const layer = r < 0.46 ? 0 : r < 0.8 ? 1 : r < 0.94 ? 2 : 3
      const crystal = (layer === 1 || layer === 2) && Math.random() < (layer === 1 ? 0.14 : 0.24)

      const size = crystal
        ? (layer === 1 ? rnd(11, 17) : rnd(18, 28))
        : [rnd(2, 3.8), rnd(4, 7.5), rnd(7, 12), rnd(16, 30)][layer]

      return {
        layer,
        crystal,
        sprite: crystal
          ? sprites.crystals[Math.floor(Math.random() * sprites.crystals.length)]
          : layer === 3 ? sprites.bokeh : sprites.dot,
        size,
        x: Math.random() * w,
        y: initial ? Math.random() * h : -size - 4,
        speed: [rnd(0.3, 0.55), rnd(0.6, 1.0), rnd(1.0, 1.6), rnd(1.3, 2.0)][layer],
        wind: [0.5, 1, 1.7, 2.4][layer],
        phase: Math.random() * Math.PI * 2,
        freq: rnd(0.008, 0.022),
        sway: rnd(0.12, 0.55),
        // ახლო ფენის ალფა შეზღუდულია, რომ ტექსტი და ღილაკები არ დაიფაროს
        alpha: crystal ? rnd(0.55, 0.85) : [rnd(0.28, 0.5), rnd(0.45, 0.75), rnd(0.28, 0.5), rnd(0.05, 0.12)][layer],
        rot: Math.random() * Math.PI * 2,
        vr: rnd(-0.02, 0.02)
      }
    }

    const targetCount = () => {
      let n = Math.min(150, Math.max(36, w / 10))
      if (w < 700) n *= 0.72
      if (lowEnd) n *= 0.75
      if (degraded) n *= 0.6
      return Math.round(Math.max(24, n))
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, w < 700 ? 1.25 : 1.5)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const target = targetCount()
      while (flakes.length < target) flakes.push(make(true))
      flakes.length = target
    }

    const spawnSpark = (x, y, burst) => {
      if (sparks.length > 90) return
      const a = Math.random() * Math.PI * 2
      const v = burst ? rnd(0.8, 3.2) : rnd(0.1, 0.7)
      sparks.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - (burst ? 0.6 : 0),
        life: rnd(28, 55),
        max: 55,
        size: rnd(8, burst ? 18 : 14),
        sprite: sprites.stars[Math.floor(Math.random() * sprites.stars.length)]
      })
    }

    const launchRocket = () => {
      rocket = {
        x: rnd(w * 0.15, w * 0.85),
        y: h + 10,
        ty: rnd(h * 0.14, h * 0.4),
        vy: -rnd(7, 9.5)
      }
    }

    const burstFirework = (x, y) => {
      if (sparks.length > 170) return
      const main = Math.floor(Math.random() * sprites.stars.length)
      const n = 36
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd(-0.08, 0.08)
        const v = rnd(1.4, 3.4)
        sparks.push({
          x, y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life: rnd(48, 78),
          max: 78,
          size: rnd(9, 15),
          drag: 0.985,
          sprite: Math.random() < 0.72 ? sprites.stars[main] : sprites.stars[Math.floor(Math.random() * sprites.stars.length)]
        })
      }
    }

    const spawnShooter = () => {
      shooter = {
        x: rnd(w * 0.05, w * 0.75),
        y: rnd(h * 0.04, h * 0.3),
        vx: rnd(9, 13),
        vy: rnd(3.5, 6),
        life: 0,
        max: 55
      }
    }

    // ოქროსფერი მტვერი: ნელა მოცურავს ზემოთ, რბილად ჩნდება და ქრება
    const spawnMote = () => {
      const life = rnd(520, 1000)
      motes.push({
        x: Math.random() * w,
        y: rnd(h * 0.25, h * 1.02),
        vy: -rnd(0.05, 0.2),
        ph: Math.random() * 6.28,
        size: rnd(6, 16),
        t: 0,
        life,
        peak: rnd(0.25, 0.5)
      })
    }

    // მოციმციმე ვარსკვლავები: პერიოდულად ჩნდება შემთხვევით ადგილას
    const spawnTwinkle = () => {
      twinks.push({
        x: Math.random() * w,
        y: rnd(h * 0.04, h * 0.85),
        size: rnd(10, 22),
        t: 0,
        life: rnd(70, 120),
        sprite: sprites.stars[Math.floor(Math.random() * 3)]
      })
    }

    const frame = time => {
      raf = requestAnimationFrame(frame)

      const dt = Math.min((time - last) / 16.7 || 1, 3)
      last = time

      // FPS-ის დაცვა: თუ მოწყობილობა ვერ აგვყვა, ნაწილაკებს ვამცირებთ
      fpsAcc += dt
      if (++fpsN >= 120) {
        if (fpsAcc / fpsN > 1.9 && !degraded) {
          degraded = true
          flakes.length = Math.max(24, Math.round(flakes.length * 0.6))
          motes.length = 0
          twinks.length = 0
        }
        fpsAcc = 0
        fpsN = 0
      }

      // ცოცხალი ქარი: ნელა იცვლის მიმართულებასა და ძალას, ზოგჯერ ძლიერი ნაკადი
      if (time > nextWind) {
        windTarget = rnd(-0.55, 0.75) * (Math.random() < 0.18 ? 1.8 : 1)
        nextWind = time + rnd(3500, 9000)
      }
      wind += (windTarget - wind) * 0.004 * dt
      const gust = wind + Math.sin(time * 0.0011) * 0.1

      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'

      for (const f of flakes) {
        f.phase += f.freq * dt
        f.y += f.speed * (1 - Math.min(0.12, Math.abs(gust) * 0.1)) * dt
        f.x += (Math.sin(f.phase) * f.sway + gust * f.wind) * dt

        // მაუსი ფიფქებს ფრთხილად აცილებს
        if (finePointer && (f.layer === 1 || f.layer === 2)) {
          const dx = f.x - mx
          const dy = f.y - my
          const d2 = dx * dx + dy * dy
          if (d2 < 7000 && d2 > 1) {
            const d = Math.sqrt(d2)
            const push = (1 - d / 84) * 2.2 * dt
            f.x += (dx / d) * push
            f.y += (dy / d) * push * 0.6
          }
        }

        if (f.y > h + f.size) Object.assign(f, make(false), { x: Math.random() * w })
        if (f.x > w + 40) f.x = -40
        if (f.x < -40) f.x = w + 40

        ctx.globalAlpha = f.alpha

        if (f.crystal) {
          f.rot += f.vr * dt
          ctx.save()
          ctx.translate(f.x, f.y)
          ctx.rotate(f.rot)
          ctx.drawImage(f.sprite, -f.size / 2, -f.size / 2, f.size, f.size)
          ctx.restore()
        } else {
          ctx.drawImage(f.sprite, f.x - f.size / 2, f.y - f.size / 2, f.size, f.size)
        }
      }

      ctx.globalAlpha = 1

      // ოქროსფერი მტვერი და მოციმციმე ვარსკვლავები (დამატებითი შერევა)
      ctx.globalCompositeOperation = 'lighter'

      if (!degraded) {
        const moteCap = w < 700 ? 7 : 16
        if (motes.length < moteCap && Math.random() < 0.02 * dt) spawnMote()

        for (let i = motes.length - 1; i >= 0; i--) {
          const m = motes[i]
          m.t += dt
          if (m.t >= m.life) { motes.splice(i, 1); continue }
          m.ph += 0.01 * dt
          m.y += m.vy * dt
          m.x += (Math.sin(m.ph) * 0.18 + gust * 0.35) * dt
          ctx.globalAlpha = Math.sin((m.t / m.life) * Math.PI) * m.peak
          ctx.drawImage(sprites.gold, m.x - m.size / 2, m.y - m.size / 2, m.size, m.size)
        }

        const twinkCap = w < 700 ? 3 : 7
        if (time > nextTwinkle) {
          if (twinks.length < twinkCap) spawnTwinkle()
          nextTwinkle = time + rnd(450, 1300)
        }

        for (let i = twinks.length - 1; i >= 0; i--) {
          const t = twinks[i]
          t.t += dt
          if (t.t >= t.life) { twinks.splice(i, 1); continue }
          const k = Math.sin((t.t / t.life) * Math.PI)
          const s = t.size * (0.55 + 0.45 * k)
          ctx.globalAlpha = k * 0.85
          ctx.drawImage(t.sprite, t.x - s / 2, t.y - s / 2, s, s)
        }
      }

      // ნაპერწკლები (მაუსის კვალი და კლიკი)
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i]
        p.life -= dt
        if (p.life <= 0) { sparks.splice(i, 1); continue }
        if (p.drag) { p.vx *= p.drag; p.vy *= p.drag }
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += 0.03 * dt
        const k = p.life / p.max
        const s = p.size * (0.4 + 0.6 * k)
        ctx.globalAlpha = Math.min(1, k * 1.4)
        ctx.drawImage(p.sprite, p.x - s / 2, p.y - s / 2, s, s)
      }

      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'

      // ფეიერვერკი: იშვიათად, ზევით ადის და იფანტება
      if (!rocket && time > nextFire) {
        launchRocket()
        nextFire = time + rnd(20000, 38000)
      }

      if (rocket) {
        rocket.y += rocket.vy * dt
        if (sparks.length < 150) {
          sparks.push({
            x: rocket.x + rnd(-1, 1), y: rocket.y,
            vx: rnd(-0.15, 0.15), vy: rnd(0.2, 0.6),
            life: 16, max: 16, size: 7, sprite: sprites.stars[1]
          })
        }
        if (rocket.y <= rocket.ty) {
          burstFirework(rocket.x, rocket.y)
          rocket = null
        }
      }

      // ცვივა ვარსკვლავი
      if (!shooter && time > nextShoot) {
        if (nextShoot) spawnShooter()
        nextShoot = time + rnd(7000, 16000)
      }

      if (shooter) {
        const s = shooter
        s.life += dt
        s.x += s.vx * dt
        s.y += s.vy * dt

        const k = 1 - s.life / s.max
        if (k <= 0 || s.x > w + 100 || s.y > h + 100) {
          shooter = null
        } else {
          const tx = s.x - s.vx * 11
          const ty = s.y - s.vy * 11
          const g = ctx.createLinearGradient(s.x, s.y, tx, ty)
          g.addColorStop(0, `rgba(255,246,214,${0.95 * k})`)
          g.addColorStop(1, 'rgba(255,246,214,0)')
          ctx.strokeStyle = g
          ctx.lineWidth = 2
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(s.x, s.y)
          ctx.lineTo(tx, ty)
          ctx.stroke()

          ctx.globalAlpha = k
          ctx.drawImage(sprites.stars[1], s.x - 9, s.y - 9, 18, 18)
          ctx.globalAlpha = 1
        }
      }
    }

    const onResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(resize, 150)
    }

    const onMove = e => {
      mx = e.clientX
      my = e.clientY
      if (e.pointerType === 'touch') return
      const dx = mx - lastSX
      const dy = my - lastSY
      if (dx * dx + dy * dy > 340) {
        lastSX = mx
        lastSY = my
        spawnSpark(mx, my, false)
      }
    }

    const onLeave = e => {
      if (!e.relatedTarget) { mx = -9999; my = -9999 }
    }

    const onDown = e => {
      if (!e.isPrimary) return
      for (let i = 0; i < 9; i++) spawnSpark(e.clientX, e.clientY, true)
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

    w = window.innerWidth
    h = window.innerHeight
    resize()
    raf = requestAnimationFrame(frame)
    window.addEventListener('resize', onResize, { passive: true })
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    document.addEventListener('mouseout', onLeave)
    document.addEventListener('visibilitychange', onVisibility)

    snow = {
      stop() {
        cancelAnimationFrame(raf)
        clearTimeout(resizeTimer)
        window.removeEventListener('resize', onResize)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerdown', onDown)
        document.removeEventListener('mouseout', onLeave)
        document.removeEventListener('visibilitychange', onVisibility)
      }
    }
  }

  function stopSnow() {
    if (!snow) return
    snow.stop()
    snow = null
  }

  /* ---------- მაუსზე ძალიან ნაზი რეაქცია (ზარები, გვირგვინები, ხეები) ---------- */

  function startReact() {
    if (react) return
    if (reduceMotion()) return
    if (!window.matchMedia('(pointer: fine)').matches) return

    const items = Array.from(document.querySelectorAll('[data-winter-react]'))
    if (!items.length) return

    let raf = 0
    let nx = 0
    let ny = 0

    const paint = () => {
      raf = 0
      for (const el of items) {
        const s = parseFloat(el.dataset.winterReact) || 1
        el.style.transform =
          `translate3d(${(nx * s * 3).toFixed(2)}px,${(ny * s * 1.2).toFixed(2)}px,0) rotate(${(nx * s * 1.6).toFixed(2)}deg)`
      }
    }

    const onMove = e => {
      nx = (e.clientX / window.innerWidth) * 2 - 1
      ny = (e.clientY / window.innerHeight) * 2 - 1
      if (!raf) raf = requestAnimationFrame(paint)
    }

    const onLeave = e => {
      if (e.relatedTarget) return
      nx = 0
      ny = 0
      if (!raf) raf = requestAnimationFrame(paint)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('mouseout', onLeave)

    react = {
      stop() {
        cancelAnimationFrame(raf)
        window.removeEventListener('pointermove', onMove)
        document.removeEventListener('mouseout', onLeave)
        items.forEach(el => { el.style.transform = '' })
      }
    }
  }

  function stopReact() {
    if (!react) return
    react.stop()
    react = null
  }

  /* ---------- რეჟიმის ჩართვა / გამორთვა ---------- */

  function apply(on) {
    on = Boolean(on)
    if (on === enabled && document.body.classList.contains('winter-mode') === on) return

    enabled = on
    writeCache(on)

    if (on) {
      // 1) ჯერ ყველა სხვა მუსიკა ჩერდება და იბლოკება, 2) მერე ვრთავთ საახალწლოს
      installMediaGuard()
      silenceOthers()

      document.documentElement.classList.add('winter-mode')
      document.body.classList.add('winter-mode')
      mountDecor()
      startSnow()
      startReact()
      tryPlay()
    } else {
      document.documentElement.classList.remove('winter-mode')
      document.body.classList.remove('winter-mode')
      stopSnow()
      stopReact()
      stopMusic()
      unmountDecor()

      // საახალწლო მუსიკა გაჩერებულია → ჩვეულებრივი სისტემა ბრუნდება
      removeMediaGuard()
      restoreOthers()
    }
  }

  /* ---------- Supabase: მდგომარეობა და Realtime ---------- */

  async function fetchState() {
    const db = await getClient()
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

  async function subscribe() {
    const db = await getClient()
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
    const db = await getClient()

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

  function saveOnLeave() {
    if (enabled && music && !music.paused) writeState(true)
  }

  window.addEventListener('pagehide', saveOnLeave)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveOnLeave()
  })

  function init() {
    // მყისიერად აღვადგინოთ ბოლო ცნობილი მდგომარეობა (ციმციმის გარეშე)
    if (readCache()) apply(true)

    fetchState()
    subscribe()

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return
      fetchState()
      if (enabled) tryPlay()    // ტაბში დაბრუნებისას მუსიკა თუ გაჩერებულია, გაგრძელდეს
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true })
  } else {
    init()
  }
})()
