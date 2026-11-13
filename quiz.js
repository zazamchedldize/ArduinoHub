/* ============================================================================
 * ArduinoHub Quiz — კლიენტის ლოგიკა
 * ----------------------------------------------------------------------------
 * სტრუქტურა:
 *  1. კონფიგურაცია და დამხმარე ფუნქციები
 *  2. მუსიკა
 *  3. API ფენა (ტაიმაუტი, შეცდომების კლასიფიკაცია)
 *  4. ინტერფეისის აგება
 *  5. ნავიგაცია და სესიის შენახვა
 *  6. ოთახის მოქმედებები (შექმნა / შესვლა / გენერაცია / დაწყება / მართვა)
 *  7. განახლების (polling) ძრავა
 *  8. რენდერი (lobby / თამაში / შედეგები) და ტაიმერი
 *  9. პასუხის გაგზავნა
 * 10. ეფექტები და ინიციალიზაცია
 * ========================================================================== */

/* ------------------------ 1. კონფიგურაცია და დამხმარეები ------------------ */

const QUIZ_TRACKS = {
  default: "/sounds/quiz.mp3",
  tvd: "/sounds/tvd.mp3",
  mcu: "/sounds/mcu.mp3"
}
const QUIZ_MUSIC_URL = QUIZ_TRACKS.default
const QUIZ_STORAGE_KEY = "arduinohub_quiz_session"
const QUIZ_SESSION_TTL = 12 * 60 * 60 * 1000
const QUIZ_ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/
const QUIZ_TIMEOUTS = { default: 15000, poll: 10000, answer: 8000, generate: 140000 }
const QUIZ_ANSWER_ATTEMPTS = 4

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char])

const quizState = {
  code: "",
  room: null,
  roomData: null,
  participants: [],
  isAdmin: false,
  role: "",
  loading: false,
  answering: false,

  // განახლება (polling)
  pollTimer: null,
  refreshPromise: null,
  pollFailures: 0,

  // ტაიმერი
  deadline: 0,
  deadlineQuestionId: null,
  pausedRemainingMs: null,
  tickTimer: null,
  timeUpKey: "",

  // რენდერის ქეში (ზედმეტი DOM განახლებების თავიდან ასაცილებლად)
  renderedQuestionKey: "",
  renderedParticipantsKey: "",
  renderedResultsKey: "",
  statusKey: "",
  lastRoomStatus: "",

  // პასუხები
  localAnswers: new Map(),
  pendingAnswer: null,

  // მუსიკა
  music: null,
  musicBlocked: false,
  musicStarting: false,
  musicTrack: "",
  musicTopic: null
}

const quizDom = {}

const quizEl = id => document.getElementById(id)

function setText(element, text) {
  if (element && element.textContent !== text) element.textContent = text
}

function setHidden(element, hidden) {
  if (element && element.hidden !== hidden) element.hidden = hidden
}

function setDisabled(element, disabled) {
  if (element && element.disabled !== disabled) element.disabled = disabled
}

function quizSleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getQuizSupabase() {
  const client = window.supabase
  return client && client.functions ? client : null
}

/* ------------------------------- 2. მუსიკა ------------------------------- */

function getQuizMusic() {
  if (quizState.music) return quizState.music

  const music = new Audio()
  music.loop = true
  music.preload = "none"
  music.volume = 0.35
  music.addEventListener("error", () => {
    console.warn(`Quiz music could not be loaded: ${music.src}`)
  })
  quizState.music = music
  quizState.musicTrack = QUIZ_MUSIC_URL
  music.src = QUIZ_MUSIC_URL
  return music
}

async function playQuizMusic() {
  if (quizState.musicStarting) return

  const music = getQuizMusic()
  quizState.musicStarting = true

  try {
    await music.play()
    quizState.musicBlocked = false
    setHidden(quizDom.musicEnable, true)
  } catch (error) {
    // AbortError: ტრეკი შეიცვალა play-ის დროს — ეს შეცდომა არაა
    if (error?.name !== "AbortError") {
      quizState.musicBlocked = true
      if (quizState.room?.status === "playing") setHidden(quizDom.musicEnable, false)
      console.warn("Quiz music playback was blocked or failed", error)
    }
  } finally {
    quizState.musicStarting = false
  }
}

function syncQuizMusic(room) {
  const status = room?.status
  const music = getQuizMusic()

  if (status === "playing") {
    if (music.paused && !quizState.musicBlocked) playQuizMusic()
    setHidden(quizDom.musicEnable, !quizState.musicBlocked)
    return
  }

  if (status === "paused") {
    if (!music.paused) music.pause()
    setHidden(quizDom.musicEnable, true)
    return
  }

  if (!music.paused) music.pause()
  if (music.currentTime > 0) music.currentTime = 0
  quizState.musicBlocked = false
  setHidden(quizDom.musicEnable, true)
}

// ტრეკი ირჩევა მხოლოდ მაშინ, როცა თემა იცვლება (და არა ყოველ განახლებაზე)
function updateQuizMusic(topic) {
  const normalizedTopic = String(topic || "").toLowerCase()

  const tvdKeywords = [
    "the vampire diaries",
    "vampire diaries",
    "ვამპირის დღიურები",
    "ვამპირის დღიური",
    "tvd",
    "დემონ სალვატორე",
    "სტეფან სალვატორე",
    "ელენა გილბერტი",
    "მისტიკ ფოლსი"
  ]

  const mcuKeywords = [
    "mcu",
    "marvel cinematic universe",
    "marvel",
    "მარველი",
    "შურისმაძიებლები",
    "რკინის კაცი",
    "კაპიტანი ამერიკა",
    "თორი",
    "სპაიდერმენი"
  ]

  let track = QUIZ_TRACKS.default

  if (tvdKeywords.some(keyword => normalizedTopic.includes(keyword))) {
    track = QUIZ_TRACKS.tvd
  } else if (mcuKeywords.some(keyword => normalizedTopic.includes(keyword))) {
    track = QUIZ_TRACKS.mcu
  }

  const music = getQuizMusic()

  if (quizState.musicTrack === track) return

  const wasPlaying = !music.paused
  quizState.musicTrack = track
  music.src = track

  if (wasPlaying || quizState.room?.status === "playing") playQuizMusic()
}

/* ------------------------------- 3. API ფენა ------------------------------ */

class QuizApiError extends Error {
  constructor(message, { status = 0, code = "", network = false, retryable = false } = {}) {
    super(message)
    this.name = "QuizApiError"
    this.status = status
    this.code = code
    this.network = network
    this.retryable = retryable
  }
}

async function toQuizError(error) {
  if (error instanceof QuizApiError) return error

  const context = error?.context

  if (context && typeof context.json === "function") {
    const status = Number(context.status) || 0
    let body = null

    try {
      body = await context.json()
    } catch {
      body = null
    }

    const fallback = status === 401
      ? "სესია ვადაგასულია. შედი ანგარიშში ხელახლა."
      : "სერვერმა შეცდომა დააბრუნა. სცადე ხელახლა."

    return new QuizApiError(body?.error || body?.message || fallback, {
      status,
      code: body?.code || "",
      retryable: status >= 500 || status === 429 || body?.retryable === true
    })
  }

  if (error?.name === "FunctionsRelayError") {
    return new QuizApiError("სერვისი დროებით მიუწვდომელია. სცადე რამდენიმე წამში.", { status: 503, retryable: true })
  }

  const offline = typeof navigator !== "undefined" && navigator.onLine === false

  return new QuizApiError(
    offline
      ? "ინტერნეტი გამორთულია. კავშირის აღდგენისას სცადე ხელახლა."
      : "სერვერთან კავშირი ვერ დამყარდა. შეამოწმე ინტერნეტი და სცადე ხელახლა.",
    { network: true, retryable: true, code: offline ? "OFFLINE" : "NETWORK" }
  )
}

function quizWithTimeout(promise, ms, controller) {
  let timer

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      if (controller) controller.abort()
      reject(new QuizApiError("სერვერმა დროულად ვერ უპასუხა. სცადე ხელახლა.", {
        network: true,
        retryable: true,
        code: "TIMEOUT"
      }))
    }, ms)
  })

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

async function invokeQuiz(action, payload = {}, { timeoutMs = QUIZ_TIMEOUTS.default } = {}) {
  const client = getQuizSupabase()

  if (!client) {
    throw new QuizApiError("Supabase ჯერ არ არის ჩატვირთული. განაახლე გვერდი.", { retryable: true })
  }

  const controller = typeof AbortController === "function" ? new AbortController() : null
  let result

  try {
    result = await quizWithTimeout(
      client.functions.invoke("quiz", {
        body: { action, ...payload },
        ...(controller ? { signal: controller.signal } : {})
      }),
      timeoutMs,
      controller
    )
  } catch (error) {
    throw await toQuizError(error)
  }

  const { data, error } = result

  if (error) throw await toQuizError(error)

  if (data?.success === false) {
    throw new QuizApiError(data.error || "მოთხოვნა ვერ შესრულდა", {
      code: data.code || "",
      retryable: data.retryable === true
    })
  }

  return data
}

/* -------------------------- სტატუსი და კავშირის ზოლი --------------------- */

function setQuizStatus(message, type = "", retry = null) {
  const status = quizDom.status || quizEl("quiz-status")
  if (!status) return

  const key = `${type}|${message}`

  if (!retry && quizState.statusKey === key) return

  quizState.statusKey = retry ? "" : key
  status.className = `quiz-status ${type}`.trim()
  status.textContent = message

  if (retry) {
    const button = document.createElement("button")
    button.type = "button"
    button.className = "quiz-retry-button"
    button.textContent = "↻ ხელახლა ცდა"
    button.addEventListener("click", () => {
      button.disabled = true
      retry()
    }, { once: true })
    status.appendChild(button)
  }
}

function setQuizConnection(lost, message) {
  if (!quizDom.connection) return
  if (message) setText(quizDom.connectionText, message)
  setHidden(quizDom.connection, !lost)
}

/* ------------------------------ 4. ინტერფეისი ----------------------------- */

function cacheQuizDom() {
  const ids = {
    modal: "quiz-modal",
    dialog: null,
    heading: "quiz-heading",
    headingIcon: "quiz-heading-icon",
    description: "quiz-description",
    roleChoice: "quiz-role-choice",
    forms: "quiz-forms",
    createForm: "quiz-create-form",
    joinForm: "quiz-join-form",
    status: "quiz-status",
    connection: "quiz-connection",
    connectionText: "quiz-connection-text",
    connectionRetry: "quiz-connection-retry",
    roomPanel: "quiz-room-panel",
    lobbyView: "quiz-lobby-view",
    roomTop: "quiz-room-top",
    roomTitle: "quiz-room-title",
    roomLive: "quiz-room-live",
    codeBox: "quiz-code-box",
    roomCode: "quiz-room-code",
    roomMeta: "quiz-room-meta",
    roomTopic: "quiz-room-topic",
    roomSettings: "quiz-room-settings",
    participantCount: "quiz-participant-count",
    participants: "quiz-participants",
    adminControls: "quiz-admin-controls",
    questionsState: "quiz-questions-state",
    generate: "quiz-generate-questions",
    start: "quiz-start-game",
    lobbyNote: "quiz-lobby-note",
    refresh: "quiz-refresh-room",
    leave: "quiz-leave-room",
    gamePanel: "quiz-game-panel",
    progress: "quiz-game-progress",
    score: "quiz-game-score",
    timer: "quiz-game-timer",
    timerBar: "quiz-timer-bar",
    musicEnable: "quiz-music-enable",
    question: "quiz-game-question",
    options: "quiz-game-options",
    feedback: "quiz-game-feedback",
    explanation: "quiz-game-explanation",
    gameAdmin: "quiz-game-admin-controls",
    pause: "quiz-pause-game",
    resume: "quiz-resume-game",
    next: "quiz-next-question",
    results: "quiz-game-results",
    resultsSummary: "quiz-results-summary",
    leaderboard: "quiz-game-leaderboard",
    leaveResults: "quiz-leave-room-results"
  }

  Object.entries(ids).forEach(([name, id]) => {
    quizDom[name] = id ? quizEl(id) : null
  })

  quizDom.dialog = document.querySelector("#quiz-modal .quiz-dialog")
}

function ensureQuizLaunchButton() {
  if (quizEl("quiz-launch-button")) return true

  const nav = document.querySelector(".site-header nav")
  if (!nav) return false

  const button = document.createElement("button")
  button.id = "quiz-launch-button"
  button.type = "button"
  button.className = "quiz-nav-button"
  button.innerHTML = "<span>✦</span> ვიქტორინა"
  button.addEventListener("click", openQuizModal)

  const adminLink = nav.querySelector(".nav-admin")

  if (adminLink) {
    nav.insertBefore(button, adminLink)
  } else {
    nav.appendChild(button)
  }

  return true
}

function createQuizInterface() {
  if (quizEl("quiz-modal")) {
    ensureQuizLaunchButton()
    return
  }

  const modal = document.createElement("div")
  modal.id = "quiz-modal"
  modal.className = "quiz-modal"
  modal.hidden = true
  modal.innerHTML = `
    <div class="quiz-backdrop" data-quiz-close></div>
    <section class="quiz-dialog quiz-role-home" role="dialog" aria-modal="true" aria-labelledby="quiz-heading">
      <button class="quiz-close" type="button" data-quiz-close aria-label="დახურვა">×</button>
      <div id="quiz-heading-icon" class="quiz-heading-icon">✦</div>
      <p class="quiz-eyebrow">ARDUINOHUB CHALLENGE</p>
      <h2 id="quiz-heading">ვიქტორინა</h2>
      <p id="quiz-description" class="quiz-description">აირჩიე შენი როლი და მოემზადე თამაშისთვის.</p>
      <div id="quiz-role-choice" class="quiz-forms quiz-role-choice">
        <button id="quiz-select-admin" class="quiz-role-card quiz-role-admin" type="button">
          <span class="quiz-role-icon">♜</span>
          <span class="quiz-role-title">ადმინისტრატორი</span>
          <span class="quiz-role-description">შექმენი ოთახი, მოამზადე კითხვები და მართე თამაში.</span>
          <span class="quiz-role-action">ოთახის შექმნა <span>→</span></span>
        </button>
        <button id="quiz-select-player" class="quiz-role-card quiz-role-player" type="button">
          <span class="quiz-role-icon">🎮</span>
          <span class="quiz-role-title">მოთამაშე</span>
          <span class="quiz-role-description">შეუერთდი ოთახს კოდით და შეეჯიბრე სხვა მონაწილეებს.</span>
          <span class="quiz-role-action">თამაშში შესვლა <span>→</span></span>
        </button>
      </div>
      <div id="quiz-forms" class="quiz-forms quiz-single-form" hidden>
        <form id="quiz-create-form" class="quiz-card" hidden>
          <div class="quiz-screen-heading">
            <span class="quiz-screen-icon">♜</span>
            <div>
              <div class="quiz-card-title">ახალი ვიქტორინა</div>
              <p>მოარგე თამაში შენს სურვილს.</p>
            </div>
          </div>
          <label for="quiz-title">ოთახის სახელი</label>
          <input id="quiz-title" name="title" maxlength="100" placeholder="მაგ. Arduino Challenge" required>
          <label for="quiz-topic">ვიქტორინის თემა</label>
          <input id="quiz-topic" name="topic" maxlength="500" placeholder="მაგ. Arduino და ქიმია" required>
          <label for="quiz-difficulty">სირთულის დონე</label>
          <select id="quiz-difficulty" name="difficulty">
            <option value="easy">მარტივი</option>
            <option value="medium">საშუალო</option>
            <option value="hard">რთული</option>
          </select>
          <div class="quiz-form-row">
            <div>
              <label for="quiz-count">კითხვების რაოდენობა</label>
              <input id="quiz-count" name="question_count" type="number" min="1" max="50" value="5" required>
            </div>
            <div>
              <label for="quiz-timer">დრო თითო კითხვაზე</label>
              <input id="quiz-timer" name="timer_seconds" type="number" min="5" max="300" value="20" required>
            </div>
          </div>
          <button class="quiz-primary-button" type="submit">ოთახის შექმნა <span>→</span></button>
          <button id="quiz-back-to-roles" class="quiz-secondary-button" type="button">← როლის არჩევა</button>
        </form>
        <form id="quiz-join-form" class="quiz-card" hidden>
          <div class="quiz-screen-heading">
            <span class="quiz-screen-icon">🎮</span>
            <div>
              <div class="quiz-card-title">თამაშში შესვლა</div>
              <p>შეიყვანე ოთახის კოდი და შეუერთდი მონაწილეებს.</p>
            </div>
          </div>
          <label for="quiz-code">ოთახის კოდი</label>
          <input id="quiz-code" name="code" maxlength="6" placeholder="მაგ. 72S3AL" autocomplete="off" autocapitalize="characters" spellcheck="false" required>
          <button class="quiz-primary-button" type="submit">თამაშში შესვლა <span>→</span></button>
          <button id="quiz-back-to-roles-player" class="quiz-secondary-button" type="button">← როლის არჩევა</button>
        </form>
      </div>
      <div id="quiz-status" class="quiz-status" role="status" aria-live="polite"></div>
      <div id="quiz-connection" class="quiz-connection" role="alert" hidden>
        <span class="quiz-connection-dot" aria-hidden="true"></span>
        <span id="quiz-connection-text">კავშირი შეწყდა. ვცდილობთ ხელახლა დაკავშირებას…</span>
        <button id="quiz-connection-retry" class="quiz-retry-button" type="button">↻ ახლავე ცდა</button>
      </div>
      <section id="quiz-room-panel" class="quiz-room-panel" hidden>
        <div id="quiz-lobby-view">
          <div id="quiz-room-top" class="quiz-room-top">
            <div>
              <p class="quiz-eyebrow">ვიქტორინის ოთახი</p>
              <h3 id="quiz-room-title"></h3>
            </div>
            <span id="quiz-room-live" class="quiz-room-live"><span></span> LOBBY</span>
          </div>
          <div id="quiz-code-box" class="quiz-code-box">
            <div>
              <small>ოთახის კოდი</small>
              <strong id="quiz-room-code"></strong>
            </div>
            <button id="quiz-copy-code" type="button">კოპირება</button>
          </div>
          <div id="quiz-room-meta" class="quiz-room-meta">
            <span id="quiz-room-topic"></span>
            <span id="quiz-room-settings"></span>
          </div>
          <div class="quiz-participants-heading">
            <strong>მონაწილეები</strong>
            <span id="quiz-participant-count">0</span>
          </div>
          <div id="quiz-participants" class="quiz-participants"></div>
          <div id="quiz-admin-controls" hidden>
            <div class="quiz-card-title">თამაშის მართვა</div>
            <p class="quiz-card-description">შექმენი კითხვები ხელოვნური ინტელექტის დახმარებით და დაიწყე თამაში.</p>
            <p id="quiz-questions-state" class="quiz-questions-state"></p>
            <button id="quiz-generate-questions" class="quiz-primary-button" type="button">✦ AI-ით კითხვების შექმნა</button>
            <button id="quiz-start-game" class="quiz-secondary-button" type="button">თამაშის დაწყება →</button>
          </div>
          <p id="quiz-lobby-note" class="quiz-lobby-note">დაელოდე ადმინისტრატორს. თამაში დაიწყება კითხვების მომზადების შემდეგ.</p>
          <button id="quiz-refresh-room" class="quiz-secondary-button" type="button">განახლება ↻</button>
          <button id="quiz-leave-room" class="quiz-secondary-button quiz-leave-button" type="button">ოთახიდან გასვლა</button>
        </div>
        <section id="quiz-game-panel" class="quiz-game-panel" hidden>
          <div class="quiz-game-header">
            <span id="quiz-game-progress">კითხვა 1</span>
            <span id="quiz-game-score" class="quiz-score-chip" hidden>0 ქულა</span>
            <span id="quiz-game-timer">20 წმ</span>
            <button id="quiz-music-enable" class="quiz-secondary-button" type="button" hidden>🎵 მუსიკის ჩართვა</button>
          </div>
          <div class="quiz-timer-track" aria-hidden="true"><div id="quiz-timer-bar" class="quiz-timer-bar"></div></div>
          <h3 id="quiz-game-question">კითხვა იტვირთება...</h3>
          <div id="quiz-game-options" class="quiz-game-options"></div>
          <p id="quiz-game-feedback" role="status" aria-live="polite"></p>
          <div id="quiz-game-explanation" class="quiz-explanation" hidden></div>
          <div id="quiz-game-admin-controls" hidden>
            <button id="quiz-pause-game" class="quiz-secondary-button" type="button">პაუზა</button>
            <button id="quiz-resume-game" class="quiz-secondary-button" type="button" hidden>გაგრძელება</button>
            <button id="quiz-next-question" class="quiz-primary-button" type="button">შემდეგი კითხვა →</button>
          </div>
          <div id="quiz-game-results" hidden>
            <h3>🏆 შედეგები</h3>
            <p id="quiz-results-summary" class="quiz-results-summary"></p>
            <div id="quiz-game-leaderboard"></div>
            <button id="quiz-leave-room-results" class="quiz-secondary-button quiz-leave-button" type="button">ოთახიდან გასვლა</button>
          </div>
        </section>
      </section>
    </section>
  `
  document.body.appendChild(modal)
  cacheQuizDom()
  ensureQuizLaunchButton()

  // ყველა მოვლენა ერთხელ მიბმულია — ხელახლა რენდერისას ახალი listener-ები არ ემატება
  modal.querySelectorAll("[data-quiz-close]").forEach(element => {
    element.addEventListener("click", closeQuizModal)
  })

  quizEl("quiz-select-admin").addEventListener("click", () => selectQuizRole("admin"))
  quizEl("quiz-select-player").addEventListener("click", () => selectQuizRole("player"))
  quizEl("quiz-back-to-roles").addEventListener("click", resetQuizRole)
  quizEl("quiz-back-to-roles-player").addEventListener("click", resetQuizRole)
  quizDom.createForm.addEventListener("submit", createQuizRoom)
  quizDom.joinForm.addEventListener("submit", joinQuizRoom)
  quizEl("quiz-copy-code").addEventListener("click", copyQuizCode)
  quizDom.refresh.addEventListener("click", () => refreshQuizRoom(true, { fresh: true }))
  quizDom.generate.addEventListener("click", generateQuizQuestions)
  quizDom.start.addEventListener("click", startQuizGame)
  quizDom.leave.addEventListener("click", leaveQuizRoom)
  quizDom.leaveResults.addEventListener("click", leaveQuizRoom)
  quizDom.connectionRetry.addEventListener("click", () => {
    quizState.pollFailures = 0
    refreshQuizRoom(true, { fresh: true })
  })
  quizDom.options.addEventListener("click", event => {
    const button = event.target.closest("[data-quiz-option]")
    if (!button || button.disabled) return
    submitQuizAnswer(Number(button.dataset.quizOption))
  })
  quizDom.pause.addEventListener("click", () => controlQuizGame("pause_game"))
  quizDom.resume.addEventListener("click", () => controlQuizGame("resume_game"))
  quizDom.next.addEventListener("click", () => controlQuizGame("next_question"))
  quizDom.musicEnable.addEventListener("click", playQuizMusic)

  quizEl("quiz-code").addEventListener("input", event => {
    event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)
  })

  document.addEventListener("keydown", handleQuizKeydown)

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && quizState.code) refreshQuizRoom(false, { fresh: true })
  })

  window.addEventListener("online", () => {
    if (!quizState.code) return
    quizState.pollFailures = 0
    setQuizConnection(false)
    refreshQuizRoom(false, { fresh: true })
  })

  window.addEventListener("offline", () => {
    if (quizState.code) setQuizConnection(true, "ინტერნეტი გაითიშა. კავშირის აღდგენისას თამაში ავტომატურად გაგრძელდება.")
  })
}

function handleQuizKeydown(event) {
  const modal = quizDom.modal
  if (!modal || modal.hidden) return

  if (event.key === "Escape") {
    closeQuizModal()
    return
  }

  // სწრაფი პასუხი კლავიატურით: 1–4 ან A–D
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName || "")) return
  if (quizState.isAdmin || quizState.room?.status !== "playing") return

  const keyMap = { "1": 0, "2": 1, "3": 2, "4": 3, a: 0, b: 1, c: 2, d: 3 }
  const option = keyMap[String(event.key).toLowerCase()]

  if (option === undefined) return

  const button = quizDom.options.querySelector(`[data-quiz-option="${option}"]`)
  if (button && !button.disabled) {
    event.preventDefault()
    submitQuizAnswer(option)
  }
}

/* ----------------------- 5. ნავიგაცია და სესიის შენახვა -------------------- */

function saveQuizSession() {
  try {
    if (quizState.code) {
      localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify({ code: quizState.code, ts: Date.now() }))
    }
  } catch {
    // localStorage მიუწვდომელია (მაგ. private mode) — სესიის აღდგენა უბრალოდ არ იმუშავებს
  }
}

function clearQuizSession() {
  try {
    localStorage.removeItem(QUIZ_STORAGE_KEY)
  } catch {
    // იგნორირება
  }
}

function readQuizSession() {
  try {
    const stored = JSON.parse(localStorage.getItem(QUIZ_STORAGE_KEY) || "null")

    if (!stored || !QUIZ_ROOM_CODE_PATTERN.test(String(stored.code)) || Date.now() - Number(stored.ts) > QUIZ_SESSION_TTL) {
      return null
    }

    return stored.code
  } catch {
    return null
  }
}

function selectQuizRole(role) {
  quizState.role = role
  const dialog = quizDom.dialog
  dialog.classList.remove("quiz-role-home", "quiz-role-admin-active", "quiz-role-player-active")
  dialog.classList.add(role === "admin" ? "quiz-role-admin-active" : "quiz-role-player-active")
  quizDom.roleChoice.hidden = true
  quizDom.forms.hidden = false
  quizDom.forms.classList.add("quiz-single-form")
  quizDom.createForm.hidden = role !== "admin"
  quizDom.joinForm.hidden = role !== "player"
  quizDom.heading.textContent = role === "admin" ? "ადმინისტრატორის პანელი" : "მოთამაშის შესვლა"
  quizDom.headingIcon.textContent = role === "admin" ? "♜" : "🎮"
  quizDom.description.textContent = role === "admin" ? "შექმენი შენი ვიქტორინა რამდენიმე მარტივი ნაბიჯით." : "შეიყვანე ოთახის კოდი და შეუერთდი თამაშს."
  setQuizStatus("")
}

function resetQuizRole() {
  if (quizState.code) return
  quizState.role = ""
  const dialog = quizDom.dialog
  dialog.classList.remove("quiz-role-admin-active", "quiz-role-player-active", "quiz-room-active", "quiz-room-admin", "quiz-room-player")
  dialog.classList.add("quiz-role-home")
  quizDom.roleChoice.hidden = false
  quizDom.forms.hidden = true
  quizDom.createForm.hidden = true
  quizDom.joinForm.hidden = true
  quizDom.roomPanel.hidden = true
  quizDom.heading.textContent = "ვიქტორინა"
  quizDom.headingIcon.textContent = "✦"
  quizDom.description.textContent = "აირჩიე შენი როლი და მოემზადე თამაშისთვის."
  setQuizStatus("")
}

function openQuizModal() {
  const modal = quizDom.modal
  if (!modal) return

  modal.hidden = false
  document.body.classList.add("quiz-modal-open")

  if (quizState.code) {
    refreshQuizRoom(false, { fresh: true })
    startQuizRefresh()
    return
  }

  resetQuizRole()

  const savedCode = readQuizSession()
  if (savedCode) resumeQuizSession(savedCode)
}

function closeQuizModal() {
  if (quizDom.modal) quizDom.modal.hidden = true
  document.body.classList.remove("quiz-modal-open")

  const gameNeedsSync = ["playing", "paused"].includes(quizState.room?.status)

  if (!gameNeedsSync) stopQuizRefresh()
  stopQuizTick()
}

async function resumeQuizSession(code) {
  setQuizStatus("წინა ოთახის აღდგენა...")

  try {
    const data = await invokeQuiz("get_room", { code }, { timeoutMs: QUIZ_TIMEOUTS.poll })
    await showQuizRoom(data.room, data)
    setQuizStatus("ოთახი აღდგენილია.", "success")
  } catch (error) {
    if (error.network || error.retryable) {
      setQuizStatus(error.message, "error", () => resumeQuizSession(code))
      return
    }

    // ოთახი აღარ არსებობს ან წვდომა აღარ გვაქვს — ძველ სესიას ვშლით
    clearQuizSession()
    setQuizStatus("")
  }
}

function leaveQuizRoom() {
  stopQuizRefresh()
  stopQuizTick()
  clearQuizSession()

  const music = quizState.music
  if (music && !music.paused) music.pause()

  Object.assign(quizState, {
    code: "",
    room: null,
    roomData: null,
    participants: [],
    isAdmin: false,
    role: "",
    loading: false,
    answering: false,
    pollFailures: 0,
    deadline: 0,
    deadlineQuestionId: null,
    pausedRemainingMs: null,
    timeUpKey: "",
    renderedQuestionKey: "",
    renderedParticipantsKey: "",
    renderedResultsKey: "",
    lastRoomStatus: "",
    pendingAnswer: null,
    musicBlocked: false,
    musicTopic: null
  })
  quizState.localAnswers.clear()

  setQuizConnection(false)
  setHidden(quizDom.musicEnable, true)
  quizDom.gamePanel.hidden = true
  quizDom.lobbyView.hidden = false
  quizDom.results.hidden = true
  quizDom.options.innerHTML = ""
  resetQuizRole()
}

/* ---------------------- 6. ოთახის მოქმედებები ----------------------------- */

async function createQuizRoom(event) {
  event.preventDefault()
  if (quizState.loading) return

  const form = event.currentTarget
  const formData = new FormData(form)
  const title = String(formData.get("title") || "").trim()
  const topic = String(formData.get("topic") || "").trim()
  const difficulty = String(formData.get("difficulty") || "easy")
  const questionCount = Number(formData.get("question_count"))
  const timerSeconds = Number(formData.get("timer_seconds"))

  if (!title || !topic) {
    setQuizStatus("შეავსე ოთახის სახელი და თემა.", "error")
    return
  }

  if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 50) {
    setQuizStatus("კითხვების რაოდენობა უნდა იყოს 1-დან 50-მდე.", "error")
    return
  }

  if (!Number.isInteger(timerSeconds) || timerSeconds < 5 || timerSeconds > 300) {
    setQuizStatus("დრო უნდა იყოს 5-დან 300 წამამდე.", "error")
    return
  }

  quizState.loading = true
  setQuizStatus("ოთახი იქმნება...")
  const submitButton = form.querySelector('button[type="submit"]')
  submitButton.disabled = true
  submitButton.classList.add("is-loading")

  try {
    const data = await invokeQuiz("create_room", {
      title,
      topic,
      difficulty,
      question_count: questionCount,
      timer_seconds: timerSeconds
    })

    if (!data.room?.code) throw new QuizApiError("ოთახის კოდი პასუხში არ მოიძებნა")

    await showQuizRoom(data.room)
    setQuizStatus("ოთახი წარმატებით შეიქმნა.", "success")
  } catch (error) {
    setQuizStatus(error.message, "error", error.retryable ? () => form.requestSubmit() : null)
  } finally {
    quizState.loading = false
    submitButton.disabled = false
    submitButton.classList.remove("is-loading")
  }
}

async function joinQuizRoom(event) {
  event.preventDefault()
  if (quizState.loading) return

  const form = event.currentTarget
  const code = quizEl("quiz-code").value.trim().toUpperCase()

  if (!code) {
    setQuizStatus("შეიყვანე ოთახის კოდი.", "error")
    return
  }

  if (!QUIZ_ROOM_CODE_PATTERN.test(code)) {
    setQuizStatus("ოთახის კოდი 6 სიმბოლოსგან შედგება (ასოები და ციფრები, 0/1/I/O გარეშე).", "error")
    return
  }

  quizState.loading = true
  setQuizStatus("ოთახთან დაკავშირება...")
  const submitButton = form.querySelector('button[type="submit"]')
  submitButton.disabled = true
  submitButton.classList.add("is-loading")

  try {
    const data = await invokeQuiz("join_room", { code })
    await showQuizRoom(data.room)
    setQuizStatus(data.message || "ოთახში წარმატებით შეხვედი.", "success")
  } catch (error) {
    setQuizStatus(error.message, "error", error.retryable ? () => form.requestSubmit() : null)
  } finally {
    quizState.loading = false
    submitButton.disabled = false
    submitButton.classList.remove("is-loading")
  }
}

async function showQuizRoom(room, initialData = null) {
  quizState.room = room
  quizState.code = room.code
  quizState.roomData = null
  quizState.pollFailures = 0
  quizState.renderedQuestionKey = ""
  quizState.renderedParticipantsKey = ""
  quizState.renderedResultsKey = ""
  quizState.localAnswers.clear()
  quizState.pendingAnswer = null

  const dialog = quizDom.dialog
  dialog.classList.remove("quiz-role-home", "quiz-role-admin-active", "quiz-role-player-active")
  dialog.classList.add("quiz-room-active")
  quizDom.roleChoice.hidden = true
  quizDom.forms.hidden = true
  quizDom.roomPanel.hidden = false
  quizDom.heading.textContent = "ვიქტორინის ოთახი"
  quizDom.headingIcon.textContent = "✦"
  quizDom.description.textContent = "მოემზადე ვიქტორინისთვის."

  saveQuizSession()

  if (initialData) {
    applyQuizRoomData(initialData, Date.now(), Date.now())
  } else {
    await refreshQuizRoom(false, { fresh: true })
  }

  startQuizRefresh()
}

async function generateQuizQuestions() {
  if (quizState.loading || !quizState.code || !quizState.isAdmin) return

  const button = quizDom.generate
  quizState.loading = true
  syncQuizAdminButtons()
  button.classList.add("is-loading")
  button.textContent = "AI კითხვებს ქმნის..."

  const startedAt = Date.now()
  const updateProgress = () => {
    const seconds = Math.round((Date.now() - startedAt) / 1000)
    setQuizStatus(`AI ქმნის და ამოწმებს კითხვებს… ${seconds} წმ (ჩვეულებრივ 10–40 წამი)`)
  }

  updateProgress()
  const progressTimer = setInterval(updateProgress, 1000)

  try {
    const data = await invokeQuiz("generate_questions", { code: quizState.code }, { timeoutMs: QUIZ_TIMEOUTS.generate })
    setQuizStatus(data.message || `${data.count} კითხვა წარმატებით შეიქმნა.`, "success")
  } catch (error) {
    setQuizStatus(error.message, "error", () => generateQuizQuestions())
  } finally {
    clearInterval(progressTimer)
    quizState.loading = false
    button.classList.remove("is-loading")
    button.textContent = "✦ AI-ით კითხვების შექმნა"
    syncQuizAdminButtons()
    await refreshQuizRoom(false, { fresh: true })
  }
}

async function startQuizGame() {
  if (quizState.loading || !quizState.code || !quizState.isAdmin) return

  quizState.loading = true
  syncQuizAdminButtons()
  setQuizStatus("თამაში იწყება...")

  try {
    const data = await invokeQuiz("start_game", { code: quizState.code })
    setQuizStatus(data.message || "თამაში დაიწყო.", "success")
    await refreshQuizRoom(false, { fresh: true })
  } catch (error) {
    setQuizStatus(error.message, "error", error.retryable ? () => startQuizGame() : null)
  } finally {
    quizState.loading = false
    syncQuizAdminButtons()
  }
}

async function controlQuizGame(action) {
  if (quizState.loading || !quizState.code || !quizState.isAdmin) return

  quizState.loading = true
  const controls = quizDom.gameAdmin.querySelectorAll("button")
  controls.forEach(button => {
    button.disabled = true
  })

  const payload = { code: quizState.code }

  // ორმაგი დაჭერისგან დაცვა: სერვერი ჯერ ამოწმებს, რომ ინდექსი ჯერ კიდევ იგივეა
  if (action === "next_question" && Number.isInteger(quizState.room?.current_question_index)) {
    payload.expected_index = quizState.room.current_question_index
  }

  try {
    const data = await invokeQuiz(action, payload)
    if (data.message) setQuizStatus(data.message, "success")
    await refreshQuizRoom(false, { fresh: true })
  } catch (error) {
    setQuizStatus(error.message, "error", error.retryable ? () => controlQuizGame(action) : null)
  } finally {
    quizState.loading = false
    controls.forEach(button => {
      button.disabled = false
    })
  }
}

async function copyQuizCode() {
  if (!quizState.code) return

  try {
    await navigator.clipboard.writeText(quizState.code)
    setQuizStatus("ოთახის კოდი დაკოპირდა.", "success")
  } catch {
    setQuizStatus(`ოთახის კოდი: ${quizState.code}`, "success")
  }
}

function syncQuizAdminButtons() {
  const data = quizState.roomData
  const ready = Number(data?.questions_ready) || 0
  const total = Number(quizState.room?.question_count) || 0
  const questionsReady = total > 0 && ready === total

  setDisabled(quizDom.generate, quizState.loading)
  setDisabled(quizDom.start, quizState.loading || !questionsReady)
}

/* ------------------------ 7. განახლების (polling) ძრავა ------------------- */

function nextQuizPollDelay() {
  const status = quizState.room?.status

  if (status === "finished") return null

  if (quizState.pollFailures > 0) {
    return Math.min(10000, 1500 * 2 ** Math.min(quizState.pollFailures, 3))
  }

  const base = status === "playing" ? 1500 : status === "paused" ? 2000 : 2500
  const slow = document.hidden || quizDom.modal?.hidden

  return slow ? Math.max(base, 5000) : base
}

function startQuizRefresh() {
  stopQuizRefresh()
  scheduleQuizPoll(nextQuizPollDelay() ?? 2500)
}

function stopQuizRefresh() {
  if (quizState.pollTimer) clearTimeout(quizState.pollTimer)
  quizState.pollTimer = null
}

function scheduleQuizPoll(delay) {
  if (quizState.pollTimer) clearTimeout(quizState.pollTimer)
  quizState.pollTimer = setTimeout(quizPollTick, delay)
}

async function quizPollTick() {
  quizState.pollTimer = null
  if (!quizState.code) return

  await refreshQuizRoom(false)

  if (!quizState.code) return

  const delay = nextQuizPollDelay()
  if (delay !== null) scheduleQuizPoll(delay)
}

// ერთდროულად მხოლოდ ერთი get_room მოთხოვნა მიდის; fresh=true ელოდება მიმდინარეს და ახალს აგზავნის
async function refreshQuizRoom(showStatus = false, { fresh = false } = {}) {
  if (!quizState.code) return

  if (quizState.refreshPromise) {
    if (!fresh) return quizState.refreshPromise
    await quizState.refreshPromise
    if (quizState.refreshPromise) return quizState.refreshPromise
  }

  const promise = performQuizRefresh(showStatus).finally(() => {
    if (quizState.refreshPromise === promise) quizState.refreshPromise = null
  })

  quizState.refreshPromise = promise
  return promise
}

async function performQuizRefresh(showStatus) {
  const code = quizState.code
  const startedAt = Date.now()

  try {
    const data = await invokeQuiz("get_room", { code }, { timeoutMs: QUIZ_TIMEOUTS.poll })

    // მოთამაშე ამ დროს ოთახიდან გავიდა ან სხვა ოთახში შევიდა
    if (quizState.code !== code) return

    quizState.pollFailures = 0
    setQuizConnection(false)
    applyQuizRoomData(data, startedAt, Date.now())

    if (showStatus) setQuizStatus("ოთახის ინფორმაცია განახლდა.", "success")
  } catch (error) {
    if (quizState.code !== code) return

    // ოთახი აღარ არსებობს ან წვდომა მოგვეხსნა — გაუთავებელ ცდას აზრი არ აქვს
    if (["ROOM_NOT_FOUND", "NO_ACCESS", "EJECTED", "BAD_CODE"].includes(error.code) || error.status === 403 || error.status === 404) {
      setQuizStatus(error.message, "error")
      leaveQuizRoom()
      setQuizStatus(error.message, "error")
      return
    }

    quizState.pollFailures += 1

    if (error.status === 401) {
      setQuizConnection(false)
      setQuizStatus(error.message, "error")
      return
    }

    if (quizState.pollFailures >= 2 || showStatus) {
      setQuizConnection(true, error.network
        ? "კავშირი შეწყდა. ვცდილობთ ხელახლა დაკავშირებას…"
        : "სერვერთან დროებითი პრობლემაა. ვცდილობთ ხელახლა…")
    }
  }
}

/* --------------------------- 8. რენდერი და ტაიმერი ------------------------- */

function applyQuizRoomData(data, requestStart, requestEnd) {
  const room = data.room || quizState.room
  const previous = quizState.room

  quizState.roomData = data
  quizState.room = room
  quizState.isAdmin = data.is_admin === true
  quizState.participants = (data.participants || []).filter(participant => participant.role !== "admin" && participant.is_admin !== true)

  // ტაიმერის სინქრონიზაცია: ქსელის შეყოვნების ნახევარს ვაკლებთ, რომ საათების სხვაობაზე არ ვიყოთ დამოკიდებული
  if (room.status === "playing") {
    const remainingMs = Number.isFinite(data.remaining_ms)
      ? data.remaining_ms
      : (Number(data.remaining_seconds ?? room.timer_seconds) || 0) * 1000
    const estimatedDeadline = (requestStart + requestEnd) / 2 + remainingMs
    const questionId = data.current_question?.id ?? null
    const drift = Math.abs(estimatedDeadline - quizState.deadline)

    // მცირე ცვლილებებს ვაიგნორებთ, რომ ტაიმერი არ "ხტოდეს"
    if (questionId !== quizState.deadlineQuestionId || drift > 700 || previous?.status !== "playing") {
      quizState.deadline = estimatedDeadline
      quizState.deadlineQuestionId = questionId
    }

    quizState.pausedRemainingMs = null
  } else if (room.status === "paused") {
    quizState.pausedRemainingMs = Number.isFinite(data.remaining_ms)
      ? data.remaining_ms
      : (Number(data.remaining_seconds ?? room.timer_seconds) || 0) * 1000
  }

  if (room.topic !== quizState.musicTopic) {
    quizState.musicTopic = room.topic
    updateQuizMusic(room.topic)
  }

  syncQuizMusic(room)

  quizDom.dialog.classList.toggle("quiz-room-admin", quizState.isAdmin)
  quizDom.dialog.classList.toggle("quiz-room-player", !quizState.isAdmin)

  renderQuizLobby(data, room)
  renderQuizGame(data)

  if (room.status !== quizState.lastRoomStatus) {
    quizState.lastRoomStatus = room.status

    if (room.status === "playing") setQuizStatus("თამაში მიმდინარეობს.", "success")
    else if (room.status === "paused") setQuizStatus("თამაში დაპაუზებულია.", "success")
    else if (room.status === "finished") setQuizStatus("ვიქტორინა დასრულებულია.", "success")
  }
}

const QUIZ_STATUS_LABELS = { lobby: "LOBBY", playing: "LIVE", paused: "PAUSED", finished: "FINISHED" }

function renderQuizLobby(data, room) {
  const status = room.status || "lobby"
  const participants = quizState.participants

  setText(quizDom.roomTitle, room.title || "ვიქტორინა")
  setText(quizDom.roomCode, room.code || "")
  setText(quizDom.roomTopic, room.topic || "")
  setText(quizDom.roomSettings, `${room.question_count} კითხვა · ${room.timer_seconds} წამი`)

  const liveLabel = QUIZ_STATUS_LABELS[status] || status.toUpperCase()

  if (quizDom.roomLive.dataset.status !== status) {
    quizDom.roomLive.dataset.status = status
    quizDom.roomLive.innerHTML = `<span></span>${escapeHtml(liveLabel)}`
  }

  setText(quizDom.participantCount, String(participants.length))

  const participantsKey = participants.map(item => `${item.id}:${item.username}`).join("|")

  if (participantsKey !== quizState.renderedParticipantsKey) {
    quizState.renderedParticipantsKey = participantsKey

    quizDom.participants.innerHTML = participants.length
      ? participants.map((participant, index) => `
          <div class="quiz-participant">
            <span class="quiz-participant-avatar">${escapeHtml((participant.username || "?").trim().slice(0, 1).toUpperCase())}</span>
            <span class="quiz-participant-name">${escapeHtml(participant.username || "მონაწილე")}</span>
            <span class="quiz-participant-number">${index + 1}</span>
          </div>
        `).join("")
      : '<div class="quiz-empty-participants">მონაწილეები ჯერ არ არიან.</div>'
  }

  const isLobby = status === "lobby"

  setHidden(quizDom.adminControls, !quizState.isAdmin)
  setHidden(quizDom.generate, !isLobby)
  setHidden(quizDom.start, !isLobby)
  setHidden(quizDom.questionsState, !quizState.isAdmin || !isLobby)
  setHidden(quizDom.codeBox, !quizState.isAdmin)
  setHidden(quizDom.roomMeta, !quizState.isAdmin)
  setHidden(quizDom.roomTop, !quizState.isAdmin)
  setHidden(quizDom.lobbyNote, !quizState.isAdmin)
  setHidden(quizDom.refresh, !quizState.isAdmin)
  setHidden(quizDom.leave, quizState.isAdmin || !isLobby)

  if (quizState.isAdmin && isLobby) {
    const ready = Number(data.questions_ready) || 0
    const total = Number(room.question_count) || 0
    const complete = total > 0 && ready === total

    setText(
      quizDom.questionsState,
      complete
        ? `✓ ${ready} კითხვა მზადაა. შეგიძლია თამაშის დაწყება.`
        : ready > 0
          ? `კითხვების მომზადება არასრულია (${ready} / ${total}). შექმენი ხელახლა.`
          : "კითხვები ჯერ არ არის შექმნილი."
    )
    quizDom.questionsState.classList.toggle("quiz-questions-ready", complete)
    syncQuizAdminButtons()
  }
}

function getQuizRemainingMs() {
  const room = quizState.room

  if (!room) return 0
  if (room.status === "paused") return quizState.pausedRemainingMs ?? room.timer_seconds * 1000
  if (room.status !== "playing") return 0

  return Math.max(0, quizState.deadline - Date.now())
}

function startQuizTick() {
  if (quizState.tickTimer) return
  quizState.tickTimer = setInterval(tickQuizTimer, 200)
}

function stopQuizTick() {
  if (quizState.tickTimer) clearInterval(quizState.tickTimer)
  quizState.tickTimer = null
}

// ტაიმერი ადგილობრივად ითვლის და სერვერის პასუხებით სინქრონდება
function tickQuizTimer() {
  const room = quizState.room

  if (!room || !["playing", "paused"].includes(room.status) || quizDom.modal.hidden) {
    if (!room || !["playing", "paused"].includes(room.status)) stopQuizTick()
    return
  }

  const remainingMs = getQuizRemainingMs()
  const seconds = Math.ceil(remainingMs / 1000)
  const total = Math.max(1, Number(room.timer_seconds) * 1000)
  const urgent = room.status === "playing" && seconds <= 5 && seconds > 0

  setText(quizDom.timer, room.status === "paused" ? "⏸ პაუზა" : `${seconds} წმ`)
  quizDom.timerBar.style.transform = `scaleX(${Math.min(1, remainingMs / total)})`
  quizDom.timer.classList.toggle("quiz-timer-urgent", urgent)
  quizDom.timerBar.classList.toggle("quiz-timer-urgent", urgent)

  if (room.status === "playing" && remainingMs <= 0) onQuizTimeUp()
}

function onQuizTimeUp() {
  const question = quizState.roomData?.current_question
  const key = `${quizState.code}:${question?.id ?? ""}`

  if (!question || quizState.timeUpKey === key) return

  quizState.timeUpKey = key

  // მიმდინარე გაგზავნას დრო ჯერ კიდევ აქვს (სერვერზე მცირე დამატებითი დროა), ამიტომ ღილაკებს ვბლოკავთ მხოლოდ თუ არაფერი იგზავნება
  if (!quizState.pendingAnswer) updateQuizOptions(quizState.roomData, question)

  // სერვერთან სინქრონიზაცია: აჩვენებს სწორ პასუხს და, საჭიროებისას, ახალ კითხვას
  setTimeout(() => refreshQuizRoom(false, { fresh: true }), 500)
}

function renderQuizResults(data) {
  const ranked = [...(data.participants || [])]
    .filter(item => item.status === "active")
    .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))

  const myId = data.me?.id ?? null
  const key = ranked.map(item => `${item.id}:${item.score}`).join("|") + `#${myId}`

  if (key === quizState.renderedResultsKey) return
  quizState.renderedResultsKey = key

  const medals = ["🥇", "🥈", "🥉"]

  quizDom.leaderboard.innerHTML = ranked.length
    ? ranked.map((item, index) => `
        <div class="quiz-leaderboard-row${item.id === myId ? " quiz-leaderboard-me" : ""}" style="--i:${index}">
          <span><b class="quiz-rank">${medals[index] || index + 1}</b> ${escapeHtml(item.username || "მონაწილე")}${item.id === myId ? " <em>(შენ)</em>" : ""}</span>
          <strong>${Number(item.score) || 0} ქულა</strong>
        </div>
      `).join("")
    : "შედეგები ჯერ არ არის"

  const myIndex = ranked.findIndex(item => item.id === myId)

  setText(
    quizDom.resultsSummary,
    myIndex >= 0 ? `შენი ადგილი: ${myIndex + 1} / ${ranked.length} · ${Number(ranked[myIndex].score) || 0} ქულა` : ""
  )
}

function renderQuizGame(data) {
  const room = data.room
  const isGameScreen = room.status !== "lobby"

  setHidden(quizDom.lobbyView, isGameScreen)
  setHidden(quizDom.gamePanel, !isGameScreen)

  if (!isGameScreen) {
    quizState.renderedQuestionKey = ""
    stopQuizTick()
    return
  }

  setHidden(quizDom.gameAdmin, !quizState.isAdmin || room.status === "finished")
  setHidden(quizDom.pause, room.status !== "playing")
  setHidden(quizDom.resume, room.status !== "paused")
  setHidden(quizDom.next, room.status !== "playing")

  if (room.status === "finished") {
    stopQuizTick()
    setHidden(quizDom.results, false)
    setHidden(quizDom.timerBar.parentElement, true)
    setHidden(quizDom.score, true)
    setText(quizDom.progress, "თამაში დასრულდა")
    setText(quizDom.timer, "🏁")
    quizDom.timer.classList.remove("quiz-timer-urgent")
    setText(quizDom.question, "ვიქტორინა დასრულებულია!")
    if (quizDom.options.innerHTML) quizDom.options.innerHTML = ""
    setText(quizDom.feedback, "")
    quizDom.feedback.className = ""
    setHidden(quizDom.explanation, true)
    setHidden(quizDom.leaveResults, false)
    quizState.renderedQuestionKey = ""
    renderQuizResults(data)
    return
  }

  setHidden(quizDom.results, true)
  setHidden(quizDom.timerBar.parentElement, false)

  const question = data.current_question

  if (!question) {
    setText(quizDom.question, "კითხვა იტვირთება...")
    if (quizDom.options.innerHTML) quizDom.options.innerHTML = ""
    quizState.renderedQuestionKey = ""
    if (!quizDom.modal.hidden) {
      startQuizTick()
      tickQuizTimer()
    }
    return
  }

  setText(quizDom.progress, `კითხვა ${question.position + 1} / ${room.question_count}`)

  const showScore = !quizState.isAdmin && data.me
  setHidden(quizDom.score, !showScore)
  if (showScore) setText(quizDom.score, `${Number(data.me.score) || 0} ქულა`)

  const isLast = question.position + 1 >= room.question_count
  setText(quizDom.next, isLast ? "ვიქტორინის დასრულება ✓" : "შემდეგი კითხვა →")

  const questionKey = String(question.id ?? question.position)

  if (quizState.renderedQuestionKey !== questionKey) {
    quizState.renderedQuestionKey = questionKey
    quizState.timeUpKey = ""
    quizState.pendingAnswer = null

    quizDom.question.textContent = question.question

    quizDom.options.innerHTML = (question.options || []).map((option, index) => `
      <button type="button" data-quiz-option="${index}" style="--i:${index}">
        <span class="quiz-option-letter">${String.fromCharCode(65 + index)}</span>
        <span class="quiz-option-text">${escapeHtml(option)}</span>
        <i class="quiz-option-mark" aria-hidden="true"></i>
      </button>
    `).join("")

    quizDom.feedback.textContent = ""
    quizDom.feedback.className = ""
    setHidden(quizDom.explanation, true)

    // ახალი კითხვის შემოსვლის ანიმაცია
    quizDom.gamePanel.classList.remove("quiz-question-enter")
    void quizDom.gamePanel.offsetWidth
    quizDom.gamePanel.classList.add("quiz-question-enter")
  }

  updateQuizOptions(data, question)

  if (!quizDom.modal.hidden) {
    startQuizTick()
    tickQuizTimer()
  }
}

function getQuizAnswer(question) {
  return quizState.roomData?.my_answer || quizState.localAnswers.get(String(question.id)) || null
}

function setQuizFeedback(text, className = "") {
  if (quizDom.feedback.textContent !== text) quizDom.feedback.textContent = text
  if (quizDom.feedback.className !== className) quizDom.feedback.className = className
}

function updateQuizOptions(data, question) {
  const room = data.room
  const buttons = quizDom.options.querySelectorAll("button")
  const answer = getQuizAnswer(question)
  const pending = quizState.pendingAnswer && String(quizState.pendingAnswer.questionId) === String(question.id)

  if (answer) {
    const correctOption = answer.correct_option
    const selectedOption = answer.selected_option
    const hasCorrect = correctOption !== null && correctOption !== undefined

    buttons.forEach((button, index) => {
      const isCorrect = hasCorrect && index === Number(correctOption)
      const isWrongPick = !answer.is_correct && index === Number(selectedOption)

      setDisabled(button, true)
      button.classList.remove("quiz-option-pending")
      button.classList.toggle("quiz-correct-answer", isCorrect)
      button.classList.toggle("quiz-wrong-answer", isWrongPick)
      button.classList.toggle("quiz-option-dim", !isCorrect && !isWrongPick)
    })

    if (answer.is_correct) {
      setQuizFeedback(`სწორია! +${Number(answer.points_awarded) || 0} ქულა`, "quiz-answer-correct")
    } else {
      const correctText = Array.isArray(question.options) && hasCorrect
        ? ` სწორი პასუხია: ${question.options[Number(correctOption)]}.`
        : ""
      setQuizFeedback(`არასწორია.${correctText}`, "quiz-answer-wrong")
    }

    if (answer.explanation) {
      setText(quizDom.explanation, answer.explanation)
      setHidden(quizDom.explanation, false)
    }

    return
  }

  if (pending) {
    buttons.forEach(button => setDisabled(button, true))
    return
  }

  const timeIsUp = room.status === "playing" && getQuizRemainingMs() <= 0
  const locked = quizState.isAdmin || room.status !== "playing" || timeIsUp

  buttons.forEach(button => {
    setDisabled(button, locked)
    button.classList.remove("quiz-option-pending", "quiz-correct-answer", "quiz-wrong-answer", "quiz-option-dim")
  })

  if (quizState.isAdmin) {
    if (room.status === "paused") {
      setQuizFeedback("თამაში დაპაუზებულია.")
    } else {
      const answered = Number(data.answered_count) || 0
      const players = Number(data.active_players) || 0
      setQuizFeedback(`მოთამაშეების პასუხებს ელოდები (${answered} / ${players} უპასუხა).`)
    }
  } else if (timeIsUp) {
    setQuizFeedback("დრო ამოიწურა. დაელოდე შემდეგ კითხვას.")
  } else if (room.status === "paused") {
    setQuizFeedback("თამაში დროებით შეჩერებულია.")
  } else {
    setQuizFeedback("აირჩიე ერთი პასუხი.")
  }
}

/* ---------------------------- 9. პასუხის გაგზავნა -------------------------- */

async function sendQuizAnswer(question, option) {
  let lastError

  for (let attempt = 1; attempt <= QUIZ_ANSWER_ATTEMPTS; attempt++) {
    try {
      return await invokeQuiz("submit_answer", {
        code: quizState.code,
        question_id: question.id,
        selected_option: option
      }, { timeoutMs: QUIZ_TIMEOUTS.answer })
    } catch (error) {
      lastError = error

      const transient = error.network || error.retryable
      const stillCurrent = quizState.code && String(quizState.roomData?.current_question?.id) === String(question.id)
      // სერვერი ამოწურვის შემდეგაც ~2 წამს იღებს პასუხს ქსელის შეფერხების გამო
      const hasTime = quizState.deadline - Date.now() > -1500

      if (!transient || attempt === QUIZ_ANSWER_ATTEMPTS || !stillCurrent || !hasTime) throw error

      setQuizFeedback("კავშირი შეფერხდა — პასუხს ხელახლა ვაგზავნით…", "quiz-answer-pending")
      await quizSleep(400 * attempt)
    }
  }

  throw lastError
}

async function submitQuizAnswer(option) {
  // სინქრონული დაცვა: მეორე დაჭერა, სანამ პირველი მუშავდება, სრულად იგნორირდება
  if (quizState.answering || quizState.isAdmin || !quizState.code) return

  const data = quizState.roomData
  const question = data?.current_question

  if (!question || data.room.status !== "playing") return
  if (getQuizAnswer(question)) return

  if (getQuizRemainingMs() <= 0) {
    setQuizFeedback("დრო ამოიწურა. დაელოდე შემდეგ კითხვას.")
    return
  }

  quizState.answering = true
  quizState.pendingAnswer = { questionId: question.id, option }

  // მყისიერი ვიზუალური რეაქცია — სერვერის პასუხს არ ველოდებით
  quizDom.options.querySelectorAll("button").forEach(button => {
    button.disabled = true
    button.classList.toggle("quiz-option-pending", Number(button.dataset.quizOption) === option)
  })
  setQuizFeedback("პასუხი იგზავნება…", "quiz-answer-pending")

  try {
    const result = await sendQuizAnswer(question, option)

    // პასუხი ადგილობრივადაც ვინახავთ, რომ დაგვიანებულმა განახლებამ არ წაშალოს
    quizState.localAnswers.set(String(question.id), {
      selected_option: result.selected_option ?? option,
      is_correct: result.correct === true || result.is_correct === true,
      points_awarded: result.points_awarded,
      correct_option: result.correct_option,
      explanation: result.explanation || ""
    })

    quizState.pendingAnswer = null

    if (quizState.roomData?.me && Number.isFinite(result.total_score)) {
      quizState.roomData.me.score = result.total_score
      setText(quizDom.score, `${result.total_score} ქულა`)
    }

    if (quizState.roomData?.current_question?.id === question.id) {
      updateQuizOptions(quizState.roomData, question)
    }

    if ((result.correct === true || result.is_correct === true) && !result.already_answered) {
      celebrateQuizCorrectAnswer()
    }

    // ქულების განახლება სხვა მონაწილეებისთვისაც — ფონურად, UI-ს არ ბლოკავს
    refreshQuizRoom(false)
  } catch (error) {
    quizState.pendingAnswer = null

    if (["TIME_UP", "QUESTION_CHANGED", "NOT_PLAYING"].includes(error.code)) {
      setQuizStatus(error.message, "error")
      await refreshQuizRoom(false, { fresh: true })
    } else {
      setQuizStatus(
        `პასუხი ვერ გაიგზავნა: ${error.message}`,
        "error",
        error.retryable || error.network ? () => submitQuizAnswer(option) : null
      )
    }

    const current = quizState.roomData?.current_question

    // ღილაკებს ვუბრუნებთ აქტიურ მდგომარეობას, რომ მოთამაშემ ხელახლა სცადოს
    if (current && String(current.id) === String(question.id)) {
      updateQuizOptions(quizState.roomData, current)
    }
  } finally {
    quizState.answering = false
  }
}

/* --------------------------- 10. ეფექტები და start ------------------------- */

function celebrateQuizCorrectAnswer() {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return

  document.querySelectorAll(".quiz-celebration").forEach(element => element.remove())

  const celebration = document.createElement("div")
  celebration.className = "quiz-celebration"
  celebration.setAttribute("aria-hidden", "true")

  const fragment = document.createDocumentFragment()
  const colors = ["#22d395", "#ffd166", "#ff4d6d", "#5e9bff", "#c77dff", "#ffffff", "#ff914d"]
  const random = (min, max) => min + Math.random() * (max - min)

  for (let i = 0; i < 70; i++) {
    const piece = document.createElement("span")
    piece.className = "quiz-confetti"
    piece.style.setProperty("--x", `${random(0, 100)}%`)
    piece.style.setProperty("--w", `${random(5, 12)}px`)
    piece.style.setProperty("--h", `${random(8, 18)}px`)
    piece.style.setProperty("--color", colors[Math.floor(Math.random() * colors.length)])
    piece.style.setProperty("--duration", `${random(2, 3.6)}s`)
    piece.style.setProperty("--delay", `${random(0, 0.6)}s`)
    piece.style.setProperty("--drift", `${random(-180, 180)}px`)
    piece.style.setProperty("--rotation", `${random(360, 1440)}deg`)
    fragment.appendChild(piece)
  }

  for (let i = 0; i < 4; i++) {
    const firework = document.createElement("span")
    firework.className = "quiz-firework"
    firework.style.setProperty("--x", `${random(15, 85)}%`)
    firework.style.setProperty("--y", `${random(15, 60)}%`)
    firework.style.setProperty("--color", colors[Math.floor(Math.random() * colors.length)])
    firework.style.animationDelay = `${i * 0.22}s`
    fragment.appendChild(firework)
  }

  celebration.appendChild(fragment)
  document.body.appendChild(celebration)
  setTimeout(() => celebration.remove(), 4500)
}

function initQuiz() {
  createQuizInterface()

  // თუ ჰედერი გვიან ჩაიტვირთა, ღილაკს load-ზე ვცდით ხელახლა
  if (!quizEl("quiz-launch-button")) {
    window.addEventListener("load", ensureQuizLaunchButton, { once: true })
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initQuiz)
} else {
  initQuiz()
}
