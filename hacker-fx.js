/* =====================================================
   ARDUINOHUB — HACKER FX (hacker-fx.js)
   ჩართე script.js-ის ქვემოთ, </body>-ის წინ
   ===================================================== */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ===== Matrix rain + მაუსის ნათება ===== */
  if (!reduce) {
    const c = document.createElement("canvas");
    c.id = "fx-rain";
    document.body.prepend(c);
    const ctx = c.getContext("2d");
    const chars = "01アイウエオカキクケコサシスセソ<>/{}[]=+*#$%&ABCDEF".split("");
    const size = 16;
    let cols, drops;

    const resize = () => {
      c.width = innerWidth;
      c.height = innerHeight;
      cols = Math.floor(c.width / size);
      drops = Array.from({ length: cols }, () => Math.random() * -50);
    };
    resize();
    addEventListener("resize", resize);

    setInterval(() => {
      ctx.fillStyle = "rgba(2, 10, 5, 0.12)";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.font = size + "px monospace";
      for (let i = 0; i < cols; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillStyle = Math.random() > 0.97 ? "#ffffff" : "#00ff66";
        ctx.fillText(ch, i * size, drops[i] * size);
        if (drops[i] * size > c.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    }, 50);

    const glow = document.createElement("div");
    glow.id = "fx-cursor";
    document.body.appendChild(glow);
    addEventListener("pointermove", (e) => {
      glow.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    });
  }

  /* ===== Glitch სათაურები ===== */
  document.querySelectorAll("h1").forEach((h) => {
    h.classList.add("glitch");
    h.setAttribute("data-text", h.textContent.trim());
  });

  /* ===== Scroll reveal ===== */
  const targets = document.querySelectorAll(
    ".team-card, [class*='project-card'], [class*='album-card'], .card, .team-intro, .team-footer-message"
  );
  targets.forEach((el) => el.classList.add("fx-reveal"));

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          setTimeout(() => en.target.classList.add("fx-in"), Number(en.target.dataset.d || 0));
          io.unobserve(en.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  targets.forEach((el, i) => {
    el.dataset.d = (i % 4) * 90;
    io.observe(el);
  });

  /* ===== ნავიგაციის "decode" ეფექტი (მხოლოდ კომპიუტერზე) ===== */
  if (matchMedia("(hover: hover)").matches) {
    const letters = "01<>/\\{}#$%";
    document.querySelectorAll(".site-header nav a").forEach((a) => {
      const txt = a.textContent.trim();
      if (!/^[\u10A0-\u10FF\s]+$/.test(txt)) return;
      let timer = null;
      a.addEventListener("mouseenter", () => {
        if (a.querySelector("i")) return;
        clearInterval(timer);
        let n = 0;
        timer = setInterval(() => {
          a.textContent = txt
            .split("")
            .map((ch, i) =>
              i < n || ch === " " ? ch : letters[Math.floor(Math.random() * letters.length)]
            )
            .join("");
          if (++n > txt.length) {
            clearInterval(timer);
            a.textContent = txt;
          }
        }, 35);
      });
      a.addEventListener("mouseleave", () => {
        clearInterval(timer);
        a.textContent = txt;
      });
    });
  }

  /* ===== Scroll progress + ზემოთ ასვლის ღილაკი ===== */
  const bar = document.createElement("div");
  bar.id = "fx-progress";
  document.body.appendChild(bar);

  const topBtn = document.createElement("div");
  topBtn.id = "fx-top";
  topBtn.setAttribute("aria-label", "ზემოთ");
  topBtn.textContent = "↑";
  topBtn.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));
  document.body.appendChild(topBtn);

  addEventListener(
    "scroll",
    () => {
      const h = document.documentElement;
      const p = h.scrollTop / (h.scrollHeight - h.clientHeight || 1);
      bar.style.width = p * 100 + "%";
      topBtn.classList.toggle("show", h.scrollTop > 400);
    },
    { passive: true }
  );

  /* ===== ტერმინალის ლოუდერი (ერთხელ სესიაზე) ===== */
  let seen = false;
  try {
    seen = sessionStorage.getItem("fx-booted") === "1";
  } catch (e) {}

  if (!seen && !reduce) {
    const boot = document.createElement("div");
    boot.id = "fx-boot";
    boot.innerHTML =
      "<pre>> ArduinoHub OS v2.0\n> ვამოწმებ სისტემას... OK\n> ვტვირთავ მოდულებს... OK\n> წვდომა დაშვებულია_<span class='bar'><i></i></span></pre>";
    document.body.appendChild(boot);
    setTimeout(() => boot.classList.add("done"), 1700);
    setTimeout(() => boot.remove(), 2400);
    try {
      sessionStorage.setItem("fx-booted", "1");
    } catch (e) {}
  }

  /* ===== 3D tilt ბარათებზე (მხოლოდ კომპიუტერზე) ===== */
  if (!reduce && matchMedia("(hover: hover)").matches) {
    document.querySelectorAll(".team-card").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform =
          `perspective(800px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-6px)`;
      });
      card.addEventListener("pointerleave", () => {
        card.style.transform = "";
      });
    });
  }

  /* ===== მენიუ იხურება ბმულზე დაჭერისას (მობილურზე) ===== */
  document.querySelectorAll(".site-header nav a").forEach((a) => {
    a.addEventListener("click", () => {
      const t = document.querySelector(".menu-toggle");
      if (t && t.getAttribute("aria-expanded") === "true") t.click();
    });
  });
})();
