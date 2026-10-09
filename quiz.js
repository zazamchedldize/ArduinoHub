
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
    answering: false,
    role: ""
}

function createQuizInterface() {
    const button = document.getElementById("quiz-launch-button")

    if (!button || button.dataset.quizInitialized === "true") return

    button.dataset.quizInitialized = "true"
    button.addEventListener("click", openQuizModal)
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createQuizInterface)
} else {
    createQuizInterface()
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

                    <button class="quiz-primary-button" type="submit">
                        ოთახის შექმნა <span>→</span>
                    </button>

                    <button id="quiz-back-to-roles" class="quiz-secondary-button" type="button">
                        ← როლის არჩევა
                    </button>
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
                    <input id="quiz-code" name="code" maxlength="6" placeholder="მაგ. 72S3AL" autocomplete="off" required>

                    <button class="quiz-primary-button" type="submit">
                        თამაშში შესვლა <span>→</span>
                    </button>

                    <button id="quiz-back-to-roles-player" class="quiz-secondary-button" type="button">
                        ← როლის არჩევა
                    </button>
                </form>
            </div>

            <div id="quiz-status" class="quiz-status" role="status" aria-live="polite"></div>

            <section id="quiz-room-panel" class="quiz-room-panel" hidden>
                <div id="quiz-lobby-view">
                    <div id="quiz-room-top" class="quiz-room-top">
                        <div>
                            <p class="quiz-eyebrow">ვიქტორინის ოთახი</p>
                            <h3 id="quiz-room-title"></h3>
                        </div>

                        <span id="quiz-room-live" class="quiz-room-live">
                            <span></span> LOBBY
                        </span>
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

                        <p class="quiz-card-description">
                            შექმენი კითხვები ხელოვნური ინტელექტის დახმარებით და დაიწყე თამაში.
                        </p>

                        <button id="quiz-generate-questions" class="quiz-primary-button" type="button">
                            ✦ AI-ით კითხვების შექმნა
                        </button>

                        <button id="quiz-start-game" class="quiz-secondary-button" type="button">
                            თამაშის დაწყება →
                        </button>
                    </div>

                    <p id="quiz-lobby-note" class="quiz-lobby-note">
                        დაელოდე ადმინისტრატორს. თამაში დაიწყება კითხვების მომზადების შემდეგ.
                    </p>

                    <button id="quiz-refresh-room" class="quiz-secondary-button" type="button">
                        განახლება ↻
                    </button>
                </div>

                <section id="quiz-game-panel" class="quiz-game-panel" hidden>
                    <div class="quiz-game-header">
                        <span id="quiz-game-progress">კითხვა 1</span>
                        <span id="quiz-game-timer">20 წმ</span>
                    </div>

                    <h3 id="quiz-game-question">კითხვა იტვირთება...</h3>

                    <div id="quiz-game-options" class="quiz-game-options"></div>

                    <p id="quiz-game-feedback" role="status" aria-live="polite"></p>

                    <div id="quiz-game-admin-controls" hidden>
                        <button id="quiz-pause-game" class="quiz-secondary-button" type="button">
                            პაუზა
                        </button>

                        <button id="quiz-resume-game" class="quiz-secondary-button" type="button" hidden>
                            გაგრძელება
                        </button>

                        <button id="quiz-next-question" class="quiz-primary-button" type="button">
                            შემდეგი კითხვა →
                        </button>
                    </div>

                    <div id="quiz-game-results" hidden>
                        <h3>🏆 შედეგები</h3>
                        <div id="quiz-game-leaderboard"></div>
                    </div>
                </section>
            </section>
        </section>
    `

    document.body.appendChild(modal)

    modal.querySelectorAll("[data-quiz-close]").forEach(element => {
        element.addEventListener("click", closeQuizModal)
    })

    document.getElementById("quiz-select-admin").addEventListener("click", () => selectQuizRole("admin"))
    document.getElementById("quiz-select-player").addEventListener("click", () => selectQuizRole("player"))

    document.getElementById("quiz-back-to-roles").addEventListener("click", resetQuizRole)
    document.getElementById("quiz-back-to-roles-player").addEventListener("click", resetQuizRole)

    document.getElementById("quiz-create-form").addEventListener("submit", createQuizRoom)
    document.getElementById("quiz-join-form").addEventListener("submit", joinQuizRoom)

    document.getElementById("quiz-copy-code").addEventListener("click", copyQuizCode)
    document.getElementById("quiz-refresh-room").addEventListener("click", () => refreshQuizRoom(true))
    document.getElementById("quiz-generate-questions").addEventListener("click", generateQuizQuestions)
    document.getElementById("quiz-start-game").addEventListener("click", startQuizGame)

    document.getElementById("quiz-game-options").addEventListener("click", event => {
        const button = event.target.closest("[data-quiz-option]")

        if (!button || button.disabled) return

        submitQuizAnswer(Number(button.dataset.quizOption))
    })

    document.getElementById("quiz-pause-game").addEventListener("click", () => controlQuizGame("pause_game"))
    document.getElementById("quiz-resume-game").addEventListener("click", () => controlQuizGame("resume_game"))
    document.getElementById("quiz-next-question").addEventListener("click", () => controlQuizGame("next_question"))

    document.getElementById("quiz-code").addEventListener("input", event => {
        event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)
    })

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !modal.hidden) {
            closeQuizModal()
        }
    })
}

function selectQuizRole(role) {
    quizState.role = role

    const dialog = document.querySelector("#quiz-modal .quiz-dialog")
    const roleChoice = document.getElementById("quiz-role-choice")
    const forms = document.getElementById("quiz-forms")

    dialog.classList.remove("quiz-role-home", "quiz-role-admin-active", "quiz-role-player-active")
    dialog.classList.add(role === "admin" ? "quiz-role-admin-active" : "quiz-role-player-active")

    roleChoice.hidden = true
    forms.hidden = false
    forms.classList.add("quiz-single-form")

    document.getElementById("quiz-create-form").hidden = role !== "admin"
    document.getElementById("quiz-join-form").hidden = role !== "player"

    document.getElementById("quiz-heading").textContent =
        role === "admin" ? "ადმინისტრატორის პანელი" : "მოთამაშის შესვლა"

    document.getElementById("quiz-heading-icon").textContent =
        role === "admin" ? "♜" : "🎮"

    document.getElementById("quiz-description").textContent =
        role === "admin"
            ? "შექმენი შენი ვიქტორინა რამდენიმე მარტივი ნაბიჯით."
            : "შეიყვანე ოთახის კოდი და შეუერთდი თამაშს."

    setQuizStatus("")
}

function resetQuizRole() {
    if (quizState.code) return

    quizState.role = ""

    const dialog = document.querySelector("#quiz-modal .quiz-dialog")

    dialog.classList.remove("quiz-role-admin-active", "quiz-role-player-active")
    dialog.classList.add("quiz-role-home")

    document.getElementById("quiz-role-choice").hidden = false
    document.getElementById("quiz-forms").hidden = true
    document.getElementById("quiz-create-form").hidden = true
    document.getElementById("quiz-join-form").hidden = true

    document.getElementById("quiz-heading").textContent = "ვიქტორინა"
    document.getElementById("quiz-heading-icon").textContent = "✦"
    document.getElementById("quiz-description").textContent =
        "აირჩიე შენი როლი და მოემზადე თამაშისთვის."

    setQuizStatus("")
}

function openQuizModal() {
    const modal = document.getElementById("quiz-modal")

    if (!modal) return

    modal.hidden = false
    document.body.classList.add("quiz-modal-open")

    if (quizState.code) {
        refreshQuizRoom(false)
        startQuizRefresh()
    } else {
        resetQuizRole()
    }
}

function closeQuizModal() {
    const modal = document.getElementById("quiz-modal")

    if (modal) {
        modal.hidden = true
    }

    document.body.classList.remove("quiz-modal-open")

    if (quizState.refresh) {
        clearInterval(quizState.refresh)
        quizState.refresh = null
    }
}

function startQuizRefresh() {
    if (quizState.refresh) {
        clearInterval(quizState.refresh)
    }

    quizState.refresh = setInterval(() => {
        if (!document.getElementById("quiz-modal")?.hidden) {
            refreshQuizRoom(false)
        }
    }, 2000)
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
            throw new Error("ოთახის კოდი პასუხში არ მოიძებნა")
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

    const dialog = document.querySelector("#quiz-modal .quiz-dialog")

    dialog.classList.remove("quiz-role-home", "quiz-role-admin-active", "quiz-role-player-active")
    dialog.classList.add("quiz-room-active")

    document.getElementById("quiz-role-choice").hidden = true
    document.getElementById("quiz-forms").hidden = true
    document.getElementById("quiz-room-panel").hidden = false

    document.getElementById("quiz-heading").textContent = "ვიქტორინის ოთახი"
    document.getElementById("quiz-heading-icon").textContent = "✦"
    document.getElementById("quiz-description").textContent = "მოემზადე ვიქტორინისთვის."

    await refreshQuizRoom(false)
    startQuizRefresh()
}

async function refreshQuizRoom(showStatus) {
    if (!quizState.code) return

    try {
        const data = await invokeQuiz("get_room", {
            code: quizState.code
        })

        quizState.roomData = data

        const room = data.room || quizState.room

        const participants = (data.participants || []).filter(participant =>
            participant.role !== "admin" && participant.is_admin !== true
        )

        quizState.room = room
        quizState.participants = participants
        quizState.isAdmin = data.is_admin === true

        const dialog = document.querySelector("#quiz-modal .quiz-dialog")

        dialog.classList.toggle("quiz-room-admin", quizState.isAdmin)
        dialog.classList.toggle("quiz-room-player", !quizState.isAdmin)

        document.getElementById("quiz-room-title").textContent = room.title || "ვიქტორინა"
        document.getElementById("quiz-room-code").textContent = room.code || ""
        document.getElementById("quiz-room-topic").textContent = room.topic || ""
        document.getElementById("quiz-room-settings").textContent =
            `${room.question_count} კითხვა · ${room.timer_seconds} წამი`

        const statusLabel = document.getElementById("quiz-room-live")
        const status = room.status || "lobby"

        statusLabel.innerHTML = `<span></span>${escapeHtml(status.toUpperCase())}`

        const list = document.getElementById("quiz-participants")

        document.getElementById("quiz-participant-count").textContent = participants.length

        if (!participants.length) {
            list.innerHTML = '<div class="quiz-empty-participants">მონაწილეები ჯერ არ არიან.</div>'
        } else {
            list.innerHTML = participants.map((participant, index) => `
                <div class="quiz-participant">
                    <span class="quiz-participant-avatar">${escapeHtml(
                        (participant.username || "?").trim().slice(0, 1).toUpperCase()
                    )}</span>
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

        document.getElementById("quiz-code-box").hidden = !quizState.isAdmin
        document.getElementById("quiz-room-meta").hidden = !quizState.isAdmin
        document.getElementById("quiz-room-top").hidden = !quizState.isAdmin
        document.getElementById("quiz-lobby-note").hidden = !quizState.isAdmin
        document.getElementById("quiz-refresh-room").hidden = !quizState.isAdmin

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

        if (result.correct) {
            feedback.textContent = `სწორია! +${Number(result.points_awarded) || 0} ქულა`
            feedback.className = "quiz-answer-correct"
        } else {
            feedback.textContent = "არასწორია. დაელოდე შემდეგ კითხვას."
            feedback.className = "quiz-answer-wrong"
        }

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
    const lobby = document.getElementById("quiz-lobby-view")
    const results = document.getElementById("quiz-game-results")
    const adminControls = document.getElementById("quiz-game-admin-controls")

    const room = data.room

    const isGameScreen = room.status !== "lobby"

    lobby.hidden = isGameScreen
    panel.hidden = !isGameScreen
    adminControls.hidden = !quizState.isAdmin

    if (!isGameScreen) return

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
        adminControls.hidden = true

        const ranked = [...(data.participants || [])]
            .filter(item => item.status === "active")
            .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))

        document.getElementById("quiz-game-leaderboard").innerHTML = ranked.length
            ? ranked.map((item, index) => `
                <div class="quiz-leaderboard-row">
                    <span>${index + 1}. ${escapeHtml(item.username || "მონაწილე")}</span>
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

    options.innerHTML = (question.options || []).map((option, index) => `
        <button type="button" data-quiz-option="${index}" ${disabled ? "disabled" : ""}>
            <span>${String.fromCharCode(65 + index)}</span>
            ${escapeHtml(option)}
        </button>
    `).join("")

    if (data.my_answer) {
        const answer = data.my_answer

        if (answer.is_correct) {
            feedback.textContent = `სწორია! +${Number(answer.points_awarded) || 0} ქულა`
            feedback.className = "quiz-answer-correct"
        } else {
            feedback.textContent = "არასწორია. დაელოდე შემდეგ კითხვას."
            feedback.className = "quiz-answer-wrong"
        }
    } else if (quizState.isAdmin) {
        feedback.textContent = room.status === "paused"
            ? "თამაში დაპაუზებულია."
            : "მოთამაშეების პასუხებს ელოდები."

        feedback.className = ""
    } else if (data.remaining_seconds <= 0) {
        feedback.textContent = "დრო ამოიწურა. დაელოდე შემდეგ კითხვას."
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
