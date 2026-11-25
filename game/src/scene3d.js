// Kuali Emas 3D — scene3d.js
// The 3D warung kitchen: renderer, fixed camera, lights, geometry, stations,
// flame + steam + dust animation, day lighting. Exposes window.KualiScene.
// Written fresh from the build spec (section 4). No Math.random anywhere;
// a tiny seeded PRNG (mulberry32) supplies all variation.
(function () {
  'use strict';

  // ---------- seeded PRNG ----------
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rng = mulberry32(20261125);

  // ---------- palette ----------
  var INGREDIENTS = [
    { key: 'rice',     name: 'Nasi',      color: 0xf5ead0, label: 'Nasi' },
    { key: 'egg',      name: 'Telur',     color: 0xffd23f, label: 'Telur' },
    { key: 'shallot',  name: 'Bawang',    color: 0xc86ba8, label: 'Bawang' },
    { key: 'chilli',   name: 'Cabai',     color: 0xe5231b, label: 'Cabai' },
    { key: 'kecap',    name: 'Kecap',     color: 0x3a1f0d, label: 'Kecap' },
    { key: 'chicken',  name: 'Ayam',      color: 0xf2b8a0, label: 'Ayam' },
    { key: 'turmeric', name: 'Kunyit',    color: 0xe8960c, label: 'Kunyit' },
    { key: 'sprouts',  name: 'Tauge',     color: 0xe8f0d0, label: 'Tauge' },
    { key: 'peanut',   name: 'Kacang',    color: 0xc89b5a, label: 'Kacang' },
    { key: 'lime',     name: 'Jeruk',     color: 0x7ed321, label: 'Jeruk' },
  ];
  var SHIRT_COLORS = [0x2e86de, 0xe84118, 0x10ac84];
  var CUSTOMER_COUNT = 3;

  // ---------- renderer / camera ----------
  var canvas = document.getElementById('game-canvas');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a1408);
  scene.fog = new THREE.Fog(0x2a1408, 22, 34);

  var camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 12.0, 10.5);
  camera.lookAt(0, 0.3, -0.4);

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---------- helpers ----------
  function mat(color, rough, metal) {
    return new THREE.MeshStandardMaterial({
      color: color, roughness: rough === undefined ? 0.85 : rough,
      metalness: metal === undefined ? 0.0 : metal,
    });
  }
  function box(w, h, d, color, rough, metal) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, rough, metal));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function cyl(rt, rb, h, color, rough, metal, seg) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 24), mat(color, rough, metal));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function sph(r, color, rough, metal) {
    var m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat(color, rough, metal));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function place(mesh, x, y, z, parent) {
    mesh.position.set(x, y, z);
    (parent || scene).add(mesh);
    return mesh;
  }
  function labelTexture(text) {
    var c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    var g = c.getContext('2d');
    g.fillStyle = '#fff3d6'; g.fillRect(0, 0, 256, 64);
    g.strokeStyle = '#8a5a00'; g.lineWidth = 6; g.strokeRect(3, 3, 250, 58);
    g.fillStyle = '#3a2410'; g.font = 'bold 34px Trebuchet MS, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 128, 34);
    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function softCircleTexture(inner, outer) {
    var c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, inner);
    grad.addColorStop(1, outer);
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // ---------- lights ----------
  var ambient = new THREE.AmbientLight(0xffe0b8, 0.55);
  scene.add(ambient);

  var sun = new THREE.DirectionalLight(0xffd9a0, 1.15);
  sun.position.set(5, 10, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -11; sun.shadow.camera.right = 11;
  sun.shadow.camera.top = 11; sun.shadow.camera.bottom = -11;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 30;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  var lampLights = [];
  [-3.2, 3.2].forEach(function (x) {
    var lamp = new THREE.PointLight(0xffb347, 0.9, 9, 1.6);
    lamp.position.set(x, 3.6, 2.4);
    scene.add(lamp);
    lampLights.push(lamp);
    // cord + shade + bulb, hanging over the counter
    var cord = cyl(0.02, 0.02, 1.6, 0x1a1a1a, 0.9);
    place(cord, x, 4.6, 2.4);
    var shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.42, 0.42, 24, 1, true), mat(0xb4762a, 0.55));
    shade.castShadow = true;
    place(shade, x, 3.85, 2.4);
    var bulb = sph(0.14, 0xffe9a8, 0.3);
    bulb.material.emissive = new THREE.Color(0xffc95e);
    bulb.material.emissiveIntensity = 1.4;
    place(bulb, x, 3.62, 2.4);
  });

  var fireLight = new THREE.PointLight(0xff7a1a, 1.6, 7, 1.8);
  fireLight.position.set(1.0, 1.7, 0.6);
  scene.add(fireLight);

  var windowGlow = new THREE.PointLight(0xffc46b, 0.8, 6, 1.8);
  windowGlow.position.set(6.3, 2.2, -2.2);
  scene.add(windowGlow);

  // ---------- pickables registry ----------
  var pickables = [];
  function registerPickable(mesh, kind, index) {
    mesh.userData.pick = { kind: kind, index: index };
    pickables.push(mesh);
  }

  // ---------- floor + back wall + awning ----------
  var floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 16), mat(0x7a4a22, 0.9));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  // plank seams
  for (var pi = 0; pi < 12; pi++) {
    var seam = box(0.05, 0.01, 16, 0x5d3413, 0.95);
    place(seam, -5.5 + pi * 1.0, 0.005, 0);
    seam.castShadow = false;
  }

  var wall = box(24, 6, 0.4, 0xb4552d, 0.95);
  place(wall, 0, 3, -4.6);
  // banana-leaf awning: slanted green leaves above the wall
  var awning = new THREE.Group();
  for (var ai = 0; ai < 7; ai++) {
    var leaf = box(2.6, 0.06, 1.6, ai % 2 ? 0x2e7d32 : 0x388e3c, 0.7);
    leaf.position.set(-7.8 + ai * 2.6, 5.4, -3.9);
    leaf.rotation.x = -0.5;
    leaf.castShadow = true;
    awning.add(leaf);
  }
  scene.add(awning);
  // order board mesh across the top (tickets are HTML above it)
  var boardMesh = box(9.5, 1.15, 0.18, 0x6b4423, 0.8);
  place(boardMesh, -1.2, 4.35, -4.3);
  var boardTrim = box(9.7, 0.1, 0.22, 0xd99a2b, 0.6);
  place(boardTrim, -1.2, 4.95, -4.3);
  // wall shelf with jars, left of the board
  var shelf = box(2.6, 0.1, 0.55, 0x6b4423, 0.8);
  place(shelf, -5.4, 2.5, -4.25);
  [[-6.2, 0xc0392b], [-5.4, 0x2e7d32], [-4.6, 0xd99a2b]].forEach(function (j) {
    var jar = cyl(0.22, 0.22, 0.55, j[1], 0.5);
    place(jar, j[0], 2.82, -4.25);
    var lid = cyl(0.23, 0.23, 0.08, 0x8a5a2b, 0.6);
    place(lid, j[0], 3.12, -4.25);
  });

  // ---------- ingredient counter (bottom) ----------
  var counterTop = box(13.4, 0.22, 1.5, 0x8a5a2b, 0.7);
  place(counterTop, 0, 0.85, 3.5);
  var counterBody = box(13.4, 0.85, 1.3, 0x6b4423, 0.85);
  place(counterBody, 0, 0.42, 3.5);
  var counterTrim = box(13.5, 0.08, 1.55, 0xd99a2b, 0.5);
  place(counterTrim, 0, 0.98, 3.5);

  var trayMeshes = [];
  var trayBases = [];
  function ingredientMesh(key, color) {
    var g = new THREE.Group();
    var m = mat(color, 0.55);
    function add(mesh) { mesh.castShadow = true; g.add(mesh); return mesh; }
    if (key === 'rice') {
      var dome = add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 12), m));
      dome.scale.set(1, 0.55, 1); dome.position.y = 0.08;
      for (var i = 0; i < 5; i++) {
        var grain = add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.04, 0.04), m));
        grain.position.set((rng() - 0.5) * 0.5, 0.2, (rng() - 0.5) * 0.4);
        grain.rotation.y = rng() * 3.1;
      }
    } else if (key === 'egg') {
      var white = add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 20), mat(0xfff6e0, 0.4)));
      white.position.y = 0.03;
      var yolk = add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 12), m));
      yolk.scale.y = 0.75; yolk.position.y = 0.12;
    } else if (key === 'shallot') {
      var bulbM = add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), m));
      bulbM.scale.set(1, 1.15, 1); bulbM.position.y = 0.18;
      var tip = add(new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 12), mat(0x8e4a7a, 0.6)));
      tip.position.y = 0.5;
    } else if (key === 'chilli') {
      var pod = add(new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.55, 12), m));
      pod.rotation.z = Math.PI / 2.4; pod.position.set(0.05, 0.14, 0);
      var stem = add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 8), mat(0x2e7d32, 0.7)));
      stem.rotation.z = Math.PI / 2.4; stem.position.set(0.3, 0.28, 0);
    } else if (key === 'kecap') {
      var bottle = add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.42, 16), m));
      bottle.position.y = 0.21;
      var neck = add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.14, 12), m));
      neck.position.y = 0.48;
      var cap = add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 12), mat(0xd32f2f, 0.5)));
      cap.position.y = 0.58;
    } else if (key === 'chicken') {
      var meat = add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), m));
      meat.scale.set(1, 0.8, 0.9); meat.position.y = 0.16;
      var bone = add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 10), mat(0xfff6e0, 0.4)));
      bone.rotation.z = 0.9; bone.position.set(0.28, 0.22, 0);
    } else if (key === 'turmeric') {
      var root = add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.5, 12), m));
      root.rotation.z = Math.PI / 2.2; root.position.set(0, 0.12, 0);
      var nub = add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), m));
      nub.position.set(-0.22, 0.2, 0.05);
    } else if (key === 'sprouts') {
      for (var s = 0; s < 6; s++) {
        var spr = add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 6), mat(0xf4f8e8, 0.5)));
        spr.rotation.z = (rng() - 0.5) * 1.4;
        spr.rotation.x = (rng() - 0.5) * 0.6;
        spr.position.set((rng() - 0.5) * 0.4, 0.16, (rng() - 0.5) * 0.3);
        var tipG = add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat(0x9ccc65, 0.6)));
        tipG.position.copy(spr.position).y += 0.2;
      }
    } else if (key === 'peanut') {
      var bowl = add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.18, 0.16, 18), mat(0x8d6e63, 0.6)));
      bowl.position.y = 0.08;
      var sauce = add(new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.03, 18), m));
      sauce.position.y = 0.15;
    } else if (key === 'lime') {
      var half = add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), m));
      half.position.y = 0.06;
      var cut = add(new THREE.Mesh(new THREE.CircleGeometry(0.21, 18), mat(0xc6e86b, 0.5)));
      cut.rotation.x = -Math.PI / 2; cut.position.y = 0.07;
    }
    return g;
  }

  INGREDIENTS.forEach(function (ing, i) {
    var x = -5.62 + i * 1.25;
    var tray = box(1.05, 0.1, 0.85, 0x9c6b33, 0.75);
    place(tray, x, 1.0, 3.5);
    trayBases.push(tray);
    var inner = box(0.9, 0.05, 0.7, 0x7a4a22, 0.85);
    inner.position.set(x, 1.06, 3.5);
    inner.castShadow = false;
    scene.add(inner);
    var food = ingredientMesh(ing.key, ing.color);
    food.position.set(x, 1.08, 3.5);
    scene.add(food);
    var label = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.28),
      new THREE.MeshBasicMaterial({ map: labelTexture(ing.label) }));
    label.position.set(x, 0.78, 4.32);
    label.rotation.x = -0.35;
    scene.add(label);
    registerPickable(tray, 'tray', i);
    registerPickable(inner, 'tray', i);
    trayMeshes.push(tray);
  });

  // ---------- cutting board (centre-left) ----------
  var boardTable = box(2.6, 0.9, 1.6, 0x6b4423, 0.85);
  place(boardTable, -3.6, 0.45, 0.6);
  var boardTop = box(2.7, 0.1, 1.7, 0x8a5a2b, 0.7);
  place(boardTop, -3.6, 0.95, 0.6);
  var cuttingBoard = box(1.5, 0.09, 1.0, 0xd9a066, 0.6);
  place(cuttingBoard, -3.6, 1.04, 0.6);
  registerPickable(cuttingBoard, 'board', 0);
  registerPickable(boardTop, 'board', 0);
  // knife beside the board
  var blade = box(0.55, 0.03, 0.14, 0xc0c0c0, 0.25, 0.9);
  blade.position.set(-2.85, 1.1, 0.25); blade.rotation.y = -0.5;
  scene.add(blade);
  var handle = box(0.3, 0.04, 0.12, 0x3a2410, 0.7);
  handle.position.set(-2.62, 1.1, 0.1); handle.rotation.y = -0.5;
  scene.add(handle);
  // chopped pieces + flying chips
  var boardGroup = new THREE.Group();
  boardGroup.position.set(-3.6, 1.1, 0.6);
  scene.add(boardGroup);
  var chips = [];
  for (var ci = 0; ci < 6; ci++) {
    var chip = box(0.09, 0.05, 0.09, 0xffffff, 0.6);
    chip.visible = false;
    boardGroup.add(chip);
    chips.push({ mesh: chip, t: 99, vx: 0, vy: 0, vz: 0 });
  }

  // ---------- wok + stove (centre-right) ----------
  var stoveBase = cyl(0.85, 1.0, 0.75, 0x3d3d3d, 0.6, 0.6);
  place(stoveBase, 1.0, 0.375, 0.6);
  var stoveRing = cyl(0.7, 0.7, 0.12, 0x222222, 0.5, 0.7);
  place(stoveRing, 1.0, 0.8, 0.6);
  // wok: lathe profile, dark metal
  var wokPts = [];
  for (var wi = 0; wi <= 10; wi++) {
    var f = wi / 10;
    wokPts.push(new THREE.Vector2(0.05 + f * 0.85, 0.05 + f * f * 0.42));
  }
  var wok = new THREE.Mesh(
    new THREE.LatheGeometry(wokPts, 28),
    new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.35, metalness: 0.85, side: THREE.DoubleSide }));
  wok.castShadow = true; wok.receiveShadow = true;
  place(wok, 1.0, 0.86, 0.6);
  registerPickable(wok, 'wok', 0);
  registerPickable(stoveBase, 'wok', 0);
  // wok handles
  [-1, 1].forEach(function (s) {
    var h = cyl(0.035, 0.035, 0.4, 0x1a1a1a, 0.5, 0.6);
    h.rotation.z = Math.PI / 2;
    place(h, 1.0 + s * 1.05, 1.1, 0.6);
  });
  // flame: emissive cone + inner cone, tall enough to peek out around the wok
  var flameMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.9 });
  var flame = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.05, 18), flameMat);
  flame.position.set(1.0, 0.85, 0.6);
  scene.add(flame);
  var flameCore = new THREE.Mesh(
    new THREE.ConeGeometry(0.34, 0.7, 14),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.95 }));
  flameCore.position.set(1.0, 0.8, 0.6);
  scene.add(flameCore);
  // glowing fire ring under the wok
  var fireRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.07, 10, 28),
    new THREE.MeshBasicMaterial({ color: 0xff8c1a }));
  fireRing.rotation.x = Math.PI / 2;
  fireRing.position.set(1.0, 0.84, 0.6);
  scene.add(fireRing);
  var flameBase = { x: 0.7, y: 0.6, z: 0.7 };
  // food mound inside the wok
  var wokFood = new THREE.Group();
  var wokFoodMesh = sph(0.55, 0xe8a13c, 0.7);
  wokFoodMesh.scale.set(1, 0.45, 1);
  wokFoodMesh.position.y = 0.1;
  wokFood.add(wokFoodMesh);
  wokFood.position.set(1.0, 1.28, 0.6);
  wokFood.visible = false;
  scene.add(wokFood);
  // cooking progress ring around the wok (flat, glowing)
  var ringBase = new THREE.Mesh(
    new THREE.RingGeometry(1.05, 1.2, 40),
    new THREE.MeshBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  ringBase.rotation.x = -Math.PI / 2;
  ringBase.position.set(1.0, 1.0, 0.6);
  ringBase.visible = false;
  scene.add(ringBase);
  var ringArc = null;
  function setRingArc(progress, color) {
    if (ringArc) { scene.remove(ringArc); ringArc.geometry.dispose(); ringArc = null; }
    if (progress <= 0.01) return;
    var geo = new THREE.RingGeometry(1.05, 1.2, 40, 1, -Math.PI / 2, Math.PI * 2 * progress);
    ringArc = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: color, transparent: true, opacity: 0.95, side: THREE.DoubleSide }));
    ringArc.rotation.x = -Math.PI / 2;
    ringArc.position.set(1.0, 1.0, 0.6);
    scene.add(ringArc);
  }
  // steam sprites
  var steamTex = softCircleTexture('rgba(255,255,255,0.85)', 'rgba(255,255,255,0)');
  var steamSprites = [];
  for (var si = 0; si < 7; si++) {
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: steamTex, transparent: true, opacity: 0, depthWrite: false }));
    sp.position.set(1.0, 1.6, 0.6);
    sp.scale.set(0.5, 0.5, 1);
    sp.userData.phase = si / 7;
    scene.add(sp);
    steamSprites.push(sp);
  }
  var steamOn = false;
  var steamDark = false;

  // ---------- plating counter (right of wok) ----------
  var plateTable = box(2.2, 0.9, 1.6, 0x7a4a22, 0.8);
  place(plateTable, 3.9, 0.45, 0.6);
  var plateTop = box(2.3, 0.1, 1.7, 0xf0e6d2, 0.5);
  place(plateTop, 3.9, 0.95, 0.6);
  registerPickable(plateTop, 'plate', 0);
  registerPickable(plateTable, 'plate', 0);
  var plateGroup = new THREE.Group();
  plateGroup.position.set(3.9, 1.02, 0.6);
  scene.add(plateGroup);
  var plateMesh = cyl(0.55, 0.42, 0.08, 0xffffff, 0.25);
  plateMesh.position.y = 0.04;
  plateGroup.add(plateMesh);
  plateGroup.visible = false;
  var garnishGroup = new THREE.Group();
  plateGroup.add(garnishGroup);
  var GARNISH_COLORS = [0xe8960c, 0x2e7d32, 0xe5231b, 0xffd23f, 0xc86ba8, 0x7ed321];

  // ---------- serving window (far right) ----------
  var winFrame = new THREE.Group();
  winFrame.position.set(6.3, 0, -3.4);
  scene.add(winFrame);
  var winBack = box(3.4, 3.2, 0.2, 0x4a2c12, 0.9);
  winBack.position.set(0, 1.6, 0);
  winFrame.add(winBack);
  var winGlowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.2),
    new THREE.MeshBasicMaterial({ color: 0xffc46b }));
  winGlowPlane.position.set(0, 1.9, 0.12);
  winFrame.add(winGlowPlane);
  var winTop = box(3.4, 0.3, 0.5, 0x6b4423, 0.8);
  winTop.position.set(0, 3.35, 0.1);
  winFrame.add(winTop);
  var winLedge = box(3.4, 0.14, 0.9, 0x8a5a2b, 0.7);
  winLedge.position.set(0, 0.85, 0.35);
  winFrame.add(winLedge);
  [-1.45, 1.45].forEach(function (sx) {
    var post = box(0.28, 3.2, 0.4, 0x6b4423, 0.8);
    post.position.set(sx, 1.6, 0.1);
    winFrame.add(post);
  });
  registerPickable(winGlowPlane, 'window', 0);
  registerPickable(winLedge, 'window', 0);
  registerPickable(winBack, 'window', 0);
  // finished plate waiting at the window
  var windowPlate = new THREE.Group();
  windowPlate.position.set(6.3, 0.95, -2.9);
  var wp = cyl(0.42, 0.34, 0.07, 0xffffff, 0.25);
  wp.position.y = 0.04;
  windowPlate.add(wp);
  var wpFood = sph(0.3, 0xe8a13c, 0.7);
  wpFood.scale.set(1, 0.4, 1); wpFood.position.y = 0.14;
  windowPlate.add(wpFood);
  windowPlate.visible = false;
  scene.add(windowPlate);

  // ---------- customers ----------
  var customers = [];
  for (var cu = 0; cu < CUSTOMER_COUNT; cu++) {
    var cg = new THREE.Group();
    var body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.34, 0.7, 6, 14), mat(SHIRT_COLORS[cu], 0.8));
    body.position.y = 0.85; body.castShadow = true;
    cg.add(body);
    var head = sph(0.3, 0xf2c9a0, 0.6);
    head.position.y = 1.62;
    cg.add(head);
    var hair = sph(0.31, cu === 1 ? 0x1a1a1a : 0x3a2410, 0.9);
    hair.scale.set(1, 0.6, 1); hair.position.set(0, 1.82, -0.05);
    cg.add(hair);
    cg.position.set(5.3 + cu * 1.0, 0, -2.6);
    cg.userData = { mood: 'neutral', bobPhase: cu * 2.1, baseY: 0, shirt: body.material };
    scene.add(cg);
    customers.push(cg);
  }

  // ---------- bin (bottom right) ----------
  var bin = cyl(0.42, 0.34, 0.8, 0x37474f, 0.6, 0.4);
  place(bin, 7.5, 0.4, 3.6);
  var binRim = cyl(0.45, 0.45, 0.08, 0x263238, 0.6, 0.4);
  place(binRim, 7.5, 0.82, 3.6);
  registerPickable(bin, 'bin', 0);
  registerPickable(binRim, 'bin', 0);

  // ---------- dust motes ----------
  var DUST_N = 130;
  var dustPos = new Float32Array(DUST_N * 3);
  var dustSeed = [];
  for (var di = 0; di < DUST_N; di++) {
    dustPos[di * 3] = (rng() - 0.5) * 14;
    dustPos[di * 3 + 1] = 0.5 + rng() * 4.5;
    dustPos[di * 3 + 2] = -3.5 + rng() * 7;
    dustSeed.push({ x: dustPos[di * 3], y: dustPos[di * 3 + 1], z: dustPos[di * 3 + 2], s: 0.2 + rng() * 0.6, p: rng() * 6.28 });
  }
  var dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  var dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0xffe9b0, size: 0.06, transparent: true, opacity: 0.7, depthWrite: false }));
  scene.add(dust);

  // ---------- scene API ----------
  var currentDay = 1;
  var highlightedTray = -1;

  function setWokState(state, progress) {
    var p = Math.max(0, Math.min(1, progress === undefined ? 0 : progress));
    if (state === 'empty') {
      wokFood.visible = false;
      steamOn = false; steamDark = false;
      ringBase.visible = false; setRingArc(0, 0x57b25e);
      flameBase = { x: 0.7, y: 0.6, z: 0.7 };
    } else if (state === 'cooking') {
      wokFood.visible = true;
      wokFoodMesh.material.color.setHex(0xe8a13c);
      steamOn = true; steamDark = false;
      ringBase.visible = true; setRingArc(p, p < 0.7 ? 0x57b25e : 0xff9d2e);
      flameBase = { x: 1.15, y: 1.25, z: 1.15 };
    } else if (state === 'done') {
      wokFood.visible = true;
      wokFoodMesh.material.color.setHex(0xf5b942);
      steamOn = true; steamDark = false;
      ringBase.visible = true; setRingArc(1, 0x57b25e);
      flameBase = { x: 0.8, y: 0.7, z: 0.8 };
    } else if (state === 'burnt') {
      wokFood.visible = true;
      wokFoodMesh.material.color.setHex(0x14100c);
      steamOn = true; steamDark = true;
      ringBase.visible = true; setRingArc(1, 0xe74c3c);
      flameBase = { x: 0.5, y: 0.45, z: 0.5 };
    }
  }

  function setBoardState(items) {
    // items: array of ingredient keys (strings) currently chopped on the board.
    while (boardGroup.children.length > chips.length) {
      boardGroup.remove(boardGroup.children[chips.length]);
    }
    var list = Array.isArray(items) ? items : [];
    list.forEach(function (key, i) {
      var def = null;
      for (var j = 0; j < INGREDIENTS.length; j++) {
        if (INGREDIENTS[j].key === key) { def = INGREDIENTS[j]; break; }
      }
      var color = def ? def.color : 0xffffff;
      for (var k = 0; k < 4; k++) {
        var piece = box(0.14, 0.06, 0.14, color, 0.6);
        piece.position.set(-0.45 + i * 0.3 + (rng() - 0.5) * 0.16, 0.05, (rng() - 0.5) * 0.5);
        piece.rotation.y = rng() * 3.1;
        boardGroup.add(piece);
      }
    });
    // chip burst: 6 small pieces fly up and fall back
    chips.forEach(function (c, idx) {
      c.mesh.visible = true;
      c.mesh.material.color.setHex(list.length ? (function () {
        for (var j = 0; j < INGREDIENTS.length; j++) {
          if (INGREDIENTS[j].key === list[list.length - 1]) return INGREDIENTS[j].color;
        }
        return 0xffffff;
      })() : 0xffffff);
      c.mesh.position.set((rng() - 0.5) * 0.5, 0.05, (rng() - 0.5) * 0.5);
      c.t = 0;
      c.vx = (rng() - 0.5) * 1.6;
      c.vy = 1.6 + rng() * 1.2;
      c.vz = (rng() - 0.5) * 1.6;
      void idx;
    });
  }

  function setPlateState(steps) {
    // steps: number of garnish steps placed, or array of garnish colors.
    var count = 0;
    var colors = [];
    if (Array.isArray(steps)) {
      count = steps.length;
      colors = steps.slice();
    } else if (typeof steps === 'number') {
      count = Math.max(0, Math.floor(steps));
      for (var i = 0; i < count; i++) colors.push(GARNISH_COLORS[i % GARNISH_COLORS.length]);
    }
    plateGroup.visible = count > 0;
    windowPlate.visible = count >= 4;
    while (garnishGroup.children.length) garnishGroup.remove(garnishGroup.children[0]);
    for (var gi = 0; gi < count; gi++) {
      var col = typeof colors[gi] === 'number' ? colors[gi] : GARNISH_COLORS[gi % GARNISH_COLORS.length];
      var g = sph(0.11, col, 0.5);
      var ang = gi * 1.9;
      g.position.set(Math.cos(ang) * 0.26, 0.14, Math.sin(ang) * 0.26);
      garnishGroup.add(g);
      if (gi === 0) {
        var base = sph(0.3, 0xe8a13c, 0.7);
        base.scale.set(1, 0.35, 1); base.position.y = 0.1;
        garnishGroup.add(base);
      }
    }
  }

  function setCustomerMood(index, mood) {
    var c = customers[index];
    if (!c) return;
    c.userData.mood = mood;
    if (mood === 'gone') { c.visible = false; return; }
    c.visible = true;
    if (mood === 'happy') {
      c.userData.shirt.emissive = new THREE.Color(0x1a5c1a);
      c.userData.shirt.emissiveIntensity = 0.35;
    } else if (mood === 'angry') {
      c.userData.shirt.emissive = new THREE.Color(0x7a1010);
      c.userData.shirt.emissiveIntensity = 0.5;
    } else {
      c.userData.shirt.emissive = new THREE.Color(0x000000);
      c.userData.shirt.emissiveIntensity = 0;
    }
  }

  function setDayLight(day) {
    currentDay = Math.max(1, Math.min(5, day || 1));
    var d = currentDay;
    // Day 1 warm dusk -> Day 5 deep evening: sun dims, lamps + fire take over.
    var sunI = 1.15 - (d - 1) * 0.2;          // 1.15 .. 0.35
    var ambI = 0.55 - (d - 1) * 0.06;          // 0.55 .. 0.31
    var lampI = 0.9 + (d - 1) * 0.18;          // 0.9 .. 1.62
    var fireI = 1.6 + (d - 1) * 0.15;          // 1.6 .. 2.2
    sun.intensity = sunI;
    ambient.intensity = ambI;
    lampLights.forEach(function (l) { l.intensity = lampI; });
    fireLight.intensity = fireI;
    windowGlow.intensity = 0.8 + (d - 1) * 0.15;
    var bg = [0x2a1408, 0x241009, 0x1e0c0a, 0x180a0c, 0x12080e][d - 1];
    scene.background.setHex(bg);
    scene.fog.color.setHex(bg);
  }

  function highlightTray(index) {
    trayBases.forEach(function (t, i) {
      t.material.emissive = new THREE.Color(i === index ? 0x664411 : 0x000000);
      t.material.emissiveIntensity = i === index ? 0.9 : 0;
    });
    highlightedTray = (index === null || index === undefined) ? -1 : index;
  }

  var raycaster = new THREE.Raycaster();
  var pointerNDC = new THREE.Vector2();
  function pickAt(clientX, clientY) {
    var rect = renderer.domElement.getBoundingClientRect();
    pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, camera);
    var hits = raycaster.intersectObjects(pickables, false);
    if (!hits.length) return { kind: 'none', index: -1 };
    var pick = hits[0].object.userData.pick;
    return { kind: pick.kind, index: pick.index };
  }

  // ---------- animation loop ----------
  var clock = new THREE.Clock();
  var started = false;
  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);
    var t = clock.elapsedTime;
    // flame flicker (seeded sin mix, no random)
    var flick = 0.85 + 0.15 * Math.sin(t * 11.3) * Math.sin(t * 5.7 + 1.3);
    flame.scale.set(flameBase.x * flick, flameBase.y * (0.9 + 0.2 * Math.sin(t * 9.7)), flameBase.z * flick);
    flameCore.scale.set(flick, 0.9 + 0.1 * Math.sin(t * 13.1), flick);
    flame.material.opacity = 0.75 + 0.2 * Math.sin(t * 9.7);
    fireLight.intensity = (1.6 + (currentDay - 1) * 0.15) * (0.85 + 0.3 * Math.sin(t * 10.2) * Math.sin(t * 4.3));
    // steam rise
    steamSprites.forEach(function (sp) {
      if (!steamOn) { sp.material.opacity = 0; return; }
      var ph = (t * 0.35 + sp.userData.phase) % 1;
      sp.position.set(1.0 + Math.sin((t + sp.userData.phase * 9) * 1.4) * 0.12, 1.55 + ph * 1.5, 0.6);
      var sc = 0.4 + ph * 0.9;
      sp.scale.set(sc, sc, 1);
      sp.material.opacity = steamDark ? (1 - ph) * 0.55 : (1 - ph) * 0.45;
      sp.material.color.setHex(steamDark ? 0x333333 : 0xffffff);
    });
    // dust drift
    var pos = dustGeo.attributes.position.array;
    for (var i = 0; i < DUST_N; i++) {
      var s = dustSeed[i];
      pos[i * 3] = s.x + Math.sin(t * s.s + s.p) * 0.35;
      pos[i * 3 + 1] = s.y + Math.sin(t * s.s * 0.7 + s.p * 2) * 0.25;
      pos[i * 3 + 2] = s.z + Math.cos(t * s.s * 0.5 + s.p) * 0.25;
    }
    dustGeo.attributes.position.needsUpdate = true;
    // customer bob
    customers.forEach(function (c) {
      if (!c.visible) return;
      var speed = c.userData.mood === 'happy' ? 5.0 : c.userData.mood === 'angry' ? 7.0 : 2.2;
      var amp = c.userData.mood === 'angry' ? 0.09 : 0.05;
      c.position.y = c.userData.baseY + Math.abs(Math.sin(t * speed + c.userData.bobPhase)) * amp;
      if (c.userData.mood === 'angry') c.rotation.z = Math.sin(t * 7 + c.userData.bobPhase) * 0.06;
    });
    // flying chips
    chips.forEach(function (c) {
      if (!c.mesh.visible || c.t > 0.7) { c.mesh.visible = false; return; }
      c.t += dt;
      c.vy -= 6 * dt;
      c.mesh.position.x += c.vx * dt;
      c.mesh.position.y += c.vy * dt;
      c.mesh.position.z += c.vz * dt;
      if (c.mesh.position.y < 0.03) { c.mesh.position.y = 0.03; c.vy = 0; }
    });
    renderer.render(scene, camera);
  }

  function start() {
    if (started) return;
    started = true;
    animate();
  }

  // initial state: Day 1 dusk, wok idle, no plate
  setDayLight(1);
  setWokState('empty', 0);
  setPlateState(0);

  window.KualiScene = {
    setWokState: setWokState,
    setBoardState: setBoardState,
    setPlateState: setPlateState,
    setCustomerMood: setCustomerMood,
    setDayLight: setDayLight,
    highlightTray: highlightTray,
    pickAt: pickAt,
  };

  start();
})();
