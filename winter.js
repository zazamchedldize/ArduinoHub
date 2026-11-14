/* =========================================================
   ArduinoHub — Winter Mode (winter.js) · v6 Christmas Experience
   დამოუკიდებელი ფაილი: script.js-ს არ ეხება.
   - /winter და /winterstop (მხოლოდ ადმინისთვის, როგორც /poll)
   - სინქრონი Supabase Realtime-ით (ცხრილი site_modes) + localStorage cache + storage event
     (ტაბებს შორის), ამიტომ refresh-ის და გვერდებს შორის გადასვლის შემდეგაც
     რეჟიმი სწორად განისაზღვრება
   - Doomsday ჰოლოგრამები (#hero-update-panel, #nyc-section, #dg-layer) იმალება
     მხოლოდ CSS-ით (html.winter-mode), კოდი და DOM უცვლელია → /winterstop-ზე
     ისინი ზუსტად იმავე მდგომარეობით ბრუნდება
   - თოვლი (canvas): 4 სიღრმის ფენა, კრისტალური ფიფქები (3D-ტრიალი), ქარის ტურბულენტობა,
     ოქროსფერი მტვერი, მოციმციმე ვარსკვლავები, ნაპერწკლები, ფეიერვერკი
   - სრული ნაძვის ხეები (ვარსკვლავი, ფერადი განათებები, ოქროსფერი/წითელი სათამაშოები,
     საჩუქრები), ნათურები თოვლზე და რბილი "fairy" ნათურები. დაკიდებული დეკორი არ არის.
   - მუსიკა: ერთი გლობალური Audio, სხვა მუსიკის დათრგუნვა (/winter) და აღდგენა (/winterstop),
     გვერდებს შორის პოზიციის გაგრძელება, autoplay-ის დაცვა
   ========================================================= */
(() => {
  'use strict'

  if (window.__arduinoHubWinter) return
  window.__arduinoHubWinter = true

  const MODE_ID = 'winter'
  const MODE_TABLE = 'site_modes'   // Supabase ცხრილი: ერთი ჩანაწერი (id='winter') = მთელი საიტის მდგომარეობა
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
    // Doomsday ათვლის წიკწიკი (tick) /winter-ის დროს არ ისმის; /winterstop-ზე თავისით აღდგება
    if (/tick/i.test(el.currentSrc || el.src || '')) return true
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
  /*GEN-START*/
  // ნათურების ფერები: წითელი, მწვანე, ოქროსფერი, ლურჯი  [ძირითადი, მუქი]
  const BULB_COLORS = [
    ['#ff4d5e', '#a91d2c'],
    ['#5fe08f', '#17803f'],
    ['#ffd45c', '#b8860b'],
    ['#6cb8ff', '#2a62b0']
  ]

  // სათამაშოები: წითელი და ოქროსფერი ჭარბობს, ზოგჯერ ლურჯი/ვერცხლისფერი
  const ORN_COLORS = [
    ['#e63946', '#8f1422'],
    ['#f2c14e', '#a97612'],
    ['#e63946', '#8f1422'],
    ['#f2c14e', '#a97612'],
    ['#7cc4ff', '#2a62b0'],
    ['#f6efd8', '#8e9a96']
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

  /* ----- სრული ნაძვის ხე: ხუთსართულიანი, თოვლიანი ტოტებით, სპირალური განათებებით,
     ოქროსფერი/წითელი სათამაშოებით, მბზინავი ვარსკვლავით და საჩუქრებით ძირში ----- */
  function treeSVG(seed, forceId) {
    const id = forceId || uid()
    const rand = mulberry32(seed * 7919 + 13)
    const cx = 120
    const tiers = [
      { top: 38, bot: 108, hw: 34 },
      { top: 78, bot: 156, hw: 52 },
      { top: 122, bot: 202, hw: 68 },
      { top: 166, bot: 246, hw: 83 },
      { top: 208, bot: 288, hw: 99 }
    ]

    // ფენის კონტური: ქვედა კიდეზე დახრილი, წვეტიანი ტოტები (არარეგულარული სიღრმით)
    const tierD = ({ top, bot, hw }, jitter) => {
      const n = Math.max(5, Math.round(hw / 9))
      const step = (hw * 2) / n
      const mid = top + (bot - top) * 0.56
      let d = `M${cx} ${top} Q${f1(cx + hw * 0.34)} ${f1(mid)} ${f1(cx + hw)} ${bot}`
      for (let i = 0; i < n; i++) {
        const x1 = cx + hw - i * step
        const x2 = x1 - step
        const tx = (x1 + x2) / 2 + (rand() - 0.5) * step * 0.3
        const depth = 10 + rand() * 11 * jitter
        d += ` Q${f1(x1 - step * 0.12)} ${f1(bot + depth * 0.8)} ${f1(tx)} ${f1(bot + depth)}`
        d += ` Q${f1(x2 + step * 0.12)} ${f1(bot + depth * 0.8)} ${f1(x2)} ${bot}`
      }
      return `${d} Q${f1(cx - hw * 0.34)} ${f1(mid)} ${cx} ${top}Z`
    }

    let body = ''
    for (let ti = tiers.length - 1; ti >= 0; ti--) {
      const t = tiers[ti]
      const back = tierD({ top: t.top + 5, bot: t.bot + 3, hw: t.hw * 1.06 }, 1.4)
      const d = tierD(t, 1)
      let needles = ''
      for (let k = 0; k < 16; k++) {
        const y = t.top + (t.bot - t.top) * (0.28 + rand() * 0.66)
        const half = t.hw * ((y - t.top) / (t.bot - t.top)) * 0.84
        const x = cx + (rand() * 2 - 1) * half
        const dir = x >= cx ? 1 : -1
        needles += `M${f1(x)} ${f1(y)}l${f1(dir * (5 + rand() * 7))} ${f1(5 + rand() * 5)}`
      }
      const mid = t.top + (t.bot - t.top) * 0.62
      const snow = [-1, 1].map(s =>
        `<ellipse cx="${f1(cx + s * t.hw * 0.44)}" cy="${f1(mid)}" rx="${f1(t.hw * 0.17)}" ry="2.4" transform="rotate(${s * 24} ${f1(cx + s * t.hw * 0.44)} ${f1(mid)})" fill="#fff" opacity=".78"/>`
      ).join('')

      body += `
        <path d="${back}" fill="url(#gb${id})"/>
        <path d="${d}" fill="url(#g${id})"/>
        <path d="${d}" fill="url(#h${id})"/>
        <path d="${needles}" fill="none" stroke="#02150b" stroke-opacity=".3" stroke-width="1.5" stroke-linecap="round"/>
        <path d="${needles}" transform="translate(-1.6 -1.6)" fill="none" stroke="#8cf5b6" stroke-opacity=".17" stroke-width="1.1" stroke-linecap="round"/>
        <path d="${d}" fill="none" stroke="#eaf6ff" stroke-opacity=".3" stroke-width="1.2" stroke-dasharray="14 9 5 11"/>
        ${snow}`
    }

    // განათებები: სადენი + ნათურები. ციმციმი 5 ჯგუფად, თითოეულს საკუთარი ტემპი
    const glow = [[], [], [], [], []]
    let cores = ''
    let wires = ''
    let bulbN = 0
    const swags = [[0.7], [0.74], [0.5, 0.84], [0.5, 0.84], [0.48, 0.82]]

    tiers.forEach((t, ti) => {
      swags[ti].forEach((frac, si) => {
        const y0 = t.top + (t.bot - t.top) * frac
        const halfW = t.hw * ((y0 - t.top) / (t.bot - t.top)) * 0.88
        const sag = 7 + ti * 2
        const n = 3 + ti + (si ? 1 : 0)
        wires += `M${f1(cx - halfW)} ${f1(y0)}Q${cx} ${f1(y0 + sag * 2)} ${f1(cx + halfW)} ${f1(y0)}`

        for (let i = 0; i < n; i++) {
          const tt = (i + 0.5) / n
          const x = (1 - tt) * (1 - tt) * (cx - halfW) + 2 * (1 - tt) * tt * cx + tt * tt * (cx + halfW)
          const y = (1 - tt) * (1 - tt) * y0 + 2 * (1 - tt) * tt * (y0 + sag * 2) + tt * tt * y0 + 1.4
          const ci = (bulbN + ti + si) % 4
          glow[(bulbN * 3 + ti) % 5].push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="9" fill="url(#gl${ci}${id})"/>`)
          cores += `<circle cx="${f1(x)}" cy="${f1(y)}" r="2.4" fill="${BULB_COLORS[ci][0]}"/><circle cx="${f1(x - .6)}" cy="${f1(y - .7)}" r=".75" fill="#fff" opacity=".85"/>`
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

    // სათამაშოები: ტოტების წვეროებთან, ბურთულები ოქროსფერი და წითელი აქცენტით
    let orns = ''
    let on = 0
    tiers.forEach((t, ti) => {
      if (!ti) return
      for (let k = 0; k < 3; k++) {
        const x = cx + (k - 1) * t.hw * 0.56 + (rand() - 0.5) * 8
        const y = t.bot - 4 - rand() * 9
        const [c1, c2] = ORN_COLORS[(on++ + ti) % ORN_COLORS.length]
        const r = 4.6 + rand() * 1.8
        orns += `
          <g transform="translate(${f1(x)} ${f1(y)})">
            <rect x="-1.4" y="${f1(-r - 2.6)}" width="2.8" height="2.4" rx=".6" fill="#d9a62e"/>
            <circle r="${f1(r)}" fill="${c1}"/>
            <circle r="${f1(r)}" fill="url(#bs${id})"/>
            <circle r="${f1(r * .62)}" fill="none" stroke="${c2}" stroke-width=".7" opacity=".5"/>
            <circle cx="${f1(-r * .36)}" cy="${f1(-r * .4)}" r="${f1(r * .26)}" fill="#fff" opacity=".85"/>
          </g>`
      }
    })
    // ზედა ფენაზე ერთი ოქროსფერი წვეთი
    orns += `
      <g transform="translate(${cx + 12} 88)">
        <rect x="-1.2" y="-9" width="2.4" height="2.2" rx=".5" fill="#d9a62e"/>
        <path d="M0 -7C5 -1 6 3 0 8C-6 3 -5 -1 0 -7Z" fill="#f2c14e"/>
        <path d="M-1.8 -2C-2.6 0 -2.4 2 -1.2 3.4" fill="none" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".8"/>
      </g>`

    // საჩუქრები ძირში (ფერები seed-ის მიხედვით ცვლება)
    const sets = [
      ['#d62839', '#f2c14e', '#8f1422', '#1f8a4f', '#fbf7ee', '#0f5a33'],
      ['#1f8a4f', '#fbf7ee', '#0f5a33', '#d62839', '#f2c14e', '#8f1422']
    ]
    const [a1, a2, a3, b1, b2, b3] = sets[seed % 2]
    const gifts =
      giftG(id, 20, 286, 34, 30, a1, a2, a3) +
      giftG(id, 56, 298, 22, 18, '#f2c14e', '#d62839', '#8f1422') +
      giftG(id, 164, 290, 32, 26, b1, b2, b3) +
      giftG(id, 198, 300, 22, 16, '#f6efd8', '#d62839', '#8f1422')

    return `
<svg viewBox="0 -22 240 344" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2fae67"/><stop offset=".55" stop-color="#17703f"/><stop offset="1" stop-color="#0b3f24"/>
    </linearGradient>
    <linearGradient id="gb${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#14683a"/><stop offset="1" stop-color="#062414"/>
    </linearGradient>
    <linearGradient id="h${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#9dffc2" stop-opacity=".24"/><stop offset=".5" stop-color="#9dffc2" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".36"/>
    </linearGradient>
    <linearGradient id="tr${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#6b4423"/><stop offset=".5" stop-color="#4a2c14"/><stop offset="1" stop-color="#2b1a0e"/>
    </linearGradient>
    <radialGradient id="bs${id}"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></radialGradient>
    <radialGradient id="sg${id}"><stop offset="0" stop-color="#fff2b8" stop-opacity=".95"/><stop offset=".4" stop-color="#f2c14e" stop-opacity=".38"/><stop offset="1" stop-color="#f2c14e" stop-opacity="0"/></radialGradient>
    <linearGradient id="sf${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff7cf"/><stop offset=".5" stop-color="#ffd966"/><stop offset="1" stop-color="#c8921f"/></linearGradient>
    ${glowDefs}${GIFT_SHADE(id)}
  </defs>
  <ellipse cx="120" cy="316" rx="100" ry="6.5" fill="#000" opacity=".34"/>
  <rect x="107" y="284" width="26" height="32" fill="url(#tr${id})"/>
  ${body}
  <path d="${wires}" fill="none" stroke="#06150d" stroke-opacity=".72" stroke-width="1"/>
  ${glow.map((g, k) => `<g class="winter-tl g${k}">${g.join('')}</g>`).join('')}
  ${cores}
  ${orns}
  <circle class="winter-star-glow" cx="120" cy="26" r="40" fill="url(#sg${id})"/>
  <path class="winter-star-flare" d="M120 -16L122.4 26L120 68L117.6 26Z" fill="#fff7cf" opacity=".85"/>
  <path class="winter-star-flare f2" d="M78 26L120 23.6L162 26L120 28.4Z" fill="#fff7cf" opacity=".85"/>
  <path d="${starPath(120, 26, 15.5, 6.6)}" fill="url(#sf${id})" stroke="#b8821b" stroke-width=".6" stroke-linejoin="round"/>
  <path d="${starPath(120, 26, 7.5, 3.2)}" fill="#fffbe6" opacity=".72"/>
  ${gifts}
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
  /*GEN-END*/

  /* ---------- დეკორი: განთავსება ----------
     ყველაფერი დგას (ხეები, საჩუქრები) ან ანათებს (ნათურები). არაფერი კიდია
     ეკრანის კიდეებზე, header-ზე ან გვერდებზე. */

  const deco = (tag, cls, html, attrs = '') =>
    `<${tag} class="winter-deco ${cls}" aria-hidden="true" ${attrs}>${html}</${tag}>`

  const tree = (cls, seed, delay) =>
    deco('div', `winter-tree-wrap ${cls}`,
      `<div class="winter-tree-in">${treeSVG(seed)}</div>`,
      `data-winter-react=".5" style="--fd:${delay}s"`)

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

  // თოვლის გროვა footer-ის ზედა კიდეზე (მიწა, რომელზეც ხეები დგას)
  function addDrift() {
    const footer = document.querySelector('footer')
    if (!footer || footer.querySelector('.winter-drift')) return
    ensurePositioned(footer)
    const drift = document.createElement('div')
    drift.className = 'winter-drift'
    drift.setAttribute('aria-hidden', 'true')
    footer.appendChild(drift)
  }

  // ნათურების რიგი თოვლზე (მიწაზე დაგებული სადენი): ყოველი ნათურა საკუთარი ფერითა და ტემპით
  function addLightRow(footer) {
    const n = isSmall() ? 13 : 26
    let pts = ''
    let bulbs = ''
    let ci = Math.floor(Math.random() * 4)

    for (let i = 0; i <= n; i++) {
      const x = (i / n) * 100
      const y = 9 + Math.sin(i * 0.95) * 3
      pts += `${i ? 'L' : 'M'}${f1(x)} ${f1(y)}`
      if (i === 0 || i === n) continue
      ci = (ci + 1 + (Math.random() < 0.3 ? 1 : 0)) % 4
      const [c1, c2] = BULB_COLORS[ci]
      bulbs += `<i class="winter-gl v${i % 3}" style="left:${f1(x)}%;top:${f1(y)}px;--c:${c1};--c2:${c2};--d:${f1(rnd(1.8, 5.6))}s;--dl:${f1(-rnd(0, 5))}s"></i>`
    }

    footer.insertAdjacentHTML('beforeend', deco('div', 'winter-lightrow',
      `<svg viewBox="0 0 100 20" preserveAspectRatio="none"><path d="${pts}" fill="none" stroke="#2c4a38" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>${bulbs}`))
  }

  // მოციმციმე რბილი ნათურები გვერდის სხვადასხვა ადგილას — უმეტესად გვერდით არეებში,
  // კონტენტის ქვემოთ/გვერდით; pointer-events გამორთულია და ტექსტს არ ფარავს
  function buildFairyLights(layer) {
    const n = isSmall() ? 9 : 18
    let html = ''

    for (let i = 0; i < n; i++) {
      const edge = Math.random() < 0.62
      const x = edge ? (Math.random() < 0.5 ? rnd(1, 5.5) : rnd(94.5, 99)) : rnd(8, 92)
      const y = rnd(8, 94)
      const [c1] = BULB_COLORS[i % 4]
      html += `<i class="winter-fl v${i % 3}" style="left:${f1(x)}%;top:${f1(y)}%;--c:${c1};--s:${f1(rnd(5, 9.5))}px;--d:${f1(rnd(2.2, 6.4))}s;--dl:${f1(-rnd(0, 6))}s"></i>`
    }
    layer.innerHTML = html
  }

  // დიდი ნაძვის ხე hero-ში — იქ, სადაც Doomsday-ის ჰოლოგრამა იდგა
  function addHeroStage() {
    const hero = document.querySelector('.hero')
    if (!hero || hero.querySelector('.winter-hero-stage')) return
    ensurePositioned(hero)
    hero.insertAdjacentHTML('beforeend', deco('div', 'winter-hero-stage',
      `${tree('hero', 5, 0.3)}<p class="winter-hero-caption">ბედნიერ დღესასწაულებს</p>`))
  }

  // ხეები სექციებში: film სექციის ქვედა კუთხეებში და footer-ის თოვლზე
  function addSectionDecor() {
    const film = document.querySelector('.arduinohub-film-section')
    const footer = document.querySelector('footer')

    if (film) {
      ensurePositioned(film)
      film.insertAdjacentHTML('beforeend',
        tree('in l sm', 3, 0.7) +
        tree('in r sm', 4, 0.9))
    }

    if (footer) {
      ensurePositioned(footer)
      footer.insertAdjacentHTML('beforeend',
        tree('top l lg', 1, 0.5) +
        tree('top r md', 2, 0.8) +
        deco('div', 'winter-gifts', giftsSVG()))
      addLightRow(footer)
    }
  }

  function mountDecor() {
    if (document.getElementById('winter-glow')) return

    const make = id => {
      const el = document.createElement('div')
      el.id = id
      el.setAttribute('aria-hidden', 'true')
      return el
    }

    const aurora = make('winter-aurora')
    const glow = make('winter-glow')
    const frost = make('winter-frost')
    const lights = make('winter-lights')
    buildFairyLights(lights)

    const canvas = document.createElement('canvas')
    canvas.id = 'winter-snow'
    canvas.setAttribute('aria-hidden', 'true')

    document.body.append(aurora, glow, lights, frost, canvas)

    addHat()
    addDrift()
    addHeroStage()
    addSectionDecor()
  }

  function unmountDecor() {
    ;['winter-frost', 'winter-aurora', 'winter-glow', 'winter-lights', 'winter-snow']
      .forEach(id => document.getElementById(id)?.remove())

    document.querySelectorAll('.winter-hat, .winter-drift, .winter-deco').forEach(node => node.remove())

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
        tilt: Math.random() * Math.PI * 2,
        vr: rnd(-0.02, 0.02)
      }
    }

    const targetCount = () => {
      let n = Math.min(190, Math.max(48, w / 8))
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
        // ქარის ტურბულენტობა: ფიფქები ადგილის მიხედვით სხვადასხვანაირად მოძრაობენ
        const swirl = Math.sin(f.y * 0.006 + time * 0.0006) * 0.2 + Math.cos(f.x * 0.004 - time * 0.0004) * 0.12
        f.x += (Math.sin(f.phase) * f.sway + (gust + swirl) * f.wind) * dt

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
          f.tilt += 0.018 * dt
          ctx.save()
          ctx.translate(f.x, f.y)
          ctx.rotate(f.rot)
          ctx.scale(0.55 + 0.45 * Math.abs(Math.cos(f.tilt)), 1)   // 3D-ტრიალის ილუზია
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

    window.dispatchEvent(new CustomEvent('winter:change', { detail: { enabled: on } }))
  }

  /* ---------- Supabase: მდგომარეობა და Realtime ---------- */

  async function fetchState() {
    const db = await getClient()
    if (!db) return

    const { data, error } = await db
      .from(MODE_TABLE)
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
        { event: '*', schema: 'public', table: MODE_TABLE, filter: `id=eq.${MODE_ID}` },
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

    const { error } = await db.from(MODE_TABLE).upsert({
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
    // სხვა ტაბში /winter ან /winterstop → ეს ტაბიც მაშინვე იცვლება (Supabase-ს არ ელოდება)
    window.addEventListener('storage', e => {
      if (e.key === CACHE_KEY && e.newValue != null) apply(e.newValue === '1')
    })

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
