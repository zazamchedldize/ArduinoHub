/* ============================================================================
 * ArduinoHub — Personal Analytics ("ჩემი სტატისტიკა")
 * ----------------------------------------------------------------------------
 * იტვირთება account.html-დან დინამიური import-ით:
 *   import('./stats.js').then(m => m.initStats({ db, user, root }))
 *
 * - იყენებს account.html-ის არსებულ Supabase კლიენტს (anon key) და სესიის მომხმარებელს.
 * - ყველა მოთხოვნა იფილტრება მხოლოდ მიმდინარე user.id-ით (+ RLS ბაზის მხარეს).
 * - გრაფიკები ხელით SVG-ია: ახალი ბიბლიოთეკა არ ემატება.
 * ========================================================================== */

const MONTHS = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ']
const TIMELINE_STEP = 10

// ვიქტორინისა და პროექტების სტატისტიკა ითვლება ამ მომენტიდან (თბილისის დრო, UTC+4).
// დასწრება (კლუბის შეხვედრები) ამ თარიღზე არ არის დამოკიდებული.
// ძველი მონაცემები ბაზაში რჩება; თარიღის გადაწევით/ამოღებით ისევ დაბრუნდება.
const STATS_START = '2026-11-21T00:00:00+04:00'

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[ch])

const icons = () => { if (window.lucide) window.lucide.createIcons() }
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/* ----------------------------- თარიღის დამხმარეები ----------------------------- */

const pad = n => String(n).padStart(2, '0')
const keyOfDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
const keyOfDay = str => String(str).slice(0, 7) // 'YYYY-MM-DD' → 'YYYY-MM' (დროის სარტყლის გარეშე)
const keyOfStamp = str => { const d = new Date(str); return Number.isNaN(d.getTime()) ? null : keyOfDate(d) }
const labelOfKey = key => { const [y, m] = key.split('-'); return `${MONTHS[Number(m) - 1]} ${String(y).slice(2)}` }

// Intl-ის ka-GE მხარდაჭერა გარემოზე დამოკიდებულია, ამიტომ თვეებს ხელით ვწერთ
const MONTHS_FULL = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი']
const longDate = d => `${d.getDate()} ${MONTHS_FULL[d.getMonth()]}, ${d.getFullYear()}`
const shortDate = d => `${d.getDate()} ${MONTHS[d.getMonth()]}`

function dayText(value) {
  const d = new Date(`${String(value).slice(0, 10)}T12:00:00`)
  return Number.isNaN(d.getTime()) ? String(value) : longDate(d)
}
function stampText(value) {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : longDate(d)
}

function lastMonthKeys(count) {
  const keys = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i--) keys.push(keyOfDate(new Date(now.getFullYear(), now.getMonth() - i, 1)))
  return keys
}

/* ----------------------------- მონაცემების ჩატვირთვა ----------------------------- */

const isMissingRelation = error => error && (
  ['42P01', 'PGRST205'].includes(error.code) || /does not exist|could not find the table/i.test(error.message || '')
)

async function loadAttendance(db, uid) {
  // მომხმარებლის ↔ club_members კავშირი ინახება club_member_links-ში (RLS: მხოლოდ საკუთარი ჩანაწერი)
  const linkRes = await db.from('club_member_links').select('member_id').eq('user_id', uid).maybeSingle()

  if (linkRes.error) {
    if (isMissingRelation(linkRes.error)) return { state: 'setup' }
    throw linkRes.error
  }
  if (!linkRes.data) return { state: 'unlinked' }

  const memberId = linkRes.data.member_id

  const [meetingsRes, mineRes] = await Promise.all([
    db.from('club_attendance').select('id,meeting_date').eq('counted', true).order('meeting_date', { ascending: true }),
    db.from('club_attendance_members').select('attendance_id').eq('member_id', memberId)
  ])
  if (meetingsRes.error) throw meetingsRes.error
  if (mineRes.error) throw mineRes.error

  const attendedIds = new Set((mineRes.data || []).map(r => r.attendance_id))
  const meetings = (meetingsRes.data || []).map(m => ({ id: m.id, date: m.meeting_date, attended: attendedIds.has(m.id) }))

  return { state: 'ok', meetings }
}

async function loadQuiz(db, uid) {
  const partRes = await db.from('quiz_participants')
    .select('id,room_id,score,joined_at').eq('user_id', uid).gte('joined_at', STATS_START)
    .order('joined_at', { ascending: true })
  if (partRes.error) throw partRes.error

  const parts = partRes.data || []
  if (!parts.length) return { state: 'ok', rows: [], answersAvailable: true }

  const roomIds = [...new Set(parts.map(p => p.room_id))]
  const partIds = parts.map(p => p.id)

  const [roomsRes, answersRes] = await Promise.all([
    db.from('quiz_rooms').select('id,title,topic,question_count,status,finished_at').in('id', roomIds),
    db.from('quiz_answers').select('participant_id,is_correct').in('participant_id', partIds)
  ])
  if (roomsRes.error) throw roomsRes.error

  const rooms = new Map((roomsRes.data || []).map(r => [r.id, r]))

  // RLS-ის გამო გამორთული პოლიტიკა შეცდომას კი არა, ცარიელ სიას აბრუნებს.
  // თუ ქულა არის, მაგრამ პასუხები ცარიელია, მონაცემს „მიუწვდომელს“ ვთვლით და არ ვაჩვენებთ ნულად.
  const answers = answersRes.error ? [] : (answersRes.data || [])
  const answersAvailable = !answersRes.error && !(answers.length === 0 && parts.some(p => Number(p.score) > 0))

  const byPart = new Map()
  for (const a of answers) {
    const s = byPart.get(a.participant_id) || { answered: 0, correct: 0 }
    s.answered++
    if (a.is_correct) s.correct++
    byPart.set(a.participant_id, s)
  }

  const rows = parts.map(p => {
    const room = rooms.get(p.room_id) || {}
    const s = byPart.get(p.id) || { answered: 0, correct: 0 }
    const finished = !!room.finished_at || room.status === 'finished'
    const total = Math.max(Number(room.question_count) || 0, s.answered)
    const percent = answersAvailable && finished && total > 0 ? Math.round((s.correct / total) * 100) : null

    return {
      id: p.id,
      title: room.title || room.topic || 'ვიქტორინა',
      date: room.finished_at || p.joined_at,
      score: Number(p.score) || 0,
      answered: s.answered,
      correct: s.correct,
      wrong: s.answered - s.correct,
      total,
      finished,
      percent
    }
  })

  return { state: 'ok', rows, answersAvailable }
}

async function loadProjects(db, uid) {
  const { data, error } = await db.from('projects')
    .select('id,title,created_at,published').eq('author_id', uid).eq('published', true)
    .gte('created_at', STATS_START).order('created_at', { ascending: true })
  if (error) throw error
  return { state: 'ok', rows: data || [] }
}

/* ----------------------------- გათვლები ----------------------------- */

function buildModel(att, quiz, proj, failed = 0) {
  const m = { att, quiz, proj, failed }

  // დასწრება
  if (att?.state === 'ok') {
    const total = att.meetings.length
    const attended = att.meetings.filter(x => x.attended).length
    const perMonth = new Map()
    for (const x of att.meetings) {
      const k = keyOfDay(x.date)
      const s = perMonth.get(k) || { total: 0, attended: 0 }
      s.total++
      if (x.attended) s.attended++
      perMonth.set(k, s)
    }
    m.attendance = {
      total, attended, missed: total - attended,
      percent: total ? Math.round((attended / total) * 100) : null,
      series: [...perMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, s]) => ({
        label: labelOfKey(k),
        value: Math.round((s.attended / s.total) * 100),
        tip: `<b>${esc(labelOfKey(k))}</b><br>დასწრება: ${s.attended} / ${s.total} (${Math.round((s.attended / s.total) * 100)}%)`
      })),
      history: [...att.meetings].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8)
    }
  }

  // ვიქტორინა
  if (quiz?.state === 'ok') {
    const rows = quiz.rows
    const scored = rows.filter(r => r.percent !== null)
    const sum = key => rows.reduce((acc, r) => acc + r[key], 0)
    m.quiz = {
      count: rows.length,
      answersAvailable: quiz.answersAvailable,
      correct: quiz.answersAvailable ? sum('correct') : null,
      wrong: quiz.answersAvailable ? sum('wrong') : null,
      avg: scored.length ? Math.round(scored.reduce((a, r) => a + r.percent, 0) / scored.length) : null,
      best: scored.length ? Math.max(...scored.map(r => r.percent)) : null,
      series: scored.map(r => ({
        label: shortDate(new Date(r.date)),
        value: r.percent,
        tip: `<b>${esc(r.title)}</b><br>${esc(stampText(r.date))}<br>სწორი: ${r.correct} / ${r.total} (${r.percent}%)`
      })),
      history: [...rows].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8)
    }
  }

  // აქტივობები (დროის ხაზი)
  const events = []
  if (att?.state === 'ok') {
    for (const x of att.meetings) if (x.attended) events.push({ type: 'attendance', date: String(x.date).slice(0, 10), title: 'დაესწრო შეხვედრას', key: keyOfDay(x.date) })
  }
  if (quiz?.state === 'ok') {
    for (const r of quiz.rows) {
      const suffix = r.percent !== null ? ` · ${r.percent}%` : (r.finished ? '' : ' · დაუსრულებელი')
      events.push({ type: 'quiz', date: r.date, title: `ვიქტორინა: ${r.title}${suffix}`, key: keyOfStamp(r.date) })
    }
  }
  if (proj?.state === 'ok') {
    for (const p of proj.rows) events.push({ type: 'project', date: p.created_at, title: `გამოქვეყნებული პროექტი: ${p.title}`, key: keyOfStamp(p.created_at) })
  }
  events.sort((a, b) => new Date(String(b.date).length === 10 ? `${b.date}T12:00:00` : b.date) - new Date(String(a.date).length === 10 ? `${a.date}T12:00:00` : a.date))
  m.events = events

  // ყოველთვიური აქტივობა (ბოლო 12 თვე)
  const keys = lastMonthKeys(12)
  const bucket = new Map(keys.map(k => [k, { attendance: 0, quiz: 0, project: 0 }]))
  for (const e of events) if (e.key && bucket.has(e.key)) bucket.get(e.key)[e.type]++
  m.monthly = keys.map(k => {
    const b = bucket.get(k)
    const value = b.attendance + b.quiz + b.project
    return {
      label: labelOfKey(k), value,
      tip: `<b>${esc(labelOfKey(k))}</b><br>სულ: ${value}<br>შეხვედრა: ${b.attendance} · ვიქტორინა: ${b.quiz} · პროექტი: ${b.project}`
    }
  })

  return m
}

/* ----------------------------- გრაფიკები (SVG) ----------------------------- */

const SVG_H = 230
const PAD = { l: 38, r: 14, t: 14, b: 30 }

function xLabels(points, xAt, plotW) {
  const maxLabels = Math.max(2, Math.floor(plotW / 62))
  const step = Math.max(1, Math.ceil(points.length / maxLabels))
  const last = points.length - 1
  // ბოლო წარწერა ყოველთვის ჩანს; ახლოს მდგომი შუალედური გამოვტოვოთ, რომ არ გადაფარონ
  return points.map((p, i) => (i === last || (i % step === 0 && last - i >= step))
    ? `<text class="ms-axis-text" x="${xAt(i)}" y="${SVG_H - 9}" text-anchor="middle">${esc(p.label)}</text>` : '').join('')
}

function lineSvg(points, w, animate, gid) {
  const plotW = w - PAD.l - PAD.r
  const plotH = SVG_H - PAD.t - PAD.b
  const n = points.length
  const xAt = i => n === 1 ? PAD.l + plotW / 2 : PAD.l + (plotW * i) / (n - 1)
  const yAt = v => PAD.t + plotH - (plotH * Math.max(0, Math.min(100, v))) / 100

  const grid = [0, 25, 50, 75, 100].map(v => `
    <line class="ms-grid-line" x1="${PAD.l}" x2="${w - PAD.r}" y1="${yAt(v)}" y2="${yAt(v)}"/>
    <text class="ms-axis-text" x="${PAD.l - 8}" y="${yAt(v) + 3.5}" text-anchor="end">${v}%</text>`).join('')

  const path = points.map((p, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)} ${yAt(p.value).toFixed(1)}`).join(' ')
  const area = n > 1 ? `<path d="${path} L${xAt(n - 1)} ${yAt(0)} L${xAt(0)} ${yAt(0)} Z" fill="url(#${gid})" opacity=".9"/>` : ''
  const dots = points.map((p, i) => `
    <circle class="ms-hit" data-i="${i}" tabindex="0" role="img" aria-label="${esc(p.label)}: ${p.value}%" cx="${xAt(i)}" cy="${yAt(p.value)}" r="15"/>
    <circle class="ms-dot" cx="${xAt(i)}" cy="${yAt(p.value)}" r="4" pointer-events="none"/>`).join('')

  return `<svg viewBox="0 0 ${w} ${SVG_H}" role="group">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#00ff66" stop-opacity=".28"/><stop offset="1" stop-color="#00ff66" stop-opacity="0"/>
    </linearGradient></defs>
    ${grid}${area}
    ${n > 1 ? `<path class="ms-line${animate ? ' draw' : ''}" pathLength="1" d="${path}"/>` : ''}
    ${xLabels(points, xAt, plotW)}${dots}</svg>`
}

function barSvg(points, w, animate) {
  const plotW = w - PAD.l - PAD.r
  const plotH = SVG_H - PAD.t - PAD.b
  const n = points.length
  const max = Math.max(...points.map(p => p.value), 0)
  const top = max <= 4 ? 4 : Math.ceil(max / 4) * 4
  const band = plotW / n
  const bw = Math.min(30, band * 0.62)
  const xAt = i => PAD.l + band * i + band / 2
  const yAt = v => PAD.t + plotH - (plotH * v) / top

  const grid = [0, 1, 2, 3, 4].map(k => {
    const v = (top / 4) * k
    return `<line class="ms-grid-line" x1="${PAD.l}" x2="${w - PAD.r}" y1="${yAt(v)}" y2="${yAt(v)}"/>
      <text class="ms-axis-text" x="${PAD.l - 8}" y="${yAt(v) + 3.5}" text-anchor="end">${Number.isInteger(v) ? v : v.toFixed(1)}</text>`
  }).join('')

  const bars = points.map((p, i) => {
    const h = Math.max(p.value ? 3 : 0, plotH - (yAt(p.value) - PAD.t))
    return `<g>
      <rect class="ms-hit bar" data-i="${i}" tabindex="0" role="img" aria-label="${esc(p.label)}: ${p.value}" x="${xAt(i) - band / 2}" y="${PAD.t}" width="${band}" height="${plotH}"/>
      <rect class="ms-bar${animate ? ' draw' : ''}" x="${xAt(i) - bw / 2}" y="${PAD.t + plotH - h}" width="${bw}" height="${h}" rx="3" pointer-events="none" style="animation-delay:${i * 35}ms"/>
    </g>`
  }).join('')

  return `<svg viewBox="0 0 ${w} ${SVG_H}" role="group">${grid}${bars}${xLabels(points, xAt, plotW)}</svg>`
}

let chartSeq = 0

function mountChart(el, points, kind) {
  el.innerHTML = '<div class="ms-tip" hidden></div><div class="ms-svg"></div>'
  const host = el.querySelector('.ms-svg')
  const tip = el.querySelector('.ms-tip')
  let first = !reducedMotion()
  let lastW = 0
  const gid = `ms-area-${++chartSeq}`

  const draw = () => {
    const w = Math.max(260, Math.round(el.clientWidth))
    if (w === lastW) return
    lastW = w
    host.innerHTML = kind === 'line' ? lineSvg(points, w, first, gid) : barSvg(points, w, first)
    first = false
  }

  const show = target => {
    const p = points[Number(target.dataset.i)]
    if (!p) return
    const box = el.getBoundingClientRect()
    const r = target.getBoundingClientRect()
    tip.innerHTML = p.tip
    tip.hidden = false
    const half = tip.offsetWidth / 2
    const x = Math.min(Math.max(r.left - box.left + r.width / 2, half + 4), box.width - half - 4)
    tip.style.left = `${x}px`
    tip.style.top = `${r.top - box.top + r.height / 2}px`
  }
  const hide = () => { tip.hidden = true }

  host.addEventListener('pointerover', e => { const t = e.target.closest('.ms-hit'); if (t) show(t) })
  host.addEventListener('pointerleave', hide)
  host.addEventListener('focusin', e => { const t = e.target.closest('.ms-hit'); if (t) show(t) })
  host.addEventListener('focusout', hide)
  host.addEventListener('click', e => { const t = e.target.closest('.ms-hit'); if (t) show(t) }) // touch

  draw()
  let raf = 0
  if (window.ResizeObserver) {
    new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw) }).observe(el)
  }
}

/* ----------------------------- რენდერი ----------------------------- */

const emptyBox = (icon, title, text) =>
  `<div class="ms-empty"><i data-lucide="${icon}"></i><strong>${esc(title)}</strong><span>${text}</span></div>`

function card(label, value, { suffix = '', note = '', off = false } = {}) {
  const shown = value === null || value === undefined ? '—' : `${value}${suffix}`
  const countable = !(value === null || value === undefined)
  return `<article class="ms-card${off || !countable ? ' is-off' : ''}">
    <p class="ms-card-label">${esc(label)}</p>
    <p class="ms-card-value" ${countable ? `data-count="${Number(value)}" data-suffix="${esc(suffix)}"` : ''}>${esc(shown)}</p>
    ${note ? `<p class="ms-card-note">${esc(note)}</p>` : ''}
  </article>`
}

function countUp(root) {
  root.querySelectorAll('[data-count]').forEach(el => {
    const target = Number(el.dataset.count)
    const suffix = el.dataset.suffix || ''
    if (reducedMotion() || !Number.isFinite(target) || target === 0) return
    const t0 = performance.now()
    const tick = now => {
      const k = Math.min(1, (now - t0) / 700)
      el.textContent = `${Math.round(target * (1 - Math.pow(1 - k, 3)))}${suffix}`
      if (k < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

function overviewHtml(m) {
  const a = m.attendance
  const q = m.quiz
  const p = m.proj?.state === 'ok' ? m.proj.rows.length : null
  const parts = [a ? a.attended : null, q ? q.count : null, p]
  const total = parts.some(v => v !== null) ? parts.reduce((s, v) => s + (v || 0), 0) : null

  return [
    card('დასწრებული შეხვედრები', a ? a.attended : null, { note: a ? '' : (m.att?.state === 'unlinked' ? 'ანგარიში წევრს არ არის მიბმული' : 'მონაცემი ჯერ მიუწვდომელია') }),
    card('ვიქტორინაში მონაწილეობა', q ? q.count : null),
    card('ვიქტორინის საშუალო შედეგი', q ? q.avg : null, { suffix: '%', note: q && q.avg === null ? 'დასრულებული შედეგი ჯერ არ არის' : '' }),
    card('გამოქვეყნებული პროექტები', p, { note: 'ცალკე „დასრულებულის“ სტატუსი არ ინახება' }),
    card('სულ აქტივობა', total)
  ].join('')
}

function attendancePanel(m) {
  const head = '<h3 class="ms-panel-title"><i data-lucide="calendar-check"></i>დასწრების ანალიტიკა</h3>'

  if (m.att?.state === 'setup') {
    return `${head}${emptyBox('database', 'დასწრების კავშირი ჯერ არ არის გააქტიურებული', 'ბაზას ჯერ არ აქვს <code>club_member_links</code> ცხრილი. გაუშვი მოწოდებული SQL.')}`
  }
  if (m.att?.state === 'unlinked') {
    return `${head}${emptyBox('link-2-off', 'შენი ანგარიში წევრს არ არის მიბმული', 'დასწრების სტატისტიკის საჩვენებლად ადმინმა უნდა დაგაკავშიროს კლუბის წევრის ჩანაწერს.')}`
  }
  if (!m.attendance) {
    return `${head}<div class="ms-error">დასწრების მონაცემები ვერ ჩაიტვირთა.</div>`
  }

  const a = m.attendance
  if (!a.total) {
    return `${head}${emptyBox('calendar-x', 'აღრიცხული შეხვედრები ჯერ არ არის', 'როგორც კი შეხვედრები აღირიცხება, აქ გამოჩნდება შენი დასწრება.')}`
  }

  return `${head}
    <div class="ms-mini">
      <div><span>დასწრებული</span><strong class="good">${a.attended}</strong></div>
      <div><span>გაცდენილი</span><strong class="${a.missed ? 'bad' : ''}">${a.missed}</strong></div>
      <div><span>დასწრება</span><strong>${a.percent}%</strong></div>
    </div>
    <div class="ms-chart" id="ms-chart-att" aria-label="დასწრების დინამიკა თვეების მიხედვით"></div>
    <h4 class="ms-subtitle">ბოლო შეხვედრები</h4>
    <ul class="ms-list">${a.history.map(h => `
      <li><span>${esc(dayText(h.date))}</span>
      <span class="ms-pill ${h.attended ? 'ok' : 'miss'}">${h.attended ? 'დაესწრო' : 'გააცდინა'}</span></li>`).join('')}
    </ul>
    <p class="ms-note">ითვლება მხოლოდ „დასათვლელად“ მონიშნული შეხვედრები.</p>`
}

function quizPanel(m) {
  const head = '<h3 class="ms-panel-title"><i data-lucide="brain-circuit"></i>ვიქტორინების ანალიტიკა</h3>'
  if (!m.quiz) return `${head}<div class="ms-error">ვიქტორინის მონაცემები ვერ ჩაიტვირთა.</div>`

  const q = m.quiz
  if (!q.count) {
    return `${head}${emptyBox('trophy', 'ვიქტორინის მონაცემების ათვლა დაიწყება დღეიდან', 'შედი ვიქტორინის ოთახში და შენი შედეგები აქ გამოჩნდება.')}`
  }

  const val = v => (v === null ? '—' : v)
  const history = q.history.map(r => `
    <li><span>${esc(r.title)}<br><small style="color:var(--ms-muted)">${esc(stampText(r.date))}</small></span>
    <span class="ms-pill ${r.percent !== null ? 'ok' : ''}">${r.percent !== null ? `${r.percent}%` : (r.finished ? `${r.score} ქულა` : 'დაუსრულებელი')}</span></li>`).join('')

  return `${head}
    <div class="ms-mini">
      <div><span>მონაწილეობა</span><strong>${q.count}</strong></div>
      <div><span>სწორი</span><strong class="good">${val(q.correct)}</strong></div>
      <div><span>არასწორი</span><strong class="${q.wrong ? 'bad' : ''}">${val(q.wrong)}</strong></div>
      <div><span>საშუალო</span><strong>${q.avg === null ? '—' : `${q.avg}%`}</strong></div>
      <div><span>საუკეთესო</span><strong class="good">${q.best === null ? '—' : `${q.best}%`}</strong></div>
    </div>
    ${q.series.length
      ? '<div class="ms-chart" id="ms-chart-quiz" aria-label="ვიქტორინების შედეგები დროის მიხედვით"></div>'
      : emptyBox('chart-line', 'გრაფიკისთვის შედეგები არ არის საკმარისი', 'გრაფიკი გამოჩნდება დასრულებული ვიქტორინის შემდეგ.')}
    <h4 class="ms-subtitle">ბოლო ვიქტორინები</h4>
    <ul class="ms-list">${history}</ul>
    ${q.answersAvailable ? '' : '<p class="ms-note">სწორი/არასწორი პასუხების მონაცემი ამ ანგარიშისთვის ჯერ მიუწვდომელია (იხ. SQL ფაილი: quiz_answers პოლიტიკა).</p>'}
    <p class="ms-note">პროცენტი = სწორი პასუხები / ვიქტორინის კითხვების რაოდენობა (მხოლოდ დასრულებული ოთახები).</p>`
}

const TL_ICON = { attendance: 'calendar-check', quiz: 'brain-circuit', project: 'cpu' }

function timelineItems(events, from, to) {
  return events.slice(from, to).map(e => {
    const date = String(e.date).length === 10 ? dayText(e.date) : stampText(e.date)
    return `<li class="ms-tl-item"><span class="ms-tl-icon"><i data-lucide="${TL_ICON[e.type]}"></i></span>
      <div class="ms-tl-text"><p class="ms-tl-title">${esc(e.title)}</p><p class="ms-tl-date">${esc(date)}</p></div></li>`
  }).join('')
}

function render(root, m) {
  const anyActivity = m.events.length > 0

  root.innerHTML = `
    <div class="ms-head">
      <div>
        <h2 class="ms-title" id="ms-title">ჩემი სტატისტიკა</h2>
        <p class="ms-sub">შენი პირადი აქტივობა ArduinoHub-ზე. მონაცემები ჩანს მხოლოდ შენთვის.</p>
      </div>
      <button type="button" class="ms-refresh" id="ms-refresh"><i data-lucide="refresh-cw"></i>განახლება</button>
    </div>

    <div class="ms-cards">${overviewHtml(m)}</div>

    ${m.failed ? '<div class="ms-error" role="alert" style="margin-bottom:14px">ზოგი მონაცემი ვერ ჩაიტვირთა, ამიტომ სტატისტიკა შეიძლება არასრული იყოს. სცადე „განახლება“.</div>' : ''}

    ${anyActivity || m.failed ? '' : emptyBox('radar', 'აქტივობა ჯერ არ გაქვს', 'დაესწარი შეხვედრას, ითამაშე ვიქტორინა ან გამოაქვეყნე პროექტი და შენი სტატისტიკა აქ გამოჩნდება.')}

    <div class="ms-grid" style="${anyActivity || m.failed ? '' : 'margin-top:14px'}">
      <section class="ms-panel">${attendancePanel(m)}</section>
      <section class="ms-panel">${quizPanel(m)}</section>

      <section class="ms-panel wide">
        <h3 class="ms-panel-title"><i data-lucide="bar-chart-3"></i>ყოველთვიური აქტივობა · ბოლო 12 თვე</h3>
        ${anyActivity ? '<div class="ms-chart" id="ms-chart-monthly" aria-label="ყოველთვიური აქტივობა"></div>' : emptyBox('bar-chart-3', 'გრაფიკისთვის მონაცემი არ არის', 'პირველივე აქტივობის შემდეგ გამოჩნდება.')}
      </section>

      <section class="ms-panel wide">
        <h3 class="ms-panel-title"><i data-lucide="history"></i>აქტივობების ისტორია</h3>
        ${anyActivity
          ? `<ol class="ms-timeline" id="ms-timeline">${timelineItems(m.events, 0, TIMELINE_STEP)}</ol>
             ${m.events.length > TIMELINE_STEP ? '<button type="button" class="ms-more" id="ms-more">მეტის ნახვა</button>' : ''}`
          : emptyBox('history', 'ისტორია ცარიელია', 'აქტივობები თარიღის მიხედვით აქ დალაგდება.')}
      </section>
    </div>`

  if (m.attendance?.series.length) mountChart(root.querySelector('#ms-chart-att'), m.attendance.series, 'line')
  if (m.quiz?.series.length) mountChart(root.querySelector('#ms-chart-quiz'), m.quiz.series, 'line')
  if (anyActivity) mountChart(root.querySelector('#ms-chart-monthly'), m.monthly, 'bar')

  const more = root.querySelector('#ms-more')
  if (more) {
    let shown = TIMELINE_STEP
    more.addEventListener('click', () => {
      root.querySelector('#ms-timeline').insertAdjacentHTML('beforeend', timelineItems(m.events, shown, shown + TIMELINE_STEP))
      shown += TIMELINE_STEP
      if (shown >= m.events.length) more.remove()
      icons()
    })
  }

  icons()
  countUp(root)
}

function renderSkeleton(root) {
  root.innerHTML = `
    <div class="ms-head"><div><h2 class="ms-title">ჩემი სტატისტიკა</h2><p class="ms-sub">მონაცემები იტვირთება...</p></div></div>
    <div class="ms-cards">${'<div class="ms-skel card"></div>'.repeat(5)}</div>
    <div class="ms-grid"><div class="ms-skel panel"></div><div class="ms-skel panel"></div></div>`
}

function renderFatal(root, retry) {
  root.innerHTML = `
    <div class="ms-head"><div><h2 class="ms-title">ჩემი სტატისტიკა</h2></div></div>
    <div class="ms-error" role="alert">სტატისტიკის ჩატვირთვა ვერ მოხერხდა. შეამოწმე ინტერნეტი და სცადე ხელახლა.
      <br><button type="button" class="ms-retry" id="ms-retry">სცადე ხელახლა</button></div>`
  root.querySelector('#ms-retry').addEventListener('click', retry)
}

/* ----------------------------- შესასვლელი წერტილი ----------------------------- */

export async function initStats({ db, user, root }) {
  if (!db || !user?.id || !root) return

  root.hidden = false
  let busy = false

  const run = async () => {
    if (busy) return
    busy = true
    renderSkeleton(root)

    try {
      // ავტორიზაციას ვამოწმებთ სერვერზე; ვიყენებთ მხოლოდ დადასტურებულ user.id-ს
      const { data, error } = await db.auth.getUser()
      if (error || !data?.user || data.user.id !== user.id) throw error || new Error('unauthenticated')
      const uid = data.user.id

      // ერთი წყაროს შეცდომა სხვებს არ აფუჭებს
      const [att, quiz, proj] = await Promise.allSettled([
        loadAttendance(db, uid), loadQuiz(db, uid), loadProjects(db, uid)
      ])

      for (const r of [att, quiz, proj]) if (r.status === 'rejected') console.error('Stats load error:', r.reason)

      if ([att, quiz, proj].every(r => r.status === 'rejected')) throw new Error('all sources failed')

      const failed = [att, quiz, proj].filter(r => r.status === 'rejected').length

      render(root, buildModel(
        att.status === 'fulfilled' ? att.value : null,
        quiz.status === 'fulfilled' ? quiz.value : null,
        proj.status === 'fulfilled' ? proj.value : null,
        failed
      ))
      root.querySelector('#ms-refresh')?.addEventListener('click', run)
    } catch (error) {
      console.error('Stats error:', error)
      renderFatal(root, run)
    } finally {
      busy = false
    }
  }

  await run()
}
