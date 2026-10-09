
const QUIZ_CONFIG = {
  supabaseUrl: "https://ywxunhvrwdtlqjfshiyj.supabase.co",
  functionName: "quiz",
  difficulties: {
    quiz1: "easy",
    quiz2: "medium",
    quiz3: "hard"
  }
}

function getQuizDifficulty(command) {
  return QUIZ_CONFIG.difficulties[command] || null
}

async function createQuizRoom(settings) {
  const client = window.supabase

  if (!client) {
    throw new Error("Supabase კავშირი ვერ მოიძებნა")
  }

  const { data: sessionData, error: sessionError } = await client.auth.getSession()

  if (sessionError || !sessionData.session) {
    throw new Error("Quiz-ის შესაქმნელად საჭიროა ანგარიშში შესვლა")
  }

  const { data, error } = await client.functions.invoke(
    QUIZ_CONFIG.functionName,
    {
      body: {
        action: "create_room",
        ...settings
      }
    }
  )

  if (error) {
    throw error
  }

  if (!data || !data.success) {
    throw new Error(data?.error || "Quiz ოთახის შექმნა ვერ მოხერხდა")
  }

  return data
}

window.ArduinoHubQuiz = {
  getQuizDifficulty,
  createQuizRoom
}


async function joinQuizRoom(code, username) {
  const client = window.supabase

  const { data, error } = await client.functions.invoke("quiz", {
    body: {
      action: "join_room",
      code,
      username
    }
  })

  if (error) throw error
  if (!data?.success) throw new Error(data?.error || "ოთახში შესვლა ვერ მოხერხდა")

  return data
}

async function getQuizRoom(code) {
  const client = window.supabase

  const { data, error } = await client.functions.invoke("quiz", {
    body: {
      action: "get_room",
      code
    }
  })

  if (error) throw error
  if (!data?.success) throw new Error(data?.error || "ოთახის ჩატვირთვა ვერ მოხერხდა")

  return data
}

window.ArduinoHubQuiz = {
  getQuizDifficulty,
  createQuizRoom,
  joinQuizRoom,
  getQuizRoom
}
