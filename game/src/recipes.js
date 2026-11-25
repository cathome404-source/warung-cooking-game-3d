// Kuali Emas 3D — recipes.js
// The three recipes from the spec. Steps must be done in order; each step is
// one station action: {station:'board'|'wok'|'plate'|'window',
// ingredient:'<key>'|null, label:'<short Indonesian instruction>'}.
// Exposes window.KualiRecipes. Classic script, no imports.
(function (root) {
  'use strict';

  // Tray order on the counter (matches the 3D scene, trays 0-9).
  var TRAY_ORDER = [
    'rice', 'egg', 'shallot', 'chilli', 'kecap',
    'chicken', 'turmeric', 'sprouts', 'peanut', 'lime'
  ];

  var RECIPES = [
    {
      id: 'nasi-goreng',
      name: 'Nasi Goreng',
      baseScore: 100,
      unlockDay: 1,
      cookSeconds: 6,
      plateBase: '#e8b64c',
      ingredients: ['rice', 'egg', 'shallot', 'chilli', 'kecap'],
      steps: [
        { station: 'board', ingredient: 'shallot', label: 'Cincang bawang' },
        { station: 'board', ingredient: 'chilli', label: 'Cincang cabai' },
        { station: 'wok', ingredient: 'egg', label: 'Goreng telur di wajan' },
        { station: 'wok', ingredient: 'rice', label: 'Masukkan nasi' },
        { station: 'wok', ingredient: 'shallot', label: 'Masukkan bawang cincang' },
        { station: 'wok', ingredient: 'chilli', label: 'Masukkan cabai cincang' },
        { station: 'plate', ingredient: 'kecap', label: 'Siram kecap manis' },
        { station: 'window', ingredient: null, label: 'Sajikan' }
      ]
    },
    {
      id: 'soto-ayam',
      name: 'Soto Ayam',
      baseScore: 150,
      unlockDay: 2,
      cookSeconds: 8,
      plateBase: '#f2c14e',
      ingredients: ['chicken', 'turmeric', 'sprouts', 'egg', 'shallot'],
      steps: [
        { station: 'board', ingredient: 'turmeric', label: 'Cincang kunyit' },
        { station: 'wok', ingredient: 'chicken', label: 'Rebus ayam' },
        { station: 'wok', ingredient: 'sprouts', label: 'Masukkan tauge' },
        { station: 'wok', ingredient: 'turmeric', label: 'Masukkan kunyit' },
        { station: 'plate', ingredient: 'egg', label: 'Taruh telur rebus' },
        { station: 'plate', ingredient: 'shallot', label: 'Tabur bawang goreng' },
        { station: 'window', ingredient: null, label: 'Sajikan' }
      ]
    },
    {
      id: 'sate-ayam',
      name: 'Sate Ayam',
      baseScore: 200,
      unlockDay: 3,
      cookSeconds: 7,
      plateBase: '#b5762e',
      ingredients: ['chicken', 'peanut', 'shallot', 'chilli', 'lime'],
      steps: [
        { station: 'board', ingredient: 'shallot', label: 'Cincang bawang' },
        { station: 'board', ingredient: 'chilli', label: 'Cincang cabai' },
        { station: 'wok', ingredient: 'chicken', label: 'Bakar sate ayam' },
        { station: 'plate', ingredient: 'peanut', label: 'Oles saus kacang' },
        { station: 'plate', ingredient: 'lime', label: 'Peras jeruk nipis' },
        { station: 'plate', ingredient: 'shallot', label: 'Tabur bawang' },
        { station: 'window', ingredient: null, label: 'Sajikan' }
      ]
    }
  ];

  function get(id) {
    for (var i = 0; i < RECIPES.length; i++) {
      if (RECIPES[i].id === id) { return RECIPES[i]; }
    }
    return null;
  }

  function isUnlocked(id, day) {
    var r = get(id);
    return !!r && day >= r.unlockDay;
  }

  // Recipes available on a given day, in unlock order.
  function unlockedFor(day) {
    var out = [];
    for (var i = 0; i < RECIPES.length; i++) {
      if (day >= RECIPES[i].unlockDay) { out.push(RECIPES[i]); }
    }
    return out;
  }

  function trayIndex(key) {
    return TRAY_ORDER.indexOf(key);
  }

  function trayKey(index) {
    return TRAY_ORDER[index] || null;
  }

  root.KualiRecipes = {
    TRAY_ORDER: TRAY_ORDER,
    RECIPES: RECIPES,
    get: get,
    isUnlocked: isUnlocked,
    unlockedFor: unlockedFor,
    trayIndex: trayIndex,
    trayKey: trayKey
  };
})(typeof window !== 'undefined' ? window : globalThis);
