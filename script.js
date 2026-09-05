import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    supabaseIsConfigured
} from './supabase-config.js';

import {
    createClient
} from 'https://esm.sh/@supabase/supabase-js@2';


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
    : null;


const page = document.body.dataset.page;


const $ = (s, root = document) =>
    root.querySelector(s);


const esc = (value = '') =>
    String(value).replace(
        /[&<>'"]/g,
        c => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[c])
    );


const icon = name =>
    `<i data-lucide="${name}"></i>`;


function refreshIcons() {
    window.lucide?.createIcons();
}


function toast(message, type = '') {

    const el = $('#toast');

    if (!el) return;

    el.textContent = message;

    el.className =
        `toast show ${type}`;

    clearTimeout(toast.timer);

    toast.timer = setTimeout(
        () => {
            el.className = 'toast';
        },
        3200
    );
}


function dateText(value) {

    return new Intl.DateTimeFormat(
        'ka-GE',
        {
            dateStyle: 'medium'
        }
    ).format(
        new Date(value)
    );
}


function neutralError(
    error,
    fallback = 'მოქმედება ვერ შესრულდა. სცადეთ ხელახლა.'
) {

    console.error(error);

    return fallback;
}


function configuredMessage(target) {

    if (!target) return;

    target.innerHTML = `
        <div class="empty-state">

            ${icon('settings')}

            <h2>
                Supabase ჯერ არ არის კონფიგურირებული
            </h2>

            <p>
                დაამატეთ პროექტის URL და anon key
                <code>supabase-config.js</code>-ში,
                შემდეგ გაუშვით schema SQL.
            </p>

        </div>
    `;

    refreshIcons();
}


function initChrome() {

    document
        .querySelectorAll('[data-year]')
        .forEach(
            el => {
                el.textContent =
                    new Date().getFullYear();
            }
        );


    const button =
        $('.menu-toggle');


    if (button) {

        button.addEventListener(
            'click',
            () => {

                const nav =
                    $('nav');

                if (!nav) return;

                const open =
                    nav.classList.toggle('open');

                button.setAttribute(
                    'aria-expanded',
                    open
                );
            }
        );
    }


    refreshIcons();
}


/* =========================================================
   ARDUINOHUB PREDEFINED CHAT
   NO AI / NO API / NO BACKEND
========================================================= */

const AI_PRESET_ANSWERS = {

    'როდის შეიქმნა ArduinoHub?': `
        <p>
            ArduinoHub შეიქმნა როგორც Arduino-სა და ქიმიის
            პროექტების ერთ სივრცეში თავმოყრისა და გაზიარების პლატფორმა.
        </p>

        <p>
            ზუსტი შექმნის თარიღი შეგიძლიათ მიუთითოთ ArduinoHub-ის
            ოფიციალურ ინფორმაციაში.
        </p>
    `,


    'რა არის ArduinoHub-ის მიზანი?': `
        <p>
            <strong>ArduinoHub-ის მიზანია</strong> Arduino-ს,
            ელექტრონიკისა და ქიმიის შესახებ ცოდნის მარტივად,
            გასაგებად და საინტერესო ფორმით გაზიარება.
        </p>

        <p>
            საიტი მომხმარებლებს საშუალებას აძლევს გაეცნონ
            სხვადასხვა პროექტს, ექსპერიმენტს და პრაქტიკულ იდეას.
        </p>
    `,


    'რა პროექტებია საიტზე?': `
        <p>
            ArduinoHub-ზე განთავსებულია სხვადასხვა პრაქტიკული
            პროექტი, რომლებიც დაკავშირებულია Arduino-სთან,
            ელექტრონიკასთან, სენსორებთან, ავტომატიზაციასთან
            და ქიმიის ექსპერიმენტებთან.
        </p>

        <p>
            პროექტების სრული სიის სანახავად გადადით
            <strong>პროექტების</strong> გვერდზე.
        </p>
    `,


    'ვინ შექმნა ArduinoHub?': `
        <p>
            ArduinoHub-ის შემქმნელის ზუსტი სახელი უნდა იყოს
            მითითებული საიტის ოფიციალურ ინფორმაციაში.
        </p>

        <p>
            ამ პასუხში სახელს შეგნებულად არ ვიგონებ, რათა
            საიტზე არ გამოჩნდეს არასწორი ინფორმაცია.
        </p>
    `

};


function addAIMessage(
    type,
    content
) {

    const messages =
        $('#ai-chat-messages');


    if (!messages) return null;


    const message =
        document.createElement('div');


    message.className =
        `ai-message ${type}`;


    if (type === 'assistant') {

        message.innerHTML = `
            <div class="ai-message-avatar">
                ${icon('bot')}
            </div>

            <div class="ai-message-bubble">
                ${content}
            </div>
        `;

    } else {

        message.innerHTML = `
            <div class="ai-message-bubble">
                ${esc(content)}
            </div>
        `;
    }


    messages.appendChild(
        message
    );


    refreshIcons();


    messages.scrollTo({
        top: messages.scrollHeight,
        behavior: 'smooth'
    });


    return message;
}


function answerAIPresetQuestion(
    question
) {

    const answer =
        AI_PRESET_ANSWERS[question];


    if (!answer) {

        addAIMessage(
            'assistant',
            `
                <p>
                    ამ კითხვაზე პასუხი ჯერ არ არის დამატებული.
                </p>
            `
        );

        return;
    }


    setTimeout(
        () => {

            addAIMessage(
                'assistant',
                answer
            );

        },
        180
    );
}


function openAIChat() {

    const chat =
        $('#ai-chat');


    const toggle =
        $('#ai-chat-toggle');


    const windowEl =
        $('#ai-chat-window');


    if (
        !chat ||
        !toggle
    ) {
        return;
    }


    chat.classList.add(
        'open'
    );


    toggle.setAttribute(
        'aria-expanded',
        'true'
    );


    windowEl?.setAttribute(
        'aria-hidden',
        'false'
    );


    setTimeout(
        () => {
            $('#ai-chat-input')?.focus();
        },
        220
    );
}


function closeAIChat() {

    const chat =
        $('#ai-chat');


    const toggle =
        $('#ai-chat-toggle');


    const windowEl =
        $('#ai-chat-window');


    if (
        !chat ||
        !toggle
    ) {
        return;
    }


    chat.classList.remove(
        'open'
    );


    toggle.setAttribute(
        'aria-expanded',
        'false'
    );


    windowEl?.setAttribute(
        'aria-hidden',
        'true'
    );
}


function initAIChat() {

    const chat =
        $('#ai-chat');


    if (!chat) return;


    const toggle =
        $('#ai-chat-toggle');


    const close =
        $('#ai-chat-close');


    const form =
        $('#ai-chat-form');


    const input =
        $('#ai-chat-input');


    if (toggle) {

        toggle.addEventListener(
            'click',
            () => {

                if (
                    chat.classList.contains(
                        'open'
                    )
                ) {

                    closeAIChat();

                } else {

                    openAIChat();
                }
            }
        );
    }


    close?.addEventListener(
        'click',
        closeAIChat
    );


    chat
        .querySelectorAll(
            '.ai-suggestion'
        )
        .forEach(
            button => {

                button.addEventListener(
                    'click',
                    () => {

                        const question =
                            button.dataset.aiQuestion;


                        if (!question) {
                            return;
                        }


                        addAIMessage(
                            'user',
                            question
                        );


                        if (input) {
                            input.value =
                                '';
                        }


                        answerAIPresetQuestion(
                            question
                        );
                    }
                );
            }
        );


    form?.addEventListener(
        'submit',
        event => {

            event.preventDefault();


            const question =
                input?.value
                    ?.trim();


            if (!question) {
                return;
            }


            const preset =
                AI_PRESET_ANSWERS[
                    question
                ];


            if (!preset) {

                addAIMessage(
                    'user',
                    question
                );


                input.value =
                    '';


                setTimeout(
                    () => {

                        addAIMessage(
                            'assistant',
                            `
                                <p>
                                    ამ ეტაპზე ArduinoHub AI-ში
                                    მხოლოდ წინასწარ მომზადებული კითხვებია
                                    ხელმისაწვდომი.
                                </p>

                                <p>
                                    აირჩიეთ ერთ-ერთი შემოთავაზებული
                                    კითხვა ზემოთ.
                                </p>
                            `
                        );

                    },
                    180
                );


                return;
            }


            addAIMessage(
                'user',
                question
            );


            input.value =
                '';


            answerAIPresetQuestion(
                question
            );
        }
    );


    document.addEventListener(
        'keydown',
        event => {

            if (
                event.key === 'Escape' &&
                chat.classList.contains('open')
            ) {

                closeAIChat();
            }
        }
    );
}


/* =========================================================
   PROJECT CARD
========================================================= */

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
            `;


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
    `;
}


/* =========================================================
   PROJECTS PAGE
========================================================= */

async function initProjects() {

    const status =
        $('#projects-status');

    const grid =
        $('#projects-grid');


    if (!db) {
        return configuredMessage(status);
    }


    const {
        data,
        error
    } = await db
        .from('projects')
        .select(
            'id,title,description,category,author,image_url,created_at'
        )
        .eq('published', true)
        .order(
            'created_at',
            {
                ascending: false
            }
        )
        .limit(60);


    if (error) {

        status.textContent =
            neutralError(
                error,
                'პროექტების ჩატვირთვა ვერ მოხერხდა.'
            );

        return;
    }


    status.remove();


    const render = () => {

        const q =
            $('#project-search')
                .value
                .trim()
                .toLocaleLowerCase('ka');


        const category =
            $('#category-filter').value;


        const result =
            data.filter(
                p =>
                    (!category ||
                        p.category === category) &&

                    (
                        !q ||

                        `${p.title} ${p.description} ${p.author}`
                            .toLocaleLowerCase('ka')
                            .includes(q)
                    )
            );


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
                `;


        refreshIcons();
    };


    $('#project-search')
        .addEventListener(
            'input',
            render
        );


    $('#category-filter')
        .addEventListener(
            'change',
            render
        );


    render();
}


/* =========================================================
   DETAIL PAGE
========================================================= */

async function initDetail() {

    const target =
        $('#project-detail');


    if (!db) {
        return configuredMessage(target);
    }


    const id =
        new URLSearchParams(
            location.search
        ).get('id');


    if (
        !id ||
        !/^[0-9a-f-]{36}$/i.test(id)
    ) {

        return notFound(target);
    }


    const {
        data: p,
        error
    } = await db
        .from('projects')
        .select('*')
        .eq('id', id)
        .eq('published', true)
        .maybeSingle();


    if (error || !p) {
        return notFound(target);
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

            : '';


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

            : '';


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

            : '';


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

            : '';


    /* =====================================================
       CATEGORY-BASED CODE / CHEMISTRY SECTION
    ===================================================== */

    let code = '';


    if (
        p.code &&
        p.code.trim()
    ) {

        const isChemistry =
            String(p.category)
                .toLowerCase() === 'chemistry';


        const sectionTitle =
            isChemistry
                ? 'ქიმიური რეაქცია'
                : 'Arduino Code';


        const copyText =
            isChemistry
                ? 'ტექსტის დაკოპირება'
                : 'კოდის დაკოპირება';


        const sectionIcon =
            isChemistry
                ? 'flask-conical'
                : 'braces';


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
                    <code id="arduino-code">${esc(p.code)}</code>
                </pre>

            </section>
        `;
    }


    target.className = '';


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
    `;


    /* =====================================================
       COPY BUTTON
    ===================================================== */

    $('#copy-code')?.addEventListener(
        'click',
        async () => {

            try {

                await navigator.clipboard.writeText(
                    p.code
                );


                const isChemistry =
                    String(p.category)
                        .toLowerCase() === 'chemistry';


                toast(
                    isChemistry
                        ? 'ქიმიური რეაქცია დაკოპირდა'
                        : 'კოდი დაკოპირდა',
                    'success'
                );

            } catch {

                toast(
                    'დაკოპირება ვერ მოხერხდა.'
                );
            }
        }
    );


    refreshIcons();
}


/* =========================================================
   NOT FOUND
========================================================= */

function notFound(target) {

    if (!target) return;

    target.className = '';


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
    `;


    refreshIcons();
}


/* =========================================================
   FILE TYPES
========================================================= */

const IMAGE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
];


const VIDEO_TYPES = [
    'video/mp4',
    'video/webm',
    'video/ogg'
];


function fileOkay(
    file,
    types,
    max,
    label
) {

    if (!file) return true;


    if (!types.includes(file.type)) {

        toast(
            `${label}: ფაილის ტიპი მიუღებელია.`
        );

        return false;
    }


    if (file.size > max) {

        toast(
            `${label}: ფაილი ზედმეტად დიდია.`
        );

        return false;
    }


    return true;
}


/* =========================================================
   ADMIN
========================================================= */

async function isAdmin(user) {

    if (!user || !db) return null;


    const {
        data,
        error
    } = await db
        .from('admin_users')
        .select('username')
        .eq('user_id', user.id)
        .maybeSingle();


    if (error || !data) {
        return null;
    }


    return data;
}


/* =========================================================
   ADMIN INITIALIZATION
========================================================= */

async function initAdmin() {

    if (!db) {

        $('#auth-panel')
            .querySelector('form')
            .hidden = true;


        $('#login-error').textContent =
            'Supabase ჯერ არ არის კონფიგურირებული.';


        return;
    }


    const {
        data: { session }
    } = await db.auth.getSession();


    if (session) {

        await showDashboard(
            session.user
        );
    }


    $('#login-form')
        .addEventListener(
            'submit',
            login
        );


    $('#logout-button')
        ?.addEventListener(
            'click',
            logout
        );


    $('#new-project-button')
        ?.addEventListener(
            'click',
            () => openEditor()
        );


    $('#cancel-edit')
        ?.addEventListener(
            'click',
            closeEditor
        );


    $('#project-form')
        ?.addEventListener(
            'submit',
            saveProject
        );


    $('#image-file')
        ?.addEventListener(
            'change',
            imagePreview
        );


    $('#video-file')
        ?.addEventListener(
            'change',
            () => {

                $('#video-name').textContent =
                    $('#video-file')
                        .files[0]
                        ?.name ||
                    'ფაილი არჩეული არ არის';

            }
        );


    /* =====================================================
       CATEGORY LABEL UPDATE
    ===================================================== */

    const categorySelect =
        $('#category');


    if (categorySelect) {

        categorySelect.addEventListener(
            'change',
            updateCodeFieldLabel
        );


        updateCodeFieldLabel();
    }


    /* =====================================================
       CLUB MEETING
    ===================================================== */

    bindMeetingForm();


    db.auth.onAuthStateChange(
        (_event, session) => {

            if (!session) {
                showLogin();
            }

        }
    );
}


/* =========================================================
   UPDATE CODE FIELD LABEL
========================================================= */

function updateCodeFieldLabel() {

    const category =
        $('#category');


    const codeInput =
        $('#code');


    if (
        !category ||
        !codeInput
    ) {
        return;
    }


    const label =
        codeInput.closest('label');


    if (!label) {
        return;
    }


    const isChemistry =
        String(category.value)
            .toLowerCase() === 'chemistry';


    const textNodes =
        Array.from(
            label.childNodes
        ).filter(
            node =>
                node.nodeType === Node.TEXT_NODE
        );


    const titleNode =
        textNodes.find(
            node =>
                node.textContent.trim()
        );


    if (titleNode) {

        titleNode.textContent =
            isChemistry
                ? '\n                            ქიმიური რეაქცია\n\n                            '
                : '\n                            Arduino Code\n\n                            ';
    }


    if (isChemistry) {

        codeInput.placeholder =
            'მაგ.: რეაქციის ფორმულა, ქიმიური განტოლება ან რეაქციის აღწერა...';

    } else {

        codeInput.placeholder =
            'ჩასვით Arduino კოდი აქ...';
    }
}


/* =========================================================
   LOGIN
========================================================= */

async function login(event) {

    event.preventDefault();


    const form =
        event.currentTarget;


    const button =
        form.querySelector('button');


    $('#login-error').textContent =
        '';


    setBusy(
        button,
        true,
        'იტვირთება...'
    );


    const {
        data,
        error
    } = await db.auth.signInWithPassword({
        email:
            $('#login-email')
                .value
                .trim(),

        password:
            $('#login-password').value
    });


    if (
        error ||
        !data.user
    ) {

        $('#login-error').textContent =
            'მონაცემები არასწორია';


        setBusy(
            button,
            false
        );


        return;
    }


    const admin =
        await isAdmin(
            data.user
        );


    if (!admin) {

        await db.auth.signOut();


        $('#login-error').textContent =
            'ამ ანგარიშს ადმინისტრატორის წვდომა არ აქვს.';


        setBusy(
            button,
            false
        );


        return;
    }


    await showDashboard(
        data.user,
        admin
    );
}


/* =========================================================
   DASHBOARD
========================================================= */

async function showDashboard(
    user,
    knownAdmin
) {

    const admin =
        knownAdmin ||
        await isAdmin(user);


    if (!admin) {

        if (user) {
            await db.auth.signOut();
        }


        return showLogin();
    }


    $('#auth-panel').hidden =
        true;


    $('#dashboard').hidden =
        false;


    $('#admin-name').textContent =
        admin.username;


    refreshIcons();


    await Promise.all([
        loadAdminProjects(),
        loadAdminMeeting()
    ]);
}


/* =========================================================
   SHOW LOGIN
========================================================= */

function showLogin() {

    $('#dashboard').hidden =
        true;


    $('#auth-panel').hidden =
        false;


    closeEditor();
}


/* =========================================================
   LOGOUT
========================================================= */

async function logout() {

    await db.auth.signOut();


    toast(
        'თქვენ გამოხვედით ანგარიშიდან.'
    );
}


/* =========================================================
   BUSY BUTTON
========================================================= */

function setBusy(
    button,
    busy,
    text
) {

    if (!button) return;


    button.disabled =
        busy;


    if (busy) {

        button.dataset.label =
            button.innerHTML;


        button.textContent =
            text;

    } else if (
        button.dataset.label
    ) {

        button.innerHTML =
            button.dataset.label;
    }


    refreshIcons();
}


/* =========================================================
   ADMIN PROJECTS
========================================================= */

let adminProjects = [];


async function loadAdminProjects() {

    const status =
        $('#admin-status');


    const list =
        $('#admin-project-list');


    if (!status || !list) return;


    status.hidden =
        false;


    list.innerHTML =
        '';


    const {
        data,
        error
    } = await db
        .from('projects')
        .select(
            'id,title,category,published,created_at,author,image_url,video_url,description,components,how_it_was_made,code'
        )
        .order(
            'created_at',
            {
                ascending: false
            }
        );


    if (error) {

        status.textContent =
            neutralError(
                error,
                'პროექტების ჩატვირთვა ვერ მოხერხდა.'
            );

        return;
    }


    adminProjects =
        data || [];


    status.hidden =
        true;


    $('#admin-count').textContent =
        `${adminProjects.length} პროექტი`;


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
            `;


    list
        .querySelectorAll('.edit')
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
        );


    list
        .querySelectorAll('.toggle')
        .forEach(
            b =>
                b.addEventListener(
                    'click',
                    () =>
                        togglePublished(
                            b.dataset.id
                        )
                )
        );


    list
        .querySelectorAll('.delete')
        .forEach(
            b =>
                b.addEventListener(
                    'click',
                    () =>
                        deleteProject(
                            b.dataset.id
                        )
                )
        );


    refreshIcons();
}


/* =========================================================
   OPEN EDITOR
========================================================= */

function openEditor(p) {

    const form =
        $('#project-form');


    form.reset();


    $('#image-preview').hidden =
        true;


    $('#image-name').textContent =
        'ფაილი არჩეული არ არის';


    $('#video-name').textContent =
        'ფაილი არჩეული არ არის';


    $('#form-error').textContent =
        '';


    $('#editor-title').textContent =
        p
            ? 'პროექტის რედაქტირება'
            : 'ახალი პროექტი';


    $('#save-project').innerHTML =
        p

            ? `ცვლილებების შენახვა ${icon('save')}`

            : `პროექტის დამატება ${icon('save')}`;


    if (p) {

        $('#edit-id').value =
            p.id;


        $('#title').value =
            p.title;


        $('#category').value =
            p.category;


        $('#author').value =
            p.author;


        $('#published').checked =
            p.published;


        $('#description').value =
            p.description;


        $('#components').value =
            p.components || '';


        $('#how-made').value =
            p.how_it_was_made || '';


        $('#code').value =
            p.code || '';
    }


    updateCodeFieldLabel();


    $('#project-editor').hidden =
        false;


    $('#project-editor').scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });


    refreshIcons();
}


/* =========================================================
   CLOSE EDITOR
========================================================= */

function closeEditor() {

    const editor =
        $('#project-editor');


    if (editor) {
        editor.hidden =
            true;
    }
}


/* =========================================================
   IMAGE PREVIEW
========================================================= */

function imagePreview() {

    const file =
        $('#image-file').files[0];


    $('#image-name').textContent =
        file?.name ||
        'ფაილი არჩეული არ არის';


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
            $('#image-preview');


        preview.src =
            URL.createObjectURL(file);


        preview.hidden =
            false;
    }
}


/* =========================================================
   UPLOAD
========================================================= */

async function upload(
    file,
    bucket,
    folder,
    types,
    max,
    label
) {

    if (!file) return null;


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
        );
    }


    const clean =
        file.name.replace(
            /[^a-zA-Z0-9._-]/g,
            '_'
        );


    const path =
        `${folder}/${crypto.randomUUID()}-${clean}`;


    const {
        error
    } = await db.storage
        .from(bucket)
        .upload(
            path,
            file,
            {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type
            }
        );


    if (error) {
        throw error;
    }


    const {
        data
    } = db.storage
        .from(bucket)
        .getPublicUrl(path);


    return {
        url: data.publicUrl,
        path
    };
}


/* =========================================================
   STORAGE PATH
========================================================= */

function storagePath(
    url,
    bucket
) {

    try {

        const marker =
            `/storage/v1/object/public/${bucket}/`;


        const index =
            url?.indexOf(marker);


        return index >= 0

            ? decodeURIComponent(
                url.slice(
                    index +
                    marker.length
                )
            )

            : null;

    } catch {

        return null;
    }
}


/* =========================================================
   REMOVE STORED FILE
========================================================= */

async function removeStored(
    url,
    bucket
) {

    const path =
        storagePath(
            url,
            bucket
        );


    if (path) {

        const {
            error
        } = await db.storage
            .from(bucket)
            .remove([path]);


        if (error) {

            console.warn(
                'Storage cleanup failed',
                error
            );
        }
    }
}


/* =========================================================
   SAVE PROJECT
========================================================= */

async function saveProject(event) {

    event.preventDefault();


    const button =
        $('#save-project');


    const id =
        $('#edit-id').value;


    const old =
        adminProjects.find(
            p =>
                p.id === id
        );


    const image =
        $('#image-file').files[0];


    const video =
        $('#video-file').files[0];


    $('#form-error').textContent =
        '';


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
        return;
    }


    setBusy(
        button,
        true,
        'ინახება...'
    );


    let uploads = [];


    try {

        const folder =
            id ||
            crypto.randomUUID();


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
            ]);
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
            ]);
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
        };


        const img =
            uploads.find(
                x =>
                    x[0] === 'image'
            )?.[1];


        const vid =
            uploads.find(
                x =>
                    x[0] === 'video'
            )?.[1];


        if (img) {

            value.image_url =
                img.url;
        }


        if (vid) {

            value.video_url =
                vid.url;
        }


        let error;


        if (id) {

            ({
                error
            } = await db
                .from('projects')
                .update(value)
                .eq('id', id));

        } else {

            ({
                error
            } = await db
                .from('projects')
                .insert(value));
        }


        if (error) {
            throw error;
        }


        if (
            img &&
            old?.image_url
        ) {

            await removeStored(
                old.image_url,
                'project-images'
            );
        }


        if (
            vid &&
            old?.video_url
        ) {

            await removeStored(
                old.video_url,
                'project-videos'
            );
        }


        toast(
            id
                ? 'ცვლილებები შენახულია.'
                : 'პროექტი დაემატა.',
            'success'
        );


        closeEditor();


        await loadAdminProjects();


    } catch (error) {

        console.error(error);


        for (
            const [kind, file]
            of uploads
        ) {

            if (!file?.url) continue;


            await removeStored(
                file.url,

                kind === 'image'
                    ? 'project-images'
                    : 'project-videos'
            );
        }


        $('#form-error').textContent =
            neutralError(
                error,
                'პროექტის შენახვა ვერ მოხერხდა.'
            );

    } finally {

        setBusy(
            button,
            false
        );
    }
}


/* =========================================================
   PUBLISH / HIDE
========================================================= */

async function togglePublished(id) {

    const p =
        adminProjects.find(
            x =>
                x.id === id
        );


    if (!p) return;


    const {
        error
    } = await db
        .from('projects')
        .update({
            published:
                !p.published
        })
        .eq('id', id);


    if (error) {

        return toast(
            'სტატუსის შეცვლა ვერ მოხერხდა.'
        );
    }


    toast(
        p.published
            ? 'პროექტი დამალულია.'
            : 'პროექტი გამოქვეყნდა.',
        'success'
    );


    loadAdminProjects();
}


/* =========================================================
   DELETE PROJECT
========================================================= */

async function deleteProject(id) {

    const p =
        adminProjects.find(
            x =>
                x.id === id
        );


    if (
        !p ||
        !confirm(
            'ნამდვილად გსურთ ამ პროექტის წაშლა?'
        )
    ) {
        return;
    }


    const {
        error
    } = await db
        .from('projects')
        .delete()
        .eq('id', id);


    if (error) {

        return toast(
            'პროექტის წაშლა ვერ მოხერხდა.'
        );
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

    ]);


    toast(
        'პროექტი წაიშალა.',
        'success'
    );


    loadAdminProjects();
}


/* =========================================================
   CLUB MEETING
   PUBLIC + ADMIN
========================================================= */

const GEORGIAN_WEEKDAYS = [
    'კვირა',
    'ორშაბათი',
    'სამშაბათი',
    'ოთხშაბათი',
    'ხუთშაბათი',
    'პარასკევი',
    'შაბათი'
];


/* =========================================================
   MEETING DAY
========================================================= */

function meetingDay(dateValue) {

    if (!dateValue) {
        return '—';
    }


    const d =
        new Date(
            `${dateValue}T12:00:00`
        );


    if (Number.isNaN(d.getTime())) {
        return '—';
    }


    return GEORGIAN_WEEKDAYS[
        d.getDay()
    ];
}


/* =========================================================
   MEETING DATE TEXT
========================================================= */

function meetingDateText(dateValue) {

    if (!dateValue) {
        return '—';
    }


    const d =
        new Date(
            `${dateValue}T12:00:00`
        );


    if (
        Number.isNaN(
            d.getTime()
        )
    ) {
        return dateValue;
    }


    return new Intl.DateTimeFormat(
        'ka-GE',
        {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }
    ).format(d);
}


/* =========================================================
   MEETING TIME TEXT
========================================================= */

function meetingTimeText(timeValue) {

    if (!timeValue) {
        return '—';
    }


    const m =
        String(timeValue).match(
            /^(\d{2}):(\d{2})/
        );


    return m
        ? `${m[1]}:${m[2]}`
        : timeValue;
}


/* =========================================================
   GET MEETING
========================================================= */

async function getMeeting() {

    if (!db) {

        return {
            data: null,
            error: new Error(
                'Supabase not configured'
            )
        };
    }


    return await db
        .from('club_meeting')
        .select(
            'id,meeting_date,meeting_time,updated_at'
        )
        .eq('id', 1)
        .maybeSingle();
}


/* =========================================================
   RENDER PUBLIC MEETING
========================================================= */

function renderMeetingContent(meeting) {

    const target =
        $('#meeting-content');


    if (!target) return;


    if (!meeting) {

        target.innerHTML = `
            <div class="meeting-empty">

                ${icon('calendar-off')}

                <h3>
                    თარიღი ჯერ არ არის გამოქვეყნებული
                </h3>

                <p>
                    როგორც კი ადმინისტრატორი თარიღსა და დროს გამოაქვეყნებს,
                    ინფორმაცია აქ გამოჩნდება.
                </p>

            </div>
        `;

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
        `;
    }


    refreshIcons();
}


/* =========================================================
   LOAD PUBLIC MEETING
========================================================= */

async function loadPublicMeeting() {

    const {
        data,
        error
    } = await getMeeting();


    if (error) {

        console.error(error);


        const target =
            $('#meeting-content');


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
            `;

            refreshIcons();
        }


        return;
    }


    renderMeetingContent(
        data
    );
}


/* =========================================================
   OPEN MEETING MODAL
========================================================= */

function openMeetingModal() {

    const modal =
        $('#meeting-modal');


    if (!modal) return;


    modal.hidden =
        false;


    modal.setAttribute(
        'aria-hidden',
        'false'
    );


    document.body.classList.add(
        'modal-open'
    );


    loadPublicMeeting();


    setTimeout(
        () => {
            $('#meeting-close')?.focus();
        },
        0
    );
}


/* =========================================================
   CLOSE MEETING MODAL
========================================================= */

function closeMeetingModal() {

    const modal =
        $('#meeting-modal');


    if (!modal) return;


    modal.hidden =
        true;


    modal.setAttribute(
        'aria-hidden',
        'true'
    );


    document.body.classList.remove(
        'modal-open'
    );
}


/* =========================================================
   PUBLIC MEETING INIT
========================================================= */

function initMeetingPublic() {

    const button =
        $('#meeting-button');


    if (!button) return;


    button.addEventListener(
        'click',
        openMeetingModal
    );


    $('#meeting-close')
        ?.addEventListener(
            'click',
            closeMeetingModal
        );


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
        );


    document.addEventListener(
        'keydown',
        e => {

            if (
                e.key === 'Escape' &&
                $('#meeting-modal') &&
                !$('#meeting-modal').hidden
            ) {

                closeMeetingModal();
            }

        }
    );
}


/* =========================================================
   LOAD ADMIN MEETING
========================================================= */

async function loadAdminMeeting() {

    const status =
        $('#meeting-admin-status');


    if (!status) return;


    const {
        data,
        error
    } = await getMeeting();


    if (error) {

        status.textContent =
            'ჩატვირთვა ვერ მოხერხდა';


        console.error(error);


        return;
    }


    if (data) {

        $('#meeting-date').value =
            data.meeting_date || '';


        $('#meeting-time').value =
            String(
                data.meeting_time || ''
            ).slice(0, 5);


        $('#meeting-day-preview').textContent =
            meetingDay(
                data.meeting_date
            );


        status.textContent =
            'გამოქვეყნებულია';


        status.className =
            'meeting-admin-status published';

    } else {

        status.textContent =
            'არ არის გამოქვეყნებული';


        status.className =
            'meeting-admin-status';


        $('#meeting-day-preview').textContent =
            '—';
    }
}


/* =========================================================
   BIND MEETING FORM
========================================================= */

function bindMeetingForm() {

    const form =
        $('#meeting-form');


    if (!form) return;


    $('#meeting-date')
        ?.addEventListener(
            'input',
            e => {

                $('#meeting-day-preview').textContent =
                    meetingDay(
                        e.target.value
                    );
            }
        );


    form.addEventListener(
        'submit',
        saveMeeting
    );


    $('#clear-meeting')
        ?.addEventListener(
            'click',
            clearMeeting
        );
}


/* =========================================================
   SAVE / PUBLISH MEETING
========================================================= */

async function saveMeeting(event) {

    event.preventDefault();


    if (!db) return;


    const button =
        $('#save-meeting');


    const errorTarget =
        $('#meeting-form-error');


    const date =
        $('#meeting-date').value;


    const time =
        $('#meeting-time').value;


    errorTarget.textContent =
        '';


    if (
        !date ||
        !time
    ) {

        errorTarget.textContent =
            'აირჩიეთ თარიღი და დრო.';


        return;
    }


    setBusy(
        button,
        true,
        'ქვეყნდება...'
    );


    try {

        const {
            data: {
                user
            }
        } = await db.auth.getUser();


        if (!user) {

            throw new Error(
                'not-authenticated'
            );
        }


        const {
            error
        } = await db
            .from('club_meeting')
            .upsert(
                {
                    id: 1,
                    meeting_date: date,
                    meeting_time: time,
                    updated_by: user.id
                },
                {
                    onConflict: 'id'
                }
            );


        if (error) {
            throw error;
        }


        toast(
            'კლუბის შეკრება გამოქვეყნდა.',
            'success'
        );


        await loadAdminMeeting();

    } catch (error) {

        errorTarget.textContent =
            neutralError(
                error,
                'შეკრების გამოქვეყნება ვერ მოხერხდა.'
            );

    } finally {

        setBusy(
            button,
            false
        );
    }
}


/* =========================================================
   DELETE / CANCEL MEETING
========================================================= */

async function clearMeeting() {

    if (!db) return;


    if (
        !confirm(
            'ნამდვილად გსურთ გამოქვეყნებული შეკრების წაშლა?'
        )
    ) {
        return;
    }


    const {
        error
    } = await db
        .from('club_meeting')
        .delete()
        .eq('id', 1);


    if (error) {

        return toast(
            'შეკრების წაშლა ვერ მოხერხდა.'
        );
    }


    $('#meeting-date').value =
        '';


    $('#meeting-time').value =
        '';


    $('#meeting-day-preview').textContent =
        '—';


    $('#meeting-admin-status').textContent =
        'არ არის გამოქვეყნებული';


    $('#meeting-admin-status').className =
        'meeting-admin-status';


    toast(
        'შეკრება გაუქმდა.',
        'success'
    );
}


/* =========================================================
   PASSWORD RESET
========================================================= */

async function initPasswordReset() {

    const form =
        $('#reset-password-form');


    if (!form) return;


    if (!db) {

        $('#reset-error').textContent =
            'Supabase ჯერ არ არის კონფიგურირებული.';


        form.querySelector(
            'button'
        ).disabled = true;


        return;
    }


    form.addEventListener(
        'submit',
        async event => {

            event.preventDefault();


            const error =
                $('#reset-error');


            const password =
                $('#new-password').value;


            const confirmPassword =
                $('#confirm-password').value;


            const button =
                form.querySelector(
                    'button'
                );


            error.textContent =
                '';


            if (
                password !==
                confirmPassword
            ) {

                error.textContent =
                    'პაროლები ერთმანეთს არ ემთხვევა.';


                return;
            }


            if (
                password.length < 10
            ) {

                error.textContent =
                    'პაროლი მინიმუმ 10 სიმბოლო უნდა იყოს.';


                return;
            }


            const {
                data: {
                    session
                }
            } = await db.auth.getSession();


            if (!session) {

                error.textContent =
                    'აღდგენის ბმული არასწორია ან ვადა გაუვიდა. მოითხოვეთ ახალი ბმული.';


                return;
            }


            setBusy(
                button,
                true,
                'ინახება...'
            );


            const {
                error: updateError
            } = await db.auth.updateUser({
                password
            });


            if (updateError) {

                error.textContent =
                    'პაროლის შეცვლა ვერ მოხერხდა. მოითხოვეთ ახალი ბმული.';

            } else {

                toast(
                    'პაროლი წარმატებით შეიცვალა.',
                    'success'
                );


                setTimeout(
                    () => {

                        location.href =
                            'admin.html';

                    },
                    900
                );
            }


            setBusy(
                button,
                false
            );
        }
    );
}


/* =========================================================
   INITIALIZE
========================================================= */

initChrome();


if (page === 'home') {

    initMeetingPublic();

    initAIChat();
}


if (page === 'projects') {
    initProjects();
}


if (page === 'detail') {
    initDetail();
}


if (page === 'admin') {
    initAdmin();
}


if (page === 'reset') {
    initPasswordReset();
}
