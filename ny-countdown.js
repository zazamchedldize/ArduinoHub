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

  var TARGET = Date.UTC(2026, 11, 16, 20, 0, 0)
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

  /* ტკაცუნის ხმა: ყოველ წამს უკრავს.
     ბრაუზერი გვერდზე შესვლისას ხმას ბლოკავს, ამიტომ ვცდილობთ თავიდანვე,
     ხოლო თუ დაიბლოკა, პირველივე დაჭერა/შეხება/კლავიში "ხსნის" ხმას. */
  var audio = null;
  try {
    audio = new Audio(section.getAttribute('data-nyc-tick') || 'sound/tick.mp3');
    audio.preload = 'auto';
    audio.volume = 1;
    // ფაილი ვერ მოიძებნა → ხმას ვთიშავთ, საიტი მუშაობს ჩვეულებრივად
    audio.addEventListener('error', function(){ audio = null; });
  } catch (e) { audio = null; }

  function playTick(){
    if (!audio || document.hidden) return;
    try {
      audio.currentTime = 0;
      var p = audio.play();
      if (p && p.catch) p.catch(function(){});
    } catch (e) {}
  }

  // პირველ მოქმედებაზე ხმას "ვხსნით" (Safari-ისთვის play() უნდა მოხდეს თავად მოქმედებისას)
  var unlockEvents = ['pointerdown', 'touchend', 'keydown', 'click'];
  function unlock(){
    unlockEvents.forEach(function(ev){ document.removeEventListener(ev, unlock, true); });
    if (!audio) return;
    try {
      var p = audio.play();
      if (p && p.then) p.then(function(){ audio.pause(); audio.currentTime = 0; }).catch(function(){});
    } catch (e) {}
  }
  unlockEvents.forEach(function(ev){ document.addEventListener(ev, unlock, true); });

  function pad(n, min){
    var s = String(n);
    while (s.length < min) s = '0' + s;
    return s;
  }

  function setValue(key, value, min){
    var text = pad(value, min);
    if (last[key] === text) return false;
    last[key] = text;
    var el = els[key];
    if (!el) return;
    el.textContent = text;
    // მცირე "tick" ანიმაცია მხოლოდ ცვლილებისას
    el.classList.remove('nyc-tick');
    void el.offsetWidth;
    el.classList.add('nyc-tick');
    return true;
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
    if (setValue('seconds', seconds, 2)) playTick();

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
