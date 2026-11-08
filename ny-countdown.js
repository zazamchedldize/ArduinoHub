/* =========================================================
   ArduinoHub — საახალწლო ათვლა (ny-countdown.js)
   სამიზნე: 2027-01-01 00:00 Asia/Tbilisi.
   საქართველო მუდმივად UTC+4-ზეა (DST არ აქვს), ამიტომ ეს არის
   2026-12-31 20:00:00 UTC. ყველაფერი გამოითვლება Date.now()-დან,
   ე.ი. მომხმარებლის მოწყობილობის დროის სარტყელზე არ არის დამოკიდებული.
   winter.js-ს არ ეხება: მხოლოდ #nyc-section-ის შიგნით მუშაობს.
   ========================================================= */
(function(){
  'use strict';

  var TARGET = Date.UTC(2026, 11, 31, 20, 0, 0); // 2027-01-01T00:00:00+04:00
  var section = document.getElementById('nyc-section');
  if (!section) return;

  var els = {
    days:    document.getElementById('nyc-days'),
    hours:   document.getElementById('nyc-hours'),
    minutes: document.getElementById('nyc-minutes'),
    seconds: document.getElementById('nyc-seconds')
  };
  var live = document.getElementById('nyc-live');
  var last = { days:null, hours:null, minutes:null, seconds:null };
  var timer = null;

  function pad(n, min){
    var s = String(n);
    while (s.length < min) s = '0' + s;
    return s;
  }

  function setValue(key, value, min){
    var text = pad(value, min);
    if (last[key] === text) return;
    last[key] = text;
    var el = els[key];
    if (!el) return;
    el.textContent = text;
    // მცირე "tick" ანიმაცია მხოლოდ ცვლილებისას
    el.classList.remove('nyc-tick');
    void el.offsetWidth;
    el.classList.add('nyc-tick');
  }

  function finish(){
    if (timer) { clearTimeout(timer); timer = null; }
    section.classList.add('nyc-done');
    section.setAttribute('data-nyc-state', 'done');
    if (live) live.textContent = 'გილოცავთ ახალ წელს!';
  }

  function tick(){
    var diff = TARGET - Date.now();
    if (diff <= 0) { finish(); return; }

    var total = Math.floor(diff / 1000);
    var days = Math.floor(total / 86400);
    var hours = Math.floor((total % 86400) / 3600);
    var minutes = Math.floor((total % 3600) / 60);
    var seconds = total % 60;

    setValue('days', days, 2);
    setValue('hours', hours, 2);
    setValue('minutes', minutes, 2);
    setValue('seconds', seconds, 2);

    // ვუსინქრონებთ მომდევნო წამის საზღვარს, რომ ციფრები არ "ახტებოდეს"
    var delay = 1000 - (Date.now() % 1000) + 5;
    timer = setTimeout(tick, delay);
  }

  // ფონური ჩანართიდან დაბრუნებისას დაუყოვნებლივ განახლება
  document.addEventListener('visibilitychange', function(){
    if (!document.hidden && !section.classList.contains('nyc-done')) {
      if (timer) clearTimeout(timer);
      tick();
    }
  });

  tick();
})();
