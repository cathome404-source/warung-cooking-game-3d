// Kuali Emas 3D — audio.js
// All sound synthesized with WebAudio at runtime: no audio files, no
// network, no recorded samples. The AudioContext is created lazily on the
// first user gesture (unlock) so autoplay rules never block the game.
// Exposes window.KualiAudio. Classic script, no imports.
(function (root) {
  'use strict';

  var ctx = null;
  var master = null;
  var noiseBuf = null;
  var sizzleNodes = null;
  var muted = false;
  var MASTER_VOL = 0.5;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') { ctx.resume(); }
      return ctx;
    }
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) { return null; }
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_VOL;
    master.connect(ctx.destination);
    // 1 second of white noise, reused by sizzle / chop / thud.
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var data = noiseBuf.getChannelData(0);
    for (var i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return ctx;
  }

  // Call from any user gesture (click / key) so later sounds can play.
  function unlock() {
    ensure();
  }

  function setMuted(m) {
    muted = !!m;
    if (master) {
      master.gain.setTargetAtTime(muted ? 0 : MASTER_VOL, ctx.currentTime, 0.02);
    }
    return muted;
  }

  function isMuted() { return muted; }

  // One oscillator blip with an exponential decay envelope.
  function tone(freq, dur, type, vol, delay, slideTo) {
    var c = ensure();
    if (!c) { return; }
    var t0 = c.currentTime + (delay || 0);
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) { osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur); }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // A burst of filtered noise.
  function noiseBurst(dur, filterType, freq, vol, delay) {
    var c = ensure();
    if (!c) { return; }
    var t0 = c.currentTime + (delay || 0);
    var src = c.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    var filter = c.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  // Short dry wooden knock.
  function chop() {
    tone(190, 0.08, 'triangle', 0.35, 0, 85);
    noiseBurst(0.05, 'lowpass', 900, 0.25);
  }

  // Filtered-noise sizzle loop while food cooks.
  function sizzleStart() {
    var c = ensure();
    if (!c || sizzleNodes) { return; }
    var src = c.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    var filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 4200;
    filter.Q.value = 0.8;
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.setTargetAtTime(0.14, c.currentTime, 0.15);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start();
    sizzleNodes = { src: src, gain: g };
  }

  function sizzleStop() {
    if (!sizzleNodes || !ctx) { return; }
    var nodes = sizzleNodes;
    sizzleNodes = null;
    nodes.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08);
    var src = nodes.src;
    setTimeout(function () { try { src.stop(); } catch (e) { /* already stopped */ } }, 400);
  }

  // Bright two-note ding when a dish is served.
  function serve() {
    tone(880, 0.18, 'sine', 0.3, 0);
    tone(1318, 0.28, 'sine', 0.3, 0.09);
  }

  // Low error buzz for a wrong ingredient.
  function error() {
    tone(110, 0.25, 'sawtooth', 0.22, 0, 95);
    tone(104, 0.25, 'sawtooth', 0.15, 0.02, 90);
  }

  // Dull thud when food burns.
  function burnt() {
    tone(75, 0.32, 'sine', 0.4, 0, 38);
    noiseBurst(0.18, 'lowpass', 300, 0.3);
  }

  // One-per-second tick while the timer is at 10 seconds or less.
  function tick() {
    tone(1050, 0.05, 'square', 0.12);
  }

  // Soft bell when a new order arrives.
  function bell() {
    tone(660, 0.35, 'sine', 0.18, 0, 660);
    tone(990, 0.4, 'sine', 0.12, 0.02);
  }

  // Short rising chime when a day is completed.
  function chime() {
    var notes = [523, 659, 784, 1046];
    for (var i = 0; i < notes.length; i++) {
      tone(notes[i], 0.22, 'sine', 0.22, i * 0.09);
    }
  }

  root.KualiAudio = {
    unlock: unlock,
    setMuted: setMuted,
    isMuted: isMuted,
    chop: chop,
    sizzleStart: sizzleStart,
    sizzleStop: sizzleStop,
    serve: serve,
    error: error,
    burnt: burnt,
    tick: tick,
    bell: bell,
    chime: chime
  };
})(typeof window !== 'undefined' ? window : globalThis);
