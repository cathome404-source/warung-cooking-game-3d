// Kuali Emas 3D — util.js
// Tiny seeded PRNG + small helpers. No unseeded randomness in game logic.
// Exposes window.KualiUtil. Classic script, no imports.
(function (root) {
  'use strict';

  // mulberry32: small fast seeded PRNG. Returns a function yielding [0, 1).
  function mulberry32(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Alias with a clearer name for call sites that build a run RNG.
  function createRng(seed) {
    return mulberry32(seed);
  }

  function clamp(v, min, max) {
    if (v < min) { return min; }
    if (v > max) { return max; }
    return v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * clamp(t, 0, 1);
  }

  // Seconds -> "M:SS" (e.g. 125 -> "2:05", 9 -> "0:09"). Negative clamps to 0.
  function formatTime(s) {
    var total = Math.max(0, Math.floor(s));
    var m = Math.floor(total / 60);
    var sec = total % 60;
    return m + ':' + (sec < 10 ? '0' + sec : '' + sec);
  }

  // Pick a random element from an array using a seeded rng function.
  function pick(arr, rng) {
    if (!arr || arr.length === 0) { return undefined; }
    return arr[Math.floor(rng() * arr.length)];
  }

  root.KualiUtil = {
    mulberry32: mulberry32,
    createRng: createRng,
    clamp: clamp,
    lerp: lerp,
    formatTime: formatTime,
    pick: pick
  };
})(typeof window !== 'undefined' ? window : globalThis);
