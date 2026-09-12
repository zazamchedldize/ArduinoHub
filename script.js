import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseIsConfigured } from './supabase-config.js'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const db = supabaseIsConfigured
  ? createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      }
    )
  : null

const page = document.body.dataset.page

const $ = (s, root = document) => root.querySelector(s)

const esc = (value = '') =>
  String(value).replace(
    /[&<>'"]/g,
    c =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[c])
  )

const icon = name =>
  `<i data-lucide="${name}"></i>`

function refreshIcons() {
  window.lucide?.createIcons()
}

function toast(message, type = '') {
  const el = $('#toast')

  if (!el) {
    return
  }

  el.textContent = message
  el.className = `toast show ${type}`

  clearTimeout(toast.timer)

  toast.timer = setTimeout(
    () => {
      el.className = 'toast'
    },
    3200
  )
}

function dateText(value) {
  return new Intl.DateTimeFormat(
    'ka-GE',
    {
      dateStyle: 'medium'
    }
  ).format(
    new Date(value)
  )
}

function neutralError(
  error,
  fallback = 'მოქმედება ვერ შესრულდა. სცადეთ ხელახლა.'
) {
  console.error(error)
  return fallback
}

function configuredMessage(target) {
  if (!target) {
    return
  }

  target.innerHTML = `
    <div class="empty-state">
      ${icon('settings')}

      <h2>
        Supabase ჯერ არ არის კონფიგურირებული
      </h2>

      <p>
        დაამატეთ პროექტის URL და anon key
        <code>supabase-config.js</code>-ში, შემდეგ გაუშვით schema SQL.
      </p>
    </div>
  `

  refreshIcons()
}

function initChrome() {
  document
    .querySelectorAll('[data-year]')
    .forEach(
      el => {
        el.textContent =
          new Date().getFullYear()
      }
    )

  const button = $('.menu-toggle')

  if (button) {
    button.addEventListener(
      'click',
      () => {
        const nav = $('nav')

        if (!nav) {
          return
        }

        const open =
          nav.classList.toggle('open')

        button.setAttribute(
          'aria-expanded',
          String(open)
        )
      }
    )
  }

  refreshIcons()
}

const AI_FUNCTION_URL =
  supabaseIsConfigured && SUPABASE_URL
    ? `${SUPABASE_URL.replace(/\/+$/, '')}/functions/v1/ai-chat`
    : null

let aiHistory = []
let aiAdminGreeting = ''

const AI_SYSTEM_CONTEXT = `
შენ ხარ ArduinoHub AI — ArduinoHub-ის ოფიციალური AI ასისტენტი.

ArduinoHub არის Arduino-სა და Chemistry-ს პროექტების პლატფორმა.

საიტის ძირითადი ინფორმაცია:
- ArduinoHub შეიქმნა 2026 წლის 3 სექტემბერს.
- პლატფორმის მიზანია Arduino-ს, ელექტრონიკისა და ქიმიის პროექტების ერთ სივრცეში თავმოყრა და ცოდნის გაზიარება.
- ArduinoHub დაკავშირებულია 29-ე საჯარო სკოლასთან.
- პროექტების მიმართულებები მოიცავს Arduino-ს, ელექტრონიკას, სენსორებს, ავტომატიზაციას, LED-ს, LCD-ს, IoT-ს და ქიმიის ექსპერიმენტებს.
- ArduinoHub შექმნილია „მოაზროვნე ქიმიკოსთა კლუბის“ მიერ.
- კლუბის ხელმძღვანელია ქალბატონი მაია მელაძე.

კლუბის წევრები არიან:
- ზაზა მჭედლიძე — აქტიური წევრია.
- თეკლა შველიძე — აქტიური წევრია.
- ანასტასია ხონელიძე — მისი დასწრება საშვალო დონეზეა.
- ანასტასია თევდორაძე — ხშირად აცდენს შეკრებებს, თუმცა ცდილობს დასწრებას.
- ანი მუმლაძე — ხშირად აცდენს შეკრებებს, თუმცა ცდილობს დასწრებას.
- გიორგი ბაღდავაძე — აგრეთვე,ხშირად აცდენს შეკრებებს, თუმცა ცდილობს დასწრებას.
- მარიამ მიშვიძე — ხშირად ესწრება კლუბის შეკრებებს, აგრეთვე პასუხისმგებელია დასწრების აღრიცხვაზე.
- ანი ძაგნიძე — აქტიური წევრია.
- ანასტასია თოდუა — ძალიან იშვიათად ესწრება კლუბის შეკრებებს.

პასუხის წესები:
1. მომხმარებელს ყოველთვის უპასუხე ქართულად, თუ სხვა ენაზე არ მოგმართავს.
2. იყავი მეგობრული, ბუნებრივი, თავაზიანი და გასაგები.
3. Arduino-სა და ქიმიის საკითხებზე შეგიძლია დეტალურად ახსნა.
4. თუ მომხმარებელი დამწყებია, ახსენი მარტივად.
5. თუ კითხვა ArduinoHub-ის შესახებ არის და ზუსტი ინფორმაცია არ გაქვს, არ მოიგონო ინფორმაცია.
6. თუ რაიმე ინფორმაცია არ იცი, პირდაპირ თქვი, რომ ზუსტი ინფორმაცია არ გაქვს.
7. არ თქვა, რომ შენ ხარ Google Gemini. მომხმარებლისთვის შენ ხარ ArduinoHub AI.
8. არ მოიგონო ისეთი პროექტები, ადამიანები ან ფუნქციები, რომლებიც მოცემულ ინფორმაციაში არ არის.
9. პასუხები ზედმეტად გრძელი არ იყოს, თუ მომხმარებელი დეტალურ ახსნას არ ითხოვს.
10. ტექნიკურ საკითხებზე გამოიყენე ნაბიჯ-ნაბიჯ ახსნა.
11. გამოიყენე Markdown ფორმატირება, როდესაც პასუხს უფრო წაკითხვადს გახდის.
12. ქიმიური ფორმულები დაწერე ჩვეულებრივი ტექსტით, მაგალითად: H2O, CO2, NaCl, KMnO4, Mn2O7.
13. არასდროს დაწერო ცალკე სიტყვა "svg", თუ ის პასუხისთვის საჭირო არ არის.
14. პასუხი არ შეწყვიტო შუა წინადადებაში.
15. თუ პასუხს რამდენიმე ნაწილი აქვს, დაალაგე ლოგიკურად.
16. მომხმარებლის ტექსტში შეიძლება იყოს მცირე ორთოგრაფიული ან კლავიატურული შეცდომა. თუ მნიშვნელობა კონტექსტიდან გასაგებია, შეცდომა გონებაში გამოასწორე.
17. თუ კითხვა გასაგებია მიუხედავად მცირე typo-სა, მომხმარებელს ნუ სთხოვ თავიდან დაწერას.
18. თუ მომხმარებელი წერს უხეშ, შეურაცხმყოფელ, სექსუალურ, 18+ ან აშკარად შეუსაბამო შინაარსს, არ გააგრძელო ასეთი საუბარი. უპასუხე მოკლე, მშვიდი გაფრთხილებით და გადაიყვანე სასწავლო თემაზე.
19. ArduinoHub AI განკუთვნილია სასწავლო, ტექნიკური და უსაფრთხო კომუნიკაციისთვის.
20. არასდროს შეურაცხყო მომხმარებელი.
21. კლუბის წევრების აქტიურობაზე პასუხისას გამოიყენე მხოლოდ ზემოთ მოცემული ინფორმაცია.
`

async function getCurrentUser() {
  if (!db) {
    return null
  }

  try {
    const {
      data: { user }
    } = await db.auth.getUser()

    return user || null
  } catch (error) {
    console.warn(
      'Could not get current user:',
      error
    )

    return null
  }
}

function getUserDisplayName(user) {
  if (!user) {
    return 'მომხმარებელი'
  }

  const metadata =
    user.user_metadata || {}

  return String(
    metadata.username ||
    metadata.name ||
    metadata.full_name ||
    user.email ||
    'მომხმარებელი'
  ).trim()
}

async function getCurrentUserContext() {
  const user =
    await getCurrentUser()

  if (!user) {
    return {
      id: null,
      email: null,
      name: null,
      isAuthenticated: false
    }
  }

  return {
    id: user.id,
    email: user.email || null,
    name: getUserDisplayName(user),
    isAuthenticated: true
  }
}

async function detectAIAdmin() {
  if (!db) {
    aiAdminGreeting = ''
    return
  }

  try {
    const {
      data: { session }
    } = await db.auth.getSession()

    if (!session?.user) {
      aiAdminGreeting = ''
      return
    }

    const admin =
      await isAdmin(session.user)

    if (!admin?.username) {
      aiAdminGreeting = ''
      return
    }

    const username =
      String(admin.username)
        .trim()
        .toLowerCase()

    if (
      username === 'zaza' ||
      username === 'ზაზა' ||
      username.includes('ზაზა') ||
      username.includes('zaza')
    ) {
      aiAdminGreeting =
        'ბატონო ზაზა'
    } else if (
      username === 'tekla' ||
      username === 'თეკლა' ||
      username.includes('თეკლა') ||
      username.includes('tekla')
    ) {
      aiAdminGreeting =
        'ქალბატონო თეკლა'
    } else {
      aiAdminGreeting = ''
    }
  } catch (error) {
    console.warn(
      'AI admin detection failed:',
      error
    )

    aiAdminGreeting = ''
  }
}

function applyAIGreeting(reply) {
  const clean =
    String(reply || '').trim()

  if (
    !aiAdminGreeting ||
    !clean
  ) {
    return clean
  }

  const greetingPattern =
    /^(ბატონო\s+ზაზა|ქალბატონო\s+თეკლა)\s*[,!:—-]?\s*/i

  if (
    greetingPattern.test(clean)
  ) {
    return clean
  }

  return `${aiAdminGreeting}, ${clean}`
}

function addAIMessage(
  type,
  content
) {
  const messages =
    $('#ai-chat-messages')

  if (!messages) {
    return null
  }

  const message =
    document.createElement('div')

  message.className =
    `ai-message ${type}`

  if (type === 'assistant') {
    message.innerHTML = `
      <div class="ai-message-avatar">
        ${icon('bot')}
      </div>

      <div class="ai-message-bubble">
        ${content}
      </div>
    `
  } else if (
    type === 'error'
  ) {
    message.innerHTML = `
      <div class="ai-message-avatar">
        ${icon('triangle-alert')}
      </div>

      <div class="ai-message-bubble">
        ${content}
      </div>
    `
  } else {
    message.innerHTML = `
      <div class="ai-message-bubble">
        ${esc(content)}
      </div>
    `
  }

  messages.appendChild(message)

  refreshIcons()

  messages.scrollTo({
    top: messages.scrollHeight,
    behavior: 'smooth'
  })

  return message
}

function formatAIResponse(text) {
  if (!text) {
    return '<p>პასუხი ვერ მივიღე.</p>'
  }

  let source =
    String(text)
      .replace(
        /^\s*svg\s*$/gim,
        ''
      )
      .trim()

  const codeBlocks = []

  source = source.replace(
    /```(?:[a-zA-Z0-9_+-]+)?\s*\n?([\s\S]*?)```/g,
    (_, code) => {
      const index =
        codeBlocks.length

      codeBlocks.push(
        esc(code.trim())
      )

      return `@@CODEBLOCK_${index}@@`
    }
  )

  let safe = esc(source)

  safe = safe.replace(
    /\*\*\*(.+?)\*\*\*/g,
    '<strong><em>$1</em></strong>'
  )

  safe = safe.replace(
    /\*\*(.+?)\*\*/g,
    '<strong>$1</strong>'
  )

  safe = safe.replace(
    /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
    '<em>$1</em>'
  )

  safe = safe.replace(
    /`([^`\n]+)`/g,
    '<code class="ai-inline-code">$1</code>'
  )

  const lines =
    safe.split(/\r?\n/)

  let html = ''
  let paragraph = []
  let listType = null

  const closeList = () => {
    if (listType === 'ul') {
      html += '</ul>'
    }

    if (listType === 'ol') {
      html += '</ol>'
    }

    listType = null
  }

  const flushParagraph = () => {
    if (!paragraph.length) {
      return
    }

    const content =
      paragraph
        .join(' ')
        .trim()

    if (content) {
      html += `
        <p>
          ${content}
        </p>
      `
    }

    paragraph = []
  }

  for (
    const rawLine of lines
  ) {
    const line =
      rawLine.trim()

    if (!line) {
      flushParagraph()
      closeList()
      continue
    }

    const codeMatch =
      line.match(
        /^@@CODEBLOCK_(\d+)@@$/
      )

    if (codeMatch) {
      flushParagraph()
      closeList()

      const code =
        codeBlocks[
          Number(codeMatch[1])
        ] || ''

      html += `
        <pre class="ai-code-block">
          <code>${code}</code>
        </pre>
      `

      continue
    }

    const heading3 =
      line.match(
        /^###\s+(.+)$/
      )

    if (heading3) {
      flushParagraph()
      closeList()

      html += `
        <h4 class="ai-response-small-title">
          ${heading3[1]}
        </h4>
      `

      continue
    }

    const heading2 =
      line.match(
        /^##\s+(.+)$/
      )

    if (heading2) {
      flushParagraph()
      closeList()

      html += `
        <h3 class="ai-response-subtitle">
          ${heading2[1]}
        </h3>
      `

      continue
    }

    const heading1 =
      line.match(
        /^#\s+(.+)$/
      )

    if (heading1) {
      flushParagraph()
      closeList()

      html += `
        <h2 class="ai-response-title">
          ${heading1[1]}
        </h2>
      `

      continue
    }

    const quote =
      line.match(
        /^>\s*(.+)$/
      )

    if (quote) {
      flushParagraph()
      closeList()

      html += `
        <blockquote class="ai-blockquote">
          ${quote[1]}
        </blockquote>
      `

      continue
    }

    const unordered =
      line.match(
        /^(?:[-*•])\s+(.+)$/
      )

    if (unordered) {
      flushParagraph()

      if (listType !== 'ul') {
        closeList()
        html +=
          '<ul class="ai-list">'
        listType = 'ul'
      }

      html += `
        <li>
          ${unordered[1]}
        </li>
      `

      continue
    }

    const ordered =
      line.match(
        /^\d+[.)]\s+(.+)$/
      )

    if (ordered) {
      flushParagraph()

      if (listType !== 'ol') {
        closeList()
        html +=
          '<ol class="ai-ordered-list">'
        listType = 'ol'
      }

      html += `
        <li>
          ${ordered[1]}
        </li>
      `

      continue
    }

    closeList()
    paragraph.push(line)
  }

  flushParagraph()
  closeList()

  return (
    html ||
    '<p>პასუხი ვერ მივიღე.</p>'
  )
}

function addAITyping() {
  const messages =
    $('#ai-chat-messages')

  if (!messages) {
    return null
  }

  const typing =
    document.createElement('div')

  typing.className =
    'ai-message assistant ai-typing-message'

  typing.innerHTML = `
    <div class="ai-message-avatar">
      ${icon('bot')}
    </div>

    <div class="ai-message-bubble ai-typing">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `

  messages.appendChild(typing)

  refreshIcons()

  messages.scrollTo({
    top: messages.scrollHeight,
    behavior: 'smooth'
  })

  return typing
}

function getAIErrorStatus(error) {
  if (
    Number.isFinite(
      Number(error?.status)
    )
  ) {
    return Number(error.status)
  }

  const message =
    String(
      error?.message || ''
    )

  const match =
    message.match(
      /\b(400|401|403|404|408|409|429|500|502|503|504)\b/
    )

  return match
    ? Number(match[1])
    : null
}

function isAIQuotaError(error) {
  const message =
    String(
      error?.message || ''
    ).toLowerCase()

  const quotaPatterns = [
    'quota exceeded',
    'quotaexceeded',
    'quota',
    'resource_exhausted',
    'resource exhausted',
    'free_tier',
    'free tier',
    'generate_content_free_tier_requests',
    'rate limit',
    'ratelimit',
    'too many requests',
    'requests per day',
    'requests per minute'
  ]

  return quotaPatterns.some(
    pattern =>
      message.includes(pattern)
  )
}

function isAIModelError(error) {
  const message =
    String(
      error?.message || ''
    ).toLowerCase()

  const modelPatterns = [
    'model not found',
    'model is not found',
    'not available',
    'is no longer available',
    'unsupported model',
    'unknown model',
    'models/',
    'gemini model'
  ]

  return modelPatterns.some(
    pattern =>
      message.includes(pattern)
  )
}

function getAIUserErrorMessage(error) {
  const status =
    getAIErrorStatus(error)

  if (
    status === 429 ||
    isAIQuotaError(error)
  ) {
    return `
      <div class="ai-error-content">
        <strong>
          ${icon('zap')}
          AI დროებით მიუწვდომელია
        </strong>

        <p>
          ArduinoHub AI-ის უფასო გამოყენების ლიმიტი ამ დროისთვის ამოიწურა.
        </p>

        <small>
          პრობლემა Gemini-ის გამოყენების ლიმიტს უკავშირდება და არა შენს კითხვას. ლიმიტის განახლების შემდეგ ჩატი კვლავ ავტომატურად იმუშავებს.
        </small>
      </div>
    `
  }

  if (isAIModelError(error)) {
    return `
      <div class="ai-error-content">
        <strong>
          ${icon('cpu')}
          AI მოდელის პრობლემა
        </strong>

        <p>
          ArduinoHub AI-ის გამოყენებული Gemini მოდელი ამჟამად ვერ მუშაობს ან მიუწვდომელია.
        </p>

        <small>
          საჭიროა Supabase Edge Function-ში გამოყენებული მოდელის შემოწმება.
        </small>
      </div>
    `
  }

  if (status === 401) {
    return `
      <div class="ai-error-content">
        <strong>
          ${icon('lock-keyhole')}
          AI ავტორიზაციის პრობლემა
        </strong>

        <p>
          AI სერვერთან ავტორიზაცია ვერ მოხერხდა.
        </p>

        <small>
          გთხოვთ, ცოტა ხანში სცადოთ ხელახლა.
        </small>
      </div>
    `
  }

  if (status === 403) {
    return `
      <div class="ai-error-content">
        <strong>
          ${icon('shield-alert')}
          AI სერვერთან წვდომა შეზღუდულია
        </strong>

        <p>
          AI სერვერმა მოთხოვნა ვერ მიიღო.
        </p>

        <small>
          საჭიროა AI სერვერის კონფიგურაციის შემოწმება.
        </small>
      </div>
    `
  }

  if (status === 404) {
    return `
      <div class="ai-error-content">
        <strong>
          ${icon('search-x')}
          AI სერვისი ვერ მოიძებნა
        </strong>

        <p>
          AI ფუნქცია ან მოთხოვნილი რესურსი ამჟამად ვერ მოიძებნა.
        </p>

        <small>
          გთხოვთ, მოგვიანებით სცადოთ ხელახლა.
        </small>
      </div>
    `
  }

  if (status === 400) {
    return `
      <div class="ai-error-content">
        <strong>
          ${icon('triangle-alert')}
          მოთხოვნის დამუშავება ვერ მოხერხდა
        </strong>

        <p>
          AI-მ მიღებული მოთხოვნა ვერ დაამუშავა.
        </p>

        <small>
          სცადეთ კითხვის ოდნავ სხვანაირად დაწერა.
        </small>
      </div>
    `
  }

  if (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return `
      <div class="ai-error-content">
        <strong>
          ${icon('server-crash')}
          AI სერვერის დროებითი პრობლემა
        </strong>

        <p>
          AI სერვერმა პასუხის დაბრუნება ამჯერად ვერ შეძლო.
        </p>

        <small>
          გთხოვთ, რამდენიმე წამში სცადოთ ხელახლა.
        </small>
      </div>
    `
  }

  return `
    <div class="ai-error-content">
      <strong>
        ${icon('wifi-off')}
        AI-სთან დაკავშირება ვერ მოხერხდა
      </strong>

      <p>
        ამ მომენტში AI სერვისთან დაკავშირება ვერ მოხერხდა.
      </p>

      <small>
        გთხოვთ, ცოტა ხანში სცადოთ ხელახლა.
      </small>
    </div>
  `
}

async function askAI(question) {
  if (!AI_FUNCTION_URL) {
    throw new Error(
      'AI ფუნქციის მისამართი ვერ მოიძებნა.'
    )
  }

  const cleanQuestion =
    String(question)
      .trim()
      .slice(0, 1000)

  if (!cleanQuestion) {
    return null
  }

  const history =
    aiHistory
      .slice(-8)
      .map(
        message => ({
          role:
            message.role === 'assistant'
              ? 'assistant'
              : 'user',
          text:
            String(
              message.content || ''
            ).slice(0, 1800)
        })
      )

  const currentUser =
    await getCurrentUserContext()

  let authorizationToken =
    SUPABASE_ANON_KEY

  if (db) {
    try {
      const {
        data: { session }
      } = await db.auth.getSession()

      if (session?.access_token) {
        authorizationToken =
          session.access_token
      }
    } catch (sessionError) {
      console.warn(
        'Could not read Supabase session:',
        sessionError
      )
    }
  }

  const userIdentityContext =
    currentUser.isAuthenticated
      ? `
        ამჟამად ArduinoHub AI-ს ესაუბრება სისტემაში შესული მომხმარებელი.

        მომხმარებლის სახელი და გვარი:
        ${currentUser.name}

        მომხმარებლის email:
        ${currentUser.email || 'უცნობია'}

        მომხმარებლის Supabase ID:
        ${currentUser.id}

        მნიშვნელოვანი წესები:
        - ეს არის ამ ჩატის ამჟამინდელი მომხმარებელი.
        - თუ მომხმარებელი გეკითხება „ვინ ვარ?“, „რა მქვია?“ ან მსგავს რამეს, გამოიყენე ზემოთ მოცემული სახელი.
        - არ აურიო ეს მომხმარებელი ArduinoHub-ის კლუბის სხვა წევრებში.
        - მომხმარებლის სახელი არ მოიგონო.
        - მომხმარებლის ID ჩვეულებრივ პასუხში არ გამოაჩინო, თუ ამის შესახებ პირდაპირ არ გკითხავს.
      `
      : `
        ამჟამად ArduinoHub AI-ს ესაუბრება არაავტორიზებული მომხმარებელი.
        მომხმარებლის სახელი უცნობია.
      `

  const finalContext = `
    ${AI_SYSTEM_CONTEXT}
    ${userIdentityContext}
  `

  let response

  try {
    response =
      await fetch(
        AI_FUNCTION_URL,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
            'Authorization':
              `Bearer ${authorizationToken}`,
            'apikey':
              SUPABASE_ANON_KEY
          },
          body:
            JSON.stringify({
              message:
                cleanQuestion,
              history,
              context:
                finalContext,
              adminGreeting:
                aiAdminGreeting,
              currentUser
            })
        }
      )
  } catch (networkError) {
    const error =
      new Error(
        networkError?.message ||
        'Network error'
      )

    error.status = 0

    throw error
  }

  let data = null

  try {
    data =
      await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    const backendMessage =
      data?.error ||
      data?.message ||
      data?.details ||
      `AI request failed with status ${response.status}`

    const error =
      new Error(
        String(backendMessage)
      )

    error.status =
      response.status

    error.backendData = data
    error.backendStatus =
      response.status

    throw error
  }

  if (
    data?.error &&
    !data?.reply &&
    !data?.text
  ) {
    const error =
      new Error(
        String(data.error)
      )

    error.status =
      response.status

    error.backendData = data

    throw error
  }

  const reply =
    String(
      data?.reply ||
      data?.text ||
      ''
    ).trim()

  if (!reply) {
    const error =
      new Error(
        'AI-მ ცარიელი პასუხი დააბრუნა.'
      )

    error.status =
      response.status

    error.backendData = data

    throw error
  }

  return reply
}

function containsUnsafeContent(text) {
  const value =
    String(text || '')
      .toLowerCase()
      .trim()

  if (!value) {
    return false
  }

  const unsafePatterns = [
    /\b(porn|porno|pornography)\b/i,
    /\b(sexcam|onlyfans)\b/i,
    /\b(nude|nudes)\b/i,
    /\b(hentai)\b/i,
    /სექსუალური\s+შინაარსი/i,
    /პორნო/i,
    /პორნოგრაფ/i
  ]

  return unsafePatterns.some(
    pattern =>
      pattern.test(value)
  )
}

function addAISafetyWarning() {
  const message = `
    <div class="ai-safety-warning">
      <strong>
        ${icon('shield-alert')}
        უსაფრთხოების გაფრთხილება
      </strong>

      <p>
        გთხოვთ, არ გამოიყენოთ ArduinoHub AI 18+ ან შეუფერებელი შინაარსისთვის. პლატფორმა განკუთვნილია სასწავლო, Arduino-სა და ქიმიის საკითხებისთვის.
      </p>
    </div>
  `

  addAIMessage(
    'error',
    message
  )
}

async function saveAIChatMessage(message) {
  if (!db) {
    return
  }

  try {
    const {
      data: { user }
    } = await db.auth.getUser()

    if (!user) {
      return
    }

    const username =
      getUserDisplayName(user)

    const { error } =
      await db
        .from('ai_chat_history')
        .insert({
          user_id: user.id,
          username:
            String(username).trim(),
          message:
            String(message).trim()
        })

    if (error) {
      console.warn(
        'AI chat history save failed:',
        error
      )
    }
  } catch (error) {
    console.warn(
      'AI chat history error:',
      error
    )
  }
}

async function getZazaHistory() {
  if (!db) {
    throw new Error(
      'Supabase არ არის კონფიგურირებული.'
    )
  }

  const { data, error } =
    await db.rpc(
      'get_zaza_history'
    )

  if (error) {
    throw error
  }

  return data || []
}

async function deleteZazaHistoryItem(id) {
  if (!db) {
    throw new Error(
      'Supabase არ არის კონფიგურირებული.'
    )
  }

  const numericId =
    Number(id)

  if (
    !Number.isSafeInteger(
      numericId
    )
  ) {
    throw new Error(
      'შეტყობინების ID არასწორია.'
    )
  }

  const { error } =
    await db.rpc(
      'delete_zaza_history_item',
      {
        p_id: numericId
      }
    )

  if (error) {
    console.error(
      'Supabase delete RPC error:',
      error
    )

    throw error
  }

  const {
    data: remainingData,
    error: verifyError
  } =
    await db.rpc(
      'get_zaza_history'
    )

  if (verifyError) {
    throw verifyError
  }

  const stillExists =
    (remainingData || [])
      .some(
        item =>
          Number(item.id) ===
          numericId
      )

  if (stillExists) {
    throw new Error(
      'Supabase-მ შეტყობინება ვერ წაშალა.'
    )
  }

  return true
}

function formatZazaHistory(items) {
  if (!items.length) {
    return `
      <p>
        „ზაზა“-ს შესახებ სხვა მომხმარებლების შეტყობინებები ვერ მოიძებნა.
      </p>
    `
  }

  let html = `
    <h3 class="ai-response-subtitle">
      „ზაზა“-ს შესახებ ნაპოვნი შეტყობინებები
    </h3>

    <p class="ai-history-count">
      ნაპოვნია
      <strong>${items.length}</strong>
      შეტყობინება:
    </p>

    <div class="ai-history-list">
  `

  items.forEach(
    (item, index) => {
      const username =
        esc(
          item.username ||
          'უცნობი მომხმარებელი'
        )

      const message =
        esc(
          item.message || ''
        )

      const date =
        item.created_at
          ? new Intl.DateTimeFormat(
              'ka-GE',
              {
                dateStyle: 'medium',
                timeStyle: 'short'
              }
            ).format(
              new Date(
                item.created_at
              )
            )
          : ''

      html += `
        <div
          class="ai-history-item"
          data-history-id="${Number(item.id)}"
        >
          <strong>
            ${index + 1}. ${username}
          </strong>

          <p>
            ${message}
          </p>

          ${
            date
              ? `<small>${esc(date)}</small>`
              : ''
          }

          <button
            type="button"
            class="ai-history-delete"
            data-history-id="${Number(item.id)}"
          >
            ${icon('trash-2')}
            სამუდამოდ წაშლა
          </button>
        </div>
      `
    }
  )

  html += `
    </div>
  `

  return html
}

function setupZazaHistoryDelete() {
  const buttons =
    document.querySelectorAll(
      '.ai-history-delete'
    )

  buttons.forEach(
    button => {
      if (
        button.dataset.deleteBound ===
        'true'
      ) {
        return
      }

      button.dataset.deleteBound =
        'true'

      button.addEventListener(
        'click',
        async event => {
          event.preventDefault()
          event.stopPropagation()

          if (button.disabled) {
            return
          }

          const id =
            Number(
              button.dataset.historyId
            )

          if (
            !Number.isSafeInteger(id)
          ) {
            toast(
              'შეტყობინების ID არასწორია.'
            )

            return
          }

          const confirmed =
            button.dataset.deleteConfirm ===
            'true'

          if (!confirmed) {
            button.dataset.deleteConfirm =
              'true'

            button.classList.add(
              'delete-confirm-ready'
            )

            button.innerHTML = `
              ${icon('triangle-alert')}
              ნამდვილად წაშლა?
            `

            refreshIcons()

            clearTimeout(
              button.deleteConfirmTimer
            )

            button.deleteConfirmTimer =
              setTimeout(
                () => {
                  if (
                    document.body.contains(
                      button
                    ) &&
                    button.dataset.deleteConfirm ===
                      'true' &&
                    !button.disabled
                  ) {
                    button.dataset.deleteConfirm =
                      'false'

                    button.classList.remove(
                      'delete-confirm-ready'
                    )

                    button.innerHTML = `
                      ${icon('trash-2')}
                      სამუდამოდ წაშლა
                    `

                    refreshIcons()
                  }
                },
                5000
              )

            return
          }

          clearTimeout(
            button.deleteConfirmTimer
          )

          button.disabled = true

          button.dataset.deleteConfirm =
            'false'

          button.classList.remove(
            'delete-confirm-ready'
          )

          button.innerHTML = `
            ${icon('loader-circle')}
            იშლება...
          `

          refreshIcons()

          try {
            await deleteZazaHistoryItem(
              id
            )

            const item =
              button.closest(
                '.ai-history-item'
              )

            if (item) {
              item.remove()
            }

            const list =
              document.querySelector(
                '.ai-history-list'
              )

            const historyItems =
              list
                ? list.querySelectorAll(
                    '.ai-history-item'
                  )
                : []

            const remaining =
              historyItems.length

            historyItems.forEach(
              (
                historyItem,
                index
              ) => {
                const strong =
                  historyItem.querySelector(
                    'strong'
                  )

                if (!strong) {
                  return
                }

                const currentText =
                  strong.textContent
                    .replace(
                      /^\s*\d+\.\s*/,
                      ''
                    )
                    .trim()

                strong.textContent =
                  `${index + 1}. ${currentText}`
              }
            )

            const count =
              document.querySelector(
                '.ai-history-count'
              )

            if (count) {
              count.innerHTML =
                remaining
                  ? `
                    დარჩენილია
                    <strong>
                      ${remaining}
                    </strong>
                    შეტყობინება:
                  `
                  : 'ყველა შეტყობინება წაშლილია.'
            }

            if (
              list &&
              remaining === 0
            ) {
              list.innerHTML = `
                <div class="empty-state compact-empty">
                  ${icon('trash-2')}

                  <h3>
                    ისტორია ცარიელია
                  </h3>

                  <p>
                    ყველა ნაპოვნი შეტყობინება სამუდამოდ წაიშალა.
                  </p>
                </div>
              `

              refreshIcons()
            }

            toast(
              'შეტყობინება სამუდამოდ წაიშალა.',
              'success'
            )
          } catch (error) {
            console.error(
              'History delete error:',
              error
            )

            console.error(
              'History delete message:',
              error?.message
            )

            console.error(
              'History delete details:',
              error?.details
            )

            console.error(
              'History delete hint:',
              error?.hint
            )

            button.disabled =
              false

            button.dataset.deleteConfirm =
              'false'

            button.innerHTML = `
              ${icon('trash-2')}
              სამუდამოდ წაშლა
            `

            refreshIcons()

            const errorMessage =
              error?.message ||
              error?.details ||
              error?.hint ||
              'შეტყობინების წაშლა ვერ მოხერხდა.'

            toast(
              errorMessage
            )
          }
        }
      )
    }
  )

  refreshIcons()
}

async function handleAIQuestion(
  question
) {
  const input =
    $('#ai-chat-input')

  const send =
    $('#ai-send-btn')

  const cleanQuestion =
    String(question || '').trim()

  if (!cleanQuestion) {
    return
  }

  await detectAIAdmin()

  if (
    containsUnsafeContent(
      cleanQuestion
    )
  ) {
    addAIMessage(
      'user',
      cleanQuestion
    )

    if (input) {
      input.value = ''
    }

    addAISafetyWarning()

    return
  }

  addAIMessage(
    'user',
    cleanQuestion
  )

  if (input) {
    input.value = ''
  }

  if (
    cleanQuestion.toLowerCase() ===
    '/history'
  ) {
    const isZaza =
      aiAdminGreeting ===
      'ბატონო ზაზა'

    if (!isZaza) {
      addAIMessage(
        'error',
        `
          <div class="ai-error-content">
            <strong>
              წვდომა უარყოფილია
            </strong>

            <p>
              /history ბრძანების გამოყენება მხოლოდ ბატონ ზაზას შეუძლია.
            </p>
          </div>
        `
      )

      return
    }

    if (send) {
      send.disabled = true
    }

    const typing =
      addAITyping()

    try {
      const history =
        await getZazaHistory()

      typing?.remove()

      addAIMessage(
        'assistant',
        formatZazaHistory(
          history
        )
      )

      setupZazaHistoryDelete()
    } catch (error) {
      console.error(
        'History error:',
        error
      )

      typing?.remove()

      addAIMessage(
        'error',
        `
          <div class="ai-error-content">
            <strong>
              ისტორიის ჩატვირთვა ვერ მოხერხდა
            </strong>

            <p>
              მონაცემების მიღებისას შეცდომა მოხდა.
            </p>
          </div>
        `
      )
    } finally {
      if (send) {
        send.disabled = false
      }

      input?.focus()
    }

    return
  }

  await saveAIChatMessage(
    cleanQuestion
  )

  aiHistory.push({
    role: 'user',
    content: cleanQuestion
  })

  if (send) {
    send.disabled = true
  }

  const typing =
    addAITyping()

  try {
    const reply =
      await askAI(
        cleanQuestion
      )

    typing?.remove()

    const finalReply =
      applyAIGreeting(reply)

    addAIMessage(
      'assistant',
      formatAIResponse(
        finalReply
      )
    )

    aiHistory.push({
      role: 'assistant',
      content: finalReply
    })

    if (
      aiHistory.length > 10
    ) {
      aiHistory =
        aiHistory.slice(-10)
    }
  } catch (error) {
    console.error(
      'ArduinoHub AI error:',
      error
    )

    console.error(
      'AI error status:',
      error?.status
    )

    console.error(
      'AI backend data:',
      error?.backendData
    )

    typing?.remove()

    addAIMessage(
      'error',
      getAIUserErrorMessage(
        error
      )
    )
  } finally {
    if (send) {
      send.disabled = false
    }

    input?.focus()
  }
}

function openAIChat() {
  const chat =
    $('#ai-chat')

  const toggle =
    $('#ai-chat-toggle')

  const windowEl =
    $('#ai-chat-window')

  if (
    !chat ||
    !toggle
  ) {
    return
  }

  chat.classList.add(
    'open'
  )

  toggle.setAttribute(
    'aria-expanded',
    'true'
  )

  windowEl?.setAttribute(
    'aria-hidden',
    'false'
  )

  setTimeout(
    () => {
      $('#ai-chat-input')
        ?.focus()
    },
    220
  )
}

function closeAIChat() {
  const chat =
    $('#ai-chat')

  const toggle =
    $('#ai-chat-toggle')

  const windowEl =
    $('#ai-chat-window')

  if (
    !chat ||
    !toggle
  ) {
    return
  }

  chat.classList.remove(
    'open'
  )

  toggle.setAttribute(
    'aria-expanded',
    'false'
  )

  windowEl?.setAttribute(
    'aria-hidden',
    'true'
  )
}

async function initAIChat() {
  const chat =
    $('#ai-chat')

  if (!chat) {
    return
  }

  await detectAIAdmin()

  const toggle =
    $('#ai-chat-toggle')

  const close =
    $('#ai-chat-close')

  const form =
    $('#ai-chat-form')

  const input =
    $('#ai-chat-input')

  if (toggle) {
    toggle.addEventListener(
      'click',
      () => {
        if (
          chat.classList.contains(
            'open'
          )
        ) {
          closeAIChat()
        } else {
          openAIChat()
        }
      }
    )
  }

  close?.addEventListener(
    'click',
    closeAIChat
  )

  chat
    .querySelectorAll(
      '.ai-suggestion'
    )
    .forEach(
      button => {
        button.addEventListener(
          'click',
          async () => {
            const question =
              button.dataset
                .aiQuestion

            if (!question) {
              return
            }

            chat
              .querySelectorAll(
                '.ai-suggestion'
              )
              .forEach(
                b => {
                  b.disabled = true
                }
              )

            await handleAIQuestion(
              question
            )

            chat
              .querySelectorAll(
                '.ai-suggestion'
              )
              .forEach(
                b => {
                  b.disabled = false
                }
              )
          }
        )
      }
    )

  form?.addEventListener(
    'submit',
    async event => {
      event.preventDefault()

      const question =
        input?.value?.trim()

      if (!question) {
        return
      }

      await handleAIQuestion(
        question
      )
    }
  )

  input?.addEventListener(
    'keydown',
    event => {
      if (
        event.key === 'Enter' &&
        !event.shiftKey
      ) {
        event.preventDefault()

        form?.requestSubmit()
      }
    }
  )

  document.addEventListener(
    'keydown',
    event => {
      if (
        event.key === 'Escape' &&
        chat.classList.contains(
          'open'
        )
      ) {
        closeAIChat()
      }
    }
  )

  refreshIcons()
}

function card(project) {
  const image =
    project.image_url
      ? `
        <img
          src="${esc(project.image_url)}"
          alt="${esc(project.title)}"
          loading="lazy"
        >
      `
      : `
        <div class="card-image fallback">
          ${icon('circuit-board')}
        </div>
      `

  return `
    <article class="project-card">
      <div class="card-image">
        ${image}
      </div>

      <div class="card-body">
        <div class="card-meta">
          <span>
            ${esc(project.category)}
          </span>

          <time datetime="${esc(project.created_at)}">
            ${dateText(project.created_at)}
          </time>
        </div>

        <h2>
          ${esc(project.title)}
        </h2>

        <p>
          ${esc(project.description)}
        </p>

        <div class="card-footer">
          <span>
            ${icon('user-round')}
            ${esc(project.author)}
          </span>

          <a
            class="text-link"
            href="project.html?id=${encodeURIComponent(project.id)}"
          >
            ნახვა
            ${icon('arrow-up-right')}
          </a>
        </div>
      </div>
    </article>
  `
}

async function initProjects() {
  const status =
    $('#projects-status')

  const grid =
    $('#projects-grid')

  if (!db) {
    return configuredMessage(
      status
    )
  }

  const { data, error } =
    await db
      .from('projects')
      .select(
        'id,title,description,category,author,image_url,created_at'
      )
      .eq(
        'published',
        true
      )
      .order(
        'created_at',
        {
          ascending: false
        }
      )
      .limit(60)

  if (error) {
    status.textContent =
      neutralError(
        error,
        'პროექტების ჩატვირთვა ვერ მოხერხდა.'
      )

    return
  }

  status.remove()

  const render = () => {
    const q =
      $('#project-search')
        .value
        .trim()
        .toLocaleLowerCase(
          'ka'
        )

    const category =
      $('#category-filter')
        .value

    const result =
      data.filter(
        p =>
          (
            !category ||
            p.category ===
              category
          ) &&
          (
            !q ||
            `${p.title} ${p.description} ${p.author}`
              .toLocaleLowerCase(
                'ka'
              )
              .includes(q)
          )
      )

    grid.innerHTML =
      result.length
        ? result
            .map(card)
            .join('')
        : `
          <div class="empty-state full">
            ${icon('search-x')}

            <h2>
              ${
                data.length
                  ? 'პროექტი ვერ მოიძებნა'
                  : 'ჯერ პროექტები არ დამატებულა'
              }
            </h2>

            <p>
              ${
                data.length
                  ? 'შეცვალეთ ძიება ან ფილტრი.'
                  : 'როგორც კი ადმინისტრატორი პირველ პროექტს გამოაქვეყნებს, ის აქ გამოჩნდება.'
              }
            </p>
          </div>
        `

    refreshIcons()
  }

  $('#project-search')
    .addEventListener(
      'input',
      render
    )

  $('#category-filter')
    .addEventListener(
      'change',
      render
    )

  render()
}

async function initDetail() {
  const target =
    $('#project-detail')

  if (!db) {
    return configuredMessage(
      target
    )
  }

  const id =
    new URLSearchParams(
      location.search
    ).get('id')

  if (
    !id ||
    !/^[0-9a-f-]{36}$/i.test(id)
  ) {
    return notFound(target)
  }

  const {
    data: p,
    error
  } =
    await db
      .from('projects')
      .select('*')
      .eq(
        'id',
        id
      )
      .eq(
        'published',
        true
      )
      .maybeSingle()

  if (
    error ||
    !p
  ) {
    return notFound(target)
  }

  const image =
    p.image_url
      ? `
        <img
          class="detail-image"
          src="${esc(p.image_url)}"
          alt="${esc(p.title)}"
        >
      `
      : ''

  const video =
    p.video_url
      ? `
        <section class="detail-section media-section">
          <h2>
            ${icon('video')}
            ვიდეო
          </h2>

          <video
            controls
            preload="metadata"
            src="${esc(p.video_url)}"
          >
            თქვენი ბრაუზერი ვიდეოს არ უჭერს მხარს.
          </video>
        </section>
      `
      : ''

  const components =
    p.components
      ? `
        <section class="detail-section">
          <h2>
            ${icon('package')}
            საჭირო კომპონენტები
          </h2>

          <div class="prose lines">
            ${esc(p.components)}
          </div>
        </section>
      `
      : ''

  const how =
    p.how_it_was_made
      ? `
        <section class="detail-section">
          <h2>
            ${icon('wrench')}
            როგორ გაკეთდა
          </h2>

          <div class="prose lines">
            ${esc(p.how_it_was_made)}
          </div>
        </section>
      `
      : ''

  let code = ''

  if (
    p.code &&
    p.code.trim()
  ) {
    const isChemistry =
      String(p.category)
        .toLowerCase() ===
      'chemistry'

    const sectionTitle =
      isChemistry
        ? 'ქიმიური რეაქცია'
        : 'Arduino Code'

    const copyText =
      isChemistry
        ? 'ტექსტის დაკოპირება'
        : 'კოდის დაკოპირება'

    const sectionIcon =
      isChemistry
        ? 'flask-conical'
        : 'braces'

    code = `
      <section class="detail-section">
        <div class="code-heading">
          <h2>
            ${icon(sectionIcon)}
            ${sectionTitle}
          </h2>

          <button
            id="copy-code"
            class="button secondary compact"
            type="button"
          >
            ${icon('copy')}
            ${copyText}
          </button>
        </div>

        <pre>
          <code id="arduino-code">
            ${esc(p.code)}
          </code>
        </pre>
      </section>
    `
  }

  target.className = ''

  target.innerHTML = `
    <article class="detail">
      <div class="detail-hero">
        <div>
          <div class="card-meta">
            <span>
              ${esc(p.category)}
            </span>

            <time>
              ${dateText(p.created_at)}
            </time>
          </div>

          <h1>
            ${esc(p.title)}
          </h1>

          <p>
            ${esc(p.description)}
          </p>

          <div class="author-line">
            ${icon('user-round')}
            ${esc(p.author)}
          </div>
        </div>

        ${image}
      </div>

      <div class="detail-content">
        ${components}
        ${how}
        ${video}
        ${code}
      </div>
    </article>
  `

  $('#copy-code')
    ?.addEventListener(
      'click',
      async () => {
        try {
          await navigator.clipboard
            .writeText(p.code)

          const isChemistry =
            String(p.category)
              .toLowerCase() ===
            'chemistry'

          toast(
            isChemistry
              ? 'ქიმიური რეაქცია დაკოპირდა'
              : 'კოდი დაკოპირდა',
            'success'
          )
        } catch {
          toast(
            'დაკოპირება ვერ მოხერხდა.'
          )
        }
      }
    )

  refreshIcons()
}

function notFound(target) {
  if (!target) {
    return
  }

  target.className = ''

  target.innerHTML = `
    <div class="empty-state">
      ${icon('search-x')}

      <h2>
        პროექტი ვერ მოიძებნა
      </h2>

      <p>
        ბმული არასწორია ან პროექტი აღარ არის გამოქვეყნებული.
      </p>

      <a
        href="projects.html"
        class="button primary"
      >
        პროექტებზე დაბრუნება
      </a>
    </div>
  `

  refreshIcons()
}

const IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
]

const VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg'
]

function fileOkay(
  file,
  types,
  max,
  label
) {
  if (!file) {
    return true
  }

  if (
    !types.includes(
      file.type
    )
  ) {
    toast(
      `${label}: ფაილის ტიპი მიუღებელია.`
    )

    return false
  }

  if (
    file.size > max
  ) {
    toast(
      `${label}: ფაილი ზედმეტად დიდია.`
    )

    return false
  }

  return true
}

async function upload(
  file,
  bucket,
  folder,
  types,
  max,
  label
) {
  if (!file) {
    return null
  }

  if (
    !fileOkay(
      file,
      types,
      max,
      label
    )
  ) {
    throw new Error(
      'invalid-file'
    )
  }

  const clean =
    file.name.replace(
      /[^a-zA-Z0-9._-]/g,
      '_'
    )

  const path =
    `${folder}/${crypto.randomUUID()}-${clean}`

  const { error } =
    await db.storage
      .from(bucket)
      .upload(
        path,
        file,
        {
          cacheControl: '3600',
          upsert: false,
          contentType:
            file.type
        }
      )

  if (error) {
    throw error
  }

  const { data } =
    db.storage
      .from(bucket)
      .getPublicUrl(path)

  return {
    url: data.publicUrl,
    path
  }
}

function storagePath(
  url,
  bucket
) {
  try {
    const marker =
      `/storage/v1/object/public/${bucket}/`

    const index =
      url?.indexOf(marker)

    return index >= 0
      ? decodeURIComponent(
          url.slice(
            index +
              marker.length
          )
        )
      : null
  } catch {
    return null
  }
}

async function removeStored(
  url,
  bucket
) {
  const path =
    storagePath(
      url,
      bucket
    )

  if (path) {
    const { error } =
      await db.storage
        .from(bucket)
        .remove([path])

    if (error) {
      console.warn(
        'Storage cleanup failed',
        error
      )
    }
  }
}

async function isAdmin(user) {
  if (
    !user ||
    !db
  ) {
    return null
  }

  const {
    data,
    error
  } =
    await db
      .from('admin_users')
      .select('username')
      .eq(
        'user_id',
        user.id
      )
      .maybeSingle()

  if (
    error ||
    !data
  ) {
    return null
  }

  return data
}

async function initAdmin() {
  if (!db) {
    $('#auth-panel')
      .querySelector('form')
      .hidden = true

    $('#login-error')
      .textContent =
      'Supabase ჯერ არ არის კონფიგურირებული.'

    return
  }

  const {
    data: { session }
  } =
    await db.auth.getSession()

  if (session) {
    const admin =
      await isAdmin(
        session.user
      )

    if (admin) {
      await showDashboard(
        session.user,
        admin
      )
    } else {
      location.href =
        'index.html'

      return
    }
  }

  $('#login-form')
    ?.addEventListener(
      'submit',
      login
    )

  $('#logout-button')
    ?.addEventListener(
      'click',
      logout
    )

  $('#new-project-button')
    ?.addEventListener(
      'click',
      () =>
        openEditor()
    )

  $('#cancel-edit')
    ?.addEventListener(
      'click',
      closeEditor
    )

  $('#project-form')
    ?.addEventListener(
      'submit',
      saveProject
    )

  $('#image-file')
    ?.addEventListener(
      'change',
      imagePreview
    )

  $('#video-file')
    ?.addEventListener(
      'change',
      () => {
        $('#video-name')
          .textContent =
          $('#video-file')
            .files[0]
            ?.name ||
          'ფაილი არჩეული არ არის'
      }
    )

  const categorySelect =
    $('#category')

  if (categorySelect) {
    categorySelect
      .addEventListener(
        'change',
        updateCodeFieldLabel
      )

    updateCodeFieldLabel()
  }

  bindMeetingForm()

  db.auth.onAuthStateChange(
    (
      _event,
      session
    ) => {
      if (!session) {
        showLogin()
      }
    }
  )
}

function updateCodeFieldLabel() {
  const category =
    $('#category')

  const codeInput =
    $('#code')

  if (
    !category ||
    !codeInput
  ) {
    return
  }

  const label =
    codeInput.closest(
      'label'
    )

  if (!label) {
    return
  }

  const isChemistry =
    String(category.value)
      .toLowerCase() ===
    'chemistry'

  const textNodes =
    Array.from(
      label.childNodes
    ).filter(
      node =>
        node.nodeType ===
        Node.TEXT_NODE
    )

  const titleNode =
    textNodes.find(
      node =>
        node.textContent.trim()
    )

  if (titleNode) {
    titleNode.textContent =
      isChemistry
        ? ' ქიმიური რეაქცია '
        : ' Arduino Code '
  }

  if (isChemistry) {
    codeInput.placeholder =
      'მაგ.: რეაქციის ფორმულა, ქიმიური განტოლება ან რეაქციის აღწერა...'
  } else {
    codeInput.placeholder =
      'ჩასვით Arduino კოდი აქ...'
  }
}

async function login(event) {
  event.preventDefault()

  const form =
    event.currentTarget

  const button =
    form.querySelector(
      'button'
    )

  const email =
    $('#login-email')
      ?.value
      .trim()

  const password =
    $('#login-password')
      ?.value || ''

  const errorElement =
    $('#login-error')

  if (errorElement) {
    errorElement.textContent =
      ''
  }

  if (
    !email ||
    !password
  ) {
    if (errorElement) {
      errorElement.textContent =
        'შეავსეთ ორივე ველი.'
    }

    return
  }

  setBusy(
    button,
    true,
    'იტვირთება...'
  )

  try {
    const {
      data,
      error
    } =
      await db.auth
        .signInWithPassword({
          email,
          password
        })

    if (
      error ||
      !data?.user
    ) {
      if (errorElement) {
        errorElement.textContent =
          'მონაცემები არასწორია'
      }

      return
    }

    const user =
      data.user

    const admin =
      await isAdmin(user)

    if (admin) {
      await showDashboard(
        user,
        admin
      )

      return
    }

    await updateAuthUI()

    toast(
      `კეთილი იყოს შენი დაბრუნება, ${getUserDisplayName(user)}!`,
      'success'
    )

    setTimeout(
      () => {
        location.href =
          'index.html'
      },
      500
    )
  } catch (error) {
    console.error(
      'Login error:',
      error
    )

    if (errorElement) {
      errorElement.textContent =
        'შესვლა ვერ მოხერხდა. სცადეთ ხელახლა.'
    }
  } finally {
    setBusy(
      button,
      false
    )
  }
}

async function showDashboard(
  user,
  knownAdmin
) {
  const admin =
    knownAdmin ||
    await isAdmin(user)

  if (!admin) {
    location.href =
      'index.html'

    return
  }

  $('#auth-panel')
    .hidden = true

  $('#dashboard')
    .hidden = false

  $('#admin-name')
    .textContent =
    admin.username

  refreshIcons()

  await Promise.all([
    loadAdminProjects(),
    loadAdminMeeting(),
    loadAdminAttendance()
  ])
}

function showLogin() {
  const dashboard =
    $('#dashboard')

  const authPanel =
    $('#auth-panel')

  if (dashboard) {
    dashboard.hidden = true
  }

  if (authPanel) {
    authPanel.hidden = false
  }

  closeEditor()
}

async function logout() {
  if (!db) {
    return
  }

  try {
    const { error } =
      await db.auth.signOut()

    if (error) {
      throw error
    }

    aiAdminGreeting = ''

    document
      .querySelectorAll(
        '.account-menu'
      )
      .forEach(
        menu =>
          menu.remove()
      )

    const loginElement =
      findLoginElement()

    if (loginElement) {
      loginElement.hidden =
        false
    }

    toast(
      'თქვენ გამოხვედით ანგარიშიდან.',
      'success'
    )

    if (
      page === 'admin'
    ) {
      setTimeout(
        () => {
          location.href =
            'index.html'
        },
        500
      )
    }
  } catch (error) {
    console.error(
      'Logout error:',
      error
    )

    toast(
      'ანგარიშიდან გამოსვლა ვერ მოხერხდა.'
    )
  }
}

function setBusy(
  button,
  busy,
  text
) {
  if (!button) {
    return
  }

  button.disabled =
    busy

  if (busy) {
    button.dataset.label =
      button.innerHTML

    button.textContent =
      text
  } else if (
    button.dataset.label
  ) {
    button.innerHTML =
      button.dataset.label
  }

  refreshIcons()
}

let adminProjects = []

async function loadAdminProjects() {
  const status =
    $('#admin-status')

  const list =
    $('#admin-project-list')

  if (
    !status ||
    !list
  ) {
    return
  }

  status.hidden = false
  list.innerHTML = ''

  const {
    data,
    error
  } =
    await db
      .from('projects')
      .select(
        'id,title,category,published,created_at,author,image_url,video_url,description,components,how_it_was_made,code'
      )
      .order(
        'created_at',
        {
          ascending: false
        }
      )

  if (error) {
    status.textContent =
      neutralError(
        error,
        'პროექტების ჩატვირთვა ვერ მოხერხდა.'
      )

    return
  }

  adminProjects =
    data || []

  status.hidden = true

  $('#admin-count')
    .textContent =
    `${adminProjects.length} პროექტი`

  list.innerHTML =
    adminProjects.length
      ? adminProjects
          .map(
            p => `
              <article class="admin-row">
                <div>
                  <h3>
                    ${esc(p.title)}
                  </h3>

                  <p>
                    ${esc(p.category)}
                    ·
                    ${dateText(p.created_at)}
                  </p>
                </div>

                <span
                  class="status ${
                    p.published
                      ? 'published'
                      : 'hidden-status'
                  }"
                >
                  ${
                    p.published
                      ? 'გამოქვეყნებული'
                      : 'დამალული'
                  }
                </span>

                <div class="row-actions">
                  <a
                    class="icon-button"
                    title="ნახვა"
                    href="project.html?id=${p.id}"
                  >
                    ${icon('eye')}
                  </a>

                  <button
                    class="icon-button edit"
                    data-id="${p.id}"
                    title="რედაქტირება"
                  >
                    ${icon('pencil')}
                  </button>

                  <button
                    class="icon-button toggle"
                    data-id="${p.id}"
                    title="${
                      p.published
                        ? 'დამალვა'
                        : 'გამოქვეყნება'
                    }"
                  >
                    ${
                      icon(
                        p.published
                          ? 'eye-off'
                          : 'send'
                      )
                    }
                  </button>

                  <button
                    class="icon-button danger delete"
                    data-id="${p.id}"
                    title="წაშლა"
                  >
                    ${icon('trash-2')}
                  </button>
                </div>
              </article>
            `
          )
          .join('')
      : `
        <div class="empty-state compact-empty">
          ${icon('folder-plus')}

          <h2>
            ჯერ პროექტები არ დამატებულა
          </h2>

          <p>
            დაიწყეთ პირველი რეალური პროექტის დამატებით.
          </p>
        </div>
      `

  list
    .querySelectorAll(
      '.edit'
    )
    .forEach(
      b =>
        b.addEventListener(
          'click',
          () =>
            openEditor(
              adminProjects.find(
                p =>
                  p.id ===
                  b.dataset.id
              )
            )
        )
    )

  list
    .querySelectorAll(
      '.toggle'
    )
    .forEach(
      b =>
        b.addEventListener(
          'click',
          () =>
            togglePublished(
              b.dataset.id
            )
        )
    )

  list
    .querySelectorAll(
      '.delete'
    )
    .forEach(
      b =>
        b.addEventListener(
          'click',
          () =>
            deleteProject(
              b.dataset.id
            )
        )
    )

  refreshIcons()
}

function openEditor(p) {
  const form =
    $('#project-form')

  form.reset()

  $('#image-preview')
    .hidden = true

  $('#image-name')
    .textContent =
    'ფაილი არჩეული არ არის'

  $('#video-name')
    .textContent =
    'ფაილი არჩეული არ არის'

  $('#form-error')
    .textContent = ''

  $('#editor-title')
    .textContent =
    p
      ? 'პროექტის რედაქტირება'
      : 'ახალი პროექტი'

  $('#save-project')
    .innerHTML =
    p
      ? `ცვლილებების შენახვა ${icon('save')}`
      : `პროექტის დამატება ${icon('save')}`

  if (p) {
    $('#edit-id')
      .value = p.id

    $('#title')
      .value = p.title

    $('#category')
      .value = p.category

    $('#author')
      .value = p.author

    $('#published')
      .checked = p.published

    $('#description')
      .value = p.description

    $('#components')
      .value =
      p.components || ''

    $('#how-made')
      .value =
      p.how_it_was_made || ''

    $('#code')
      .value =
      p.code || ''
  }

  updateCodeFieldLabel()

  $('#project-editor')
    .hidden = false

  $('#project-editor')
    .scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    })

  refreshIcons()
}

function closeEditor() {
  const editor =
    $('#project-editor')

  if (editor) {
    editor.hidden = true
  }
}

function imagePreview() {
  const file =
    $('#image-file')
      .files[0]

  $('#image-name')
    .textContent =
    file?.name ||
    'ფაილი არჩეული არ არის'

  if (
    file &&
    fileOkay(
      file,
      IMAGE_TYPES,
      5 * 1024 * 1024,
      'სურათი'
    )
  ) {
    const preview =
      $('#image-preview')

    preview.src =
      URL.createObjectURL(
        file
      )

    preview.hidden = false
  }
}

async function saveProject(
  event
) {
  event.preventDefault()

  const button =
    $('#save-project')

  const id =
    $('#edit-id')
      .value

  const old =
    adminProjects.find(
      p =>
        p.id === id
    )

  const image =
    $('#image-file')
      .files[0]

  const video =
    $('#video-file')
      .files[0]

  $('#form-error')
    .textContent = ''

  if (
    !fileOkay(
      image,
      IMAGE_TYPES,
      5 * 1024 * 1024,
      'სურათი'
    ) ||
    !fileOkay(
      video,
      VIDEO_TYPES,
      50 * 1024 * 1024,
      'ვიდეო'
    )
  ) {
    return
  }

  setBusy(
    button,
    true,
    'ინახება...'
  )

  let uploads = []

  try {
    const folder =
      id ||
      crypto.randomUUID()

    if (image) {
      uploads.push([
        'image',
        await upload(
          image,
          'project-images',
          folder,
          IMAGE_TYPES,
          5 * 1024 * 1024,
          'სურათი'
        )
      ])
    }

    if (video) {
      uploads.push([
        'video',
        await upload(
          video,
          'project-videos',
          folder,
          VIDEO_TYPES,
          50 * 1024 * 1024,
          'ვიდეო'
        )
      ])
    }

    const value = {
      title:
        $('#title')
          .value
          .trim(),

      category:
        $('#category')
          .value,

      author:
        $('#author')
          .value
          .trim(),

      description:
        $('#description')
          .value
          .trim(),

      components:
        $('#components')
          .value
          .trim() ||
        null,

      how_it_was_made:
        $('#how-made')
          .value
          .trim() ||
        null,

      code:
        $('#code')
          .value
          .trim() ||
        null,

      published:
        $('#published')
          .checked
    }

    const img =
      uploads.find(
        x =>
          x[0] ===
          'image'
      )?.[1]

    const vid =
      uploads.find(
        x =>
          x[0] ===
          'video'
      )?.[1]

    if (img) {
      value.image_url =
        img.url
    }

    if (vid) {
      value.video_url =
        vid.url
    }

    let error

    if (id) {
      ({
        error
      } =
        await db
          .from('projects')
          .update(value)
          .eq(
            'id',
            id
          ))
    } else {
      ({
        error
      } =
        await db
          .from('projects')
          .insert(
            value
          ))
    }

    if (error) {
      throw error
    }

    if (
      img &&
      old?.image_url
    ) {
      await removeStored(
        old.image_url,
        'project-images'
      )
    }

    if (
      vid &&
      old?.video_url
    ) {
      await removeStored(
        old.video_url,
        'project-videos'
      )
    }

    toast(
      id
        ? 'ცვლილებები შენახულია.'
        : 'პროექტი დაემატა.',
      'success'
    )

    closeEditor()

    await loadAdminProjects()
  } catch (error) {
    console.error(error)

    for (
      const [kind, file]
      of uploads
    ) {
      if (!file?.url) {
        continue
      }

      await removeStored(
        file.url,
        kind === 'image'
          ? 'project-images'
          : 'project-videos'
      )
    }

    $('#form-error')
      .textContent =
      neutralError(
        error,
        'პროექტის შენახვა ვერ მოხერხდა.'
      )
  } finally {
    setBusy(
      button,
      false
    )
  }
}

async function togglePublished(
  id
) {
  const p =
    adminProjects.find(
      x =>
        x.id === id
    )

  if (!p) {
    return
  }

  const { error } =
    await db
      .from('projects')
      .update({
        published:
          !p.published
      })
      .eq(
        'id',
        id
      )

  if (error) {
    return toast(
      'სტატუსის შეცვლა ვერ მოხერხდა.'
    )
  }

  toast(
    p.published
      ? 'პროექტი დამალულია.'
      : 'პროექტი გამოქვეყნდა.',
    'success'
  )

  loadAdminProjects()
}

async function deleteProject(
  id
) {
  const p =
    adminProjects.find(
      x =>
        x.id === id
    )

  if (
    !p ||
    !confirm(
      'ნამდვილად გსურთ ამ პროექტის წაშლა?'
    )
  ) {
    return
  }

  const { error } =
    await db
      .from('projects')
      .delete()
      .eq(
        'id',
        id
      )

  if (error) {
    return toast(
      'პროექტის წაშლა ვერ მოხერხდა.'
    )
  }

  await Promise.all([
    removeStored(
      p.image_url,
      'project-images'
    ),

    removeStored(
      p.video_url,
      'project-videos'
    )
  ])

  toast(
    'პროექტი წაიშალა.',
    'success'
  )

  loadAdminProjects()
}

const GEORGIAN_WEEKDAYS = [
  'კვირა',
  'ორშაბათი',
  'სამშაბათი',
  'ოთხშაბათი',
  'ხუთშაბათი',
  'პარასკევი',
  'შაბათი'
]

function meetingDay(
  dateValue
) {
  if (!dateValue) {
    return '—'
  }

  const d =
    new Date(
      `${dateValue}T12:00:00`
    )

  if (
    Number.isNaN(
      d.getTime()
    )
  ) {
    return '—'
  }

  return GEORGIAN_WEEKDAYS[
    d.getDay()
  ]
}

function meetingDateText(
  dateValue
) {
  if (!dateValue) {
    return '—'
  }

  const d =
    new Date(
      `${dateValue}T12:00:00`
    )

  if (
    Number.isNaN(
      d.getTime()
    )
  ) {
    return dateValue
  }

  return new Intl.DateTimeFormat(
    'ka-GE',
    {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }
  ).format(d)
}

function meetingTimeText(
  timeValue
) {
  if (!timeValue) {
    return '—'
  }

  const m =
    String(timeValue)
      .match(
        /^(\d{2}):(\d{2})/
      )

  return m
    ? `${m[1]}:${m[2]}`
    : timeValue
}

async function getMeeting() {
  if (!db) {
    return {
      data: null,
      error:
        new Error(
          'Supabase not configured'
        )
    }
  }

  return await db
    .from('club_meeting')
    .select(
      'id,meeting_date,meeting_time,updated_at'
    )
    .eq(
      'id',
      1
    )
    .maybeSingle()
}

function renderMeetingContent(
  meeting
) {
  const target =
    $('#meeting-content')

  if (!target) {
    return
  }

  if (!meeting) {
    target.innerHTML = `
      <div class="meeting-empty">
        ${icon('calendar-off')}

        <h3>
          თარიღი ჯერ არ არის გამოქვეყნებული
        </h3>

        <p>
          როგორც კი ადმინისტრატორი თარიღსა და დროს გამოაქვეყნებს, ინფორმაცია აქ გამოჩნდება.
        </p>
      </div>
    `
  } else {
    target.innerHTML = `
      <div class="meeting-date-main">
        ${esc(
          meetingDateText(
            meeting.meeting_date
          )
        )}
      </div>

      <div class="meeting-detail-row">
        <div>
          <span>
            დღე
          </span>

          <strong>
            ${esc(
              meetingDay(
                meeting.meeting_date
              )
            )}
          </strong>
        </div>

        <div>
          <span>
            დრო
          </span>

          <strong>
            ${esc(
              meetingTimeText(
                meeting.meeting_time
              )
            )}
          </strong>
        </div>
      </div>
    `
  }

  refreshIcons()
}

async function loadPublicMeeting() {
  const {
    data,
    error
  } =
    await getMeeting()

  if (error) {
    console.error(error)

    const target =
      $('#meeting-content')

    if (target) {
      target.innerHTML = `
        <div class="meeting-empty">
          ${icon('triangle-alert')}

          <h3>
            ინფორმაციის ჩატვირთვა ვერ მოხერხდა
          </h3>

          <p>
            სცადეთ რამდენიმე წამში ხელახლა.
          </p>
        </div>
      `

      refreshIcons()
    }

    return
  }

  renderMeetingContent(
    data
  )
}

function openMeetingModal() {
  const modal =
    $('#meeting-modal')

  if (!modal) {
    return
  }

  modal.hidden = false

  modal.setAttribute(
    'aria-hidden',
    'false'
  )

  document.body.classList.add(
    'modal-open'
  )

  loadPublicMeeting()

  setTimeout(
    () => {
      $('#meeting-close')
        ?.focus()
    },
    0
  )
}

function closeMeetingModal() {
  const modal =
    $('#meeting-modal')

  if (!modal) {
    return
  }

  modal.hidden = true

  modal.setAttribute(
    'aria-hidden',
    'true'
  )

  document.body.classList.remove(
    'modal-open'
  )
}

function initMeetingPublic() {
  const button =
    $('#meeting-button')

  if (!button) {
    return
  }

  button.addEventListener(
    'click',
    openMeetingModal
  )

  $('#meeting-close')
    ?.addEventListener(
      'click',
      closeMeetingModal
    )

  document
    .querySelectorAll(
      '[data-meeting-close]'
    )
    .forEach(
      el =>
        el.addEventListener(
          'click',
          closeMeetingModal
        )
    )

  document.addEventListener(
    'keydown',
    e => {
      if (
        e.key === 'Escape' &&
        $('#meeting-modal') &&
        !$('#meeting-modal')
          .hidden
      ) {
        closeMeetingModal()
      }
    }
  )
}

async function loadAdminMeeting() {
  const status =
    $('#meeting-admin-status')

  if (!status) {
    return
  }

  const {
    data,
    error
  } =
    await getMeeting()

  if (error) {
    status.textContent =
      'ჩატვირთვა ვერ მოხერხდა'

    console.error(error)

    return
  }

  if (data) {
    $('#meeting-date')
      .value =
      data.meeting_date ||
      ''

    $('#meeting-time')
      .value =
      String(
        data.meeting_time ||
        ''
      ).slice(
        0,
        5
      )

    $('#meeting-day-preview')
      .textContent =
      meetingDay(
        data.meeting_date
      )

    status.textContent =
      'გამოქვეყნებულია'

    status.className =
      'meeting-admin-status published'
  } else {
    status.textContent =
      'არ არის გამოქვეყნებული'

    status.className =
      'meeting-admin-status'

    $('#meeting-day-preview')
      .textContent =
      '—'
  }
}

function bindMeetingForm() {
  const form =
    $('#meeting-form')

  if (!form) {
    return
  }

  $('#meeting-date')
    ?.addEventListener(
      'input',
      e => {
        $('#meeting-day-preview')
          .textContent =
          meetingDay(
            e.target.value
          )
      }
    )

  form.addEventListener(
    'submit',
    saveMeeting
  )

  $('#clear-meeting')
    ?.addEventListener(
      'click',
      clearMeeting
    )
}

async function saveMeeting( event ) {
  event.preventDefault()
  if (!db) { return }
  const button = $('#save-meeting')
  const errorTarget = $('#meeting-form-error')
  const date = $('#meeting-date') .value
  const time = $('#meeting-time') .value
  errorTarget.textContent = ''
  if ( !date || !time ) {
    errorTarget.textContent = 'აირჩიეთ თარიღი და დრო.'
    return
  }
  setBusy( button, true, 'ქვეყნდება...' )
  try {
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      throw new Error( 'not-authenticated' )
    }
    const { error } = await db
      .from('club_meeting')
      .upsert(
        { id: 1, meeting_date: date, meeting_time: time, updated_by: user.id },
        { onConflict: 'id' }
      )
    if (error) {
      throw error
    }
    toast( 'კლუბის შეკრება გამოქვეყნდა.', 'success' )
    

    await loadAdminMeeting()
  } catch (error) {
    errorTarget.textContent = neutralError( error, 'შეკრების გამოქვეყნება ვერ მოხერხდა.' )
  } finally {
    setBusy( button, false )
  }
}
async function clearMeeting() {
  if (!db) {
    return
  }

  if (
    !confirm(
      'ნამდვილად გსურთ გამოქვეყნებული შეკრების წაშლა?'
    )
  ) {
    return
  }

  const { error } =
    await db
      .from('club_meeting')
      .delete()
      .eq(
        'id',
        1
      )

  if (error) {
    return toast(
      'შეკრების წაშლა ვერ მოხერხდა.'
    )
  }

  $('#meeting-date')
    .value = ''

  $('#meeting-time')
    .value = ''

  $('#meeting-day-preview')
    .textContent =
    '—'

  $('#meeting-admin-status')
    .textContent =
    'არ არის გამოქვეყნებული'

  $('#meeting-admin-status')
    .className =
    'meeting-admin-status'

  toast(
    'შეკრება გაუქმდა.',
    'success'
  )
}

async function initPasswordReset() {
  const form =
    $('#reset-password-form')

  if (!form) {
    return
  }

  if (!db) {
    $('#reset-error')
      .textContent =
      'Supabase ჯერ არ არის კონფიგურირებული.'

    form
      .querySelector(
        'button'
      )
      .disabled = true

    return
  }

  form.addEventListener(
    'submit',
    async event => {
      event.preventDefault()

      const error =
        $('#reset-error')

      const password =
        $('#new-password')
          .value

      const confirmPassword =
        $('#confirm-password')
          .value

      const button =
        form.querySelector(
          'button'
        )

      error.textContent =
        ''

      if (
        password !==
        confirmPassword
      ) {
        error.textContent =
          'პაროლები ერთმანეთს არ ემთხვევა.'

        return
      }

      if (
        password.length < 10
      ) {
        error.textContent =
          'პაროლი მინიმუმ 10 სიმბოლო უნდა იყოს.'

        return
      }

      const {
        data: { session }
      } =
        await db.auth.getSession()

      if (!session) {
        error.textContent =
          'აღდგენის ბმული არასწორია ან ვადა გაუვიდა. მოითხოვეთ ახალი ბმული.'

        return
      }

      setBusy(
        button,
        true,
        'ინახება...'
      )

      const {
        error: updateError
      } =
        await db.auth.updateUser({
          password
        })

      if (updateError) {
        error.textContent =
          'პაროლის შეცვლა ვერ მოხერხდა. მოითხოვეთ ახალი ბმული.'
      } else {
        toast(
          'პაროლი წარმატებით შეიცვალა.',
          'success'
        )

        setTimeout(
          () => {
            location.href =
              'admin.html'
          },
          900
        )
      }

      setBusy(
        button,
        false
      )
    }
  )
}

const MARIA_USER_ID = 'a02cb2e0-c4d0-4978-ab26-e8af583e4f58'

let attendanceMembers = []
let attendanceRecords = []

async function isAttendanceManager(user) {
  return !!user && user.id === MARIA_USER_ID
}

async function getAttendanceMembers() {
  if (!db) {
    return []
  }

  const { data, error } = await db
    .from('club_members')
    .select('id,full_name,sort_order,active')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    throw error
  }

  return data || []
}

async function getAttendanceRecords() {
  if (!db) {
    return []
  }

  const { data, error } = await db
    .from('club_attendance')
    .select(`
      id,
      meeting_date,
      recorded_by,
      counted,
      created_at,
      updated_at,
      club_attendance_members (
        member_id,
        club_members (
          id,
          full_name,
          sort_order
        )
      )
    `)
    .order('meeting_date', { ascending: false })

  if (error) {
    throw error
  }

  return data || []
}

function attendanceDateText(value) {
  if (!value) {
    return '—'
  }

  const date = new Date(`${value}T12:00:00`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(
    'ka-GE',
    {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }
  ).format(date)
}

async function saveAttendanceRecord(date, memberIds, counted) {
  if (!db) {
    throw new Error('Supabase არ არის კონფიგურირებული.')
  }

  const { data: { user } } = await db.auth.getUser()

  if (!user) {
    throw new Error('ანგარიშში შესვლა აუცილებელია.')
  }

  const manager = await isAttendanceManager(user)

  if (!manager) {
    throw new Error('დასწრების აღრიცხვაზე წვდომა არ გაქვთ.')
  }

  let { data: record, error } = await db
    .from('club_attendance')
    .select('id')
    .eq('meeting_date', date)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (record) {
    const { error: updateError } = await db
      .from('club_attendance')
      .update({
        recorded_by: user.id,
        counted,
        updated_at: new Date().toISOString()
      })
      .eq('id', record.id)

    if (updateError) {
      throw updateError
    }
  } else {
    const { data: created, error: insertError } = await db
      .from('club_attendance')
      .insert({
        meeting_date: date,
        recorded_by: user.id,
        counted
      })
      .select('id')
      .single()

    if (insertError) {
      throw insertError
    }

    record = created
  }

  const { error: deleteError } = await db
    .from('club_attendance_members')
    .delete()
    .eq('attendance_id', record.id)

  if (deleteError) {
    throw deleteError
  }

  if (memberIds.length) {
    const rows = memberIds.map(
      member_id => ({
        attendance_id: record.id,
        member_id
      })
    )

    const { error: insertMembersError } = await db
      .from('club_attendance_members')
      .insert(rows)

    if (insertMembersError) {
      throw insertMembersError
    }
  }

  return record.id
}

function closeAttendancePanel() {
  const panel = $('#attendance-panel')

  if (!panel) {
    document.body.style.overflow = ''
    document.body.classList.remove('modal-open')

    document.removeEventListener(
      'keydown',
      attendanceEscapeHandler
    )

    return
  }

  panel.remove()

  document.body.style.overflow = ''
  document.body.classList.remove('modal-open')

  document.removeEventListener(
    'keydown',
    attendanceEscapeHandler
  )
}

function renderAttendancePanel(records) {
  const panel = $('#attendance-panel')

  if (!panel) {
    return
  }

  const currentDate =
    $('#attendance-date')?.value || ''

  const selectedRecord =
    records.find(
      record =>
        record.meeting_date === currentDate
    )

  const selectedIds =
    selectedRecord
      ? selectedRecord
        .club_attendance_members
        .map(
          item => item.member_id
        )
      : []

  const countedInput =
    $('#attendance-counted')

  if (countedInput) {
    countedInput.checked =
      selectedRecord?.counted === true
  }

  const memberList =
    $('#attendance-member-select')

  if (!memberList) {
    return
  }

  memberList.innerHTML =
    attendanceMembers
      .map(
        member => `
          <label class="attendance-member-option">
            <input
              type="checkbox"
              value="${esc(member.id)}"
              ${
                selectedIds.includes(
                  member.id
                )
                  ? 'checked'
                  : ''
              }
            >

            <span>
              ${esc(member.full_name)}
            </span>
          </label>
        `
      )
      .join('')

  const history =
    $('#attendance-personal-history')

  if (history) {
    const countedRecords =
      records.filter(
        record =>
          record.counted === true
      )

    history.innerHTML =
      countedRecords.length
        ? countedRecords
          .map(
            record => {
              const names =
                record
                  .club_attendance_members
                  .map(
                    item =>
                      item
                        .club_members
                        ?.full_name
                  )
                  .filter(Boolean)

              return `
                <button
                  type="button"
                  class="attendance-history-item"
                  data-attendance-date="${esc(
                    record.meeting_date
                  )}"
                >
                  <span>
                    ${esc(
                      attendanceDateText(
                        record.meeting_date
                      )
                    )}
                  </span>

                  <strong>
                    ${names.length} წევრი
                  </strong>
                </button>
              `
            }
          )
          .join('')
        : `
          <div class="empty-state compact-empty">
            ${icon('calendar-x')}

            <h3>
              შეკრებების ისტორია ცარიელია
            </h3>

            <p>
              ჩათვლილი შეხვედრები აქ გამოჩნდება.
            </p>
          </div>
        `

    history
      .querySelectorAll(
        '[data-attendance-date]'
      )
      .forEach(
        button => {
          button.addEventListener(
            'click',
            () => {
              const date =
                button.dataset
                  .attendanceDate

              const input =
                $('#attendance-date')

              if (input) {
                input.value = date
              }

              renderAttendancePanel(
                attendanceRecords
              )

              updateAttendanceSelectedCount()
            }
          )
        }
      )
  }

  refreshIcons()
}

async function openAttendancePanel() {
  const user = await getCurrentUser()
  if (!user) {
    toast('დასწრების აღრიცხვისთვის ანგარიშში შესვლა აუცილებელია.')
    return
  }
  const manager = await isAttendanceManager(user)
  if (!manager) {
    toast('დასწრების აღრიცხვაზე წვდომა არ გაქვთ.')
    return
  }
  closeAttendancePanel()
  const panel = document.createElement('div')
  panel.id = 'attendance-panel'
  panel.className = 'attendance-overlay'
  panel.hidden = false
  panel.style.position = 'fixed'
  panel.style.inset = '0'
  panel.style.zIndex = '999999'
  panel.style.display = 'flex'
  panel.style.alignItems = 'center'
  panel.style.justifyContent = 'center'
  panel.style.overflowY = 'auto'
  panel.style.padding = '20px'
  panel.style.background = 'rgba(0, 0, 0, 0.7)'
  panel.style.boxSizing = 'border-box'
  panel.innerHTML = `
    <div class="attendance-panel-backdrop" data-attendance-close style="
        position:absolute;
        inset:0;
        width:100%;
        height:100%;
    "></div>
    <section class="attendance-panel-content" role="dialog" aria-modal="true" aria-labelledby="attendance-panel-title" style="
        position:relative;
        z-index:2;
        width:min(900px,100%);
        max-height:90vh;
        overflow-y:auto;
        box-sizing:border-box;
    ">
      <div class="attendance-panel-header">
        <div>
          <p class="eyebrow">CLUB ATTENDANCE</p>
          <h2 id="attendance-panel-title">დასწრების აღრიცხვა</h2>
          <p>მონიშნე იმ შეხვედრაზე დამსწრე კლუბის წევრები.</p>
        </div>
        <button type="button" class="icon-button" id="attendance-close" aria-label="დახურვა">
          ${icon('x')}
        </button>
      </div>
      <div class="attendance-panel-body">
        <div class="attendance-date-box">
          <label>შეხვედრის თარიღი <input id="attendance-date" type="date"></label>
          <span id="attendance-record-status" class="attendance-record-status"></span>
        </div>
        <div class="attendance-select-box">
          <div class="attendance-subheading">
            <div>
              <h3>დამსწრე წევრები</h3>
              <p>მონიშნე ყველა, ვინც შეხვედრას დაესწრო.</p>
            </div>
            <span id="attendance-selected-count">0</span>
          </div>
          <div id="attendance-member-select" class="attendance-member-select"></div>
        </div>
        <p id="attendance-form-error" class="form-message" role="alert" aria-live="polite"></p>
        <div class="attendance-actions">
          <label class="attendance-count-toggle">
            <input type="checkbox" id="attendance-counted">
            <span class="attendance-count-toggle-box">${icon('check')}</span>
            <span>ჩათვლა</span>
          </label>
          <button type="button" class="button primary" id="save-attendance">
            ${icon('save')} დასწრების შენახვა
          </button>
          <button type="button" class="button ghost" id="attendance-cancel">გაუქმება</button>
        </div>
        <div class="attendance-history-box">
          <div class="attendance-subheading">
            <div>
              <h3>შეკრებების ისტორია</h3>
              <p>აქ გამოჩნდება მხოლოდ ჩათვლილი შეხვედრები.</p>
            </div>
          </div>
          <div id="attendance-personal-history" class="attendance-personal-history"></div>
        </div>
      </div>
    </section>
  `
  document.body.appendChild(panel)
  document.body.style.overflow = 'hidden'

  try {
    attendanceMembers = await getAttendanceMembers()
    attendanceRecords = await getAttendanceRecords()
    const dateInput = $('#attendance-date')
    if (dateInput) {
      const latest = attendanceRecords[0]
      dateInput.value =
        latest?.meeting_date || new Date().toISOString().slice(0, 10)
    }

    renderAttendancePanel(attendanceRecords)
    updateAttendanceSelectedCount()

    $('#attendance-close')?.addEventListener('click', closeAttendancePanel)
    $('#attendance-cancel')?.addEventListener('click', closeAttendancePanel)
    panel
      .querySelector('[data-attendance-close]')
      ?.addEventListener('click', closeAttendancePanel)

    $('#attendance-date')?.addEventListener('change', () => {
      renderAttendancePanel(attendanceRecords)
      updateAttendanceSelectedCount()
    })

    $('#attendance-member-select')?.addEventListener(
      'change',
      updateAttendanceSelectedCount
    )
    $('#save-attendance')?.addEventListener('click', saveAttendanceFromPanel)
    document.addEventListener('keydown', attendanceEscapeHandler)
    refreshIcons()
  } catch (error) {
    console.error('Attendance panel error:', error)
    const errorTarget = $('#attendance-form-error')
    if (errorTarget) {
      errorTarget.textContent =
        error?.message || 'დასწრების მონაცემების ჩატვირთვა ვერ მოხერხდა.'
    }
  }
}

// გლობალურად გახსნა - ფუნქციის გარეთ!
window.openAttendancePanel = openAttendancePanel;
function attendanceEscapeHandler(event) {
  if (
    event.key === 'Escape' &&
    $('#attendance-panel')
  ) {
    closeAttendancePanel()
  }
}

function updateAttendanceSelectedCount() {
  const checked =
    document.querySelectorAll(
      '#attendance-member-select input[type="checkbox"]:checked'
    )

  const counter =
    $('#attendance-selected-count')

  if (counter) {
    counter.textContent =
      String(checked.length)
  }
}

async function saveAttendanceFromPanel() {
  const date =
    $('#attendance-date')
      ?.value

  const errorTarget =
    $('#attendance-form-error')

  const button =
    $('#save-attendance')

  if (errorTarget) {
    errorTarget.textContent = ''
  }

  if (!date) {
    if (errorTarget) {
      errorTarget.textContent =
        'აირჩიე შეხვედრის თარიღი.'
    }

    return
  }

  const selected =
    Array.from(
      document.querySelectorAll(
        '#attendance-member-select input[type="checkbox"]:checked'
      )
    ).map(
      input => input.value
    )

  const counted =
    $('#attendance-counted')
      ?.checked === true

  setBusy(
    button,
    true,
    'ინახება...'
  )

  try {
    await saveAttendanceRecord(
      date,
      selected,
      counted
    )

    attendanceRecords =
      await getAttendanceRecords()

    renderAttendancePanel(
      attendanceRecords
    )

    updateAttendanceSelectedCount()

    toast(
      counted
        ? 'შეხვედრა ჩათვლილია და დასწრება შენახულია.'
        : 'დასწრება შენახულია.'
      ,
      'success'
    )
  } catch (error) {
    console.error(
      'Attendance save error:',
      error
    )

    if (errorTarget) {
      errorTarget.textContent =
        error?.message ||
        'დასწრების შენახვა ვერ მოხერხდა.'
    }
  } finally {
    setBusy(
      button,
      false
    )
  }
}

async function loadAdminAttendance() {
  const status =
    $('#attendance-admin-status')

  const memberList =
    $('#attendance-member-list')

  const historyList =
    $('#attendance-history-list')

  const totalMeetings =
    $('#attendance-total-meetings')

  const totalMembers =
    $('#attendance-total-members')

  if (
    !status &&
    !memberList &&
    !historyList
  ) {
    return
  }

  if (!db) {
    if (status) {
      status.textContent =
        'Supabase არ არის კონფიგურირებული'
    }

    return
  }

  try {
    const [members, records] =
      await Promise.all([
        getAttendanceMembers(),
        getAttendanceRecords()
      ])

    attendanceMembers =
      members

    attendanceRecords =
      records

    const countedRecords =
      records.filter(
        record =>
          record.counted === true
      )

    if (status) {
      status.textContent =
        'განახლებულია'
    }

    if (totalMeetings) {
      totalMeetings.textContent =
        String(
          countedRecords.length
        )
    }

    if (totalMembers) {
      totalMembers.textContent =
        String(
          members.length
        )
    }

    const counts =
      new Map()

    members.forEach(
      member => {
        counts.set(
          member.id,
          0
        )
      }
    )

    countedRecords.forEach(
      record => {
        record
          .club_attendance_members
          .forEach(
            item => {
              counts.set(
                item.member_id,
                (
                  counts.get(
                    item.member_id
                  ) || 0
                ) + 1
              )
            }
          )
      }
    )

    if (memberList) {
      memberList.innerHTML =
        members.length
          ? members
            .map(
              member => {
                const count =
                  counts.get(
                    member.id
                  ) || 0

                const percent =
                  countedRecords.length
                    ? Math.round(
                        count /
                        countedRecords.length *
                        100
                      )
                    : 0

                return `
                  <div class="attendance-admin-member">

                    <div>
                      <strong>
                        ${esc(
                          member.full_name
                        )}
                      </strong>

                      <span>
                        ${count} შეხვედრა
                      </span>
                    </div>

                    <div class="attendance-admin-member-value">

                      <strong>
                        ${percent}%
                      </strong>

                      <small>
                        დასწრება
                      </small>

                    </div>

                  </div>
                `
              }
            )
            .join('')
          : `
            <div class="empty-state compact-empty">
              ${icon('users-round')}

              <h3>
                წევრები ვერ მოიძებნა
              </h3>

              <p>
                კლუბის წევრების სია ცარიელია.
              </p>
            </div>
          `
    }

    if (historyList) {
      historyList.innerHTML =
        countedRecords.length
          ? countedRecords
            .map(
              record => {
                const names =
                  record
                    .club_attendance_members
                    .map(
                      item =>
                        item
                          .club_members
                          ?.full_name
                    )
                    .filter(Boolean)

                return `
                  <article class="attendance-admin-record">

                    <div class="attendance-admin-record-header">

                      <div>
                        <span>
                          შეხვედრა
                        </span>

                        <strong>
                          ${esc(
                            attendanceDateText(
                              record.meeting_date
                            )
                          )}
                        </strong>
                      </div>

                      <span class="attendance-admin-badge">
                        ${names.length} დამსწრე
                      </span>

                    </div>

                    <div class="attendance-admin-names">

                      ${
                        names.length
                          ? names
                            .map(
                              name => `
                                <span>
                                  ${icon('check')}
                                  ${esc(name)}
                                </span>
                              `
                            )
                            .join('')
                          : `
                            <span class="attendance-no-members">
                              არავინ იყო მონიშნული
                            </span>
                          `
                      }

                    </div>

                  </article>
                `
              }
            )
            .join('')
          : `
            <div class="empty-state compact-empty">
              ${icon('calendar-x')}

              <h3>
                დასწრების ისტორია ცარიელია
              </h3>

              <p>
                ჩათვლილი შეხვედრები აქ გამოჩნდება.
              </p>

            </div>
          `
    }

    refreshIcons()
  } catch (error) {
    console.error(
      'Admin attendance error:',
      error
    )

    if (status) {
      status.textContent =
        'ჩატვირთვა ვერ მოხერხდა'
    }

    if (memberList) {
      memberList.innerHTML = `
        <div class="empty-state compact-empty">

          ${icon('triangle-alert')}

          <h3>
            დასწრების მონაცემები ვერ ჩაიტვირთა
          </h3>

          <p>
            ${esc(
              error?.message ||
              'სცადეთ ხელახლა.'
            )}
          </p>

        </div>
      `
    }

    refreshIcons()
  }
}

let authUIUpdating = false
let authUIQueued = false
let authUIListenerStarted = false

function findLoginElement() {
  const elements =
    Array.from(
      document.querySelectorAll(
        'a[href], button'
      )
    )

  return (
    elements.find(
      element => {
        if (
          element.closest(
            '.account-menu'
          )
        ) {
          return false
        }

        const href =
          element.getAttribute(
            'href'
          ) || ''

        const text =
          element.textContent
            .trim()
            .toLowerCase()

        return (
          href ===
            'admin.html' ||
          href.endsWith(
            '/admin.html'
          ) ||
          text ===
            'log in' ||
          text ===
            'login' ||
          text ===
            'ადმინისტრატორი'
        )
      }
    ) || null
  )
}

function closeAllAccountMenus(
  except = null
) {
  document
    .querySelectorAll(
      '.account-menu'
    )
    .forEach(
      menu => {
        if (
          menu !== except
        ) {
          menu.remove()
        }
      }
    )
}

function createAccountMenu(
  user
) {
  const name =
    getUserDisplayName(
      user
    )

  const isMaria =
    user?.id ===
    MARIA_USER_ID

  const wrapper =
    document.createElement(
      'div'
    )

  wrapper.className =
    'account-menu'

  wrapper.innerHTML = `
    <button
      type="button"
      class="account-button"
      aria-expanded="false"
    >
      ${icon('user-round')}

      <span class="account-name">
        ${esc(name)}
      </span>

      ${icon('chevron-down')}
    </button>

    <div
      class="account-dropdown"
      hidden
    >
      <div class="account-dropdown-name">
        ${icon('user-round')}

        <span>
          ${esc(name)}
        </span>
      </div>

      ${
        isMaria
          ? `
            <button
              type="button"
              class="account-attendance"
            >
              ${icon('clipboard-check')}
              დასწრების აღრიცხვა
            </button>
          `
          : ''
      }

      <button
        type="button"
        class="account-logout"
      >
        ${icon('log-out')}
        გამოსვლა
      </button>
    </div>
  `

  const button =
    wrapper.querySelector(
      '.account-button'
    )

  const dropdown =
    wrapper.querySelector(
      '.account-dropdown'
    )

  const attendanceButton =
    wrapper.querySelector(
      '.account-attendance'
    )

  const logoutButton =
    wrapper.querySelector(
      '.account-logout'
    )

  button?.addEventListener(
    'click',
    event => {
      event.stopPropagation()

      const shouldOpen =
        dropdown.hidden

      document
        .querySelectorAll(
          '.account-dropdown'
        )
        .forEach(
          item => {
            item.hidden = true
          }
        )

      document
        .querySelectorAll(
          '.account-button'
        )
        .forEach(
          item => {
            item.setAttribute(
              'aria-expanded',
              'false'
            )
          }
        )

      dropdown.hidden =
        !shouldOpen

      button.setAttribute(
        'aria-expanded',
        String(
          shouldOpen
        )
      )
    }
  )

  attendanceButton?.addEventListener(
    'click',
    async event => {
      event.stopPropagation()

      dropdown.hidden = true

      button.setAttribute(
        'aria-expanded',
        'false'
      )

      await openAttendancePanel()
    }
  )

  logoutButton?.addEventListener(
    'click',
    async event => {
      event.stopPropagation()

      logoutButton.disabled =
        true

      logoutButton.innerHTML = `
        ${icon('loader-circle')}
        გამოდის...
      `

      refreshIcons()

      await logout()
    }
  )

  return wrapper
}

async function updateAuthUI() {
  if (!db) {
    return
  }

  if (authUIUpdating) {
    authUIQueued = true
    return
  }

  authUIUpdating = true

  try {
    const user =
      await getCurrentUser()

    const existingMenus =
      Array.from(
        document.querySelectorAll(
          '.account-menu'
        )
      )

    const loginElement =
      findLoginElement()

    if (!user) {
      existingMenus
        .forEach(
          menu =>
            menu.remove()
        )

      if (loginElement) {
        loginElement.hidden =
          false
      }

      return
    }

    const admin =
      await isAdmin(user)

    if (admin) {
      existingMenus
        .forEach(
          menu =>
            menu.remove()
        )

      if (loginElement) {
        loginElement.hidden =
          false
      }

      return
    }

    if (!loginElement) {
      if (
        existingMenus.length >
        1
      ) {
        existingMenus
          .slice(1)
          .forEach(
            menu =>
              menu.remove()
          )
      }

      return
    }

    const currentMenu =
      existingMenus[0]

    if (currentMenu) {
      existingMenus
        .slice(1)
        .forEach(
          menu =>
            menu.remove()
        )

      loginElement.hidden =
        true

      return
    }

    closeAllAccountMenus()

    const menu =
      createAccountMenu(
        user
      )

    loginElement.hidden =
      true

    loginElement.parentElement
      ?.appendChild(
        menu
      )

    refreshIcons()
  } finally {
    authUIUpdating =
      false

    if (authUIQueued) {
      authUIQueued =
        false

      setTimeout(
        () =>
          updateAuthUI(),
        0
      )
    }
  }
}

function queueAuthUIUpdate() {
  if (authUIQueued) {
    return
  }

  authUIQueued = true

  setTimeout(
    async () => {
      authUIQueued =
        false

      await updateAuthUI()
    },
    0
  )
}

async function initAuthUI() {
  if (!db) {
    return
  }

  await updateAuthUI()

  if (
    authUIListenerStarted
  ) {
    return
  }

  authUIListenerStarted =
    true

  db.auth.onAuthStateChange(
    (
      _event,
      session
    ) => {
      if (session?.user) {
        detectAIAdmin()
      } else {
        aiAdminGreeting = ''
      }

      queueAuthUIUpdate()
    }
  )
}

initChrome()

if (
  page === 'home'
) {
  initMeetingPublic()
  initAIChat()
}

if (
  page === 'projects'
) {
  initProjects()
}

if (
  page === 'detail'
) {
  initDetail()
}

if (
  page === 'admin'
) {
  initAdmin()
}

if (
  page === 'reset'
) {
  initPasswordReset()
}

initAuthUI()
document.addEventListener('DOMContentLoaded', () => {
    const meetingBtn = document.getElementById('meeting-button');
    if (meetingBtn) {
        meetingBtn.addEventListener('click', () => {
            openAttendancePanel();
        });
    }
});
// ერთიანი ფუნქცია შეხვედრის შენახვისა და ფუშ-შეტყობინების გასაგზავნად
async function saveMeetingAndNotify(meetingTitle, meetingDesc) {
  try {
    // 1. ვინახავთ შეხვედრას (თუ გაქვს ძველი ლოგიკა, აქ შეგიძლია ჩასვა)
    console.log("შეხვედრა ინახება:", meetingTitle);

    // 2. ვგზავნით OneSignal ფუშ-შეტყობინებას პროქსის გავლით (CORS-ის ასავლელად)
    const response = await fetch("https://api.allorigins.win/raw?url=" + encodeURIComponent("https://onesignal.com/api/v1/notifications"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": "Basic os_v2_app_d4psobll6rhhpg3ec66v3ae6yqagkpebweheqwnabdw4hmhlrijhncsfbiboyqyzefj5p2itv4zaujrlxccbpsaan7cegyawzjesvva"
      },
      body: JSON.stringify({
        app_id: "შენი_onesignal_app_id", // აქ ჩაწერე შენი OneSignal აპის აიდი
        included_segments: ["All"],
        contents: { en: `ახალი შეხვედრა: ${meetingTitle}` },
        headings: { en: "Arduino Hub" }
      })
    });

    const data = await response.json();
    console.log("შეტყობინება გაიგზავნა:", data);
  } catch (error) {
    console.error("შეცდომა შეტყობინების გაგზავნისას:", error);
  }
}
