// Kuali Emas 3D — stations.js
// The hand + station state machine. One dish is worked at a time; main.js
// sets the active recipe to the oldest ticket (setActiveRecipe) and mirrors
// step progress back to KualiOrders.
//
// State:
//   held: ingredient key in the hand, or null
//   board: chopped ingredient keys waiting on the cutting board
//   wok: {contents:[keys], progress 0-1, cooking, done, burnt, burnTimer}
//   plate: {base:bool, steps:[hex colours], recipeId}
//   readyPlate: plate holds a complete dish (base + all plate steps done)
//
// Every action returns {ok, reason?, event, ...} with event one of:
// 'pick' 'chop' 'cook-start' 'add' 'cook-done' 'burnt' 'plate' 'serve'
// 'reject' 'bin'. tick(dt) returns an array of events (cook-done / burnt).
// Wrong ingredient -> {ok:false, event:'reject'} (breaks the combo in main).
// Exposes window.KualiStations. Classic script, no imports.
// Depends on window.KualiUtil + window.KualiRecipes (loaded before this file).
(function (root) {
  'use strict';

  var BURN_WINDOW = 8; // seconds a finished cook may sit before it burns
  var DEFAULT_COOK_SECONDS = 6;

  // Only these can be chopped on the board.
  var CHOPABLE = { shallot: true, chilli: true, turmeric: true };

  // Garnish colour per ingredient, for the plate + scene.
  var PLATE_COLOURS = {
    rice: '#f5ead0', egg: '#ffd23f', shallot: '#c86ba8', chilli: '#e5231b',
    kecap: '#3a1f0d', chicken: '#f2b8a0', turmeric: '#e8960c',
    sprouts: '#e8f0d0', peanut: '#c89b5a', lime: '#7ed321'
  };

  var day = 1;
  var held = null;
  var board = [];
  var wok = null;
  var plate = null;
  var recipe = null;
  var stepsDone = 0;

  function freshWok() {
    return { contents: [], progress: 0, cooking: false, done: false, burnt: false, burnTimer: 0 };
  }

  function freshPlate() {
    return { base: false, steps: [], recipeId: null };
  }

  function reset(newDay) {
    day = root.KualiUtil.clamp(newDay || 1, 1, 5);
    held = null;
    board = [];
    wok = freshWok();
    plate = freshPlate();
    recipe = null;
    stepsDone = 0;
  }

  // Tell stations which recipe (and how far along it) the player is working.
  // main.js calls this from the oldest ticket; pass null to clear.
  function setActiveRecipe(recipeId, done) {
    recipe = recipeId ? root.KualiRecipes.get(recipeId) : null;
    stepsDone = done || 0;
  }

  function getStepsDone() { return stepsDone; }

  function currentStep() {
    if (!recipe) { return null; }
    return stepsDone < recipe.steps.length ? recipe.steps[stepsDone] : null;
  }

  function getCurrentStep() {
    var s = currentStep();
    return s ? { station: s.station, ingredient: s.ingredient, label: s.label } : null;
  }

  function reject(reason) {
    return { ok: false, event: 'reject', reason: reason || 'wrong-ingredient' };
  }

  // --- hand ---

  function pickIngredient(key) {
    if (root.KualiRecipes.trayIndex(key) < 0) {
      return { ok: false, event: 'reject', reason: 'bad-ingredient' };
    }
    held = key; // picking replaces whatever was held
    return { ok: true, event: 'pick', held: key };
  }

  // --- station actions ---

  function actOn(kind) {
    if (kind === 'board') { return actBoard(); }
    if (kind === 'wok') { return actWok(); }
    if (kind === 'plate') { return actPlate(); }
    if (kind === 'window') { return actWindow(); }
    if (kind === 'bin') { return actBin(); }
    return reject('bad-station');
  }

  function actBoard() {
    var step = currentStep();
    if (!step || step.station !== 'board') { return reject('not-board-step'); }
    if (!held) { return reject('empty-hand'); }
    if (held !== step.ingredient) { return reject('wrong-ingredient'); }
    if (!CHOPABLE[held]) { return reject('not-chopable'); }
    var key = held;
    board.push(key);
    held = null;
    stepsDone++;
    return { ok: true, event: 'chop', ingredient: key, stepsDone: stepsDone };
  }

  function allWokStepsDone() {
    if (!recipe) { return true; }
    for (var i = 0; i < recipe.steps.length; i++) {
      if (recipe.steps[i].station === 'wok' && i >= stepsDone) { return false; }
    }
    return true;
  }

  function actWok() {
    var step = currentStep();
    if (!step || step.station !== 'wok') { return reject('not-wok-step'); }
    if (!held) { return reject('empty-hand'); }
    if (held !== step.ingredient) { return reject('wrong-ingredient'); }
    if (wok.burnt) { return reject('wok-burnt'); }
    if (wok.done) { return reject('wok-done'); }
    var key = held;
    var first = wok.contents.length === 0;
    if (first) {
      wok.cooking = true;
      wok.progress = 0;
      wok.burnTimer = 0;
    }
    wok.contents.push(key);
    wok.burnTimer = 0; // fresh food in resets the overcook clock
    // A chopped ingredient leaves the board as it goes into the pan.
    var bi = board.indexOf(key);
    if (bi >= 0) { board.splice(bi, 1); }
    held = null;
    stepsDone++;
    return {
      ok: true, event: first ? 'cook-start' : 'add',
      ingredient: key, stepsDone: stepsDone
    };
  }

  function actPlate() {
    // Finished cook -> plate (no ingredient needed, hand must be empty).
    if (wok.done && !plate.base) {
      if (held) { return reject('hand-full'); }
      plate.base = true;
      plate.recipeId = recipe ? recipe.id : null;
      plate.steps = [recipe ? recipe.plateBase : '#e8b64c'];
      wok = freshWok();
      return { ok: true, event: 'plate', phase: 'transfer', steps: plate.steps.slice() };
    }
    var step = currentStep();
    if (!step || step.station !== 'plate') { return reject('not-plate-step'); }
    if (!plate.base) { return reject('no-cook-on-plate'); }
    if (!held) { return reject('empty-hand'); }
    if (held !== step.ingredient) { return reject('wrong-ingredient'); }
    var key = held;
    plate.steps.push(PLATE_COLOURS[key] || '#ffffff');
    held = null;
    stepsDone++;
    return { ok: true, event: 'plate', phase: 'garnish', ingredient: key, steps: plate.steps.slice() };
  }

  function isReadyPlate() {
    var step = currentStep();
    return !!(plate.base && step && step.station === 'window');
  }

  function actWindow() {
    if (!isReadyPlate()) { return reject('plate-not-ready'); }
    var rid = plate.recipeId;
    plate = freshPlate();
    stepsDone = 0;
    recipe = null;
    return { ok: true, event: 'serve', recipeId: rid };
  }

  function actBin() {
    if (wok.burnt) {
      wok = freshWok();
      return { ok: true, event: 'bin', cleared: 'burnt' };
    }
    if (held) {
      held = null;
      return { ok: true, event: 'bin', cleared: 'held' };
    }
    if (board.length > 0) {
      board = [];
      return { ok: true, event: 'bin', cleared: 'board' };
    }
    return reject('bin-empty');
  }

  // --- time ---

  function burnWok() {
    wok.burnt = true;
    wok.cooking = false;
    wok.done = false;
  }

  // Advance cooking / burning. Returns events that fired this tick.
  function tick(dt) {
    var events = [];
    if (!wok) { return events; }
    if (wok.cooking && !wok.done && !wok.burnt) {
      var cookSeconds = recipe ? recipe.cookSeconds : DEFAULT_COOK_SECONDS;
      wok.progress += dt / cookSeconds;
      if (wok.progress >= 1) {
        wok.progress = 1;
        if (allWokStepsDone()) {
          wok.done = true;
          wok.cooking = false;
          wok.burnTimer = 0;
          events.push({ event: 'cook-done' });
        } else {
          // Fully fried but ingredients still missing: overcooking clock.
          wok.burnTimer += dt;
          if (wok.burnTimer > BURN_WINDOW) {
            burnWok();
            events.push({ event: 'burnt' });
          }
        }
      }
    } else if (wok.done && !wok.burnt) {
      wok.burnTimer += dt;
      if (wok.burnTimer > BURN_WINDOW) {
        burnWok();
        events.push({ event: 'burnt' });
      }
    }
    return events;
  }

  // --- snapshots for main.js -> scene / HUD ---

  function getWokState() {
    if (wok.burnt) { return 'burnt'; }
    if (wok.done) { return 'done'; }
    if (wok.cooking) { return 'cooking'; }
    return 'empty';
  }

  function getState() {
    return {
      day: day,
      held: held,
      board: board.slice(),
      wok: {
        contents: wok.contents.slice(), progress: wok.progress,
        cooking: wok.cooking, done: wok.done, burnt: wok.burnt,
        state: getWokState()
      },
      plate: {
        base: plate.base, steps: plate.steps.slice(), recipeId: plate.recipeId
      },
      readyPlate: isReadyPlate(),
      recipeId: recipe ? recipe.id : null,
      stepsDone: stepsDone,
      currentStep: getCurrentStep()
    };
  }

  root.KualiStations = {
    BURN_WINDOW: BURN_WINDOW,
    PLATE_COLOURS: PLATE_COLOURS,
    reset: reset,
    setActiveRecipe: setActiveRecipe,
    getStepsDone: getStepsDone,
    getCurrentStep: getCurrentStep,
    pickIngredient: pickIngredient,
    actOn: actOn,
    tick: tick,
    isReadyPlate: isReadyPlate,
    getWokState: getWokState,
    getState: getState
  };
})(typeof window !== 'undefined' ? window : globalThis);
