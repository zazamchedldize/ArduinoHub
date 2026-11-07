/* =========================================================
   ArduinoHub — Winter Mode (winter.js)
   დამოუკიდებელი ფაილი: script.js-ს არ ეხება.
   - /winter და /winterstop (მხოლოდ ადმინისთვის, როგორც /poll)
   - სინქრონი Supabase Realtime-ით (ცხრილი site_modes)
   - მდგომარეობა რჩება refresh-ის შემდეგაც
   - თოვლი (canvas): ფიფქების 3 ფენა, კრისტალური ფიფქები, ქარი, მაუსის ეფექტები,
     ნაპერწკლები, ცვივა ვარსკვლავი, ფეიერვერკი
   - გირლანდა + ქანაობადი ბურთულები/ვარსკვლავები, ყინულის ლოლოები, ნაძვის ტოტები,
     ყინვის ჩარჩო, ჩრდილოეთის ნათება (aurora), სანტას ქუდი ლოგოზე, თოვლის გროვა footer-ზე
   - მუსიკა: autoplay ცდა, დაბლოკვისას პირველი ინტერაქცია, loop, ღილაკის გარეშე
   ========================================================= */
(() => {
  'use strict'

  if (window.__arduinoHubWinter) return
  window.__arduinoHubWinter = true

  const MODE_ID = 'winter'
  const CACHE_KEY = 'arduinohub_winter_mode'
  const POS_KEY = 'arduinohub_winter_pos'
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

  /* ---------- მუსიკა ---------- */

  const readPos = () => {
    try { return parseFloat(localStorage.getItem(POS_KEY)) || 0 } catch { return 0 }
  }

  const writePos = value => {
    try { localStorage.setItem(POS_KEY, String(value)) } catch {}
  }

  function ensureAudio() {
    if (music) return music

    music = new Audio(MUSIC_SRC)
    music.loop = true
    music.preload = 'auto'
    music.volume = MUSIC_VOLUME

    music.addEventListener('error', diagnoseAudio)

    // გვერდიდან გვერდზე გადასვლისას განაგრძოს იქიდან, სადაც შეჩერდა
    music.addEventListener('loadedmetadata', () => {
      const saved = readPos()
      if (saved > 0 && Number.isFinite(music.duration) && saved < music.duration - 1) {
        try { music.currentTime = saved } catch {}
      }
    }, { once: true })

    let lastSave = 0
    music.addEventListener('timeupdate', () => {
      const now = Date.now()
      if (now - lastSave < 1000) return
      lastSave = now
      writePos(music.currentTime)
    })

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
    writePos(0)
  }

  /* ---------- დეკორი ---------- */

  const BAUBLE_COLORS = [
    ['#ff5d6c', '#a91d2c'],
    ['#ffd966', '#b8902f'],
    ['#6fe39a', '#1f8a4f'],
    ['#9ad7ff', '#3b78b8'],
    ['#f6efd8', '#9aa4a0']
  ]
  const BAUBLE_POS = [5, 16, 28, 40, 52, 63, 75, 87, 95]
  const BAUBLE_KINDS = ['ball', 'star', 'ball', 'drop', 'ball', 'star', 'drop', 'ball', 'star']

  function addBranches(parent) {
    if (!parent) return
    ;['tl', 'tr'].forEach(pos => {
      const branch = document.createElement('div')
      branch.className = `winter-branch ${pos}`
      branch.setAttribute('aria-hidden', 'true')
      parent.appendChild(branch)
    })
  }

  // ქანაობადი ბურთულები გირლანდაზე
  function addBaubles(garland) {
    BAUBLE_POS.forEach((x, i) => {
      const [c1, c2] = BAUBLE_COLORS[(i * 2 + Math.floor(Math.random() * 2)) % BAUBLE_COLORS.length]
      const el = document.createElement('i')
      el.className = `winter-bauble ${BAUBLE_KINDS[i]}`
      el.setAttribute('aria-hidden', 'true')
      el.style.setProperty('--x', `${x + (Math.random() * 4 - 2)}%`)
      el.style.setProperty('--len', `${8 + Math.random() * 10}px`)
      el.style.setProperty('--size', `${13 + Math.random() * 5}px`)
      el.style.setProperty('--c1', c1)
      el.style.setProperty('--c2', c2)
      el.style.setProperty('--dur', `${2.8 + Math.random() * 1.8}s`)
      el.style.setProperty('--delay', `${-Math.random() * 3}s`)
      garland.appendChild(el)
    })
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

  function mountDecor() {
    if (document.getElementById('winter-garland')) return

    const garland = document.createElement('div')
    garland.id = 'winter-garland'
    garland.setAttribute('aria-hidden', 'true')
    addBaubles(garland)

    const frost = document.createElement('div')
    frost.id = 'winter-frost'
    frost.setAttribute('aria-hidden', 'true')

    const aurora = document.createElement('div')
    aurora.id = 'winter-aurora'
    aurora.setAttribute('aria-hidden', 'true')

    const canvas = document.createElement('canvas')
    canvas.id = 'winter-snow'
    canvas.setAttribute('aria-hidden', 'true')

    document.body.append(aurora, garland, frost, canvas)

    // ტოტები hero-სა და footer-ის კუთხეებში (header-ს არ ფარავს)
    addBranches(document.querySelector('.hero'))
    addBranches(document.querySelector('footer'))
    addBranches(document.querySelector('.arduinohub-film-section'))

    addIcicles()
    addHat()
    addDrift()
  }

  function unmountDecor() {
    document.getElementById('winter-garland')?.remove()
    document.getElementById('winter-frost')?.remove()
    document.getElementById('winter-aurora')?.remove()
    document.getElementById('winter-snow')?.remove()
    document.querySelectorAll('.winter-branch, .winter-icicles, .winter-hat, .winter-drift').forEach(node => node.remove())

    document.querySelectorAll('[data-winter-pos]').forEach(el => {
      el.style.position = ''
      delete el.dataset.winterPos
    })
  }

  /* ---------- თოვლი ---------- */

  // ფიფქების "სპრაიტები" ერთხელ იხატება და მერე მხოლოდ drawImage-ით გამოიყენება → სწრაფია
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

    return { dot, crystals, stars }
  }

  function startSnow() {
    if (snow) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const canvas = document.getElementById('winter-snow')
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const sprites = buildSprites()
    const finePointer = window.matchMedia('(pointer: fine)').matches

    let w = 0
    let h = 0
    let raf = 0
    let last = 0
    let resizeTimer = 0
    let nextShoot = 0
    let mx = -9999
    let my = -9999
    let lastSX = -9999
    let lastSY = -9999
    const flakes = []
    const sparks = []
    let shooter = null
    let rocket = null
    let nextFire = performance.now() + 9000 + Math.random() * 6000

    const rnd = (a, b) => a + Math.random() * (b - a)

    // 3 სიღრმის ფენა: შორეული (პატარა, ნელი) → ახლო (დიდი, სწრაფი)
    const make = initial => {
      const r = Math.random()
      const layer = r < 0.5 ? 0 : r < 0.85 ? 1 : 2
      const crystal = layer > 0 && Math.random() < (layer === 1 ? 0.14 : 0.24)

      const size = crystal
        ? (layer === 1 ? rnd(11, 17) : rnd(18, 28))
        : [rnd(2.5, 4.5), rnd(4, 7.5), rnd(7, 13)][layer]

      return {
        layer,
        crystal,
        sprite: crystal
          ? sprites.crystals[Math.floor(Math.random() * sprites.crystals.length)]
          : sprites.dot,
        size,
        x: Math.random() * w,
        y: initial ? Math.random() * h : -size - 4,
        speed: [rnd(0.35, 0.65), rnd(0.6, 1.0), rnd(1.0, 1.7)][layer],
        wind: [0.5, 1, 1.8][layer],
        phase: Math.random() * Math.PI * 2,
        sway: rnd(0.15, 0.6),
        alpha: crystal ? rnd(0.6, 0.9) : [rnd(0.35, 0.6), rnd(0.5, 0.8), rnd(0.3, 0.6)][layer],
        rot: Math.random() * Math.PI * 2,
        vr: rnd(-0.02, 0.02)
      }
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // მობილურზე ნაკლები ნაწილაკი
      const target = Math.round(Math.min(140, Math.max(40, w / 11)))
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

    const frame = time => {
      raf = requestAnimationFrame(frame)

      const dt = Math.min((time - last) / 16.7 || 1, 3)
      last = time

      // ქარის ნაკადები: ნელი ტალღა + მცირე ბორძიკი
      const gust = Math.sin(time * 0.00028) * 0.35 + Math.sin(time * 0.0011) * 0.12

      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'

      for (const f of flakes) {
        f.phase += 0.012 * dt
        f.y += f.speed * dt
        f.x += (Math.sin(f.phase) * f.sway + gust * f.wind) * dt

        // მაუსი ფიფქებს ფრთხილად აცილებს
        if (finePointer && f.layer > 0) {
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
        if (f.x > w + 30) f.x = -30
        if (f.x < -30) f.x = w + 30

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

      // ნაპერწკლები (მაუსის კვალი და კლიკი)
      if (sparks.length) {
        ctx.globalCompositeOperation = 'lighter'
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
      }

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
    if (enabled && music && !music.paused) writePos(music.currentTime)
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
      if (!document.hidden) fetchState()
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true })
  } else {
    init()
  }
})()
