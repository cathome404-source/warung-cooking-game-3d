// Kuali Emas 3D — input.js
// Mouse + keyboard input only: it translates raw events into game intents
// and hands them to main.js through callbacks. No game logic lives here —
// it never touches stations, scoring, or the HUD directly (except the
// scene raycast helper and the tray highlight, which are pure visuals).
// Exposes window.KualiInput. Classic script, no imports.
// Depends on window.KualiScene (pickAt / highlightTray) + KualiRecipes.
(function (root) {
  'use strict';

  var INGREDIENT_NAMES = {
    rice: 'Nasi', egg: 'Telur', shallot: 'Bawang', chilli: 'Cabai',
    kecap: 'Kecap Manis', chicken: 'Ayam', turmeric: 'Kunyit',
    sprouts: 'Tauge', peanut: 'Saus Kacang', lime: 'Jeruk Nipis'
  };

  var STATION_NAMES = {
    board: 'Talenan — potong bahan',
    wok: 'Wok — masak di atas api',
    plate: 'Piring — tata hidangan',
    window: 'Jendela Sajian — antar pesanan',
    bin: 'Tempat Sampah — buang yang gosong'
  };

  var callbacks = null;
  var canvas = null;
  var attached = false;

  function stationLabel(kind, index) {
    if (kind === 'tray') {
      var key = root.KualiRecipes.trayKey(index);
      return INGREDIENT_NAMES[key] || 'Bahan';
    }
    return STATION_NAMES[kind] || null;
  }

  function onClick(e) {
    if (!callbacks || !root.KualiScene) { return; }
    var hit = root.KualiScene.pickAt(e.clientX, e.clientY);
    if (!hit || hit.kind === 'none') { return; }
    callbacks.onStation(hit.kind, hit.index);
  }

  function onMove(e) {
    if (!callbacks || !root.KualiScene) { return; }
    var hit = root.KualiScene.pickAt(e.clientX, e.clientY);
    if (!hit || hit.kind === 'none') {
      callbacks.onHover(null, -1, e.clientX, e.clientY);
      return;
    }
    callbacks.onHover(hit.kind, hit.index, e.clientX, e.clientY);
  }

  function onKey(e) {
    if (!callbacks) { return; }
    // Number keys 1-0 grab the ingredient in that counter slot.
    if (e.code === 'Digit0') { callbacks.onStation('tray', 9); e.preventDefault(); return; }
    if (e.code >= 'Digit1' && e.code <= 'Digit9') {
      callbacks.onStation('tray', parseInt(e.code.slice(5), 10) - 1);
      e.preventDefault();
      return;
    }
    if (e.code === 'Space') {
      callbacks.onServeKey();
      e.preventDefault();
      return;
    }
    if (e.code === 'Escape') {
      callbacks.onPauseKey();
      e.preventDefault();
    }
  }

  // callbacks: { onStation(kind, index), onHover(kind, index, x, y),
  //   onServeKey(), onPauseKey() }. onHover may be omitted.
  function init(cb) {
    callbacks = cb || {};
    canvas = document.getElementById('game-canvas');
    if (!canvas || attached) { return; }
    attached = true;
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('mousemove', onMove);
    root.addEventListener('keydown', onKey);
  }

  // Human-readable label for a hovered station / tray (for the tooltip).
  function labelFor(kind, index) {
    return stationLabel(kind, index);
  }

  root.KualiInput = {
    init: init,
    labelFor: labelFor,
    INGREDIENT_NAMES: INGREDIENT_NAMES
  };
})(typeof window !== 'undefined' ? window : globalThis);
