// Kuali Emas 3D — orders.js
// The order board: ticket model, seeded spawning, patience drain, expiry,
// and matching a finished plate to its ticket.
// Ticket: {id, recipeId, stepsDone, patience (0-1), maxPatience (seconds)}.
// tick(dt) returns {spawned:[tickets], expired:[tickets]}; the caller
// (main.js) turns those into sounds / HUD / scoring events.
// Exposes window.KualiOrders. Classic script, no imports.
// Depends on window.KualiUtil + window.KualiRecipes (loaded before this file).
(function (root) {
  'use strict';

  var MAX_TICKETS = 3;
  // Spawn gap (seconds) and patience lifetime (seconds) per day.
  // Later days: orders arrive faster and patience drains faster.
  var SPAWN_INTERVAL = { 1: 18, 2: 15, 3: 12, 4: 10, 5: 8 };
  var PATIENCE_SECONDS = { 1: 75, 2: 65, 3: 55, 4: 48, 5: 42 };

  var day = 1;
  var rng = null;
  var tickets = [];
  var nextId = 1;
  var spawnTimer = 0;

  function nextInterval() {
    var base = SPAWN_INTERVAL[day] || 18;
    // Seeded jitter: 75%-125% of the base interval.
    return base * (0.75 + rng() * 0.5);
  }

  function pickRecipeId() {
    var unlocked = root.KualiRecipes.unlockedFor(day);
    var r = root.KualiUtil.pick(unlocked, rng);
    return r ? r.id : 'nasi-goreng';
  }

  function spawnTicket() {
    var t = {
      id: 'T' + (nextId++),
      recipeId: pickRecipeId(),
      stepsDone: 0,
      patience: 1,
      maxPatience: PATIENCE_SECONDS[day] || 75
    };
    tickets.push(t);
    return t;
  }

  function reset(newDay, seed) {
    day = root.KualiUtil.clamp(newDay || 1, 1, 5);
    rng = root.KualiUtil.createRng(seed === undefined ? 1 : seed);
    tickets = [];
    nextId = 1;
    // One order is already waiting when the day starts.
    spawnTicket();
    spawnTimer = nextInterval();
  }

  // Advance time: spawn new tickets, drain patience, expire dead ones.
  // Returns {spawned, expired} (fresh arrays, ticket objects are copies).
  function tick(dt) {
    var spawned = [];
    var expired = [];
    spawnTimer -= dt;
    while (spawnTimer <= 0) {
      if (tickets.length < MAX_TICKETS) {
        spawned.push(copy(spawnTicket()));
        spawnTimer += nextInterval();
      } else {
        // Board full: retry soon instead of spinning.
        spawnTimer = 2;
        break;
      }
    }
    var i;
    for (i = tickets.length - 1; i >= 0; i--) {
      tickets[i].patience -= dt / tickets[i].maxPatience;
      if (tickets[i].patience <= 0) {
        tickets[i].patience = 0;
        expired.push(copy(tickets[i]));
        tickets.splice(i, 1);
      }
    }
    return { spawned: spawned, expired: expired };
  }

  function copy(t) {
    return {
      id: t.id, recipeId: t.recipeId, stepsDone: t.stepsDone,
      patience: t.patience, maxPatience: t.maxPatience
    };
  }

  function getTickets() {
    var out = [];
    for (var i = 0; i < tickets.length; i++) { out.push(copy(tickets[i])); }
    return out;
  }

  function activeCount() {
    return tickets.length;
  }

  // Oldest ticket = the one the player should work on first.
  function getOldestTicket() {
    return tickets.length ? copy(tickets[0]) : null;
  }

  function findTicket(id) {
    for (var i = 0; i < tickets.length; i++) {
      if (tickets[i].id === id) { return tickets[i]; }
    }
    return null;
  }

  function setStepsDone(id, n) {
    var t = findTicket(id);
    if (!t) { return false; }
    t.stepsDone = root.KualiUtil.clamp(n, 0, 99);
    return true;
  }

  // Advance the oldest ticket of a recipe by one step; returns the ticket.
  function advanceStep(recipeId) {
    for (var i = 0; i < tickets.length; i++) {
      if (tickets[i].recipeId === recipeId) {
        tickets[i].stepsDone += 1;
        return copy(tickets[i]);
      }
    }
    return null;
  }

  function removeTicket(id) {
    for (var i = 0; i < tickets.length; i++) {
      if (tickets[i].id === id) {
        return copy(tickets.splice(i, 1)[0]);
      }
    }
    return null;
  }

  // Find the ticket a finished plate serves. plateSteps may be a count or
  // an array of garnish colours; the plate must hold the full dish:
  // 1 base + one step per 'plate' step of the recipe.
  function matchPlate(plateSteps, recipeId) {
    var recipe = root.KualiRecipes.get(recipeId);
    if (!recipe) { return null; }
    var count = (typeof plateSteps === 'number')
      ? plateSteps
      : (plateSteps ? plateSteps.length : 0);
    var plateStepCount = 0;
    for (var s = 0; s < recipe.steps.length; s++) {
      if (recipe.steps[s].station === 'plate') { plateStepCount++; }
    }
    if (count < 1 + plateStepCount) { return null; }
    for (var i = 0; i < tickets.length; i++) {
      if (tickets[i].recipeId === recipeId) { return copy(tickets[i]); }
    }
    return null;
  }

  root.KualiOrders = {
    MAX_TICKETS: MAX_TICKETS,
    reset: reset,
    tick: tick,
    getTickets: getTickets,
    activeCount: activeCount,
    getOldestTicket: getOldestTicket,
    setStepsDone: setStepsDone,
    advanceStep: advanceStep,
    removeTicket: removeTicket,
    matchPlate: matchPlate
  };
})(typeof window !== 'undefined' ? window : globalThis);
