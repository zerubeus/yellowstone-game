/* =============================================================
   YELLOWSTONE — A Cowboy Survival Game
   Single-file canvas game. No external assets.
   ============================================================= */
(() => {
'use strict';

// ---------------- Canvas & DOM ----------------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const W = canvas.width, H = canvas.height;

// Sprite sheets
const imgTerrain = new Image();
const imgObjects = new Image();
imgTerrain.src = 'tiles_terrain.png';
imgObjects.src = 'tiles_objects.png';
const SPRITE = 32; // source tile size px

// Character direction sprites
const charSprites = {};
const CHAR_DIRS = ['south', 'south_east', 'east', 'north_east', 'north', 'north_west', 'west', 'south_west'];
for (const d of CHAR_DIRS) {
  const img = new Image();
  img.src = `sprites/char/${d}.png`;
  charSprites[d] = img;
}

const $ = id => document.getElementById(id);
const startScreen = $('startScreen');
const hudEl = $('hud');
const panelsEl = $('panels');
const interactHint = $('interactHint');

// ---------------- Constants ----------------
const WORLD_W = 3600, WORLD_H = 2200;
const TILE = 40;
const RANCH = { x: 400, y: 900, w: 720, h: 560 };
const ZONES = [
  { name: 'The Badlands',  x: 0,    x2: 1400, color: '#100e06', tier: 1 },
  { name: 'Dust Wastes',   x: 1400, x2: 2500, color: '#0e0a04', tier: 2 },
  { name: 'Blood Ruins',   x: 2500, x2: WORLD_W, color: '#0e0604', tier: 3 },
];

const TILE_COLS = Math.ceil(WORLD_W / TILE);
const TILE_ROWS = Math.ceil(WORLD_H / TILE);

// ---------------- Utility ----------------
const rand = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rand(a, b + 1));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const AABB = (ax, ay, aw, ah, bx, by, bw, bh) =>
  ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
const zoneAt = x => ZONES.find(z => x >= z.x && x < z.x2) || ZONES[0];

// ---------------- Items ----------------
const ITEMS = {
  wood:      { name: 'Wood',       icon: '🪵', tier: 'common',   sell: 1 },
  stone:     { name: 'Stone',      icon: '🪨', tier: 'common',   sell: 1 },
  fiber:     { name: 'Fiber',      icon: '🌾', tier: 'common',   sell: 1 },
  iron:      { name: 'Iron Ore',   icon: '⛏️', tier: 'uncommon', sell: 4 },
  coal:      { name: 'Coal',       icon: '⚫', tier: 'uncommon', sell: 3 },
  silver:    { name: 'Silver',     icon: '🔘', tier: 'rare',     sell: 12 },
  leather:   { name: 'Leather',    icon: '🟤', tier: 'uncommon', sell: 3 },
  meat:      { name: 'Raw Meat',   icon: '🥩', tier: 'common',   sell: 2 },
  // Crafted
  plank:     { name: 'Plank',      icon: '📏', tier: 'common',   sell: 2 },
  ironBar:   { name: 'Iron Bar',   icon: '🔩', tier: 'uncommon', sell: 8 },
  knife:     { name: 'Knife',      icon: '🔪', tier: 'common',   sell: 10, weapon: { dmg: 12, range: 55, cd: 280 } },
  tomahawk:  { name: 'Tomahawk',   icon: '🪓', tier: 'uncommon', sell: 30, weapon: { dmg: 22, range: 60, cd: 340 } },
  sword:     { name: 'Steel Sword', icon: '⚔️', tier: 'rare',    sell: 80, weapon: { dmg: 40, range: 70, cd: 320 } },
  bow:       { name: 'Bow',        icon: '🏹', tier: 'uncommon', sell: 40, weapon: { dmg: 28, range: 360, cd: 600, ranged: true } },
  // Melee weapons (no firearms)
  spear:     { name: 'Spear',      icon: '🔱', tier: 'uncommon', sell: 60,  weapon: { dmg: 32, range: 120, cd: 350 } },
  hammer:    { name: 'War Hammer',  icon: '🔨', tier: 'uncommon', sell: 80,  weapon: { dmg: 45, range: 60,  cd: 550 } },
  flail:     { name: 'Flail',      icon: '⛓️', tier: 'rare',     sell: 150, weapon: { dmg: 55, range: 80, cd: 480 } },
  katana:    { name: 'Katana',     icon: '⚔️', tier: 'epic',     sell: 250, weapon: { dmg: 65, range: 80, cd: 220 } },
  // Food
  jerky:     { name: 'Jerky',      icon: '🍖', tier: 'common',   sell: 5, food: { heal: 30, energy: 10 } },
  stew:      { name: 'Hearty Stew', icon: '🍲', tier: 'uncommon', sell: 18, food: { heal: 60, energy: 30 } },
  // Tools
  axe:       { name: 'Axe',        icon: '🪓', tier: 'common',   sell: 15, tool: 'chop', weapon: { dmg: 14, range: 55, cd: 340 } },
  pickaxe:   { name: 'Pickaxe',    icon: '⛏️', tier: 'common',   sell: 15, tool: 'mine', weapon: { dmg: 10, range: 55, cd: 360 } },
  // Gear (wearable)
  leatherVest: { name: 'Leather Vest', icon: '🧥', tier: 'uncommon', sell: 25, gear: { defense: 5 } },
  ironArmor:   { name: 'Iron Armor',   icon: '🛡️', tier: 'rare',    sell: 60, gear: { defense: 12 } },
  shadowCloak: { name: 'Shadow Cloak', icon: '🌑', tier: 'rare',    sell: 90, gear: { defense: 8, speedBonus: 0.15 } },
  warBoots:    { name: 'War Boots',    icon: '👢', tier: 'uncommon', sell: 40, gear: { defense: 3, dmgBonus: 0.10 } },
  demonMask:   { name: 'Demon Mask',   icon: '😈', tier: 'epic',    sell: 120, gear: { defense: 6, dmgBonus: 0.20 } },
};
const tierColor = t => ({ common: '#7a6a50', uncommon: '#7a8a50', rare: '#5060a0', epic: '#8a3030' }[t] || '#7a6a50');

// ---------------- Recipes ----------------
const RECIPES = [
  { id: 'plank',    station: 'carpenter', time: 1500, cost: { wood: 2 },        out: { plank: 1 } },
  { id: 'axe',      station: 'carpenter', time: 2500, cost: { wood: 3, stone: 2 }, out: { axe: 1 } },
  { id: 'pickaxe',  station: 'carpenter', time: 2500, cost: { wood: 3, stone: 3 }, out: { pickaxe: 1 } },
  { id: 'bow',      station: 'carpenter', time: 4000, cost: { wood: 5, fiber: 4 }, out: { bow: 1 } },
  { id: 'knife',    station: 'smithy',    time: 2000, cost: { wood: 1, iron: 1 },  out: { knife: 1 } },
  { id: 'ironBar',  station: 'smithy',    time: 3000, cost: { iron: 2, coal: 1 },  out: { ironBar: 1 } },
  { id: 'tomahawk', station: 'smithy',    time: 3500, cost: { wood: 2, iron: 3 },  out: { tomahawk: 1 } },
  { id: 'sword',    station: 'smithy',    time: 6000, cost: { ironBar: 3, leather: 1 }, out: { sword: 1 } },
  { id: 'spear',    station: 'smithy',    time: 5000,  cost: { ironBar: 2, wood: 3 },                out: { spear: 1 } },
  { id: 'hammer',   station: 'smithy',    time: 7000,  cost: { ironBar: 3, stone: 4 },              out: { hammer: 1 } },
  { id: 'flail',    station: 'smithy',    time: 10000, cost: { ironBar: 4, silver: 2, leather: 2 },  out: { flail: 1 } },
  { id: 'katana',   station: 'smithy',    time: 15000, cost: { ironBar: 8, silver: 4, leather: 2 }, out: { katana: 1 } },
  { id: 'jerky',    station: 'kitchen',   time: 2000, cost: { meat: 2, fiber: 1 }, out: { jerky: 2 } },
  { id: 'stew',     station: 'kitchen',   time: 4000, cost: { meat: 3, fiber: 2, iron: 1 }, out: { stew: 1 } },
  // Gear at workbench
  { id: 'leatherVest', station: 'workbench', time: 5000,  cost: { leather: 4, fiber: 3 }, out: { leatherVest: 1 } },
  { id: 'ironArmor',   station: 'workbench', time: 8000,  cost: { ironBar: 4, leather: 2 }, out: { ironArmor: 1 } },
  { id: 'shadowCloak', station: 'workbench', time: 10000, cost: { fiber: 8, silver: 2, leather: 3 }, out: { shadowCloak: 1 } },
  { id: 'warBoots',    station: 'workbench', time: 6000,  cost: { leather: 3, ironBar: 2 }, out: { warBoots: 1 } },
  { id: 'demonMask',   station: 'workbench', time: 12000, cost: { silver: 3, ironBar: 3, fiber: 2 }, out: { demonMask: 1 } },
];

// ---------------- Buildings ----------------
const BUILDINGS = {
  tent:       { name: 'Tent',          w: 80,  h: 80,  cost: { wood: 6, fiber: 4 }, hp: 100, color: '#1a0c06', respawn: true },
  bed:        { name: 'Bedroll',       w: 60,  h: 40,  cost: { fiber: 8, wood: 2 }, hp: 30,  color: '#2a1a06', sleep: true },
  chest:      { name: 'Storage Chest', w: 50,  h: 40,  cost: { wood: 8 }, hp: 50, color: '#1a0c04', storage: true },
  carpenter:  { name: 'Carpenter Table', w: 70, h: 60, cost: { wood: 12 }, hp: 80, color: '#2a1008', station: 'carpenter' },
  smithy:     { name: 'Smithy',        w: 80,  h: 70,  cost: { wood: 6, stone: 12, iron: 2 }, hp: 120, color: '#1a1a1a', station: 'smithy' },
  kitchen:    { name: 'Kitchen',       w: 70,  h: 60,  cost: { wood: 8, stone: 6 }, hp: 80, color: '#2a1008', station: 'kitchen' },
  wall:       { name: 'Wooden Wall',   w: 40,  h: 40,  cost: { wood: 4 }, hp: 150, color: '#1a0c04', solid: true },
  stoneWall:  { name: 'Stone Wall',    w: 40,  h: 40,  cost: { stone: 6 }, hp: 300, color: '#2a2a2a', solid: true },
  ranchHouse: { name: 'Ranch House',   w: 120, h: 90,  cost: { wood: 15, stone: 10, fiber: 8 }, hp: 200, color: '#1a0c06', ranchHeal: true, sleep: true },
  workbench:  { name: 'Workbench',     w: 60,  h: 50,  cost: { wood: 10, iron: 2 }, hp: 60, color: '#2a1408', station: 'workbench' },
};

// ---------------- Game State ----------------
const state = {
  running: false,
  t: 0, dt: 0, last: 0,
  keys: {},
  mouse: { x: W/2, y: H/2, down: false, clicked: false, right: false },
  cam: { x: 0, y: 0 },
  player: {
    x: RANCH.x + RANCH.w/2, y: RANCH.y + RANCH.h/2,
    r: 18, speed: 200,
    hp: 100, hpMax: 100,
    energy: 100, energyMax: 100, energyTimer: 0,
    xp: 0, level: 1,
    coins: 25,
    facing: 0,
    attackCd: 0,
    hurtCd: 0,
    flashCd: 0,
    equipped: null,
    gear: null,
    inv: {},
    deathScreenT: 0,
  },
  nodes: [],
  enemies: [],
  projectiles: [],
  loot: [],
  buildings: [],
  npcs: [],
  craftQueue: [],
  floatTexts: [],
  particles: [],
  ambientParticles: [],
  buildMode: null,
  buildOK: false,
  activeStation: null,
  nearShop: false,
  shopMode: 'buy',
  panel: null,
  showMap: false,
  ambientTimer: 0,
};

// ---------------- Inventory ----------------
const inv = {
  add(id, n = 1) {
    state.player.inv[id] = (state.player.inv[id] || 0) + n;
    toast(`+${n} ${ITEMS[id]?.name || id}`, 'good');
  },
  has(id, n = 1) { return (state.player.inv[id] || 0) >= n; },
  canAfford(cost) { return Object.entries(cost).every(([k, v]) => this.has(k, v)); },
  pay(cost) {
    for (const [k, v] of Object.entries(cost)) {
      state.player.inv[k] -= v;
      if (state.player.inv[k] <= 0) delete state.player.inv[k];
    }
  },
  count(id) { return state.player.inv[id] || 0; },
};

// ---------------- Toast & Float Texts ----------------
function toast(text, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = text;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
function floatText(x, y, text, color = '#fff') {
  state.floatTexts.push({ x, y, text, color, life: 1.0, vy: -40 });
}
function particle(x, y, color, count = 6) {
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x, y,
      vx: rand(-80, 80), vy: rand(-120, -20),
      life: rand(0.4, 0.8), color,
      size: rint(2, 4),
    });
  }
}

// ---------------- Ambient Particles ----------------
function spawnAmbient() {
  const cx = state.cam.x + W / 2;
  const cy = state.cam.y + H / 2;
  const spread = 500;
  // Fireflies
  if (Math.random() < 0.4) {
    state.ambientParticles.push({
      x: cx + rand(-spread, spread),
      y: cy + rand(-spread, spread),
      vx: rand(-10, 10), vy: rand(-8, 8),
      life: rand(3, 7), maxLife: 5,
      type: 'firefly',
      phase: rand(0, Math.PI * 2),
    });
  }
  // Mist wisps
  if (Math.random() < 0.25) {
    state.ambientParticles.push({
      x: cx + rand(-spread, spread),
      y: cy + rand(-spread * 0.5, spread * 0.5),
      vx: rand(-6, 6), vy: rand(-2, 2),
      life: rand(5, 12), maxLife: 10,
      type: 'mist',
      size: rand(30, 80),
    });
  }
  // Dust motes
  if (Math.random() < 0.3) {
    state.ambientParticles.push({
      x: cx + rand(-spread, spread),
      y: cy + rand(-spread, spread),
      vx: rand(-4, 4), vy: rand(-12, -2),
      life: rand(2, 5), maxLife: 4,
      type: 'dust',
    });
  }
}

// ---------------- Tile Map ----------------
function tileHash(tx, ty) {
  let h = Math.imul(tx * 374761393 + ty * 668265263, 1) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 0x100000000;
}

function generateTileMap() {
  const cols = TILE_COLS, rows = TILE_ROWS;
  // terrain: packed [tileCol, tileRow] per tile (2 bytes each)
  // overlay: 0=none, 1=flowers, 2=water
  state.tileMap = {
    cols, rows,
    terrain: new Uint8Array(cols * rows * 2),
    overlay: new Uint8Array(cols * rows),
  };
  const { terrain, overlay } = state.tileMap;

  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const wx = tx * TILE;
      const r  = tileHash(tx, ty);
      const idx = ty * cols + tx;
      const zone = zoneAt(wx);
      let tc = 0, tr = 0;

      if (zone.tier === 1) {
        // Grass zone — green tiles with dirt patches
        if (r < 0.55)      { tc = 0; tr = 0; }       // plain grass
        else if (r < 0.75) { tc = 1; tr = 0; }       // grass variant
        else if (r < 0.87) { tc = 2; tr = 0; }       // grass with flowers
        else if (r < 0.94) { tc = 0; tr = 1; }       // dirt patch
        else               { tc = 1; tr = 1; }       // rocky dirt
      } else if (zone.tier === 2) {
        // Dust wastes — dirt/path tiles
        if (r < 0.55)      { tc = 0; tr = 1; }       // dry dirt
        else if (r < 0.78) { tc = 1; tr = 1; }       // dirt variant
        else if (r < 0.90) { tc = 2; tr = 1; }       // rocky dirt
        else               { tc = 0; tr = 2; }       // dark stone
      } else {
        // Blood ruins — dark rocky terrain
        if (r < 0.50)      { tc = 0; tr = 2; }       // dark rock
        else if (r < 0.78) { tc = 1; tr = 2; }       // dark rock variant
        else if (r < 0.90) { tc = 2; tr = 2; }       // darker rock
        else               { tc = 1; tr = 1; }       // dark dirt
      }

      terrain[idx * 2]     = tc;
      terrain[idx * 2 + 1] = tr;

      // Flower overlay in grass zone
      if (zone.tier === 1 && r > 0.88 && r < 0.92) overlay[idx] = 1;

      // Scattered water ponds in zone 1
      if (zone.tier === 1 && tileHash(tx + 777, ty + 333) < 0.025) overlay[idx] = 2;
    }
  }

  // Water strip near zone 1/2 boundary (around x=1380)
  const bx1 = Math.floor(1380 / TILE);
  for (let ty = 0; ty < rows; ty++) {
    if (tileHash(bx1, ty + 500) < 0.18) {
      state.tileMap.overlay[ty * cols + bx1] = 2;
    }
  }
}

function drawTileMap() {
  const cam = state.cam;
  const startTX = Math.max(0, Math.floor(cam.x / TILE));
  const startTY = Math.max(0, Math.floor(cam.y / TILE));
  const endTX   = Math.min(TILE_COLS - 1, Math.ceil((cam.x + W) / TILE));
  const endTY   = Math.min(TILE_ROWS - 1, Math.ceil((cam.y + H) / TILE));
  const loaded  = imgTerrain.complete && imgTerrain.naturalWidth > 0;
  const { terrain, overlay } = state.tileMap;

  for (let ty = startTY; ty <= endTY; ty++) {
    for (let tx = startTX; tx <= endTX; tx++) {
      const sx  = tx * TILE - cam.x;
      const sy  = ty * TILE - cam.y;
      const idx = ty * TILE_COLS + tx;

      if (loaded) {
        const tc = terrain[idx * 2];
        const tr = terrain[idx * 2 + 1];
        ctx.drawImage(imgTerrain, tc * SPRITE, tr * SPRITE, SPRITE, SPRITE, sx, sy, TILE + 1, TILE + 1);

        const ov = overlay[idx];
        if (ov === 2) {
          // Water tile — row 4 of terrain sheet
          ctx.drawImage(imgTerrain, 0, 4 * SPRITE, SPRITE, SPRITE, sx, sy, TILE + 1, TILE + 1);
        } else if (ov === 1) {
          // Flower overlay — row 3 col 2
          ctx.drawImage(imgTerrain, 2 * SPRITE, 3 * SPRITE, SPRITE, SPRITE, sx, sy, TILE + 1, TILE + 1);
        }
      } else {
        const zone = zoneAt(tx * TILE);
        ctx.fillStyle = zone.tier === 1 ? '#100e06' : zone.tier === 2 ? '#0e0a04' : '#0e0604';
        ctx.fillRect(sx, sy, TILE + 1, TILE + 1);
      }

      // Dark atmosphere overlay (grim LISA mood)
      ctx.fillStyle = 'rgba(0,0,0,0.44)';
      ctx.fillRect(sx, sy, TILE + 1, TILE + 1);
    }
  }
}

// Blit a single sprite tile centred at (dx, dy)
function blitObj(col, row, dx, dy, size) {
  size = size || TILE;
  ctx.drawImage(imgObjects, col * SPRITE, row * SPRITE, SPRITE, SPRITE, dx - size / 2, dy - size / 2, size, size);
}

// ---------------- World Generation ----------------
function spawnNodes() {
  for (let i = 0; i < 35; i++) {
    const x = rand(80, 1380), y = rand(80, WORLD_H - 80);
    if (AABB(x - 20, y - 20, 40, 40, RANCH.x, RANCH.y, RANCH.w, RANCH.h)) continue;
    state.nodes.push(makeNode('tree', x, y));
  }
  for (let i = 0; i < 20; i++) {
    const x = rand(80, 1380), y = rand(80, WORLD_H - 80);
    if (AABB(x - 20, y - 20, 40, 40, RANCH.x, RANCH.y, RANCH.w, RANCH.h)) continue;
    state.nodes.push(makeNode('rock', x, y));
  }
  for (let i = 0; i < 25; i++) {
    state.nodes.push(makeNode('fiber', rand(80, 1380), rand(80, WORLD_H - 80)));
  }
  for (let i = 0; i < 18; i++) state.nodes.push(makeNode('iron', rand(1420, 2480), rand(80, WORLD_H - 80)));
  for (let i = 0; i < 14; i++) state.nodes.push(makeNode('coal', rand(1420, 2480), rand(80, WORLD_H - 80)));
  for (let i = 0; i < 15; i++) state.nodes.push(makeNode('tree', rand(1420, 2480), rand(80, WORLD_H - 80)));
  for (let i = 0; i < 15; i++) state.nodes.push(makeNode('rock', rand(1420, 2480), rand(80, WORLD_H - 80)));
  for (let i = 0; i < 14; i++) state.nodes.push(makeNode('silver', rand(2540, WORLD_W - 80), rand(80, WORLD_H - 80)));
  for (let i = 0; i < 14; i++) state.nodes.push(makeNode('iron', rand(2540, WORLD_W - 80), rand(80, WORLD_H - 80)));
  for (let i = 0; i < 10; i++) state.nodes.push(makeNode('coal', rand(2540, WORLD_W - 80), rand(80, WORLD_H - 80)));
}
function makeNode(type, x, y) {
  const defs = {
    tree:   { hp: 30, r: 18, drop: 'wood',   amount: [2, 4], req: null,   xp: 3,  color: '#0d1a06', trunk: '#1a0c04' },
    rock:   { hp: 40, r: 16, drop: 'stone',  amount: [1, 3], req: null,   xp: 3,  color: '#1a1a1a' },
    fiber:  { hp: 10, r: 10, drop: 'fiber',  amount: [1, 2], req: null,   xp: 1,  color: '#5a5010' },
    iron:   { hp: 70, r: 16, drop: 'iron',   amount: [1, 3], req: 'mine', xp: 8,  color: '#3a2010' },
    coal:   { hp: 60, r: 16, drop: 'coal',   amount: [1, 3], req: 'mine', xp: 7,  color: '#111' },
    silver: { hp: 120, r: 16, drop: 'silver', amount: [1, 2], req: 'mine', xp: 20, color: '#2a2a38' },
  };
  const d = defs[type];
  return { type, x, y, r: d.r, hp: d.hp, hpMax: d.hp, def: d, respawn: 0 };
}

function spawnEnemies() {
  for (let i = 0; i < 6; i++) state.enemies.push(makeEnemy('wolf', rand(1420, 2480), rand(80, WORLD_H - 80)));
  for (let i = 0; i < 4; i++) state.enemies.push(makeEnemy('bandit', rand(1420, 2480), rand(80, WORLD_H - 80)));
  for (let i = 0; i < 6; i++) state.enemies.push(makeEnemy('bandit2', rand(2540, WORLD_W - 80), rand(80, WORLD_H - 80)));
  for (let i = 0; i < 4; i++) state.enemies.push(makeEnemy('dire', rand(2540, WORLD_W - 80), rand(80, WORLD_H - 80)));
  for (let i = 0; i < 3; i++) state.enemies.push(makeEnemy('wolf', rand(1100, 1380), rand(80, WORLD_H - 80)));
}
function makeEnemy(type, x, y) {
  const defs = {
    wolf:    { hp: 35,  dmg: 10, speed: 120, r: 14, color: '#1a0e06', eye: '#c8a020', xp: 15, coins: [1, 3], drop: ['meat', 'leather'], range: 28 },
    bandit:  { hp: 60,  dmg: 15, speed: 95,  r: 14, color: '#2a1008', eye: '#c8a020', xp: 25, coins: [3, 8], drop: ['wood', 'iron', 'jerky'], range: 32 },
    bandit2: { hp: 130, dmg: 25, speed: 105, r: 15, color: '#1a0508', eye: '#cc4010', xp: 50, coins: [8, 18], drop: ['iron', 'silver', 'leather'], range: 36, ranged: true },
    dire:    { hp: 140, dmg: 30, speed: 150, r: 18, color: '#0a0a0a', eye: '#cc2020', xp: 60, coins: [6, 14], drop: ['meat', 'meat', 'leather'], range: 36 },
  };
  const d = defs[type];
  return {
    type, x, y, hx: x, hy: y, hp: d.hp, hpMax: d.hp, def: d, r: d.r,
    vx: 0, vy: 0, attackCd: 0, alertCd: 0, hurtCd: 0, wander: 0, wx: x, wy: y,
    dead: false, respawn: 0,
  };
}

function spawnNPCs() {
  state.npcs.push({ type: 'store', x: 250, y: 1100, r: 20, name: 'General Store' });
}

// ---------------- Starter ----------------
function startGame() {
  startScreen.classList.add('hidden');
  hudEl.classList.remove('hidden');
  panelsEl.classList.remove('hidden');
  state.running = true;
  generateTileMap();
  spawnNodes();
  spawnEnemies();
  spawnNPCs();
  inv.add('wood', 4);
  inv.add('fiber', 3);
  toast('The wastes stretch forever. Scavenge to survive.', 'good');
  state.last = performance.now();
  requestAnimationFrame(loop);
}

// ---------------- Input ----------------
window.addEventListener('keydown', e => {
  state.keys[e.key.toLowerCase()] = true;
  const k = e.key.toLowerCase();
  if (!state.running) return;
  if (k === 'i') togglePanel('invPanel');
  else if (k === 'c') togglePanel('craftPanel');
  else if (k === 'b') togglePanel('buildPanel');
  else if (k === 'm') togglePanel('mapPanel');
  else if (k === 'escape') { closePanels(); state.buildMode = null; }
  else if (k === 'e') trySleep();
  else if (k === 'f') tryEat();
  else if (/^[1-5]$/.test(k)) quickUse(parseInt(k));
});
window.addEventListener('keyup', e => { state.keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  state.mouse.x = (e.clientX - r.left) * (W / r.width);
  state.mouse.y = (e.clientY - r.top) * (H / r.height);
});
canvas.addEventListener('mousedown', e => {
  if (e.button === 0) { state.mouse.down = true; state.mouse.clicked = true; }
  if (e.button === 2) { state.mouse.right = true; }
});
canvas.addEventListener('mouseup', e => { if (e.button === 0) state.mouse.down = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

// ---------------- Mobile Touch Controls ----------------
if ('ontouchstart' in window) {
  document.getElementById('touchControls').style.display = 'block';

  const joystickOuter = document.getElementById('joystickOuter');
  const joystickInner = document.getElementById('joystickInner');
  const joystickZone  = document.getElementById('joystickZone');
  const btnAttack     = document.getElementById('btnAttack');
  const btnInteract   = document.getElementById('btnInteract');

  const OUTER_R = 60; // radius of outer circle
  const INNER_R = 25; // radius of inner circle (for center offset)
  let joystickTouchId = null;
  let joystickOrigin  = { x: 0, y: 0 };

  function getJoystickCenter() {
    const r = joystickOuter.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function updateJoystick(cx, cy, tx, ty) {
    let dx = tx - cx;
    let dy = ty - cy;
    const len = Math.hypot(dx, dy);
    if (len > OUTER_R) { dx = dx / len * OUTER_R; dy = dy / len * OUTER_R; }

    // Move inner circle visually
    joystickInner.style.transform = `translate(${dx}px, ${dy}px)`;

    // Map to keys — use threshold of 20% of outer radius
    const threshold = OUTER_R * 0.20;
    state.keys['w'] = dy < -threshold;
    state.keys['s'] = dy >  threshold;
    state.keys['a'] = dx < -threshold;
    state.keys['d'] = dx >  threshold;

    // Magnitude-based: if beyond threshold set key, simulating partial push isn't needed
    // since the game just checks key booleans
  }

  function clearJoystick() {
    joystickInner.style.transform = 'translate(0px, 0px)';
    state.keys['w'] = false;
    state.keys['s'] = false;
    state.keys['a'] = false;
    state.keys['d'] = false;
  }

  joystickZone.addEventListener('touchstart', e => {
    e.preventDefault();
    if (joystickTouchId !== null) return; // already tracking one
    const t = e.changedTouches[0];
    joystickTouchId = t.identifier;
    const c = getJoystickCenter();
    updateJoystick(c.x, c.y, t.clientX, t.clientY);
  }, { passive: false });

  joystickZone.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joystickTouchId) {
        const c = getJoystickCenter();
        updateJoystick(c.x, c.y, t.clientX, t.clientY);
      }
    }
  }, { passive: false });

  joystickZone.addEventListener('touchend', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joystickTouchId) {
        joystickTouchId = null;
        clearJoystick();
      }
    }
  }, { passive: false });

  joystickZone.addEventListener('touchcancel', e => {
    joystickTouchId = null;
    clearJoystick();
  });

  // Attack button
  btnAttack.addEventListener('touchstart', e => {
    e.preventDefault();
    state.mouse.down = true;
    state.mouse.clicked = true;
  }, { passive: false });
  btnAttack.addEventListener('touchend', e => {
    e.preventDefault();
    state.mouse.down = false;
  }, { passive: false });

  // Interact button — triggers space (shop/interact)
  btnInteract.addEventListener('touchstart', e => {
    e.preventDefault();
    state.keys[' '] = true;
    // Also trigger click for NPC interaction
    state.mouse.clicked = true;
  }, { passive: false });
  btnInteract.addEventListener('touchend', e => {
    e.preventDefault();
    state.keys[' '] = false;
  }, { passive: false });

  // Bag button — opens inventory panel
  const btnBag = document.getElementById('btnBag');
  btnBag.addEventListener('touchstart', e => {
    e.preventDefault();
    togglePanel('invPanel');
  }, { passive: false });
}

document.querySelectorAll('.closeBtn').forEach(btn => {
  btn.addEventListener('click', closePanels);
});

function togglePanel(id) {
  if (state.panel === id) { closePanels(); return; }
  closePanels();
  $(id).classList.remove('hidden');
  state.panel = id;
  const tc = document.getElementById('touchControls');
  if (tc) tc.style.display = 'none';
  if (id === 'invPanel') renderInventory();
  if (id === 'craftPanel') renderCraft();
  if (id === 'buildPanel') renderBuild();
  if (id === 'mapPanel') renderMiniMap();
  if (id === 'shopPanel') renderShop();
}
function closePanels() {
  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
  state.panel = null;
  const tc = document.getElementById('touchControls');
  if (tc && 'ontouchstart' in window) tc.style.display = '';
}

$('playBtn').addEventListener('click', startGame);

// ---------------- Main Loop ----------------
function loop(now) {
  state.dt = Math.min(0.05, (now - state.last) / 1000);
  state.last = now;
  state.t += state.dt;
  update();
  render();
  state.mouse.clicked = false;
  state.mouse.right = false;
  requestAnimationFrame(loop);
}

// ---------------- Gear helpers ----------------
function equippedGear() {
  const g = state.player.gear;
  return (g && ITEMS[g]?.gear) ? ITEMS[g].gear : null;
}
function gearDefense() { return equippedGear()?.defense || 0; }
function gearDmgBonus() { return equippedGear()?.dmgBonus || 0; }
function gearSpeedBonus() { return equippedGear()?.speedBonus || 0; }

// ---------------- Update ----------------
function update() {
  const p = state.player;
  if (p.hp <= 0) {
    p.deathScreenT += state.dt;
    if (p.deathScreenT > 2.5) respawnPlayer();
    return;
  }

  let dx = 0, dy = 0;
  if (state.keys['w'] || state.keys['arrowup']) dy -= 1;
  if (state.keys['s'] || state.keys['arrowdown']) dy += 1;
  if (state.keys['a'] || state.keys['arrowleft']) dx -= 1;
  if (state.keys['d'] || state.keys['arrowright']) dx += 1;
  const len = Math.hypot(dx, dy);
  if (len > 0) { dx /= len; dy /= len; }
  const speed = p.speed * (1 + gearSpeedBonus()) * state.dt;
  const nx = p.x + dx * speed;
  const ny = p.y + dy * speed;
  if (!solidAt(nx, p.y, p.r)) p.x = clamp(nx, 20, WORLD_W - 20);
  if (!solidAt(p.x, ny, p.r)) p.y = clamp(ny, 20, WORLD_H - 20);

  const mw = screenToWorld(state.mouse.x, state.mouse.y);
  p.facing = Math.atan2(mw.y - p.y, mw.x - p.x);

  state.cam.x = clamp(p.x - W/2, 0, WORLD_W - W);
  state.cam.y = clamp(p.y - H/2, 0, WORLD_H - H);

  p.energyTimer += state.dt;
  if (p.energyTimer > 2 && p.energy < p.energyMax) { p.energy++; p.energyTimer = 0; }

  // HP regen: 3x inside ranchHouse perimeter
  let hpRegenRate = 1.5;
  if (p.hurtCd <= 0) {
    for (const b of state.buildings) {
      if (b.def.ranchHeal && dist(p, b) < 80) { hpRegenRate = 4.5; break; }
    }
    if (p.hp < p.hpMax) p.hp = Math.min(p.hpMax, p.hp + state.dt * hpRegenRate);
  }
  p.hurtCd = Math.max(0, p.hurtCd - state.dt);
  p.flashCd = Math.max(0, p.flashCd - state.dt);
  p.attackCd = Math.max(0, p.attackCd - state.dt * 1000);

  state.activeStation = null;
  for (const b of state.buildings) {
    if (b.def.station && dist(p, b) < 60) { state.activeStation = b.def.station; break; }
  }
  state.nearShop = false;
  for (const n of state.npcs) if (n.type === 'store' && dist(p, n) < 40) state.nearShop = true;

  if (state.mouse.clicked && !state.panel) {
    if (state.buildMode) {
      tryPlaceBuilding();
    } else {
      attackOrInteract();
    }
  }

  if (state.nearShop && !state.panel) {
    showInteractHint('Press [space] or click NPC to trade');
  } else if (state.activeStation && !state.panel) {
    showInteractHint(`[C] Craft at ${state.activeStation}`);
  } else if (nearBed() && !state.panel) {
    showInteractHint('[E] Sleep to refill energy & HP');
  } else {
    hideInteractHint();
  }
  if (state.keys[' '] && state.nearShop && !state.panel) {
    togglePanel('shopPanel');
    state.keys[' '] = false;
  }

  for (const e of state.enemies) updateEnemy(e);

  for (const pr of state.projectiles) {
    pr.x += pr.vx * state.dt;
    pr.y += pr.vy * state.dt;
    pr.life -= state.dt;
    if (pr.owner === 'player') {
      for (const e of state.enemies) {
        if (e.dead) continue;
        if (dist(pr, e) < e.r + 4) { damageEnemy(e, pr.dmg); pr.life = 0; break; }
      }
    } else {
      if (dist(pr, p) < p.r + 4) { damagePlayer(pr.dmg); pr.life = 0; }
    }
  }
  state.projectiles = state.projectiles.filter(pr => pr.life > 0);

  for (const l of state.loot) {
    if (dist(l, p) < 26) { inv.add(l.id, l.n); l.picked = true; }
  }
  state.loot = state.loot.filter(l => !l.picked);

  for (const n of state.nodes) {
    if (n.hp <= 0) { n.respawn += state.dt; if (n.respawn > 15) { n.hp = n.hpMax; n.respawn = 0; } }
  }
  for (const e of state.enemies) {
    if (e.dead) {
      e.respawn += state.dt;
      if (e.respawn > 25) { e.dead = false; e.hp = e.hpMax; e.x = e.hx; e.y = e.hy; }
    }
  }

  for (const job of state.craftQueue) {
    job.remaining -= state.dt * 1000;
    if (job.remaining <= 0) {
      for (const [k, v] of Object.entries(job.recipe.out)) inv.add(k, v);
      addXP(5);
      job.done = true;
    }
  }
  state.craftQueue = state.craftQueue.filter(j => !j.done);

  for (const f of state.floatTexts) { f.y += f.vy * state.dt; f.life -= state.dt; }
  state.floatTexts = state.floatTexts.filter(f => f.life > 0);

  for (const pt of state.particles) {
    pt.x += pt.vx * state.dt; pt.y += pt.vy * state.dt;
    pt.vy += 220 * state.dt; pt.life -= state.dt;
  }
  state.particles = state.particles.filter(pt => pt.life > 0);

  // Ambient particles
  state.ambientTimer += state.dt;
  if (state.ambientTimer > 0.12) { spawnAmbient(); state.ambientTimer = 0; }
  for (const ap of state.ambientParticles) { ap.x += ap.vx * state.dt; ap.y += ap.vy * state.dt; ap.life -= state.dt; }
  state.ambientParticles = state.ambientParticles.filter(ap => ap.life > 0);
  if (state.ambientParticles.length > 200) state.ambientParticles.splice(0, 50);

  if (state.buildMode) {
    const mw2 = screenToWorld(state.mouse.x, state.mouse.y);
    const def = BUILDINGS[state.buildMode];
    const gx = Math.round(mw2.x / 20) * 20;
    const gy = Math.round(mw2.y / 20) * 20;
    state.buildGhost = { x: gx, y: gy, def, id: state.buildMode };
    state.buildOK = canPlaceBuilding(state.buildGhost);
  }

  updateHUD();
  updateQuickbar();
}

function showInteractHint(txt) { interactHint.textContent = txt; interactHint.classList.remove('hidden'); }
function hideInteractHint() { interactHint.classList.add('hidden'); }

function nearBed() {
  for (const b of state.buildings) if ((b.def.sleep || b.def.ranchHeal) && dist(state.player, b) < 60) return b;
  return null;
}
function trySleep() {
  const b = nearBed();
  if (b) {
    state.player.energy = state.player.energyMax;
    state.player.hp = state.player.hpMax;
    toast('You rest and feel restored.', 'good');
    floatText(state.player.x, state.player.y - 30, 'RESTED', '#8080ff');
  }
}
function tryEat() {
  const foods = ['stew', 'jerky'];
  for (const id of foods) { if (inv.has(id)) { useItem(id); return; } }
  toast('No food in pack.', 'bad');
}

// ---------------- Interaction / Attack ----------------
function attackOrInteract() {
  const p = state.player;
  for (const n of state.npcs) {
    if (n.type === 'store' && dist(n, screenToWorld(state.mouse.x, state.mouse.y)) < 28 && dist(n, p) < 60) {
      togglePanel('shopPanel'); return;
    }
  }
  if (p.attackCd > 0) return;
  const wDef = currentWeapon();
  p.attackCd = wDef.cd;

  if (wDef.ranged) {
    if (p.energy < 2) { toast('Too tired to aim.', 'bad'); return; }
    p.energy = Math.max(0, p.energy - 2);
    const sp = 600;
    const baseDmg = wDef.dmg * (1 + gearDmgBonus());
    if (wDef.spread) {
      // Shotgun: 3 pellets in cone
      for (let i = -1; i <= 1; i++) {
        const ang = p.facing + i * 0.28;
        state.projectiles.push({
          x: p.x + Math.cos(ang) * 16, y: p.y + Math.sin(ang) * 16,
          vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
          life: wDef.range / sp, dmg: baseDmg, owner: 'player', color: '#ff8020', r: 3,
        });
      }
    } else {
      state.projectiles.push({
        x: p.x + Math.cos(p.facing) * 16, y: p.y + Math.sin(p.facing) * 16,
        vx: Math.cos(p.facing) * sp, vy: Math.sin(p.facing) * sp,
        life: wDef.range / sp, dmg: baseDmg, owner: 'player', color: '#8080ff', r: 3,
      });
    }
  } else {
    const hitX = p.x + Math.cos(p.facing) * wDef.range * 0.6;
    const hitY = p.y + Math.sin(p.facing) * wDef.range * 0.6;
    let hit = false;
    const baseDmg = wDef.dmg * (1 + gearDmgBonus());
    for (const e of state.enemies) {
      if (e.dead) continue;
      if (dist({ x: hitX, y: hitY }, e) < e.r + 20) { damageEnemy(e, baseDmg); hit = true; }
    }
    const tool = ITEMS[p.equipped]?.tool;
    for (const n of state.nodes) {
      if (n.hp <= 0) continue;
      if (dist({ x: hitX, y: hitY }, n) < n.r + 22) {
        if (n.def.req && n.def.req !== tool) {
          floatText(n.x, n.y - 20, `Need ${n.def.req === 'mine' ? 'Pickaxe' : 'Axe'}`, '#f44');
          continue;
        }
        if (p.energy < 3) { floatText(p.x, p.y - 30, 'Too tired', '#f44'); return; }
        p.energy -= 3;
        const dmg = tool ? 18 : 10;
        n.hp -= dmg;
        particle(n.x, n.y, n.def.color || '#1a1a1a', 5);
        hit = true;
        if (n.hp <= 0) {
          const amt = rint(n.def.amount[0], n.def.amount[1]);
          inv.add(n.def.drop, amt);
          addXP(n.def.xp);
          floatText(n.x, n.y - 20, `+${amt} ${ITEMS[n.def.drop].name}`, '#6ec55e');
          if (n.type === 'tree' && Math.random() < 0.25) inv.add('fiber', 1);
        }
      }
    }
    if (hit) particle(hitX, hitY, '#8080aa', 3);
  }
}

function currentWeapon() {
  const p = state.player;
  if (p.equipped && ITEMS[p.equipped]?.weapon) return ITEMS[p.equipped].weapon;
  return { dmg: 6, range: 45, cd: 380 };
}

function damageEnemy(e, dmg) {
  e.hp -= dmg;
  e.hurtCd = 0.15;
  e.alertCd = 6;
  floatText(e.x, e.y - 20, `-${Math.floor(dmg)}`, '#ff5542');
  particle(e.x, e.y, '#660000', 4);
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  e.dead = true; e.respawn = 0;
  const d = e.def;
  addXP(d.xp);
  const coins = rint(d.coins[0], d.coins[1]);
  state.player.coins += coins;
  floatText(e.x, e.y - 20, `+$${coins} +${d.xp}XP`, '#c8a020');
  const dropId = d.drop[rint(0, d.drop.length - 1)];
  state.loot.push({ x: e.x + rand(-10, 10), y: e.y + rand(-10, 10), id: dropId, n: 1 });
  if (Math.random() < 0.3) {
    const extra = d.drop[rint(0, d.drop.length - 1)];
    state.loot.push({ x: e.x + rand(-14, 14), y: e.y + rand(-14, 14), id: extra, n: 1 });
  }
  particle(e.x, e.y, '#440000', 12);
}
function damagePlayer(rawDmg) {
  const p = state.player;
  const defense = gearDefense();
  const dmg = rawDmg * (1 - defense / 100);
  p.hp = Math.max(0, p.hp - dmg);
  p.hurtCd = 1.2;
  p.flashCd = 0.15;
  floatText(p.x, p.y - 25, `-${Math.floor(dmg)}`, '#ff5542');
  if (p.hp <= 0) {
    toast('You fell in the wastes...', 'bad');
    particle(p.x, p.y, '#440000', 20);
  }
}
function respawnPlayer() {
  const p = state.player;
  const tent = state.buildings.find(b => b.def.respawn);
  const spot = tent || { x: RANCH.x + RANCH.w/2, y: RANCH.y + RANCH.h/2 };
  p.x = spot.x; p.y = spot.y;
  p.hp = p.hpMax * 0.6;
  p.energy = Math.max(p.energy, 40);
  p.deathScreenT = 0;
  const lost = Math.floor(p.coins * 0.15);
  p.coins = Math.max(0, p.coins - lost);
  if (lost > 0) toast(`You lost $${lost} to the dirt.`, 'bad');
}

// ---------------- Enemy AI ----------------
function updateEnemy(e) {
  if (e.dead) return;
  const p = state.player;
  const d = dist(e, p);
  e.hurtCd = Math.max(0, e.hurtCd - state.dt);
  e.attackCd = Math.max(0, e.attackCd - state.dt);
  e.alertCd = Math.max(0, e.alertCd - state.dt);

  const aggroRange = e.def.ranged ? 320 : 240;
  let targetX, targetY;
  if (d < aggroRange || e.alertCd > 0) {
    targetX = p.x; targetY = p.y;
    if (d < e.def.range + e.r + p.r && e.attackCd <= 0 && p.hp > 0) {
      e.attackCd = 1.0;
      damagePlayer(e.def.dmg);
      particle(p.x, p.y, '#880020', 6);
    } else if (e.def.ranged && d < 320 && e.attackCd <= 0) {
      e.attackCd = 1.6;
      const ang = Math.atan2(p.y - e.y, p.x - e.x);
      const sp = 380;
      state.projectiles.push({
        x: e.x, y: e.y, vx: Math.cos(ang)*sp, vy: Math.sin(ang)*sp,
        life: 1.2, dmg: e.def.dmg * 0.7, owner: 'enemy', color: '#cc4010', r: 3,
      });
    }
  } else {
    e.wander -= state.dt;
    if (e.wander <= 0) { e.wx = e.hx + rand(-80, 80); e.wy = e.hy + rand(-80, 80); e.wander = rand(2, 5); }
    targetX = e.wx; targetY = e.wy;
  }
  const ang = Math.atan2(targetY - e.y, targetX - e.x);
  const vd = Math.hypot(targetX - e.x, targetY - e.y);
  if (vd > 4 && (d > (e.def.ranged ? 240 : e.def.range))) {
    e.x += Math.cos(ang) * e.def.speed * state.dt;
    e.y += Math.sin(ang) * e.def.speed * state.dt;
  }
  e.x = clamp(e.x, 20, WORLD_W - 20);
  e.y = clamp(e.y, 20, WORLD_H - 20);
}

// ---------------- Building ----------------
function canPlaceBuilding(g) {
  if (!AABB(g.x - g.def.w/2, g.y - g.def.h/2, g.def.w, g.def.h, RANCH.x, RANCH.y, RANCH.w, RANCH.h)) return false;
  for (const b of state.buildings) {
    if (AABB(g.x - g.def.w/2, g.y - g.def.h/2, g.def.w, g.def.h,
            b.x - b.def.w/2, b.y - b.def.h/2, b.def.w, b.def.h)) return false;
  }
  if (!inv.canAfford(g.def.cost)) return false;
  return true;
}
function tryPlaceBuilding() {
  if (!state.buildGhost || !state.buildOK) { toast('Cannot place here.', 'bad'); return; }
  const g = state.buildGhost;
  inv.pay(g.def.cost);
  state.buildings.push({ x: g.x, y: g.y, id: g.id, def: g.def, hp: g.def.hp, hpMax: g.def.hp });
  addXP(10);
  toast(`Built ${g.def.name}`, 'good');
  particle(g.x, g.y, '#8080ff', 10);
  if (!inv.canAfford(g.def.cost)) state.buildMode = null;
}
function solidAt(x, y, r) {
  for (const b of state.buildings) {
    if (!b.def.solid) continue;
    if (AABB(x - r, y - r, r*2, r*2, b.x - b.def.w/2, b.y - b.def.h/2, b.def.w, b.def.h)) return true;
  }
  return false;
}

// ---------------- XP & Level ----------------
function xpForLevel(l) { return 40 + (l - 1) * 60; }
function addXP(n) {
  const p = state.player;
  p.xp += n;
  while (p.xp >= xpForLevel(p.level)) {
    p.xp -= xpForLevel(p.level);
    p.level++;
    p.hpMax += 10; p.hp = p.hpMax;
    p.energyMax += 5; p.energy = p.energyMax;
    toast(`LEVEL UP! ${p.level}`, 'good');
    floatText(p.x, p.y - 30, `LV ${p.level}`, '#c8a020');
    particle(p.x, p.y, '#8040c0', 20);
  }
}

// ---------------- HUD ----------------
function updateHUD() {
  const p = state.player;
  $('hpFill').style.width = (p.hp / p.hpMax * 100) + '%';
  $('enFill').style.width = (p.energy / p.energyMax * 100) + '%';
  $('xpFill').style.width = (p.xp / xpForLevel(p.level) * 100) + '%';
  $('hpLabel').textContent = `${Math.ceil(p.hp)}/${p.hpMax}`;
  $('enLabel').textContent = `${p.energy}/${p.energyMax}`;
  $('xpLabel').textContent = `${p.xp}/${xpForLevel(p.level)}`;
  $('lvlTxt').textContent = `Lv ${p.level}`;
  $('coinTxt').textContent = `$${p.coins}`;
  $('zoneTxt').textContent = zoneAt(p.x).name;
}

// ---------------- Quickbar ----------------
function updateQuickbar() {
  const qb = $('quickbar');
  const weapons = Object.keys(state.player.inv).filter(k => ITEMS[k]?.weapon).slice(0, 5);
  const foods = Object.keys(state.player.inv).filter(k => ITEMS[k]?.food).slice(0, 2);
  const slots = [...weapons, ...foods].slice(0, 5);
  qb.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const div = document.createElement('div');
    div.className = 'slot';
    const id = slots[i];
    if (id) {
      const it = ITEMS[id];
      const eq = state.player.equipped === id ? 'style="border-color:#8080ff"' : '';
      div.innerHTML = `<span class="n">${i+1}</span><div class="icon">${it.icon}</div><span class="c">${state.player.inv[id]||0}</span>`;
      if (eq) div.setAttribute('style', 'border-color:#8080ff');
      div.dataset.id = id;
    } else {
      div.innerHTML = `<span class="n">${i+1}</span>`;
    }
    qb.appendChild(div);
  }
}
function quickUse(i) {
  const slots = $('quickbar').children;
  const id = slots[i - 1]?.dataset?.id;
  if (!id) return;
  useItem(id);
}
function useItem(id) {
  const it = ITEMS[id];
  if (!it) return;
  if (it.weapon) {
    state.player.equipped = state.player.equipped === id ? null : id;
    toast(state.player.equipped ? `Equipped ${it.name}` : `Unequipped`, 'good');
    $('eqWeapon').textContent = state.player.equipped ? ITEMS[state.player.equipped].name : 'Fists';
  } else if (it.food) {
    if (!inv.has(id)) return;
    inv.pay({ [id]: 1 });
    state.player.hp = Math.min(state.player.hpMax, state.player.hp + it.food.heal);
    state.player.energy = Math.min(state.player.energyMax, state.player.energy + it.food.energy);
    floatText(state.player.x, state.player.y - 30, `+${it.food.heal} HP`, '#6ec55e');
    toast(`Ate ${it.name}.`, 'good');
  } else if (it.gear) {
    if (state.player.gear === id) {
      state.player.gear = null;
      toast(`Unequipped ${it.name}`, 'good');
    } else {
      state.player.gear = id;
      const bonuses = [];
      if (it.gear.defense) bonuses.push(`DEF+${it.gear.defense}`);
      if (it.gear.dmgBonus) bonuses.push(`DMG+${Math.round(it.gear.dmgBonus*100)}%`);
      if (it.gear.speedBonus) bonuses.push(`SPD+${Math.round(it.gear.speedBonus*100)}%`);
      toast(`Equipped ${it.name} (${bonuses.join(', ')})`, 'good');
    }
    $('eqGear').textContent = state.player.gear ? ITEMS[state.player.gear].name : 'None';
  }
  if (state.panel === 'invPanel') renderInventory();
}

// ---------------- Panels ----------------
function renderInventory() {
  const invPanel = $('invPanel');
  // Update title
  invPanel.querySelector('h2').textContent = '🎒 BAG';

  const grid = $('invGrid');
  grid.style.gridTemplateColumns = 'repeat(5, 56px)';
  grid.style.gap = '6px';
  grid.style.marginBottom = '10px';
  grid.innerHTML = '';

  const entries = Object.entries(state.player.inv).filter(([_, n]) => n > 0);
  const VISIBLE_SLOTS = Math.max(10, entries.length);

  for (let i = 0; i < VISIBLE_SLOTS; i++) {
    const [id, n] = entries[i] || [];
    const el = document.createElement('div');
    el.style.cssText = 'width:56px;height:56px;background:#060402;border:3px solid #1a1208;position:relative;cursor:pointer;font-size:26px;display:flex;align-items:center;justify-content:center;';

    if (id) {
      const it = ITEMS[id];
      const isEqWeapon = state.player.equipped === id;
      const isEqGear = state.player.gear === id;
      if (isEqWeapon) el.style.border = '3px solid #8080ff';
      else if (isEqGear) el.style.border = '3px solid #8080ff';
      else if (it.tier === 'rare') el.style.border = '3px solid #1a1a28';
      else if (it.tier === 'epic') el.style.border = '3px solid #2a0808';
      else if (it.tier === 'uncommon') el.style.border = '3px solid #2a1808';

      const icon = document.createElement('span');
      icon.textContent = it.icon;
      el.appendChild(icon);

      const cnt = document.createElement('span');
      cnt.textContent = n;
      cnt.style.cssText = 'position:absolute;bottom:2px;right:4px;font-size:10px;font-weight:bold;color:#6a4828;text-shadow:1px 1px 0 #000;font-family:monospace;';
      el.appendChild(cnt);

      let tip = it.name;
      if (it.weapon) tip += ' (Dmg ' + it.weapon.dmg + ')';
      if (it.gear) {
        const g = it.gear;
        const parts = [];
        if (g.defense) parts.push('DEF +' + g.defense);
        if (g.dmgBonus) parts.push('DMG +' + Math.round(g.dmgBonus*100) + '%');
        if (g.speedBonus) parts.push('SPD +' + Math.round(g.speedBonus*100) + '%');
        tip += ' (' + parts.join(', ') + ')';
      }
      if (it.sell) tip += ' | Sell $' + it.sell;
      el.title = tip;

      el.addEventListener('click', () => useItem(id));
      el.addEventListener('contextmenu', e => { e.preventDefault(); sellItem(id, 1); renderInventory(); });
    } else {
      el.style.background = '#040302';
      el.style.opacity = '0.4';
      el.style.cursor = 'default';
    }
    grid.appendChild(el);
  }

  // Sell All button (only when near shop)
  const existingSellAll = invPanel.querySelector('#invSellAll');
  if (existingSellAll) existingSellAll.remove();
  if (state.nearShop) {
    const sellAllBtn = document.createElement('button');
    sellAllBtn.id = 'invSellAll';
    sellAllBtn.textContent = 'SELL ALL';
    sellAllBtn.style.cssText = 'margin-top:8px;padding:5px 14px;background:#0a0804;color:#8a5028;border:2px solid #000;font-family:inherit;cursor:pointer;font-weight:bold;text-shadow:1px 1px 0 #000;box-shadow:2px 2px 0 #000;display:block;';
    sellAllBtn.addEventListener('click', () => {
      if (!confirm('Sell all sellable items?')) return;
      sellAll();
      renderInventory();
    });
    const hintEl = invPanel.querySelector('.hint');
    invPanel.insertBefore(sellAllBtn, hintEl);
  }

  $('eqWeapon').textContent = state.player.equipped ? ITEMS[state.player.equipped].name : 'Fists';
  $('eqGear').textContent = state.player.gear ? ITEMS[state.player.gear].name : 'None';
}

function renderCraft() {
  const st = state.activeStation;
  const names = { carpenter:'Carpenter Table', smithy:'Smithy', kitchen:'Kitchen', workbench:'Workbench' };
  $('stationName').textContent = st ? names[st] : 'nowhere — stand near a workbench';
  const list = $('craftList');
  list.innerHTML = '';
  if (!st) return;
  const recipes = RECIPES.filter(r => r.station === st);
  for (const r of recipes) {
    const canAfford = inv.canAfford(r.cost);
    const costTxt = Object.entries(r.cost).map(([k, v]) => `${v} ${ITEMS[k].icon}`).join(' ');
    const outId = Object.keys(r.out)[0];
    const out = ITEMS[outId];
    const div = document.createElement('div');
    div.className = 'recipe';
    div.innerHTML = `
      <div>
        <div class="name" style="color:${tierColor(out.tier)}">${out.icon} ${out.name} ×${r.out[outId]}</div>
        <div class="cost">${costTxt} · ${(r.time/1000).toFixed(1)}s</div>
      </div>
    `;
    const btn = document.createElement('button');
    btn.textContent = 'Craft';
    btn.disabled = !canAfford;
    btn.addEventListener('click', () => {
      if (!inv.canAfford(r.cost)) return;
      inv.pay(r.cost);
      state.craftQueue.push({ recipe: r, remaining: r.time });
      toast(`Crafting ${out.name}...`);
      renderCraft();
    });
    div.appendChild(btn);
    list.appendChild(div);
  }
  if (state.craftQueue.length) {
    const info = document.createElement('div');
    info.className = 'hint';
    info.textContent = `In progress: ${state.craftQueue.length} item(s).`;
    list.appendChild(info);
  }
}

function renderBuild() {
  const list = $('buildList');
  list.innerHTML = '';
  for (const [id, def] of Object.entries(BUILDINGS)) {
    const canAfford = inv.canAfford(def.cost);
    const costTxt = Object.entries(def.cost).map(([k, v]) => `${v} ${ITEMS[k].icon}`).join(' ');
    const div = document.createElement('div');
    div.className = 'building';
    div.innerHTML = `<div><div class="name">${def.name}</div><div class="cost">${costTxt}</div></div>`;
    const btn = document.createElement('button');
    btn.textContent = state.buildMode === id ? 'Selected' : 'Select';
    btn.disabled = !canAfford;
    btn.addEventListener('click', () => {
      state.buildMode = id;
      toast(`Placing ${def.name}. Click in ranch area.`);
      closePanels();
    });
    div.appendChild(btn);
    list.appendChild(div);
  }
}

function renderShop() {
  const list = $('shopList');
  list.innerHTML = '';

  // Coin display
  const coinDiv = document.createElement('div');
  coinDiv.className = 'hint';
  coinDiv.innerHTML = `💰 Coins: <b>$${state.player.coins}</b>`;
  coinDiv.style.marginBottom = '8px';
  list.appendChild(coinDiv);

  // Tab buttons
  const tabs = document.createElement('div');
  tabs.style.cssText = 'display:flex;gap:6px;margin-bottom:12px;';
  const buyTab = document.createElement('button');
  buyTab.textContent = 'BUY';
  buyTab.style.cssText = 'padding:5px 16px;background:' + (state.shopMode==='buy'?'#2a1808':'#0a0804') + ';color:#8a6040;border:2px solid #000;font-family:inherit;cursor:pointer;font-weight:bold;';
  buyTab.addEventListener('click', () => { state.shopMode = 'buy'; renderShop(); });
  const sellTab = document.createElement('button');
  sellTab.textContent = 'SELL';
  sellTab.style.cssText = 'padding:5px 16px;background:' + (state.shopMode==='sell'?'#2a1808':'#0a0804') + ';color:#8a6040;border:2px solid #000;font-family:inherit;cursor:pointer;font-weight:bold;';
  sellTab.addEventListener('click', () => { state.shopMode = 'sell'; renderShop(); });
  tabs.appendChild(buyTab);
  tabs.appendChild(sellTab);
  list.appendChild(tabs);

  if (state.shopMode === 'buy') {
    const buyables = [
      { id: 'axe',      price: 40 },
      { id: 'pickaxe',  price: 40 },
      { id: 'knife',    price: 30 },
      { id: 'spear',  price: 80 },
      { id: 'hammer', price: 100 },
      { id: 'flail',  price: 180 },
      { id: 'katana', price: 350 },
      { id: 'katana',   price: 350 },
      { id: 'jerky',    price: 12 },
      { id: 'wood',     price: 2 },
      { id: 'stone',    price: 2 },
      { id: 'iron',     price: 8 },
    ];
    for (const b of buyables) {
      const it = ITEMS[b.id];
      const div = document.createElement('div');
      div.className = 'shopItem';
      div.innerHTML = `<div><div class="name" style="color:${tierColor(it.tier)}">${it.icon} ${it.name}</div><div class="cost">Price: $${b.price}</div></div>`;
      const btn = document.createElement('button');
      btn.textContent = 'Buy';
      btn.disabled = state.player.coins < b.price;
      btn.addEventListener('click', () => {
        if (state.player.coins < b.price) return;
        state.player.coins -= b.price;
        inv.add(b.id, 1);
        renderShop();
      });
      div.appendChild(btn);
      list.appendChild(div);
    }
  } else {
    // SELL mode
    const sellableEntries = Object.entries(state.player.inv).filter(([id, n]) => n > 0 && (ITEMS[id]?.sell || 0) > 0);
    if (sellableEntries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'hint';
      empty.textContent = 'Nothing to sell.';
      list.appendChild(empty);
    } else {
      // Sell All button
      const sellAllDiv = document.createElement('div');
      sellAllDiv.style.marginBottom = '8px';
      const sellAllBtn = document.createElement('button');
      sellAllBtn.textContent = 'SELL ALL';
      sellAllBtn.style.cssText = 'padding:5px 14px;background:#0a0804;color:#9a5028;border:2px solid #700808;font-family:inherit;cursor:pointer;font-weight:bold;';
      sellAllBtn.addEventListener('click', () => {
        if (!confirm('Sell all sellable items?')) return;
        sellAll();
        renderShop();
      });
      sellAllDiv.appendChild(sellAllBtn);
      list.appendChild(sellAllDiv);

      for (const [id, n] of sellableEntries) {
        const it = ITEMS[id];
        const sellPrice = it.sell;
        const div = document.createElement('div');
        div.className = 'shopItem';
        div.innerHTML = `<div><div class="name" style="color:${tierColor(it.tier)}">${it.icon} ${it.name} <span style="color:#4a3a20;font-size:11px">(x${n})</span></div><div class="cost">$${sellPrice} each</div></div>`;
        const btn = document.createElement('button');
        btn.textContent = 'SELL 1';
        btn.addEventListener('click', () => {
          sellItem(id, 1);
          renderShop();
        });
        div.appendChild(btn);
        list.appendChild(div);
      }
    }
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = 'You can also right-click items in your bag to sell.';
    list.appendChild(hint);
  }
}
function sellItem(id, n) {
  if (!state.nearShop) { toast('Must be at General Store to sell.', 'bad'); return; }
  if (!inv.has(id, n)) return;
  const price = (ITEMS[id].sell || 1) * n;
  inv.pay({ [id]: n });
  state.player.coins += price;
  toast(`Sold ${n} ${ITEMS[id].name} for $${price}`, 'good');
}
function sellAll() {
  if (!state.nearShop) { toast('Must be at General Store to sell.', 'bad'); return; }
  let total = 0;
  for (const [id, n] of Object.entries(state.player.inv)) {
    const sell = ITEMS[id]?.sell || 0;
    if (sell > 0 && n > 0 && id !== state.player.equipped && id !== state.player.gear) {
      total += sell * n;
      delete state.player.inv[id];
    }
  }
  if (total > 0) {
    state.player.coins += total;
    toast(`Sold everything for $${total}`, 'good');
  }
}

function renderMiniMap() {
  const mm = $('miniMap');
  const mctx = mm.getContext('2d');
  mctx.imageSmoothingEnabled = false;
  const sx = mm.width / WORLD_W, sy = mm.height / WORLD_H;
  for (const z of ZONES) {
    mctx.fillStyle = z.color;
    mctx.fillRect(z.x * sx, 0, (z.x2 - z.x) * sx, mm.height);
  }
  // Ranch
  mctx.fillStyle = '#1a1006';
  mctx.fillRect(RANCH.x * sx, RANCH.y * sy, RANCH.w * sx, RANCH.h * sy);
  mctx.strokeStyle = '#5a3810';
  mctx.lineWidth = 1;
  mctx.strokeRect(RANCH.x * sx, RANCH.y * sy, RANCH.w * sx, RANCH.h * sy);
  // Nodes
  for (const n of state.nodes) {
    if (n.hp <= 0) continue;
    mctx.fillStyle = n.type === 'tree' ? '#2e2418' : (n.type === 'rock' ? '#2a2826' : '#3a2e10');
    mctx.fillRect(n.x * sx - 1, n.y * sy - 1, 2, 2);
  }
  // Enemies
  mctx.fillStyle = '#8a1010';
  for (const e of state.enemies) if (!e.dead) mctx.fillRect(e.x * sx - 1, e.y * sy - 1, 2, 2);
  // Player
  mctx.fillStyle = '#1a4844';
  mctx.fillRect(state.player.x * sx - 3, state.player.y * sy - 3, 6, 6);
  mctx.strokeStyle = '#000';
  mctx.lineWidth = 1;
  mctx.strokeRect(state.player.x * sx - 3, state.player.y * sy - 3, 6, 6);
  // Zone labels
  mctx.fillStyle = 'rgba(90,60,20,0.9)';
  mctx.font = '10px monospace';
  mctx.fillText('BADLANDS', 4, 13);
  mctx.fillText('WASTES', ZONES[1].x * sx + 4, 13);
  mctx.fillText('RUINS', ZONES[2].x * sx + 4, 13);
}

// ---------------- Render ----------------
function screenToWorld(sx, sy) { return { x: sx + state.cam.x, y: sy + state.cam.y }; }
function worldToScreen(wx, wy) { return { x: wx - state.cam.x, y: wy - state.cam.y }; }

function render() {
  // Tile-based ground rendering
  if (state.tileMap) {
    drawTileMap();
  } else {
    ctx.fillStyle = '#100e06';
    ctx.fillRect(0, 0, W, H);
  }

  // Sickly haze gradient — post-apocalyptic oppression
  const hazeGrad = ctx.createRadialGradient(W/2, H/2, 60, W/2, H/2, W/1.4);
  hazeGrad.addColorStop(0, 'rgba(40,30,10,0.04)');
  hazeGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hazeGrad;
  ctx.fillRect(0, 0, W, H);

  // Zone borders — thick black dividers with gritty labels
  for (const zo of ZONES) {
    const s = worldToScreen(zo.x, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(s.x - 2, 0, 4, H);
    ctx.strokeStyle = '#2a1a08';
    ctx.lineWidth = 1;
    ctx.strokeRect(s.x - 2, 0, 4, H);
    const labelX = s.x + 8;
    if (labelX > -200 && labelX < W) {
      ctx.fillStyle = '#000';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(zo.name.toUpperCase(), labelX + 1, 21);
      ctx.fillStyle = '#5a4020';
      ctx.fillText(zo.name.toUpperCase(), labelX, 20);
    }
  }

  // Ranch border markings
  const rs = worldToScreen(RANCH.x, RANCH.y);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.strokeRect(rs.x, rs.y, RANCH.w, RANCH.h);
  ctx.strokeStyle = '#2a1a08';
  ctx.lineWidth = 1;
  ctx.strokeRect(rs.x + 2, rs.y + 2, RANCH.w - 4, RANCH.h - 4);
  ctx.fillStyle = '#000';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('YOUR CAMP', rs.x + 9, rs.y + 21);
  ctx.fillStyle = '#5a4020';
  ctx.fillText('YOUR CAMP', rs.x + 8, rs.y + 20);

  // Ambient particles (behind buildings)
  drawAmbientParticles();

  for (const b of state.buildings) drawBuilding(b);
  for (const n of state.nodes) drawNode(n);
  for (const l of state.loot) drawLoot(l);
  for (const n of state.npcs) drawNPC(n);
  for (const e of state.enemies) if (!e.dead) drawEnemy(e);
  drawPlayer();

  // Build ghost
  if (state.buildMode && state.buildGhost) {
    const g = state.buildGhost;
    const ss = worldToScreen(g.x - g.def.w/2, g.y - g.def.h/2);
    ctx.fillStyle = state.buildOK ? 'rgba(80,100,255,0.3)' : 'rgba(255,40,40,0.3)';
    ctx.fillRect(ss.x, ss.y, g.def.w, g.def.h);
    ctx.strokeStyle = state.buildOK ? '#6060ff' : '#ff4040';
    ctx.lineWidth = 2;
    ctx.strokeRect(ss.x, ss.y, g.def.w, g.def.h);
  }

  // Projectiles
  for (const pr of state.projectiles) {
    const s = worldToScreen(pr.x, pr.y);
    ctx.fillStyle = pr.color;
    ctx.beginPath(); ctx.arc(s.x, s.y, pr.r || 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pr.color.replace(')', ',0.2)').replace('rgb', 'rgba');
    ctx.beginPath(); ctx.arc(s.x, s.y, (pr.r || 3) + 3, 0, Math.PI * 2); ctx.fill();
  }

  // Particles
  for (const pt of state.particles) {
    const s = worldToScreen(pt.x, pt.y);
    ctx.fillStyle = pt.color;
    ctx.globalAlpha = Math.max(0, pt.life);
    ctx.fillRect(s.x - pt.size/2, s.y - pt.size/2, pt.size, pt.size);
    ctx.globalAlpha = 1;
  }

  // Float texts
  for (const f of state.floatTexts) {
    const s = worldToScreen(f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, s.x, s.y);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'start';
  }

  // Crafting progress
  if (state.craftQueue.length) {
    ctx.fillStyle = '#0a0804';
    ctx.fillRect(W - 222, H - 52, 214, 44);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(W - 222, H - 52, 214, 44);
    ctx.fillStyle = '#6a4820';
    ctx.font = '11px monospace';
    const job = state.craftQueue[0];
    const outId = Object.keys(job.recipe.out)[0];
    const prog = 1 - job.remaining / job.recipe.time;
    ctx.fillStyle = '#000';
    ctx.fillText(`Forging: ${ITEMS[outId].name}`, W - 209, H - 29);
    ctx.fillStyle = '#6a4820';
    ctx.fillText(`Forging: ${ITEMS[outId].name}`, W - 210, H - 30);
    ctx.fillStyle = '#080604';
    ctx.fillRect(W - 212, H - 22, 192, 8);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(W - 212, H - 22, 192, 8);
    ctx.fillStyle = '#5a3010';
    ctx.fillRect(W - 212, H - 22, 192 * prog, 8);
  }

  // Heavy vignette — oppressive wasteland darkness
  const vignette = ctx.createRadialGradient(W/2, H/2, H*0.25, W/2, H/2, H*0.95);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.78)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  // Dust haze at top edge
  const fogTop = ctx.createLinearGradient(0, 0, 0, 70);
  fogTop.addColorStop(0, 'rgba(20,12,4,0.6)');
  fogTop.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fogTop;
  ctx.fillRect(0, 0, W, 70);

  // Ground haze at bottom
  const fogBot = ctx.createLinearGradient(0, H - 55, 0, H);
  fogBot.addColorStop(0, 'rgba(0,0,0,0)');
  fogBot.addColorStop(1, 'rgba(10,6,2,0.55)');
  ctx.fillStyle = fogBot;
  ctx.fillRect(0, H - 55, W, 55);

  // Death screen
  if (state.player.hp <= 0) {
    ctx.fillStyle = 'rgba(4,0,0,0.85)';
    ctx.fillRect(0, 0, W, H);
    // Shadow text
    ctx.fillStyle = '#000';
    ctx.font = 'bold 56px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('YOU DIED', W/2 + 3, H/2 + 3);
    ctx.fillStyle = '#8a1010';
    ctx.fillText('YOU DIED', W/2, H/2);
    ctx.fillStyle = '#5a3020';
    ctx.font = '14px monospace';
    ctx.fillText('crawling back from the wastes...', W/2, H/2 + 44);
    ctx.textAlign = 'start';
  }
}

// ---------------- Ambient Particle Drawing ----------------
function drawAmbientParticles() {
  for (const ap of state.ambientParticles) {
    const s = worldToScreen(ap.x, ap.y);
    if (s.x < -100 || s.x > W + 100 || s.y < -100 || s.y > H + 100) continue;
    const lifeFrac = ap.life / ap.maxLife;
    const fadeAlpha = Math.min(lifeFrac * 3, 1) * Math.min((ap.maxLife - ap.life) * 3, 1);

    if (ap.type === 'firefly') {
      // Ember / ash fleck — post-apocalyptic glow
      const pulse = (Math.sin(state.t * 2.5 + ap.phase) + 1) * 0.5;
      ctx.globalAlpha = fadeAlpha * pulse * 0.7;
      ctx.fillStyle = '#c06020';
      ctx.beginPath(); ctx.arc(s.x, s.y, 2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = fadeAlpha * pulse * 0.15;
      ctx.fillStyle = '#804010';
      ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (ap.type === 'mist') {
      ctx.globalAlpha = fadeAlpha * 0.05;
      ctx.fillStyle = '#6a5030';
      ctx.beginPath(); ctx.arc(s.x, s.y, ap.size, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (ap.type === 'dust') {
      ctx.globalAlpha = fadeAlpha * 0.4;
      ctx.fillStyle = '#4a3820';
      ctx.fillRect(s.x - 1, s.y - 1, 2, 2);
      ctx.globalAlpha = 1;
    }
  }
}

// ---------------- Drawing helpers ----------------
// Sprite positions in tiles_objects.png for resource nodes
// Trees: row 0 col 0-3 (various tree tops); row 1 col 0-1 for trunks
// Rocks: row 2 col 0-3; Bushes/fiber: row 3 col 0-2
// Ore nodes: row 4 col 0 (iron), col 1 (coal), col 2 (silver)
const NODE_SPRITES = {
  tree:   { col: 0, row: 0, size: 56 },
  rock:   { col: 0, row: 2, size: 44 },
  fiber:  { col: 0, row: 3, size: 36 },
  iron:   { col: 0, row: 4, size: 44 },
  coal:   { col: 1, row: 4, size: 44 },
  silver: { col: 2, row: 4, size: 44 },
};

function drawNode(n) {
  if (n.hp <= 0) return;
  const s = worldToScreen(n.x, n.y);
  if (s.x < -50 || s.x > W + 50 || s.y < -50 || s.y > H + 50) return;

  const objLoaded = imgObjects.complete && imgObjects.naturalWidth > 0;
  const sp = NODE_SPRITES[n.type];

  ctx.strokeStyle = '#000';

  if (n.type === 'tree') {
    if (objLoaded) {
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(s.x, s.y + 8, 18, 6, 0, 0, Math.PI * 2); ctx.fill();
      // Tree trunk sprite (row 1 col 0)
      blitObj(0, 1, s.x, s.y + 14, 28);
      // Tree canopy sprite (row 0, vary col by hash for variety)
      const col = ((n.x * 7 + n.y * 13) | 0) % 3;
      blitObj(col, 0, s.x, s.y - 8, sp.size);
      // Dark tint over sprites for grim mood
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#000';
      ctx.fillRect(s.x - sp.size/2, s.y - 8 - sp.size/2, sp.size, sp.size);
      ctx.globalAlpha = 1;
    } else {
      // Fallback primitive
      ctx.fillStyle = '#2a1e10';
      ctx.fillRect(s.x - 4, s.y - 2, 8, 20);
      ctx.lineWidth = 2; ctx.strokeRect(s.x - 4, s.y - 2, 8, 20);
      ctx.fillStyle = '#2e2418';
      ctx.beginPath(); ctx.arc(s.x, s.y - 10, 20, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  } else if (n.type === 'rock') {
    // Angular dark gray rock with thick outline
    if (objLoaded) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(s.x, s.y + 6, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
      const col = ((n.x * 3 + n.y * 7) | 0) % 3;
      blitObj(col, 2, s.x, s.y, sp.size);
      ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
      ctx.fillRect(s.x - sp.size/2, s.y - sp.size/2, sp.size, sp.size);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#2a2826';
      ctx.beginPath();
      ctx.moveTo(s.x - 16, s.y + 8); ctx.lineTo(s.x - 10, s.y - 10);
      ctx.lineTo(s.x + 4, s.y - 12); ctx.lineTo(s.x + 16, s.y - 4);
      ctx.lineTo(s.x + 14, s.y + 8); ctx.closePath();
      ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
    }
  } else if (n.type === 'fiber') {
    if (objLoaded) {
      blitObj(((n.x + n.y) | 0) % 3, 3, s.x, s.y, sp.size);
      ctx.globalAlpha = 0.25; ctx.fillStyle = '#000';
      ctx.fillRect(s.x - sp.size/2, s.y - sp.size/2, sp.size, sp.size);
      ctx.globalAlpha = 1;
    } else {
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = '#4a3e1a';
        ctx.fillRect(s.x - 7 + i * 3, s.y - 10, 2, 14);
        ctx.strokeRect(s.x - 7 + i * 3, s.y - 10, 2, 14);
      }
    }
  } else if (n.type === 'iron') {
    if (objLoaded) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(s.x, s.y + 6, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
      blitObj(0, 4, s.x, s.y, sp.size);
      ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
      ctx.fillRect(s.x - sp.size/2, s.y - sp.size/2, sp.size, sp.size);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#2e2010';
      ctx.beginPath();
      ctx.moveTo(s.x - 14, s.y + 6); ctx.lineTo(s.x - 8, s.y - 8);
      ctx.lineTo(s.x + 14, s.y - 6); ctx.lineTo(s.x + 12, s.y + 8);
      ctx.closePath(); ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
    }
  } else if (n.type === 'coal') {
    if (objLoaded) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(s.x, s.y + 6, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
      blitObj(1, 4, s.x, s.y, sp.size);
      ctx.globalAlpha = 0.4; ctx.fillStyle = '#000';
      ctx.fillRect(s.x - sp.size/2, s.y - sp.size/2, sp.size, sp.size);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#141212';
      ctx.beginPath();
      ctx.moveTo(s.x - 14, s.y + 6); ctx.lineTo(s.x - 6, s.y - 8);
      ctx.lineTo(s.x + 14, s.y - 4); ctx.lineTo(s.x + 10, s.y + 8);
      ctx.closePath(); ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
    }
  } else if (n.type === 'silver') {
    if (objLoaded) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(s.x, s.y + 6, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
      blitObj(2, 4, s.x, s.y, sp.size);
      ctx.globalAlpha = 0.25; ctx.fillStyle = '#000';
      ctx.fillRect(s.x - sp.size/2, s.y - sp.size/2, sp.size, sp.size);
      ctx.globalAlpha = 1;
      // Faint shimmer
      ctx.globalAlpha = 0.15 * (0.5 + 0.5 * Math.sin(state.t * 2.5 + n.x));
      ctx.fillStyle = '#aaaacc';
      ctx.fillRect(s.x - sp.size/2, s.y - sp.size/2, sp.size, sp.size);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#1e1e2a';
      ctx.beginPath();
      ctx.moveTo(s.x - 14, s.y + 6); ctx.lineTo(s.x - 10, s.y - 8);
      ctx.lineTo(s.x + 12, s.y - 6); ctx.lineTo(s.x + 14, s.y + 6);
      ctx.closePath(); ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
    }
  }

  if (n.hp < n.hpMax) {
    ctx.fillStyle = '#000';
    ctx.fillRect(s.x - 17, s.y - 30, 34, 6);
    ctx.fillStyle = '#3a2010';
    ctx.fillRect(s.x - 16, s.y - 29, 32 * (n.hp / n.hpMax), 4);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(s.x - 17, s.y - 30, 34, 6);
  }
}

function drawEnemy(e) {
  const s = worldToScreen(e.x, e.y);
  if (s.x < -60 || s.x > W + 60 || s.y < -60 || s.y > H + 60) return;
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.ellipse(s.x, s.y + e.r + 2, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
  const hurt = e.hurtCd > 0;
  const OL = '#000';
  ctx.strokeStyle = OL;

  if (e.type === 'wolf' || e.type === 'dire') {
    // Dark hound / dire wolf — skeletal, undead canine
    const bodyCol = hurt ? '#aa1818' : (e.type === 'dire' ? '#181410' : '#2a2418');
    const boneCol = hurt ? '#cc2020' : '#5a5040';
    // Body (ribcage visible)
    ctx.fillStyle = bodyCol;
    ctx.fillRect(s.x - e.r, s.y - e.r/2, e.r * 2, e.r + 2);
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x - e.r, s.y - e.r/2, e.r * 2, e.r + 2);
    // Ribs
    ctx.fillStyle = boneCol;
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(s.x - e.r + 4 + i * 8, s.y - e.r/2 + 2, 2, e.r - 2);
    }
    // Head (skull-like snout)
    ctx.fillStyle = hurt ? '#991010' : '#222018';
    ctx.fillRect(s.x - e.r - 8, s.y - 6, 12, 9);
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x - e.r - 8, s.y - 6, 12, 9);
    // Jaw bone
    ctx.fillStyle = boneCol;
    ctx.fillRect(s.x - e.r - 6, s.y, 8, 2);
    // Teeth
    ctx.fillStyle = '#c8c0a0';
    ctx.fillRect(s.x - e.r - 4, s.y - 1, 2, 2);
    ctx.fillRect(s.x - e.r, s.y - 1, 2, 2);
    // Eyes — hollow glowing
    ctx.fillStyle = e.def.eye;
    ctx.fillRect(s.x - e.r - 5, s.y - 4, 3, 3);
    ctx.lineWidth = 1;
    ctx.strokeRect(s.x - e.r - 5, s.y - 4, 3, 3);
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = e.def.eye;
    ctx.beginPath(); ctx.arc(s.x - e.r - 4, s.y - 3, 5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // Legs (thin, bony)
    ctx.fillStyle = bodyCol;
    ctx.fillRect(s.x - e.r + 3, s.y + e.r/2, 3, 7);
    ctx.strokeRect(s.x - e.r + 3, s.y + e.r/2, 3, 7);
    ctx.fillRect(s.x + e.r - 6, s.y + e.r/2, 3, 7);
    ctx.strokeRect(s.x + e.r - 6, s.y + e.r/2, 3, 7);
    // Spiky tail
    ctx.fillStyle = bodyCol;
    ctx.fillRect(s.x + e.r, s.y - e.r/2 - 2, 6, 3);
    ctx.strokeRect(s.x + e.r, s.y - e.r/2 - 2, 6, 3);
    ctx.fillStyle = boneCol;
    ctx.fillRect(s.x + e.r + 4, s.y - e.r/2 - 4, 2, 3);
  } else {
    // Bandit types — Castlevania Legionary (Roman soldier)
    const isElite = e.type === 'bandit2';
    const armorCol = hurt ? '#aa1818' : (isElite ? '#4a4a52' : '#6a6a72');
    const armorHi  = hurt ? '#cc3030' : (isElite ? '#5a5a64' : '#8a8a92');
    const armorDk  = hurt ? '#881010' : (isElite ? '#2a2a32' : '#4a4a52');
    const tunicCol = hurt ? '#aa1818' : (isElite ? '#8a1010' : '#8a2020');
    const tunicDk  = hurt ? '#881010' : (isElite ? '#6a0808' : '#6a1818');
    const skinCol  = hurt ? '#aa1818' : '#a08060';
    const plumeCol = hurt ? '#cc3030' : (isElite ? '#1a1a2a' : '#8a1818');
    const shieldCol = hurt ? '#aa1818' : (isElite ? '#3a3850' : '#5a6a72');

    // === BOOTS (caligae, strapped sandals) ===
    ctx.fillStyle = '#3a2210';
    ctx.fillRect(s.x - 8, s.y + 10, 6, 5);
    ctx.fillRect(s.x + 2, s.y + 10, 6, 5);
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x - 8, s.y + 10, 6, 5);
    ctx.strokeRect(s.x + 2, s.y + 10, 6, 5);
    // Leg straps
    ctx.fillStyle = '#2a1808';
    ctx.fillRect(s.x - 8, s.y + 12, 6, 1);
    ctx.fillRect(s.x + 2, s.y + 12, 6, 1);

    // === LEGS (skin, thighs) ===
    ctx.fillStyle = skinCol;
    ctx.fillRect(s.x - 7, s.y + 3, 5, 8);
    ctx.fillRect(s.x + 2, s.y + 3, 5, 8);
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x - 7, s.y + 3, 5, 8);
    ctx.strokeRect(s.x + 2, s.y + 3, 5, 8);

    // === PTERUGES (leather strips hanging from belt) ===
    ctx.fillStyle = tunicDk;
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(s.x - 9 + i * 5, s.y + 1, 4, 5);
      ctx.lineWidth = 1;
      ctx.strokeRect(s.x - 9 + i * 5, s.y + 1, 4, 5);
    }

    // === BELT ===
    ctx.fillStyle = '#3a2010';
    ctx.fillRect(s.x - 10, s.y, 20, 3);
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x - 10, s.y, 20, 3);

    // === TORSO (armor — lorica segmentata) ===
    ctx.fillStyle = armorCol;
    ctx.fillRect(s.x - 9, s.y - 14, 18, 16);
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x - 9, s.y - 14, 18, 16);
    // Armor horizontal bands
    ctx.fillStyle = armorDk;
    ctx.fillRect(s.x - 9, s.y - 8, 18, 2);
    ctx.fillRect(s.x - 9, s.y - 2, 18, 2);
    // Armor highlight
    ctx.fillStyle = armorHi;
    ctx.fillRect(s.x - 9, s.y - 14, 18, 2);

    // === RED TUNIC ===
    ctx.fillStyle = tunicCol;
    // Short sleeves visible
    ctx.fillRect(s.x - 12, s.y - 12, 4, 6);
    ctx.strokeRect(s.x - 12, s.y - 12, 4, 6);
    ctx.fillRect(s.x + 8, s.y - 12, 4, 6);
    ctx.strokeRect(s.x + 8, s.y - 12, 4, 6);

    // === CAPE / NECK CLOAK (red, draped over shoulders) ===
    ctx.fillStyle = tunicCol;
    ctx.fillRect(s.x - 10, s.y - 16, 20, 4);
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x - 10, s.y - 16, 20, 4);

    // === ARMS ===
    // Left arm (holding shield)
    ctx.fillStyle = armorCol;
    ctx.fillRect(s.x - 14, s.y - 12, 5, 10);
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x - 14, s.y - 12, 5, 10);
    ctx.fillStyle = skinCol;
    ctx.fillRect(s.x - 14, s.y - 2, 5, 4);
    ctx.strokeRect(s.x - 14, s.y - 2, 5, 4);

    // Right arm (holding spear)
    ctx.fillStyle = armorCol;
    ctx.fillRect(s.x + 9, s.y - 12, 5, 10);
    ctx.strokeRect(s.x + 9, s.y - 12, 5, 10);
    ctx.fillStyle = skinCol;
    ctx.fillRect(s.x + 9, s.y - 2, 5, 4);
    ctx.strokeRect(s.x + 9, s.y - 2, 5, 4);

    // === SHIELD (left side, circular) ===
    ctx.fillStyle = shieldCol;
    ctx.beginPath(); ctx.arc(s.x - 14, s.y - 6, 9, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 2;
    ctx.stroke();
    // Shield rings
    ctx.strokeStyle = armorHi;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(s.x - 14, s.y - 6, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(s.x - 14, s.y - 6, 3, 0, Math.PI * 2); ctx.stroke();
    // Shield boss
    ctx.fillStyle = armorHi;
    ctx.beginPath(); ctx.arc(s.x - 14, s.y - 6, 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = OL;

    // === SPEAR (right side, vertical) ===
    ctx.fillStyle = '#3a2010';
    ctx.fillRect(s.x + 12, s.y - 28, 3, 30);
    ctx.lineWidth = 1;
    ctx.strokeRect(s.x + 12, s.y - 28, 3, 30);
    // Spearhead
    ctx.fillStyle = armorCol;
    ctx.beginPath();
    ctx.moveTo(s.x + 10, s.y - 28);
    ctx.lineTo(s.x + 13.5, s.y - 36);
    ctx.lineTo(s.x + 17, s.y - 28);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = OL;
    ctx.stroke();

    // === HEAD (face, mostly hidden by helmet) ===
    ctx.fillStyle = skinCol;
    ctx.fillRect(s.x - 5, s.y - 22, 10, 7);
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x - 5, s.y - 22, 10, 7);

    // === HELMET (galea, silver/grey) ===
    ctx.fillStyle = armorCol;
    ctx.fillRect(s.x - 7, s.y - 24, 14, 6);
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x - 7, s.y - 24, 14, 6);
    // Brow ridge
    ctx.fillStyle = armorHi;
    ctx.fillRect(s.x - 7, s.y - 24, 14, 2);
    // Neck guard
    ctx.fillStyle = armorDk;
    ctx.fillRect(s.x - 4, s.y - 18, 8, 3);
    // Cheek guards
    ctx.fillRect(s.x - 7, s.y - 22, 3, 6);
    ctx.strokeRect(s.x - 7, s.y - 22, 3, 6);
    ctx.fillRect(s.x + 4, s.y - 22, 3, 6);
    ctx.strokeRect(s.x + 4, s.y - 22, 3, 6);

    // === CREST / PLUME (red, on top of helmet) ===
    ctx.fillStyle = plumeCol;
    ctx.fillRect(s.x - 2, s.y - 32, 4, 10);
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x - 2, s.y - 32, 4, 10);
    // Plume curves
    ctx.fillRect(s.x - 4, s.y - 30, 2, 6);
    ctx.strokeRect(s.x - 4, s.y - 30, 2, 6);
    ctx.fillRect(s.x + 2, s.y - 30, 2, 6);
    ctx.strokeRect(s.x + 2, s.y - 30, 2, 6);

    // === EYES (dark, hollow behind helmet) ===
    ctx.fillStyle = e.def.eye;
    ctx.fillRect(s.x - 3, s.y - 21, 2, 2);
    ctx.fillRect(s.x + 1, s.y - 21, 2, 2);
    ctx.lineWidth = 1;
    ctx.strokeRect(s.x - 3, s.y - 21, 2, 2);
    ctx.strokeRect(s.x + 1, s.y - 21, 2, 2);
  }

  // HP bar
  if (e.hp < e.hpMax) {
    ctx.fillStyle = '#000';
    ctx.fillRect(s.x - 19, s.y - e.r - 18, 38, 6);
    ctx.fillStyle = '#6a0808';
    ctx.fillRect(s.x - 18, s.y - e.r - 17, 36 * (e.hp / e.hpMax), 4);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(s.x - 19, s.y - e.r - 18, 38, 6);
  }
}

function facingToDir(angle) {
  // Normalize angle to [-PI, PI]
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  const P = Math.PI;
  if (a >= -P/8 && a < P/8)          return 'south';
  if (a >= P/8  && a < 3*P/8)        return 'south_east';
  if (a >= 3*P/8 && a < 5*P/8)       return 'east';
  if (a >= 5*P/8 && a < 7*P/8)       return 'north_east';
  if (a >= -3*P/8 && a < -P/8)       return 'south_west';
  if (a >= -5*P/8 && a < -3*P/8)     return 'west';
  if (a >= -7*P/8 && a < -5*P/8)     return 'north_west';
  return 'north';
}

function drawPlayer() {
  const p = state.player;
  const s = worldToScreen(p.x, p.y);
  const flash = p.flashCd > 0;
  const gearId = p.gear;

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.ellipse(s.x, s.y + 4, 14, 5, 0, 0, Math.PI * 2); ctx.fill();

  const dir = facingToDir(p.facing);
  const img = charSprites[dir];
  const SW = 44, SH = 44; // draw size
  const drawX = s.x - SW / 2;
  const drawY = s.y - SH;   // feet at s.y

  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, drawX, drawY, SW, SH);

    // Gear overlays on torso area
    if (!flash) {
      if (gearId === 'ironArmor') {
        ctx.fillStyle = 'rgba(56,56,64,0.65)';
        ctx.fillRect(drawX + 8, drawY + 14, 28, 18);
      } else if (gearId === 'shadowCloak') {
        ctx.fillStyle = 'rgba(0,0,10,0.55)';
        ctx.fillRect(drawX + 4, drawY + 10, 36, 26);
      }
      if (gearId === 'demonMask') {
        ctx.fillStyle = 'rgba(70,0,30,0.75)';
        ctx.fillRect(drawX + 10, drawY + 2, 24, 14);
        ctx.fillStyle = '#cc1818';
        ctx.fillRect(drawX + 12, drawY + 6, 4, 2);
        ctx.fillRect(drawX + 20, drawY + 6, 4, 2);
      }
    }

    // Hurt flash — red tint over sprite
    if (flash) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.save();
      // Clip to sprite region so tint doesn't bleed outside
      ctx.beginPath();
      ctx.rect(drawX, drawY, SW, SH);
      ctx.clip();
      ctx.fillStyle = 'rgba(220,20,20,0.6)';
      ctx.fillRect(drawX, drawY, SW, SH);
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    }
  } else {
    // Fallback circle while images load
    ctx.fillStyle = flash ? '#cc1020' : '#D2A679';
    ctx.beginPath(); ctx.arc(s.x, s.y - SH/2, 16, 0, Math.PI * 2); ctx.fill();
  }

  // === WEAPON ARM (pointing toward mouse) ===
  const wx = s.x + Math.cos(p.facing) * 18;
  const wy = s.y - SH/2 + Math.sin(p.facing) * 18;
  const wDef = currentWeapon();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(s.x, s.y - SH/2); ctx.lineTo(wx, wy); ctx.stroke();
  ctx.strokeStyle = '#967259';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(s.x, s.y - SH/2); ctx.lineTo(wx, wy); ctx.stroke();
  if (p.equipped) {
    if (!wDef.ranged) {
      const angle = p.facing;
      const bx = wx + Math.cos(angle) * 10;
      const by = wy + Math.sin(angle) * 10;
      const cx2 = wx + Math.cos(angle - 0.7) * 14;
      const cy2 = wy + Math.sin(angle - 0.7) * 14;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(wx, wy); ctx.quadraticCurveTo(cx2, cy2, bx, by); ctx.stroke();
      ctx.strokeStyle = '#B0BEC5';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(wx, wy); ctx.quadraticCurveTo(cx2, cy2, bx, by); ctx.stroke();
      ctx.fillStyle = '#C5A059';
      ctx.fillRect(wx - 3, wy - 3, 6, 6);
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
      ctx.strokeRect(wx - 3, wy - 3, 6, 6);
    } else {
      ctx.fillStyle = '#2a1808';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.fillRect(wx - 3, wy - 3, 6, 6);
      ctx.strokeRect(wx - 3, wy - 3, 6, 6);
    }
  }

  // === ATTACK SWOOSH ===
  if (p.attackCd > wDef.cd * 0.6) {
    ctx.strokeStyle = 'rgba(180,80,0,0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(s.x, s.y - SH/2, 26, p.facing - 0.65, p.facing + 0.65);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,140,20,0.2)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(s.x, s.y - SH/2, 26, p.facing - 0.65, p.facing + 0.65);
    ctx.stroke();
  }

  // Faint warm glow at feet
  ctx.globalAlpha = 0.1;
  const pglow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 28);
  pglow.addColorStop(0, '#804010');
  pglow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = pglow;
  ctx.beginPath(); ctx.arc(s.x, s.y, 28, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

function drawLoot(l) {
  const s = worldToScreen(l.x, l.y);
  if (s.x < -30 || s.x > W + 30) return;
  const bob = Math.sin(state.t * 3.5 + l.x) * 2;
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(s.x, s.y + 6, 8, 2, 0, 0, Math.PI * 2); ctx.fill();
  // Dim amber glow — wasteland dropped goods
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#7a5020';
  ctx.beginPath(); ctx.arc(s.x, s.y + bob - 4, 10, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // Item border box
  ctx.fillStyle = '#0e0a06';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.fillRect(s.x - 10, s.y + bob - 12, 20, 18);
  ctx.strokeRect(s.x - 10, s.y + bob - 12, 20, 18);
  ctx.fillStyle = '#a07828';
  ctx.font = '14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(ITEMS[l.id].icon, s.x, s.y + bob + 2);
  ctx.textAlign = 'start';
}

function drawNPC(n) {
  const s = worldToScreen(n.x, n.y);
  if (s.x < -50 || s.x > W + 50) return;

  ctx.strokeStyle = '#000';

  // Store shack — dark weathered wood
  ctx.fillStyle = '#1a1006';
  ctx.fillRect(s.x - 42, s.y - 42, 84, 54);
  ctx.lineWidth = 3;
  ctx.strokeRect(s.x - 42, s.y - 42, 84, 54);
  // Roof overhang
  ctx.fillStyle = '#100c04';
  ctx.fillRect(s.x - 46, s.y - 52, 92, 12);
  ctx.lineWidth = 3;
  ctx.strokeRect(s.x - 46, s.y - 52, 92, 12);
  // Roof ridgeline detail
  ctx.strokeStyle = '#2a1808';
  ctx.lineWidth = 1;
  for (let rx = -42; rx < 44; rx += 10) {
    ctx.beginPath(); ctx.moveTo(s.x + rx, s.y - 52); ctx.lineTo(s.x + rx, s.y - 40); ctx.stroke();
  }
  ctx.strokeStyle = '#000';
  // Wall planks detail
  ctx.strokeStyle = '#0a0804';
  ctx.lineWidth = 1;
  for (let ry = -42; ry < 12; ry += 12) {
    ctx.beginPath(); ctx.moveTo(s.x - 42, s.y + ry); ctx.lineTo(s.x + 42, s.y + ry); ctx.stroke();
  }
  ctx.strokeStyle = '#000';

  // NPC body — gaunt shopkeeper silhouette
  ctx.fillStyle = '#1e1208';
  ctx.fillRect(s.x - 10, s.y - 28, 20, 32);
  ctx.lineWidth = 2;
  ctx.strokeRect(s.x - 10, s.y - 28, 20, 32);
  // Head
  ctx.fillStyle = '#241a0e';
  ctx.fillRect(s.x - 7, s.y - 38, 14, 12);
  ctx.lineWidth = 2;
  ctx.strokeRect(s.x - 7, s.y - 38, 14, 12);
  // Hat
  ctx.fillStyle = '#0a0604';
  ctx.fillRect(s.x - 9, s.y - 40, 18, 4);
  ctx.lineWidth = 2;
  ctx.strokeRect(s.x - 9, s.y - 40, 18, 4);
  // Eyes
  ctx.fillStyle = '#b07820';
  ctx.fillRect(s.x - 4, s.y - 35, 3, 2);
  ctx.fillRect(s.x + 1, s.y - 35, 3, 2);
  ctx.lineWidth = 1;
  ctx.strokeRect(s.x - 4, s.y - 35, 3, 2);
  ctx.strokeRect(s.x + 1, s.y - 35, 3, 2);

  // Dim lantern glow — amber flicker
  ctx.globalAlpha = 0.18;
  const lantern = ctx.createRadialGradient(s.x + 28, s.y - 28, 0, s.x + 28, s.y - 28, 38);
  lantern.addColorStop(0, '#c07820');
  lantern.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lantern;
  ctx.beginPath(); ctx.arc(s.x + 28, s.y - 28, 38, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  // Label — pixel-feel text with shadow
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000';
  ctx.fillText('TRADER', s.x + 1, s.y - 55);
  ctx.fillStyle = '#7a5820';
  ctx.fillText('TRADER', s.x, s.y - 56);
  ctx.fillStyle = '#000';
  ctx.fillText('[CLICK]', s.x + 1, s.y + 22);
  ctx.fillStyle = '#5a4018';
  ctx.fillText('[CLICK]', s.x, s.y + 21);
  ctx.textAlign = 'start';
}

function drawBuilding(b) {
  const s = worldToScreen(b.x, b.y);
  const x = s.x - b.def.w/2, y = s.y - b.def.h/2;
  if (x < -100 || x > W + 100) return;

  ctx.strokeStyle = '#000';
  const objLoaded = imgObjects.complete && imgObjects.naturalWidth > 0;

  // Base structure — dark brown weathered
  ctx.fillStyle = b.def.color || '#1a1006';
  ctx.fillRect(x, y, b.def.w, b.def.h);

  // Wooden plank texture from objects sheet (row 5, col 0 = wooden floor tile)
  if (objLoaded && b.id !== 'stoneWall' && b.id !== 'wall') {
    ctx.save();
    ctx.globalAlpha = 0.22;
    // Tile a wooden plank sprite across the building base
    for (let tx = 0; tx < b.def.w; tx += SPRITE) {
      for (let ty2 = 0; ty2 < b.def.h; ty2 += SPRITE) {
        ctx.drawImage(imgObjects, 0, 5 * SPRITE, SPRITE, SPRITE,
          x + tx, y + ty2, Math.min(SPRITE, b.def.w - tx), Math.min(SPRITE, b.def.h - ty2));
      }
    }
    ctx.restore();
  }

  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, b.def.w, b.def.h);
  // Inner plank lines
  ctx.strokeStyle = '#0a0804';
  ctx.lineWidth = 1;
  for (let ry = 0; ry < b.def.h; ry += 10) {
    ctx.beginPath(); ctx.moveTo(x, y + ry); ctx.lineTo(x + b.def.w, y + ry); ctx.stroke();
  }
  ctx.strokeStyle = '#000';

  if (b.id === 'tent') {
    ctx.fillStyle = '#201408';
    ctx.beginPath();
    ctx.moveTo(x - 2, y + b.def.h + 2);
    ctx.lineTo(x + b.def.w/2, y - 4);
    ctx.lineTo(x + b.def.w + 2, y + b.def.h + 2);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000';
    ctx.stroke();
    // Door
    ctx.fillStyle = '#0a0604';
    ctx.fillRect(x + b.def.w/2 - 6, y + b.def.h - 18, 12, 18);
    ctx.lineWidth = 2;
    ctx.strokeRect(x + b.def.w/2 - 6, y + b.def.h - 18, 12, 18);
    // Tent rope hints
    ctx.strokeStyle = '#3a2010';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + b.def.w/2, y - 4); ctx.lineTo(x - 8, y + b.def.h + 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + b.def.w/2, y - 4); ctx.lineTo(x + b.def.w + 8, y + b.def.h + 6); ctx.stroke();
    ctx.strokeStyle = '#000';
  } else if (b.id === 'bed') {
    ctx.fillStyle = '#241828';
    ctx.fillRect(x + 4, y + 4, b.def.w - 8, b.def.h - 8);
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 4, y + 4, b.def.w - 8, b.def.h - 8);
    ctx.fillStyle = '#1a0e18';
    ctx.fillRect(x + 4, y + 4, 14, b.def.h - 8);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 4, y + 4, 14, b.def.h - 8);
  } else if (b.id === 'chest') {
    // Chest bands
    ctx.fillStyle = '#3a1e08';
    ctx.fillRect(x + 4, y + b.def.h/2 - 2, b.def.w - 8, 5);
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 4, y + b.def.h/2 - 2, b.def.w - 8, 5);
    // Lid line
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 2, y + b.def.h/2 - 2); ctx.lineTo(x + b.def.w - 2, y + b.def.h/2 - 2); ctx.stroke();
    // Lock
    ctx.fillStyle = '#a07010';
    ctx.fillRect(x + b.def.w/2 - 4, y + b.def.h/2 - 3, 8, 6);
    ctx.lineWidth = 2;
    ctx.strokeRect(x + b.def.w/2 - 4, y + b.def.h/2 - 3, 8, 6);
    ctx.fillStyle = '#000';
    ctx.fillRect(x + b.def.w/2 - 1, y + b.def.h/2, 2, 2);
  } else if (b.id === 'ranchHouse') {
    // Roof triangle
    ctx.fillStyle = '#1a0e06';
    ctx.beginPath();
    ctx.moveTo(x - 6, y + 2);
    ctx.lineTo(x + b.def.w/2, y - 22);
    ctx.lineTo(x + b.def.w + 6, y + 2);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000';
    ctx.stroke();
    // Roof planks
    ctx.strokeStyle = '#0a0604';
    ctx.lineWidth = 1;
    for (let ri = 1; ri < 4; ri++) {
      const rx = x + (b.def.w / 4) * ri;
      ctx.beginPath(); ctx.moveTo(rx, y + 2); ctx.lineTo(x + b.def.w/2, y - 22); ctx.stroke();
    }
    ctx.strokeStyle = '#000';
    // Door
    ctx.fillStyle = '#0a0604';
    ctx.fillRect(x + b.def.w/2 - 9, y + b.def.h - 28, 18, 28);
    ctx.lineWidth = 2;
    ctx.strokeRect(x + b.def.w/2 - 9, y + b.def.h - 28, 18, 28);
    // Windows
    ctx.fillStyle = '#181006';
    ctx.fillRect(x + 8, y + 8, 16, 12);
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 8, y + 8, 16, 12);
    ctx.fillRect(x + b.def.w - 24, y + 8, 16, 12);
    ctx.strokeRect(x + b.def.w - 24, y + 8, 16, 12);
    // Faint amber glow from window
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#c07820';
    ctx.fillRect(x + 8, y + 8, 16, 12);
    ctx.fillRect(x + b.def.w - 24, y + 8, 16, 12);
    ctx.globalAlpha = 1;
    // Labels
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';
    ctx.fillText('CAMP HOUSE', s.x + 1, y - 7);
    ctx.fillStyle = '#6a4820';
    ctx.fillText('CAMP HOUSE', s.x, y - 8);
    ctx.fillStyle = '#000';
    ctx.fillText('[E] Sleep', s.x + 1, y + b.def.h + 13);
    ctx.fillStyle = '#4a3018';
    ctx.fillText('[E] Sleep', s.x, y + b.def.h + 12);
    ctx.textAlign = 'start';
  } else if (b.id === 'wall' || b.id === 'stoneWall') {
    // Wall texture lines
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + b.def.w/2, y); ctx.lineTo(x + b.def.w/2, y + b.def.h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + b.def.h/2); ctx.lineTo(x + b.def.w, y + b.def.h/2); ctx.stroke();
  } else if (b.def.station) {
    const icon = { carpenter: '🪚', smithy: '⚒️', kitchen: '🍳', workbench: '🔧' }[b.def.station];
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#4a3818';
    ctx.fillText(icon, s.x, s.y + 5);
    ctx.font = '8px monospace';
    ctx.fillStyle = '#000';
    ctx.fillText(b.def.name.toUpperCase(), s.x + 1, y - 1);
    ctx.fillStyle = '#5a3a18';
    ctx.fillText(b.def.name.toUpperCase(), s.x, y - 2);
    ctx.textAlign = 'start';
  }
}

})();
