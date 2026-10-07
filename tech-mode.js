const technicalModeScreen = document.getElementById("technical-mode-screen")
const technicalAdminNotice = document.getElementById("technical-admin-notice")
const technicalAdminContinue = document.getElementById("technical-admin-continue")

let technicalModeEnabled = false
let technicalModeAdmin = false

async function technicalIsAdmin() {
  try {
    const { data: userData, error: userError } =
      await window.supabase.auth.getUser()

    if (userError || !userData?.user) {
      return false
    }

    const { data, error } =
      await window.supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", userData.user.id)
        .maybeSingle()

    if (error || !data) {
      return false
    }

    return true
  } catch {
    return false
  }
}

async function getTechnicalMode() {
  try {
    const { data, error } =
      await window.supabase
        .from("site_settings")
        .select("technical_mode")
        .eq("id", "main")
        .maybeSingle()

    if (error || !data) {
      return false
    }

    return data.technical_mode === true
  } catch {
    return false
  }
}

async function setTechnicalMode(enabled) {
  const isAdmin = await technicalIsAdmin()

  if (!isAdmin) {
    return false
  }

  const { error } =
    await window.supabase
      .from("site_settings")
      .update({
        technical_mode: enabled,
        updated_at: new Date().toISOString()
      })
      .eq("id", "main")

  return !error
}

function showTechnicalScreen() {
  if (!technicalModeScreen) {
    return
  }

  technicalModeScreen.hidden = false
  document.body.style.overflow = "hidden"
}

function hideTechnicalScreen() {
  if (!technicalModeScreen) {
    return
  }

  technicalModeScreen.hidden = true
  document.body.style.overflow = ""
}

function showTechnicalAdminNotice() {
  if (!technicalAdminNotice) {
    return
  }

  technicalAdminNotice.hidden = false
  document.body.style.overflow = "hidden"
}

function hideTechnicalAdminNotice() {
  if (!technicalAdminNotice) {
    return
  }

  technicalAdminNotice.hidden = true
  document.body.style.overflow = ""
}

async function initializeTechnicalMode() {
  if (!window.supabase) {
    return
  }

  technicalModeEnabled = await getTechnicalMode()

  if (!technicalModeEnabled) {
    hideTechnicalScreen()
    hideTechnicalAdminNotice()
    return
  }

  technicalModeAdmin = await technicalIsAdmin()

  if (!technicalModeAdmin) {
    showTechnicalScreen()
    return
  }

  hideTechnicalScreen()
  showTechnicalAdminNotice()
}

if (technicalAdminContinue) {
  technicalAdminContinue.addEventListener("click", () => {
    hideTechnicalAdminNotice()
  })
}

window.technicalMode = {
  async enable() {
    const success = await setTechnicalMode(true)

    if (success) {
      technicalModeEnabled = true
      await initializeTechnicalMode()
    }

    return success
  },

  async disable() {
    const success = await setTechnicalMode(false)

    if (success) {
      technicalModeEnabled = false
      await initializeTechnicalMode()
    }

    return success
  },

  async refresh() {
    await initializeTechnicalMode()
  }
}

window.addEventListener("load", () => {
  setTimeout(() => {
    initializeTechnicalMode()
  }, 300)
})

window.addEventListener("DOMContentLoaded", () => {
  const chatForm = document.getElementById("ai-chat-form")
  const chatInput = document.getElementById("ai-chat-input")

  if (!chatForm || !chatInput) {
    return
  }

  chatForm.addEventListener("submit", async event => {
    const text = chatInput.value.trim().toLowerCase()

    if (text !== "/tech" && text !== "/tech off") {
      return
    }

    event.preventDefault()
    event.stopImmediatePropagation()

    chatInput.value = ""

    const isAdmin = await technicalIsAdmin()

    if (!isAdmin) {
      alert("ეს ბრძანება მხოლოდ ადმინისტრატორისთვისაა!")
      return
    }

    const enabled = text === "/tech"

    const success = await setTechnicalMode(enabled)

    if (!success) {
      alert(
        enabled
          ? "ტექნიკური რეჟიმის ჩართვა ვერ მოხერხდა!"
          : "ტექნიკური რეჟიმის გამორთვა ვერ მოხერხდა!"
      )
      return
    }

    technicalModeEnabled = enabled

    if (enabled) {
      alert("ტექნიკური რეჟიმი ჩართულია!")
      showTechnicalAdminNotice()
    } else {
      alert("ტექნიკური რეჟიმი გამორთულია!")
      hideTechnicalAdminNotice()
    }
  }, true)
})
