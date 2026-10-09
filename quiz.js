
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
  participants: [],
  refresh: null,
  loading: false
}

function createQuizInterface() {
  if (document.getElementById("quiz-launch-button")) return

  const nav = document.querySelector(".site-header nav")

  if (nav) {
    const button = document.createElement("button")
    button.id = "quiz-launch-button"
    button.type = "button"
    button.className = "quiz-nav-button"
    button.innerHTML = '<span>✦</span> ვიქტორინა'
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
          <input id="quiz-topic" name="topic" maxlength="300" placeholder="მაგ. Arduino და ქიმია" required>

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

          <button class="quiz-primary-button" type="submit">ოთახის შექმნა <span>→</span></button>
        </form>

        <form id="quiz-join-form" class="quiz-card">
          <div class="quiz-card-title">ოთახში შესვლა</div>
          <p class="quiz-card-description">შეიყვანე ადმინისტრატორის მიერ მოწოდებული კოდი.</p>

          <label for="quiz-code">ოთახის კოდი</label>
          <input id="quiz-code" name="code" maxlength="6" placeholder="მაგ. 72S3AL" autocomplete="off" required>

          <button class="quiz-secondary-button" type="submit">შემოერთება <span>↗</span></button>
        </form>
      </div>

      <div id="quiz-status" class="quiz-status" role="status" aria-live="polite"></div>

      <section id="quiz-room-panel" class="quiz-room-panel" hidden>
        <div class="quiz-room-top">
          <div>
            <p class="quiz-eyebrow">ოთახი შექმნილია</p>
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

        <p class="quiz-lobby-note">
          ოთახის მონაწილეები პერიოდულად განახლდება. თამაშის დაწყებამდე საჭიროა კითხვების მომზადებაც.
        </p>

        <button id="quiz-refresh-room" class="quiz-secondary-button" type="button">განახლება ↻</button>
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

  document.getElementById("quiz-code").addEventListener("input", event => {
    event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)
  })

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modal.hidden) closeQuizModal()
  })
}

function openQuizModal() {
  const modal = document.getElementById("quiz-modal")

  if (!modal) return

  modal.hidden = false
  document.body.classList.add("quiz-modal-open")
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
    body: {
      action,
      ...payload
    }
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

    setQuizStatus("ოთახი წარმატებით შეიქმნა.", "success")
    await showQuizRoom(data.room)
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

    setQuizStatus(data.message || "ოთახში წარმატებით შეხვედი.", "success")
    await showQuizRoom(data.room)
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

  document.getElementById("quiz-room-panel").hidden = false
  document.getElementById("quiz-room-title").textContent = room.title || "ვიქტორინა"
  document.getElementById("quiz-room-code").textContent = room.code || ""
  document.getElementById("quiz-room-topic").textContent = room.topic || ""
  document.getElementById("quiz-room-settings").textContent =
    `${room.question_count} კითხვა · ${room.timer_seconds} წამი`

  await refreshQuizRoom(false)

  if (quizState.refresh) clearInterval(quizState.refresh)

  quizState.refresh = setInterval(() => {
    if (!document.getElementById("quiz-modal")?.hidden) {
      refreshQuizRoom(false)
    }
  }, 5000)
}

async function refreshQuizRoom(showStatus) {
  if (!quizState.code || quizState.loading) return

  try {
    const data = await invokeQuiz("get_room", {
      code: quizState.code
    })

    const room = data.room || quizState.room
    const participants = data.participants || data.room?.participants || []

    quizState.room = room
    quizState.participants = participants

    document.getElementById("quiz-room-title").textContent = room.title || "ვიქტორინა"
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

    if (showStatus) setQuizStatus("ოთახის ინფორმაცია განახლდა.", "success")
  } catch (error) {
    if (showStatus) setQuizStatus(error.message, "error")
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
