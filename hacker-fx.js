(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ===== Matrix rain ===== */
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

    /* მაუსის ნათება */
    const glow = document.createElement("div");
    glow.id = "fx-cursor";
    document.body.appendChild(glow);
    addEventListener("pointermove", e => {
      glow.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    });
  }

  /* ===== Glitch სათაურები ===== */
  document.querySelectorAll("h1").forEach(h => {
    h.classList.add("glitch");
    h.setAttribute("data-text", h.textContent.trim());
  });

  /* ===== Scroll reveal ===== */
  const targets = document.querySelectorAll(
    ".team-card, [class*='project-card'], [class*='album-card'], .card, .team-intro, .team-footer-message"
  );
  targets.forEach(el => el.classList.add("fx-reveal"));
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        setTimeout(() => en.target.classList.add("fx-in"), (en.target.dataset.d || 0));
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.12 });
  targets.forEach((el, i) => { el.dataset.d = (i % 4) * 90; io.observe(el); });

  /* ===== ტექსტის "decode" ეფექტი ნავიგაციაზე ===== */
  const letters = "01<>/\\{}#$%";
  document.querySelectorAll(".site-header nav a").forEach(a => {
    const txt = a.textContent.trim();
    if (!/^[\u10A0-\u10FF\s]+$/.test(txt)) return;
    a.addEventListener("mouseenter", () => {
      const icon = a.querySelector("i");
      if (icon) return;
      let n = 0;
      const t = setInterval(() => {
        a.textContent = txt.split("").map((ch, i) =>
          i < n || ch === " " ? ch : letters[Math.floor(Math.random() * letters.length)]
        ).join("");
        if (++n > txt.length) { clearInterval(t); a.textContent = txt; }
      }, 35);
    });
  });
})();
