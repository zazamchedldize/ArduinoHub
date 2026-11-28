/* =====================================================
   ARDUINOHUB — DOOMSDAY FX (hacker-fx.js)
   ჩართე script.js-ის ქვემოთ, </body>-ის წინ
   ===================================================== */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ===== Doomsday ქარიშხალი (ნაპერწკლები, ფერფლი, ელვა) + მაუსის ნათება ===== */
  if (!reduce) {
    const c = document.createElement("canvas");
    c.id = "fx-rain"; // id უცვლელია: winter.css ამით თიშავს
    document.body.prepend(c);
    const ctx = c.getContext("2d");
    let parts = [];
    let bolt = null;
    let nextBolt = performance.now() + 4000;
    let last = 0;

    const rnd = (min, max) => min + Math.random() * (max - min);

    const spawn = (anywhere) => {
      const ember = Math.random() < 0.6;
      return {
        ember,
        x: rnd(0, c.width),
        y: anywhere ? rnd(0, c.height) : ember ? c.height + 10 : -10,
        r: ember ? rnd(0.8, 2.4) : rnd(0.6, 1.8),
        vy: ember ? rnd(-1.4, -0.4) : rnd(0.3, 0.9),
        phase: rnd(0, 6.28),
      };
    };

    const resize = () => {
      c.width = innerWidth;
      c.height = innerHeight;
      const count = Math.min(110, Math.round((c.width * c.height) / 14000));
      parts = Array.from({ length: count }, () => spawn(true));
    };
    resize();
    addEventListener("resize", resize);

    // დატოტვილი ელვა
    const makeBolt = (now) => {
      const paths = [];
      const walk = (x, y, steps, width) => {
        const path = { width, points: [[x, y]] };
        for (let i = 0; i < steps; i++) {
          x += rnd(-34, 34);
          y += rnd(18, 46);
          path.points.push([x, y]);
          if (width > 1.5 && Math.random() < 0.18) walk(x, y, 4, 1);
        }
        paths.push(path);
      };
      walk(rnd(c.width * 0.1, c.width * 0.9), -10, Math.round(rnd(9, 15)), 2.2);
      return { paths, born: now };
    };

    const frame = (now) => {
      requestAnimationFrame(frame);
      if (now - last < 33) return; // ~30 კადრი წამში
      last = now;
      if (document.body.classList.contains("winter-mode")) return;

      ctx.clearRect(0, 0, c.width, c.height);

      if (now > nextBolt) {
        bolt = makeBolt(now);
        nextBolt = now + rnd(8000, 16000);
      }

      if (bolt) {
        const life = 1 - (now - bolt.born) / 700;
        if (life <= 0) {
          bolt = null;
        } else {
          // რბილი, ერთჯერადად ჩამქრალი ნათება (ციმციმის გარეშე)
          ctx.fillStyle = `rgba(47, 224, 140, ${0.07 * life})`;
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.strokeStyle = `rgba(200, 255, 226, ${life})`;
          ctx.shadowColor = "#2fe08c";
          ctx.shadowBlur = 18;
          bolt.paths.forEach((p) => {
            ctx.lineWidth = p.width;
            ctx.beginPath();
            p.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            ctx.stroke();
          });
          ctx.shadowBlur = 0;
        }
      }

      parts.forEach((p, i) => {
        p.y += p.vy;
        p.x += Math.sin(now / 900 + p.phase) * 0.5 + 0.25;
        if (p.y < -12 || p.y > c.height + 12 || p.x > c.width + 12) {
          parts[i] = spawn(false);
          return;
        }
        ctx.fillStyle = p.ember
          ? `rgba(92, 240, 168, ${0.55 + 0.35 * Math.sin(now / 300 + p.phase)})`
          : "rgba(185, 199, 193, 0.4)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fill();
      });
    };
    requestAnimationFrame(frame);

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
