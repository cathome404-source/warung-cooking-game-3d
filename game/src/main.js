// Kuali Emas 3D — main.js
// Bootstrap + game loop: wires input -> stations -> scoring -> scene + HUD
// + audio, owns the frame loop, and applies the ?shot= parameter for the
// deterministic screenshot setups (cover / title / cook / serve).
// Exposes window.KualiMain and auto-starts on load. Classic script, no imports.
// Depends on KualiUtil, KualiRecipes, KualiOrders, KualiStations,
// KualiScoring, KualiScene, KualiAudio, KualiInput, KualiHud (loaded before).
(function (root) {
  'use strict';

  var DAY_SECONDS = 120;
  var BASE_SEED = 1337;

  var day = 1;
  var timeLeft = DAY_SECONDS;
  var running = false;   // a day is in progress
  var paused = false;
  var frozen = false;    // shot mode: deterministic still, no ticking
  var over = false;      // win / lose screen showing
  var dayDone = false;   // day-complete screen showing
  var muted = false;
  var howtoReturn = 'title';
  var bestCombo = 1;
  var coinsAtDayStart = 0;
  var lastNow = 0;
  var lastTickSecond = -1;
  var angryUntil = [0, 0, 0];
  var happyUntil = [0, 0, 0];
  var frozenHudState = null;
  var shot = null;

  function now() { return performance.now() / 1000; }

  // ---------- tickets -> HUD view models ----------

  function ticketVMs() {
    var tickets = root.KualiOrders.getTickets();
    var out = [];
    for (var i = 0; i < tickets.length; i++) {
      var t = tickets[i];
      var recipe = root.KualiRecipes.get(t.recipeId);
      var steps = [];
      if (recipe) {
        for (var s = 0; s < recipe.steps.length; s++) {
          steps.push({
            label: recipe.steps[s].label,
            done: s < t.stepsDone,
            now: s === t.stepsDone
          });
        }
      }
      out.push({
        id: t.id, recipeId: t.recipeId,
        name: recipe ? recipe.name : t.recipeId,
        steps: steps, stepsDone: t.stepsDone,
        patience: t.patience, current: i === 0
      });
    }
    return out;
  }

  function syncActiveRecipe() {
    var oldest = root.KualiOrders.getOldestTicket();
    if (oldest) {
      root.KualiStations.setActiveRecipe(oldest.recipeId, oldest.stepsDone);
    } else {
      root.KualiStations.setActiveRecipe(null, 0);
    }
  }

  function mirrorSteps() {
    var oldest = root.KualiOrders.getOldestTicket();
    if (oldest) {
      root.KualiOrders.setStepsDone(oldest.id, root.KualiStations.getStepsDone());
    }
  }

  // ---------- day / run lifecycle ----------

  function startDayCommon(d) {
    day = d;
    root.KualiStations.reset(d);
    root.KualiOrders.reset(d, BASE_SEED + d * 101);
    root.KualiScene.setDayLight(d);
    root.KualiScene.setWokState('empty', 0);
    root.KualiScene.setBoardState([]);
    root.KualiScene.setPlateState(0);
    for (var i = 0; i < 3; i++) {
      root.KualiScene.setCustomerMood(i, i === 0 ? 'neutral' : 'gone');
      angryUntil[i] = 0;
      happyUntil[i] = 0;
    }
    timeLeft = DAY_SECONDS;
    bestCombo = 1;
    coinsAtDayStart = root.KualiScoring.getState().coins;
    lastTickSecond = -1;
    syncActiveRecipe();
  }

  function startDay(d) {
    root.KualiScoring.reset(d);
    startDayCommon(d);
    running = true;
    paused = false;
    frozen = false;
    over = false;
    dayDone = false;
    root.KualiHud.hideAll();
  }

  function startRun(d) {
    root.KualiScoring.resetRun(d);
    startDay(d);
  }

  function statsSnapshot() {
    var sc = root.KualiScoring.getState();
    return {
      day: day, score: sc.score, coins: sc.coins,
      served: sc.served, servedTotal: sc.servedTotal,
      coinsDay: sc.coins - coinsAtDayStart,
      bestCombo: bestCombo, stars: sc.reputation
    };
  }

  function endWin() {
    running = false;
    over = true;
    root.KualiAudio.sizzleStop();
    root.KualiAudio.chime();
    root.KualiHud.showGameOver(true, 'win', statsSnapshot());
  }

  function endLose(reason) {
    running = false;
    over = true;
    root.KualiAudio.sizzleStop();
    root.KualiHud.showGameOver(false, reason, statsSnapshot());
  }

  function endDayComplete() {
    running = false;
    dayDone = true;
    root.KualiAudio.sizzleStop();
    root.KualiAudio.chime();
    root.KualiHud.showDayComplete(statsSnapshot());
  }

  // ---------- input handling ----------

  function handleStation(kind, index) {
    root.KualiAudio.unlock();
    if (!running || paused || frozen || over || dayDone) { return; }
    if (kind === 'tray') {
      var key = root.KualiRecipes.trayKey(index);
      if (!key) { return; }
      var pick = root.KualiStations.pickIngredient(key);
      if (pick.ok) { root.KualiScene.highlightTray(index); }
      return;
    }
    var preTickets = root.KualiOrders.getTickets();
    var pre = root.KualiStations.getState();
    var res = root.KualiStations.actOn(kind);
    if (!res.ok) {
      if (res.event === 'reject') {
        root.KualiScoring.onReject();
        root.KualiAudio.error();
        root.KualiHud.flashTicket();
      }
      return;
    }
    if (res.event === 'chop') { root.KualiAudio.chop(); }
    if (res.event === 'cook-start') { root.KualiAudio.sizzleStart(); }
    if (res.event === 'plate' && res.phase === 'transfer') { root.KualiAudio.sizzleStop(); }
    if (res.event === 'bin' && res.cleared === 'burnt') {
      root.KualiScoring.onBurnBinned();
      root.KualiAudio.burnt();
      root.KualiAudio.sizzleStop();
    }
    if (res.event === 'serve') {
      var ticket = root.KualiOrders.matchPlate(pre.plate.steps.length, res.recipeId);
      var recipe = root.KualiRecipes.get(res.recipeId);
      if (ticket && recipe) {
        root.KualiOrders.removeTicket(ticket.id);
        var result = root.KualiScoring.onServe(recipe, ticket.patience);
        if (result.comboNext > bestCombo) { bestCombo = result.comboNext; }
        root.KualiAudio.serve();
        root.KualiAudio.sizzleStop();
        var idx = -1;
        for (var i = 0; i < preTickets.length; i++) {
          if (preTickets[i].id === ticket.id) { idx = i; }
        }
        if (idx >= 0) { happyUntil[idx] = now() + 2; }
      } else {
        root.KualiScoring.onReject();
        root.KualiAudio.error();
      }
    }
    mirrorSteps();
    syncActiveRecipe();
  }

  function handleServeKey() {
    root.KualiAudio.unlock();
    if (!running || paused || frozen || over || dayDone) { return; }
    if (root.KualiStations.isReadyPlate()) { handleStation('window', 0); }
  }

  function handlePauseKey() {
    if (!running || over || dayDone) { return; }
    paused = !paused;
    howtoReturn = 'game';
    root.KualiHud.showPause(paused, day);
  }

  function resumeFromHowTo() {
    if (paused) {
      paused = false;
      root.KualiHud.hideAll();
    } else if (howtoReturn === 'title') {
      root.KualiHud.showTitle();
    } else {
      root.KualiHud.hideAll();
    }
  }

  // ---------- per-frame sync ----------

  function syncMoods() {
    var tickets = root.KualiOrders.getTickets();
    var t = now();
    for (var i = 0; i < 3; i++) {
      var mood;
      if (i < tickets.length) {
        mood = happyUntil[i] > t ? 'happy'
          : (tickets[i].patience < 0.25 ? 'angry' : 'neutral');
      } else if (angryUntil[i] > t) {
        mood = 'angry';
      } else {
        mood = 'gone';
      }
      root.KualiScene.setCustomerMood(i, mood);
    }
  }

  function buildHudState() {
    var sc = root.KualiScoring.getState();
    var st = root.KualiStations.getState();
    return {
      timeLeft: timeLeft, score: sc.score, combo: sc.combo,
      coins: sc.coins, stars: sc.reputation,
      day: day, served: sc.served, target: sc.target,
      tickets: ticketVMs(), heldKey: st.held, muted: muted
    };
  }

  function frame(dt) {
    if (frozen) {
      if (frozenHudState) { root.KualiHud.update(frozenHudState); }
      return;
    }
    if (running && !paused && !over && !dayDone) {
      timeLeft -= dt;
      var sec = Math.ceil(timeLeft);
      if (timeLeft <= 10 && timeLeft > 0 && sec !== lastTickSecond) {
        lastTickSecond = sec;
        root.KualiAudio.tick();
      }
      var preTickets = root.KualiOrders.getTickets();
      var ord = root.KualiOrders.tick(dt);
      for (var s = 0; s < ord.spawned.length; s++) { root.KualiAudio.bell(); }
      for (var e = 0; e < ord.expired.length; e++) {
        root.KualiScoring.onExpire();
        var idx = -1;
        for (var i = 0; i < preTickets.length; i++) {
          if (preTickets[i].id === ord.expired[e].id) { idx = i; }
        }
        if (idx >= 0) { angryUntil[idx] = now() + 2.5; }
      }
      var events = root.KualiStations.tick(dt);
      for (var k = 0; k < events.length; k++) {
        if (events[k].event === 'cook-done') { root.KualiAudio.bell(); }
        if (events[k].event === 'burnt') {
          root.KualiAudio.burnt();
          root.KualiAudio.sizzleStop();
        }
      }
      syncActiveRecipe();
      var sc = root.KualiScoring.getState();
      if (sc.won) { endWin(); }
      else if (sc.lost) { endLose(sc.loseReason); }
      else if (sc.targetMet) { endDayComplete(); }
      else if (timeLeft <= 0) { timeLeft = 0; endLose('time'); }
    }
    // Scene mirrors the station state every frame.
    var st = root.KualiStations.getState();
    root.KualiScene.setWokState(st.wok.state, st.wok.progress);
    root.KualiScene.setBoardState(st.board);
    root.KualiScene.setPlateState(st.plate.steps.length);
    syncMoods();
    root.KualiHud.update(buildHudState());
  }

  var rafLast = 0;
  function loop(ts) {
    root.requestAnimationFrame(loop);
    var t = ts / 1000;
    var dt = rafLast ? Math.min(t - rafLast, 0.05) : 0.016;
    rafLast = t;
    frame(dt);
  }

  // ---------- deterministic shot setups ----------

  // Drive the real station API through one recipe step.
  function doStep(ingredient, station) {
    syncActiveRecipe();
    if (ingredient) { root.KualiStations.pickIngredient(ingredient); }
    var res = root.KualiStations.actOn(station);
    mirrorSteps();
    syncActiveRecipe();
    return res;
  }

  // Advance order spawning in small deterministic ticks until n tickets
  // are on the board (or the time budget runs out).
  function spawnUntil(n, maxSeconds) {
    var elapsed = 0;
    while (root.KualiOrders.activeCount() < n && elapsed < maxSeconds) {
      root.KualiOrders.tick(0.5);
      elapsed += 0.5;
    }
  }

  // Play Nasi Goreng up to the plating stage: board chopped, wok cooked,
  // transferred to the plate, kecap drizzled — stepsDone 7, serve step next.
  function playNasiToPlate() {
    doStep('shallot', 'board');
    doStep('chilli', 'board');
    doStep('egg', 'wok');
    doStep('rice', 'wok');
    doStep('shallot', 'wok');
    doStep('chilli', 'wok');
    root.KualiStations.tick(6.5); // cook finishes (6s cook time)
    doStep(null, 'plate');        // transfer to plate
    doStep('kecap', 'plate');     // garnish
  }

  function setupShot(name) {
    frozen = true;
    running = false;
    root.KualiHud.hideAll();
    root.KualiScoring.resetRun(1);
    startDayCommon(1);
    root.KualiScene.setDayLight(1);
    var st;
    if (name === 'title') {
      root.KualiScene.setWokState('cooking', 0.4);
      root.KualiHud.showTitle();
      frozenHudState = buildHudState();
      return;
    }
    if (name === 'cook') {
      spawnUntil(2, 40);
      doStep('shallot', 'board');
      doStep('chilli', 'board');
      doStep('egg', 'wok');
      root.KualiStations.tick(3); // wok half cooked (3s of 6s)
      st = root.KualiStations.getState();
      root.KualiScene.setBoardState(st.board);
      root.KualiScene.setWokState('cooking', 0.5);
      root.KualiScene.setPlateState(0);
      frozenHudState = buildHudState();
      return;
    }
    if (name === 'serve') {
      spawnUntil(2, 40);
      playNasiToPlate();
      st = root.KualiStations.getState();
      root.KualiScene.setBoardState(st.board);
      root.KualiScene.setWokState('empty', 0);
      root.KualiScene.setPlateState(4); // finished plate at the window
      root.KualiScene.setCustomerMood(0, 'happy');
      frozenHudState = buildHudState();
      frozenHudState.combo = 2;   // second consecutive serve
      frozenHudState.served = 3;  // target nearly met (3 of 4)
      return;
    }
    // Default: cover.
    spawnUntil(2, 40);
    playNasiToPlate();
    st = root.KualiStations.getState();
    root.KualiScene.setBoardState(st.board);
    root.KualiScene.setWokState('cooking', 0.55); // flame + steam + ring
    root.KualiScene.setPlateState(4); // mid-assembly dish + plate at window
    timeLeft = 87; // 1:27 on the big timer
    frozenHudState = buildHudState();
  }

  // ---------- bootstrap ----------

  function init() {
    root.KualiHud.init({
      onPlay: function () { root.KualiAudio.unlock(); startRun(1); },
      onHowTo: function () {
        howtoReturn = running ? 'game' : 'title';
        root.KualiHud.showHowTo(day);
      },
      onHowToClose: resumeFromHowTo,
      onSoundToggle: function () {
        muted = !muted;
        root.KualiAudio.setMuted(muted);
        root.KualiHud.setMuted(muted);
      },
      onNextDay: function () { startDay(day + 1); },
      onRetryDay: function () {
        if (root.KualiScoring.getState().reputation <= 0) {
          root.KualiScoring.resetRun(day);
        }
        startDay(day);
      },
      onPlayAgain: function () { startRun(1); },
      onPause: handlePauseKey
    });
    root.KualiInput.init({
      onStation: handleStation,
      onHover: function (kind, index, x, y) {
        if (!kind) {
          root.KualiHud.hideTooltip();
          root.KualiScene.highlightTray(null);
          return;
        }
        root.KualiHud.showTooltip(root.KualiInput.labelFor(kind, index), x, y);
        root.KualiScene.highlightTray(kind === 'tray' ? index : null);
      },
      onServeKey: handleServeKey,
      onPauseKey: handlePauseKey
    });
    // First gesture unlocks audio (autoplay policy).
    var unlockOnce = function () { root.KualiAudio.unlock(); };
    root.addEventListener('pointerdown', unlockOnce);
    root.addEventListener('keydown', unlockOnce);

    var params = new root.URLSearchParams(root.location.search);
    shot = params.get('shot');
    if (shot) {
      setupShot(shot);
    } else {
      // Title backdrop: a live kitchen with one order waiting.
      startDayCommon(1);
      root.KualiHud.showTitle();
    }
    rafLast = 0;
    root.requestAnimationFrame(loop);
  }

  root.KualiMain = {
    init: init,
    startRun: startRun,
    startDay: startDay,
    getState: function () {
      return {
        day: day, timeLeft: timeLeft, running: running,
        paused: paused, frozen: frozen, over: over,
        shot: shot, scoring: root.KualiScoring.getState(),
        stations: root.KualiStations.getState()
      };
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
