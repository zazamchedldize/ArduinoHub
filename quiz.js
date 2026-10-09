
const supabaseClient = window.supabase

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[char])

const quizState = {
  code: "",
  room: null,
  roomData: null,
  participants: [],
  refresh: null,
  loading: false,
  isAdmin: false,
  answering: false
}

function createQuizInterface() {
  if (document.getElementById("quiz-launch-button")) return

  const nav = document.querySelector(".site-header nav")

  if (nav) {
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
  }

  const modal = document.createElement("div")
  modal.id = "quiz-modal"
  modal.className = "quiz-modal"
  modal.hidden = true

  modal.innerHTML = `
    <div class="quiz-backdrop" data-quiz-close></div>

    <section class="quiz-dialog" role="dialog" aria-modal="true" aria-labelledby="quiz-heading">
      <button class="quiz-close" type="button" data-quiz-close aria-label="დახურვა">×</button>

      <div class="quiz-heading-icon">✦</div>
      <p class="quiz-eyebrow">ARDUINOHUB CHALLENGE</p>
      <h2 id="quiz-heading">ვიქტორინის ოთახი</h2>
      <p class="quiz-description">შექმენი ოთახი ან შეუერთდი მეგობრებს უნიკალური კოდით.</p>

      <div class="quiz-forms">
        <form id="quiz-create-form" class="quiz-card">
          <div class="quiz-card-title">ახალი ოთახი</div>

          <label for="quiz-title">ოთახის სახელი</label>
          <input id="quiz-title" name="title" maxlength="100" placeholder="მაგ. Arduino Challenge" required>

          <label for="quiz-topic">თემა</label>
          <input id="quiz-topic" name="topic" maxlength="500" placeholder="მაგ. Arduino და ქიმია" required>

          <label for="quiz-difficulty">სირთულე</label>
          <select id="quiz-difficulty" name="difficulty">
            <option value="easy">მარტივი</option>
            <option value="medium">საშუალო</option>
            <option value="hard">რთული</option>
          </select>

          <div class="quiz-form-row">
            <div>
              <label for="quiz-count">კითხვები</label>
              <input id="quiz-count" name="question_count" type="number" min="1" max="50" value="5" required>
            </div>

            <div>
              <label for="quiz-timer">წამები</label>
              <input id="quiz-timer" name="timer_seconds" type="number" min="5" max="300" value="20" required>
            </div>
          </div>

          <button class="quiz-primary-button" type="submit">
            ოთახის შექმნა <span>→</span>
          </button>
        </form>

        <form id="quiz-join-form" class="quiz-card">
          <div class="quiz-card-title">ოთახში შესვლა</div>
          <p class="quiz-card-description">შეიყვანე ადმინისტრატორის მიერ მოწოდებული კოდი.</p>

          <label for="quiz-code">ოთახის კოდი</label>
          <input id="quiz-code" name="code" maxlength="6" placeholder="მაგ. 72S3AL" autocomplete="off" required>

          <button class="quiz-secondary-button" type="submit">
            შემოერთება <span>↗</span>
          </button>
        </form>
      </div>

      <div id="quiz-status" class="quiz-status" role="status" aria-live="polite"></div>

      <section id="quiz-room-panel" class="quiz-room-panel" hidden>
        <div class="quiz-room-top">
          <div>
            <p class="quiz-eyebrow">ვიქტორინის ოთახი</p>
            <h3 id="quiz-room-title"></h3>
          </div>

          <span class="quiz-room-live"><span></span> LOBBY</span>
        </div>

        <div class="quiz-code-box">
          <div>
            <small>ოთახის კოდი</small>
            <strong id="quiz-room-code"></strong>
          </div>

          <button id="quiz-copy-code" type="button" aria-label="კოდის კოპირება">კოპირება</button>
        </div>

        <div class="quiz-room-meta">
          <span id="quiz-room-topic"></span>
          <span id="quiz-room-settings"></span>
        </div>

        <div class="quiz-participants-heading">
          <strong>მონაწილეები</strong>
          <span id="quiz-participant-count">0</span>
        </div>

        <div id="quiz-participants" class="quiz-participants"></div>

        <div id="quiz-admin-controls" class="quiz-admin-controls" hidden>
          <div class="quiz-card-title">ადმინისტრატორის მართვა</div>

          <p class="quiz-card-description">
            AI შექმნის კითხვებს მითითებული თემის, სირთულისა და რაოდენობის მიხედვით.
          </p>

          <button id="quiz-generate-questions" class="quiz-primary-button" type="button">
            ✦ AI-ით კითხვების შექმნა
          </button>

          <button id="quiz-start-game" class="quiz-secondary-button" type="button">
            თამაშის დაწყება →
          </button>
        </div>

        <section id="quiz-game-panel" class="quiz-game-panel" hidden>
          <div class="quiz-game-header">
            <span id="quiz-game-progress">კითხვა 1</span>
            <span id="quiz-game-timer">20 წმ</span>
          </div>

          <h3 id="quiz-game-question">კითხვის ტექსტი</h3>

          <div id="quiz-game-options" class="quiz-game-options"></div>

          <p id="quiz-game-feedback" role="status" aria-live="polite"></p>

          <div id="quiz-game-admin-controls" hidden>
            <button id="quiz-pause-game" class="quiz-secondary-button" type="button">პაუზა</button>
            <button id="quiz-resume-game" class="quiz-secondary-button" type="button" hidden>გაგრძელება</button>
            <button id="quiz-next-question" class="quiz-primary-button" type="button">შემდეგი კითხვა →</button>
          </div>

          <div id="quiz-game-results" hidden>
            <h3>🏆 შედეგები</h3>
            <div id="quiz-game-leaderboard"></div>
          </div>
        </section>

        <p class="quiz-lobby-note">
          ოთახის მონაწილეები პერიოდულად განახლდება. თამაშის დაწყებამდე კითხვები უნდა მომზადდეს.
        </p>

        <button id="quiz-refresh-room" class="quiz-secondary-button" type="button">
          განახლება ↻
        </button>
      </section>
    </section>
  `

  document.body.appendChild(modal)

  modal.querySelectorAll("[data-quiz-close]").forEach(element => {
    element.addEventListener("click", closeQuizModal)
  })

  document.getElementById("quiz-create-form").addEventListener("submit", createQuizRoom)
  document.getElementById("quiz-join-form").addEventListener("submit", joinQuizRoom)
  document.getElementById("quiz-copy-code").addEventListener("click", copyQuizCode)
  document.getElementById("quiz-refresh-room").addEventListener("click", () => refreshQuizRoom(true))
  document.getElementById("quiz-generate-questions").addEventListener("click", generateQuizQuestions)
  document.getElementById("quiz-start-game").addEventListener("click", startQuizGame)

  document.getElementById("quiz-game-options").addEventListener("click", event => {
    const button = event.target.closest("[data-quiz-option]")

    if (!button) return

    submitQuizAnswer(Number(button.dataset.quizOption))
  })

  document.getElementById("quiz-pause-game").addEventListener("click", () => {
    controlQuizGame("pause_game")
  })

  document.getElementById("quiz-resume-game").addEventListener("click", () => {
    controlQuizGame("resume_game")
  })

  document.getElementById("quiz-next-question").addEventListener("click", () => {
    controlQuizGame("next_question")
  })

  document.getElementById("quiz-code").addEventListener("input", event => {
    event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)
  })

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modal.hidden) {
      closeQuizModal()
    }
  })
}

function openQuizModal() {
  const modal = document.getElementById("quiz-modal")

  if (!modal) return

  modal.hidden = false
  document.body.classList.add("quiz-modal-open")

  if (quizState.code) {
    refreshQuizRoom(false)
  }
}

function closeQuizModal() {
  const modal = document.getElementById("quiz-modal")

  if (modal) modal.hidden = true

  document.body.classList.remove("quiz-modal-open")

  if (quizState.refresh) {
    clearInterval(quizState.refresh)
    quizState.refresh = null
  }
}

function setQuizStatus(message, type = "") {
  const status = document.getElementById("quiz-status")

  if (!status) return

  status.textContent = message
  status.className = `quiz-status ${type}`
}

async function getQuizError(error) {
  if (error?.context && typeof error.context.json === "function") {
    try {
      const body = await error.context.json()
      return body.error || body.message || error.message
    } catch {
      return error.message || "მოთხოვნა ვერ შესრულდა"
    }
  }

  return error?.message || "მოთხოვნა ვერ შესრულდა"
}

async function invokeQuiz(action, payload = {}) {
  if (!supabaseClient?.functions) {
    throw new Error("Supabase ჯერ არ არის ჩატვირთული")
  }

  const { data, error } = await supabaseClient.functions.invoke("quiz", {
    body: { action, ...payload }
  })

  if (error) {
    throw new Error(await getQuizError(error))
  }

  if (data?.success === false) {
    throw new Error(data.error || "მოთხოვნა ვერ შესრულდა")
  }

  return data
}

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

  try {
    const data = await invokeQuiz("create_room", {
      title,
      topic,
      difficulty,
      question_count: questionCount,
      timer_seconds: timerSeconds
    })

    if (!data.room?.code) {
      throw new Error("ოთახი შეიქმნა, მაგრამ კოდი პასუხში არ მოიძებნა")
    }

    await showQuizRoom(data.room)
    setQuizStatus("ოთახი წარმატებით შეიქმნა.", "success")
  } catch (error) {
    setQuizStatus(error.message, "error")
  } finally {
    quizState.loading = false
    submitButton.disabled = false
  }
}

async function joinQuizRoom(event) {
  event.preventDefault()

  if (quizState.loading) return

  const code = document.getElementById("quiz-code").value.trim().toUpperCase()

  if (!code) {
    setQuizStatus("შეიყვანე ოთახის კოდი.", "error")
    return
  }

  quizState.loading = true
  setQuizStatus("ოთახთან დაკავშირება...")

  const submitButton = event.currentTarget.querySelector('button[type="submit"]')
  submitButton.disabled = true

  try {
    const data = await invokeQuiz("join_room", { code })

    await showQuizRoom(data.room)
    setQuizStatus(data.message || "ოთახში წარმატებით შეხვედი.", "success")
  } catch (error) {
    setQuizStatus(error.message, "error")
  } finally {
    quizState.loading = false
    submitButton.disabled = false
  }
}

async function showQuizRoom(room) {
  quizState.room = room
  quizState.code = room.code
  quizState.roomData = null
  quizState.isAdmin = false

  document.getElementById("quiz-room-panel").hidden = false
  document.getElementById("quiz-room-title").textContent = room.title || "ვიქტორინა"
  document.getElementById("quiz-room-code").textContent = room.code || ""
  document.getElementById("quiz-room-topic").textContent = room.topic || ""
  document.getElementById("quiz-room-settings").textContent =
    `${room.question_count} კითხვა · ${room.timer_seconds} წამი`

  await refreshQuizRoom(false)

  if (quizState.refresh) {
    clearInterval(quizState.refresh)
  }

  quizState.refresh = setInterval(() => {
    if (!document.getElementById("quiz-modal")?.hidden) {
      refreshQuizRoom(false)
    }
  }, 2000)
}

async function refreshQuizRoom(showStatus) {
  if (!quizState.code) return

  try {
    const data = await invokeQuiz("get_room", { code: quizState.code })

    quizState.roomData = data

    const room = data.room || quizState.room

    const participants = (data.participants || []).filter(participant =>
      participant.role !== "admin" && participant.is_admin !== true
    )

    quizState.room = room
    quizState.participants = participants
    quizState.isAdmin = data.is_admin === true

    document.getElementById("quiz-room-title").textContent = room.title || "ვიქტორინა"
    document.getElementById("quiz-room-code").textContent = room.code || ""
    document.getElementById("quiz-room-topic").textContent = room.topic || ""
    document.getElementById("quiz-room-settings").textContent =
      `${room.question_count} კითხვა · ${room.timer_seconds} წამი`

    const statusLabel = document.querySelector(".quiz-room-live")
    const status = room.status || "lobby"

    statusLabel.innerHTML = `<span></span>${escapeHtml(status.toUpperCase())}`

    const list = document.getElementById("quiz-participants")

    document.getElementById("quiz-participant-count").textContent = participants.length

    if (!participants.length) {
      list.innerHTML = '<div class="quiz-empty-participants">მონაწილეები ჯერ არ არიან.</div>'
    } else {
      list.innerHTML = participants.map((participant, index) => `
        <div class="quiz-participant">
          <span class="quiz-participant-avatar">${escapeHtml((participant.username || "?").trim().slice(0, 1).toUpperCase())}</span>
          <span class="quiz-participant-name">${escapeHtml(participant.username || "მონაწილე")}</span>
          <span class="quiz-participant-number">${index + 1}</span>
        </div>
      `).join("")
    }

    const adminControls = document.getElementById("quiz-admin-controls")
    const generateButton = document.getElementById("quiz-generate-questions")
    const startButton = document.getElementById("quiz-start-game")

    adminControls.hidden = !quizState.isAdmin
    generateButton.hidden = status !== "lobby"
    startButton.hidden = status !== "lobby"

    if (status === "playing") {
      setQuizStatus("თამაში მიმდინარეობს.", "success")
    } else if (status === "paused") {
      setQuizStatus("თამაში დაპაუზებულია.", "success")
    } else if (status === "finished") {
      setQuizStatus("ვიქტორინა დასრულებულია.", "success")
    } else if (showStatus) {
      setQuizStatus("ოთახის ინფორმაცია განახლდა.", "success")
    }

    renderQuizGame(data)
  } catch (error) {
    if (showStatus) {
      setQuizStatus(error.message, "error")
    }
  }
}

async function generateQuizQuestions() {
  if (quizState.loading || !quizState.code || !quizState.isAdmin) return

  const button = document.getElementById("quiz-generate-questions")
  const startButton = document.getElementById("quiz-start-game")

  quizState.loading = true
  button.disabled = true
  startButton.disabled = true
  button.textContent = "AI კითხვებს ქმნის..."

  setQuizStatus("AI ქმნის კითხვებს. ამას შეიძლება ცოტა დრო დასჭირდეს...")

  try {
    const data = await invokeQuiz("generate_questions", {
      code: quizState.code
    })

    setQuizStatus(
      data.message || `${data.count} კითხვა წარმატებით შეიქმნა.`,
      "success"
    )
  } catch (error) {
    setQuizStatus(error.message, "error")
  } finally {
    quizState.loading = false
    button.disabled = false
    startButton.disabled = false
    button.textContent = "✦ AI-ით კითხვების შექმნა"

    await refreshQuizRoom(false)
  }
}

async function startQuizGame() {
  if (quizState.loading || !quizState.code || !quizState.isAdmin) return

  const button = document.getElementById("quiz-start-game")
  const generateButton = document.getElementById("quiz-generate-questions")

  quizState.loading = true
  button.disabled = true
  generateButton.disabled = true

  setQuizStatus("თამაში იწყება...")

  try {
    const data = await invokeQuiz("start_game", {
      code: quizState.code
    })

    setQuizStatus(data.message || "თამაში დაიწყო.", "success")
    await refreshQuizRoom(false)
  } catch (error) {
    setQuizStatus(error.message, "error")
  } finally {
    quizState.loading = false
    button.disabled = false
    generateButton.disabled = false
  }
}

async function submitQuizAnswer(option) {
  if (quizState.loading || quizState.answering || !quizState.code || quizState.isAdmin) return

  const data = quizState.roomData
  const question = data?.current_question

  if (!question || data.room.status !== "playing" || data.my_answer) return

  if (data.remaining_seconds <= 0) {
    setQuizStatus("პასუხის დრო ამოიწურა.", "error")
    return
  }

  quizState.answering = true

  const buttons = document.querySelectorAll("#quiz-game-options button")

  buttons.forEach(button => {
    button.disabled = true
  })

  try {
    const result = await invokeQuiz("submit_answer", {
      code: quizState.code,
      selected_option: option
    })

    const feedback = document.getElementById("quiz-game-feedback")

    feedback.textContent = result.correct
      ? `სწორია! +${result.points_awarded} ქულა. ${result.explanation || ""}`
      : `არასწორია. ${result.explanation || ""}`

    feedback.className = result.correct
      ? "quiz-answer-correct"
      : "quiz-answer-wrong"

    await refreshQuizRoom(false)
  } catch (error) {
    setQuizStatus(error.message, "error")
    await refreshQuizRoom(false)
  } finally {
    quizState.answering = false
  }
}

async function controlQuizGame(action) {
  if (quizState.loading || !quizState.code || !quizState.isAdmin) return

  quizState.loading = true

  const controls = document.querySelectorAll("#quiz-game-admin-controls button")
  controls.forEach(button => {
    button.disabled = true
  })

  try {
    const data = await invokeQuiz(action, {
      code: quizState.code
    })

    setQuizStatus(data.message || "მოქმედება შესრულდა.", "success")
    await refreshQuizRoom(false)
  } catch (error) {
    setQuizStatus(error.message, "error")
  } finally {
    quizState.loading = false
    controls.forEach(button => {
      button.disabled = false
    })
  }
}

function renderQuizGame(data) {
  const panel = document.getElementById("quiz-game-panel")
  const results = document.getElementById("quiz-game-results")
  const adminControls = document.getElementById("quiz-game-admin-controls")
  const room = data.room

  panel.hidden = room.status === "lobby"

  if (panel.hidden) return

  adminControls.hidden = !quizState.isAdmin

  document.getElementById("quiz-pause-game").hidden = room.status !== "playing"
  document.getElementById("quiz-resume-game").hidden = room.status !== "paused"
  document.getElementById("quiz-next-question").hidden = room.status !== "playing"

  if (room.status === "finished") {
    results.hidden = false

    document.getElementById("quiz-game-progress").textContent = "თამაში დასრულდა"
    document.getElementById("quiz-game-timer").textContent = "🏁"
    document.getElementById("quiz-game-question").textContent = "ვიქტორინა დასრულებულია!"
    document.getElementById("quiz-game-options").innerHTML = ""
    document.getElementById("quiz-game-feedback").textContent = ""

    const ranked = [...data.participants]
      .filter(item => item.status === "active")
      .sort((a, b) => b.score - a.score)

    document.getElementById("quiz-game-leaderboard").innerHTML = ranked.length
      ? ranked.map((item, index) => `
          <div class="quiz-leaderboard-row">
            <span>${index + 1}. ${escapeHtml(item.username)}</span>
            <strong>${Number(item.score) || 0} ქულა</strong>
          </div>
        `).join("")
      : "შედეგები ჯერ არ არის"

    return
  }

  results.hidden = true

  const question = data.current_question
  const options = document.getElementById("quiz-game-options")
  const feedback = document.getElementById("quiz-game-feedback")

  if (!question) {
    document.getElementById("quiz-game-question").textContent = "კითხვა იტვირთება..."
    options.innerHTML = ""
    return
  }

  document.getElementById("quiz-game-progress").textContent =
    `კითხვა ${question.position + 1} / ${room.question_count}`

  document.getElementById("quiz-game-timer").textContent =
    room.status === "paused"
      ? "⏸ პაუზა"
      : `${data.remaining_seconds ?? room.timer_seconds} წმ`

  document.getElementById("quiz-game-question").textContent = question.question

  const answered = Boolean(data.my_answer)

  const disabled =
    quizState.isAdmin ||
    answered ||
    room.status !== "playing" ||
    data.remaining_seconds <= 0

  options.innerHTML = question.options.map((option, index) => `
    <button type="button" data-quiz-option="${index}" ${disabled ? "disabled" : ""}>
      <span>${String.fromCharCode(65 + index)}</span>
      ${escapeHtml(option)}
    </button>
  `).join("")

  if (data.my_answer) {
    const answer = data.my_answer

    feedback.textContent = answer.is_correct
      ? `სწორია! +${answer.points_awarded} ქულა. ${answer.explanation || ""}`
      : `არასწორია. სწორი პასუხია: ${question.options[answer.correct_option] || ""}. ${answer.explanation || ""}`

    feedback.className = answer.is_correct
      ? "quiz-answer-correct"
      : "quiz-answer-wrong"
  } else if (quizState.isAdmin) {
    feedback.textContent = room.status === "paused"
      ? "თამაში დაპაუზებულია."
      : "მოთამაშეების პასუხებს ელოდები. დროის დასრულების შემდეგ დააჭირე შემდეგ კითხვას."

    feedback.className = ""
  } else if (data.remaining_seconds <= 0) {
    feedback.textContent = "დრო ამოიწურა. დაელოდე წამყვანს."
    feedback.className = ""
  } else if (room.status === "paused") {
    feedback.textContent = "თამაში დროებით შეჩერებულია."
    feedback.className = ""
  } else {
    feedback.textContent = "აირჩიე ერთი პასუხი."
    feedback.className = ""
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", createQuizInterface)
} else {
  createQuizInterface()
}
