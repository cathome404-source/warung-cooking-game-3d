// Kuali Emas 3D — scoring.js
// Score, combo multiplier, coins + tips, reputation stars, day targets,
// win and lose checks.
//
// Combo: 1x on the 1st consecutive good serve, 1.5x on the 2nd, 2x on the
// 3rd, 2.5x on the 4th, capped at 3x from the 5th. Any burn / expiry /
// wrong ingredient (via onBurnBinned / onExpire / onReject) resets it to 1.
// Coins: base/10 + tip 5 if patience > 0.5, 10 if patience > 0.75.
// Reputation 0-5 (starts at 5): serve on time +0.25, expired -1,
// binned burnt food -0.5. Lose at reputation <= 0 or 3 expired in one day.
// Win: Day 5 serve target met.
// reset(day) starts a new day: served/expiredToday/combo reset, while
// score, coins, reputation and servedTotal carry over the whole run.
// Exposes window.KualiScoring. Classic script, no imports.
(function (root) {
  'use strict';

  var DAY_TARGETS = { 1: 4, 2: 6, 3: 8, 4: 10, 5: 12 };
  var MAX_REPUTATION = 5;

  var day = 1;
  var score = 0;
  var coins = 0;
  var streak = 0; // consecutive good serves
  var reputation = MAX_REPUTATION;
  var served = 0; // served today
  var servedTotal = 0;
  var expiredToday = 0;

  function targetFor(d) {
    return DAY_TARGETS[d] || 4;
  }

  function comboFor(s) {
    var c = 1 + 0.5 * s;
    return c > 3 ? 3 : c;
  }

  function reset(newDay) {
    day = root.KualiUtil.clamp(newDay || 1, 1, 5);
    served = 0;
    expiredToday = 0;
    streak = 0;
    // score, coins, reputation, servedTotal persist across days.
  }

  // Full run reset (Play Again): also clears score/coins/reputation.
  function resetRun(newDay) {
    score = 0;
    coins = 0;
    reputation = MAX_REPUTATION;
    servedTotal = 0;
    reset(newDay);
  }

  function isLost() {
    return reputation <= 0 || expiredToday >= 3;
  }

  function loseReason() {
    if (reputation <= 0) { return 'reputation'; }
    if (expiredToday >= 3) { return 'expired'; }
    return null;
  }

  function isWon() {
    return day === 5 && served >= targetFor(5);
  }

  function onServe(recipe, patience) {
    var p = root.KualiUtil.clamp(patience === undefined ? 1 : patience, 0, 1);
    var mult = comboFor(streak);
    var scoreGained = Math.round(recipe.baseScore * mult);
    var tip = p > 0.75 ? 10 : (p > 0.5 ? 5 : 0);
    var coinsGained = Math.floor(recipe.baseScore / 10) + tip;
    score += scoreGained;
    coins += coinsGained;
    served += 1;
    servedTotal += 1;
    streak += 1;
    reputation = Math.min(MAX_REPUTATION, reputation + 0.25);
    return {
      scoreGained: scoreGained, coinsGained: coinsGained, tip: tip,
      combo: mult, comboNext: comboFor(streak),
      served: served, target: targetFor(day),
      targetMet: served >= targetFor(day), won: isWon()
    };
  }

  function onExpire() {
    reputation = Math.max(0, reputation - 1);
    expiredToday += 1;
    streak = 0;
    return { reputation: reputation, expiredToday: expiredToday, lost: isLost(), loseReason: loseReason() };
  }

  function onBurnBinned() {
    reputation = Math.max(0, reputation - 0.5);
    streak = 0;
    return { reputation: reputation, lost: isLost(), loseReason: loseReason() };
  }

  // Wrong ingredient: combo resets, nothing else changes.
  function onReject() {
    streak = 0;
    return { combo: 1 };
  }

  function getState() {
    return {
      day: day,
      score: score,
      coins: coins,
      combo: comboFor(streak),
      streak: streak,
      reputation: reputation,
      served: served,
      servedTotal: servedTotal,
      expiredToday: expiredToday,
      target: targetFor(day),
      targetMet: served >= targetFor(day),
      won: isWon(),
      lost: isLost(),
      loseReason: loseReason()
    };
  }

  root.KualiScoring = {
    DAY_TARGETS: DAY_TARGETS,
    targetFor: targetFor,
    reset: reset,
    resetRun: resetRun,
    onServe: onServe,
    onExpire: onExpire,
    onBurnBinned: onBurnBinned,
    onReject: onReject,
    isWon: isWon,
    isLost: isLost,
    loseReason: loseReason,
    getState: getState
  };
})(typeof window !== 'undefined' ? window : globalThis);
