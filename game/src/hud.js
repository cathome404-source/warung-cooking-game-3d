// Kuali Emas 3D — hud.js
// The HTML overlay: big timer + ring, score/combo, coins/stars, day line,
// order tickets, hand chip, station tooltip, and all screens (title,
// how-to, day-complete, game-over, pause). Pure DOM rendering — no game
// logic, no Three.js. Exposes window.KualiHud. Classic script, no imports.
// Depends on window.KualiUtil (formatTime) + window.KualiRecipes (how-to).
(function (root) {
  'use strict';

  var RING_CIRC = 2 * Math.PI * 50;
  var DAY_SECONDS = 120;

  var DISH_THUMB = { 'nasi-goreng': '\u{1F35A}', 'soto-ayam': '\u{1F35C}', 'sate-ayam': '\u{1F362}' };

  var INGREDIENT_NAMES = {
    rice: 'Nasi', egg: 'Telur', shallot: 'Bawang', chilli: 'Cabai',
    kecap: 'Kecap Manis', chicken: 'Ayam', turmeric: 'Kunyit',
    sprouts: 'Tauge', peanut: 'Saus Kacang', lime: 'Jeruk Nipis'
  };

  var el = {};
  var callbacks = null;
  var lastTicketSig = '';
  var mouseX = 0;
  var mouseY = 0;
  var muted = false;

  function $(id) { return document.getElementById(id); }

  function init(cb) {
    callbacks = cb || {};
    var ids = ['score-value', 'combo-value', 'coins-value', 'stars-value',
      'timer-value', 'timer-ring-fg', 'day-line', 'order-board', 'hand-chip',
      'tooltip', 'title-screen', 'howto-screen', 'day-complete-screen',
      'game-over-screen', 'day-complete-title', 'day-complete-stats',
      'game-over-title', 'game-over-reason', 'game-over-stats',
      'btn-play', 'btn-howto', 'btn-sound', 'btn-sound-2', 'btn-howto-close',
      'btn-next-day', 'btn-retry-day', 'btn-play-again', 'pause-btn',
      'recipe-list'];
    for (var i = 0; i < ids.length; i++) { el[ids[i]] = $(ids[i]); }
    if (el['timer-ring-fg']) {
      el['timer-ring-fg'].style.strokeDasharray = String(RING_CIRC);
      el['timer-ring-fg'].style.strokeDashoffset = '0';
    }
    root.addEventListener('mousemove', function (e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (el['hand-chip'] && el['hand-chip'].style.display !== 'none') {
        el['hand-chip'].style.left = mouseX + 'px';
        el['hand-chip'].style.top = mouseY + 'px';
      }
    });
    bind('btn-play', 'onPlay');
    bind('btn-howto', 'onHowTo');
    bind('btn-sound', 'onSoundToggle');
    bind('btn-sound-2', 'onSoundToggle');
    bind('btn-howto-close', 'onHowToClose');
    bind('btn-next-day', 'onNextDay');
    bind('btn-retry-day', 'onRetryDay');
    bind('btn-play-again', 'onPlayAgain');
    bind('pause-btn', 'onPause');
    buildRecipeList(1);
  }

  function bind(id, cbName) {
    var b = el[id];
    if (b && callbacks[cbName]) {
      b.addEventListener('click', function () { callbacks[cbName](); });
    }
  }

  function buildRecipeList(day) {
    if (!el['recipe-list'] || !root.KualiRecipes) { return; }
    var html = '';
    var recipes = root.KualiRecipes.RECIPES;
    for (var i = 0; i < recipes.length; i++) {
      var r = recipes[i];
      var locked = day < r.unlockDay;
      var steps = [];
      for (var s = 0; s < r.steps.length; s++) { steps.push(r.steps[s].label); }
      html += '<div class="' + (locked ? 'locked' : '') + '"><b>' + r.name +
        '</b> — ' + r.baseScore + ' poin' +
        (locked ? ' (buka Hari ' + r.unlockDay + ')' : '') +
        '<br>' + steps.join(' &rarr; ') + '</div>';
    }
    el['recipe-list'].innerHTML = html;
  }

  function hideAll() {
    var screens = ['title-screen', 'howto-screen', 'day-complete-screen', 'game-over-screen'];
    for (var i = 0; i < screens.length; i++) {
      if (el[screens[i]]) { el[screens[i]].classList.remove('show'); }
    }
  }

  function showTitle() {
    hideAll();
    if (el['title-screen']) { el['title-screen'].classList.add('show'); }
  }

  function showHowTo(day) {
    buildRecipeList(day || 1);
    hideAll();
    if (el['howto-screen']) { el['howto-screen'].classList.add('show'); }
  }

  // Pause reuses the how-to overlay (spec §8: Escape opens pause + how-to).
  function showPause(on, day) {
    if (on) { showHowTo(day || 1); } else { hideAll(); }
  }

  function showDayComplete(stats) {
    hideAll();
    if (el['day-complete-title']) {
      el['day-complete-title'].textContent = 'Hari ' + stats.day + ' Selesai!';
    }
    if (el['day-complete-stats']) {
      el['day-complete-stats'].innerHTML =
        'Pesanan disajikan: ' + stats.served + ' &middot; Koin hari ini: ' + stats.coinsDay +
        ' &middot; Combo terbaik: x' + stats.bestCombo +
        ' &middot; Bintang: ' + stats.stars + ' / 5';
    }
    if (el['day-complete-screen']) { el['day-complete-screen'].classList.add('show'); }
  }

  function showGameOver(win, reason, stats) {
    hideAll();
    var titles = {
      win: 'KUALI EMAS DIDAPAT!',
      reputation: 'Warung Tutup',
      expired: 'Warung Tutup',
      time: 'Warung Tutup'
    };
    var reasons = {
      win: 'Kamu mendapatkan Kuali Emas! Lima hari penuh, pelanggan puas, wok tetap menyala.',
      reputation: 'Reputasi warung habis — pelanggan kecewa dan tak ada yang kembali.',
      expired: 'Tiga pesanan kedaluwarsa dalam satu hari — pelanggan pergi dengan marah.',
      time: 'Waktu habis dan target hari ini tidak tercapai.'
    };
    if (el['game-over-title']) {
      el['game-over-title'].textContent = win ? titles.win : (titles[reason] || titles.time);
    }
    if (el['game-over-reason']) {
      el['game-over-reason'].textContent = win ? reasons.win : (reasons[reason] || reasons.time);
    }
    if (el['game-over-stats']) {
      el['game-over-stats'].innerHTML =
        'Hari ' + stats.day + ' &middot; Skor: ' + stats.score +
        ' &middot; Koin: ' + stats.coins + ' &middot; Pesanan disajikan: ' + stats.servedTotal;
    }
    if (el['game-over-screen']) { el['game-over-screen'].classList.add('show'); }
  }

  function setMuted(m) {
    muted = !!m;
    var label = muted ? 'Suara: Mati' : 'Suara: Nyala';
    if (el['btn-sound']) { el['btn-sound'].textContent = label; }
    if (el['btn-sound-2']) { el['btn-sound-2'].textContent = label; }
  }

  function showTooltip(text, x, y) {
    if (!el['tooltip']) { return; }
    if (!text) { hideTooltip(); return; }
    el['tooltip'].textContent = text;
    el['tooltip'].style.display = 'block';
    el['tooltip'].style.left = x + 'px';
    el['tooltip'].style.top = y + 'px';
  }

  function hideTooltip() {
    if (el['tooltip']) { el['tooltip'].style.display = 'none'; }
  }

  function flashTicket() {
    var board = el['order-board'];
    if (!board || !board.firstChild) { return; }
    var t = board.firstChild;
    t.classList.add('angry');
    setTimeout(function () { t.classList.remove('angry'); }, 500);
  }

  // state: {timeLeft, score, combo, coins, stars, day, served, target,
  //   tickets:[{id,recipeId,name,steps:[{label,done,now}],patience,current}],
  //   heldKey, muted}
  function update(state) {
    if (!state) { return; }
    var t = root.KualiUtil ? root.KualiUtil.formatTime(state.timeLeft) : String(state.timeLeft);
    if (el['timer-value']) {
      el['timer-value'].textContent = t;
      el['timer-value'].classList.toggle('low', state.timeLeft <= 10);
    }
    if (el['timer-ring-fg']) {
      var frac = Math.max(0, Math.min(1, state.timeLeft / DAY_SECONDS));
      el['timer-ring-fg'].style.strokeDashoffset = String(RING_CIRC * (1 - frac));
      el['timer-ring-fg'].style.stroke = state.timeLeft <= 10 ? '#ff5a3c' : '#ffb347';
    }
    if (el['score-value']) { el['score-value'].textContent = String(state.score); }
    if (el['combo-value']) {
      var c = state.combo || 1;
      el['combo-value'].textContent = 'Combo x' + (c % 1 ? c.toFixed(1) : c);
      el['combo-value'].classList.toggle('hot', c >= 2);
    }
    if (el['coins-value']) { el['coins-value'].textContent = String(state.coins) + ' \u{1F33C}'; }
    if (el['stars-value']) {
      var filled = Math.max(0, Math.min(5, Math.round(state.stars || 0)));
      var s = '';
      for (var i = 0; i < 5; i++) { s += i < filled ? '\u2605' : '\u2606'; }
      el['stars-value'].textContent = s;
    }
    if (el['day-line']) {
      el['day-line'].textContent = 'Day ' + state.day + ' — served ' + state.served + ' of ' + state.target;
    }
    renderTickets(state.tickets || []);
    renderHand(state.heldKey);
    if (state.muted !== undefined && state.muted !== muted) { setMuted(state.muted); }
  }

  function renderHand(heldKey) {
    var chip = el['hand-chip'];
    if (!chip) { return; }
    if (!heldKey) {
      chip.style.display = 'none';
      return;
    }
    chip.textContent = 'Memegang: ' + (INGREDIENT_NAMES[heldKey] || heldKey);
    chip.style.display = 'block';
    chip.style.left = mouseX + 'px';
    chip.style.top = mouseY + 'px';
  }

  function renderTickets(tickets) {
    var board = el['order-board'];
    if (!board) { return; }
    // Rebuild only when the visible content changed (cheap per-frame guard).
    var sig = '';
    for (var i = 0; i < tickets.length; i++) {
      var tk = tickets[i];
      sig += tk.id + ':' + tk.stepsDone + ':' + Math.floor(tk.patience * 20) + '|';
    }
    if (sig === lastTicketSig) { return; }
    lastTicketSig = sig;
    var html = '';
    for (var j = 0; j < tickets.length; j++) {
      var t = tickets[j];
      var pct = Math.max(0, Math.min(100, Math.round(t.patience * 100)));
      html += '<div class="ticket' + (t.current ? ' current' : '') + '"' +
        ' data-ticket="' + t.id + '">' +
        '<span class="dish-thumb">' + (DISH_THUMB[t.recipeId] || '\u{1F372}') + '</span>' +
        '<div class="dish-name">' + t.name + '</div>' +
        '<ul class="steps">';
      for (var s = 0; s < t.steps.length; s++) {
        var st = t.steps[s];
        html += '<li class="' + (st.done ? 'done' : (st.now ? 'now' : '')) + '">' +
          (st.done ? '\u2713 ' : (st.now ? '\u25B6 ' : '')) + st.label + '</li>';
      }
      html += '</ul><div class="patience' + (pct <= 25 ? ' low' : '') + '">' +
        '<div style="width:' + pct + '%"></div></div></div>';
    }
    board.innerHTML = html;
  }

  root.KualiHud = {
    init: init,
    update: update,
    showTitle: showTitle,
    showHowTo: showHowTo,
    showPause: showPause,
    showDayComplete: showDayComplete,
    showGameOver: showGameOver,
    hideAll: hideAll,
    setMuted: setMuted,
    showTooltip: showTooltip,
    hideTooltip: hideTooltip,
    flashTicket: flashTicket,
    INGREDIENT_NAMES: INGREDIENT_NAMES
  };
})(typeof window !== 'undefined' ? window : globalThis);
