'use strict';
/* Hill Climb Adventure - Stage 1: Monster Truck + Desert (Matter.js physics) */

const $ = id => document.getElementById(id);
if (typeof Matter === 'undefined') { $('err').classList.remove('hidden'); throw new Error('Matter.js missing: put matter.min.js in libs/'); }
const { Engine, Bodies, Body, Composite, Constraint, Events } = Matter;

/* ---------- Config ---------- */
const STEP = 1000 / 60, SEG = 40, PX_PER_M = 50, VIEW_H = 620;
const DESERT = { sky: '#FFF0B3', sun: '#FFD96B', far: '#F6D38C', mid: '#EDB766', ground: '#8F4F1F', edge: '#4E280E', dust: '#EBCB8E' };

/* ---------- Save (LocalStorage) ---------- */
const SAVE_KEY = 'hca_save_v1';
let save = { coins: 0, best: 0, sound: true, music: true, unlocked: ['truck'], selected: 'truck' };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY)) || {}); } catch (e) { /* ignore */ }
if (!Array.isArray(save.unlocked) || !save.unlocked.includes('truck')) save.unlocked = ['truck'];
let V = VEHICLES.find(v => v.id === save.selected && save.unlocked.includes(v.id)) || VEHICLES[0];   // selected vehicle
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } };

/* ---------- Terrain function (deterministic) ---------- */
function terrainY(x) {
  const hard = 0.35 + 0.65 * Math.min(1, Math.max(0, (x - 300) / 6000));   // gets steeper with distance
  const flat = Math.min(1, Math.max(0, (x - 250) / 400));                  // flat start area
  return 520 - flat * hard * (Math.sin(x / 280) * 70 + Math.sin(x / 110 + 1.3) * 22 + Math.sin(x / 700) * 110);
}
const rnd = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/* ---------- World state ---------- */
let engine, world, chassis, wheelR, wheelF, terrain, pickups, done, particles;
let state = 'menu', acc = 0, last = performance.now();
let camX = 0, camY = 0, scale = 1, W = 0, H = 0, dpr = 1;
let fuel, coins, startX, flipTicks, stallTicks, reason, wasGround = true, airVy = 0, shake = 0;
const input = { gas: false, brake: false, tilt: 0 };

function createWorld() {
  engine = Engine.create(); world = engine.world; engine.gravity.y = 1;
  terrain = new Map(); pickups = new Map(); done = new Set(); particles = [];
  Composite.add(world, Bodies.rectangle(-260, 0, 40, 4000, { isStatic: true, label: 'ground' }));
  const T = V, x = 200, y = terrainY(x) - (T.wheelY + T.wheelR + 40), g = { group: -1 };
  chassis = Bodies.rectangle(x, y, T.w, T.h, { density: T.density, friction: 0.5, collisionFilter: g, label: 'chassis' });
  const mkWheel = ox => Bodies.circle(x + ox, y + T.wheelY, T.wheelR, { density: T.wheelDensity, friction: T.grip, frictionStatic: 1, restitution: 0.05, collisionFilter: g, label: 'wheel' });
  wheelR = mkWheel(-T.wheelX); wheelF = mkWheel(T.wheelX);
  const spring = (w, ox) => Constraint.create({ bodyA: chassis, pointA: { x: ox, y: T.wheelY }, bodyB: w, length: 0, stiffness: T.stiff, damping: T.damp });
  Composite.add(world, [chassis, wheelR, wheelF, spring(wheelR, -T.wheelX), spring(wheelF, T.wheelX)]);
  Events.on(engine, 'collisionStart collisionActive', e => {
    for (const p of e.pairs) {
      const gr = p.bodyA.label === 'ground' ? p.bodyA : p.bodyB.label === 'ground' ? p.bodyB : null;
      if (!gr) continue;
      const o = gr === p.bodyA ? p.bodyB : p.bodyA;
      if (o.label === 'wheel') o.grounded = true; else if (o.label === 'chassis') o.hit = true;
    }
  });
}

function ensureTerrain(x0, x1) {
  const i0 = Math.floor(x0 / SEG) - 2, i1 = Math.ceil(x1 / SEG) + 2;
  for (let i = i0; i <= i1; i++) {
    if (terrain.has(i) || i < -6) continue;
    const xa = i * SEG, xb = xa + SEG, ya = terrainY(xa), yb = terrainY(xb), t = 60;
    const ang = Math.atan2(yb - ya, xb - xa), len = Math.hypot(xb - xa, yb - ya) + 2;
    const mx = (xa + xb) / 2 + (-Math.sin(ang)) * t / 2, my = (ya + yb) / 2 + Math.cos(ang) * t / 2;
    const b = Bodies.rectangle(mx, my, len, t, { isStatic: true, angle: ang, friction: 2, label: 'ground' });
    terrain.set(i, b); Composite.add(world, b);
    // pickups: coin arcs every few segments, fuel can now and then
    if (i >= 10 && !done.has('p' + i)) {
      if (i % 50 === 32) pickups.set('p' + i, { id: 'p' + i, type: 'fuel', x: xa, y: ya - 70 });
      else if (i % 5 === 0 && rnd(i) < 0.75) for (let k = 0; k < 3; k++) {
        const id = 'p' + i + '_' + k;
        if (!done.has(id)) pickups.set(id, { id, type: 'coin', x: xa + k * 34, y: terrainY(xa + k * 34) - 70 - (k === 1 ? 14 : 0) });
      }
    }
  }
  for (const [i, b] of terrain) if (i < i0 - 15 || i > i1 + 15) { Composite.remove(world, b); terrain.delete(i); }
  for (const [id, p] of pickups) if (p.x < x0 - 600) pickups.delete(id);
}

/* ---------- Game flow ---------- */
function resetGame() {
  createWorld(); fuel = V.fuel; coins = 0; startX = chassis.position.x; flipTicks = 0; stallTicks = 0; reason = '';
  camX = chassis.position.x - 300; camY = chassis.position.y - 380; acc = 0;
  ensureTerrain(camX - 100, camX + 2200);
}
function show(id, on) { $(id).classList.toggle('hidden', !on); }
function setState(s) {
  state = s; Sfx.run(s === 'play'); show('garage', s === 'garage');
  show('menu', s === 'menu'); show('hud', s === 'play' || s === 'pause');
  show('pause', s === 'pause'); show('over', s === 'over');
  if (s === 'menu') { $('menuVeh').textContent = V.name; $('menuBest').textContent = save.best + ' m'; $('menuCoins').textContent = save.coins; }
}
function startRun() { Sfx.unlock(); resetGame(); setState('play'); }
function dist() { return Math.max(0, (chassis.position.x - startX) / PX_PER_M); }
function gameOver(why) {
  if (state !== 'play') return;
  Sfx.run(false); if (why === 'Crashed') { Sfx.crash(); shake = 12; } else Sfx.over();
  reason = why; const d = Math.floor(dist()), earned = coins + Math.floor(d / 20);
  save.coins += earned; if (d > save.best) save.best = d; persist();
  $('overReason').textContent = why; $('overDist').textContent = d + ' m'; $('overCoins').textContent = coins;
  $('overEarned').textContent = earned; $('overBest').textContent = save.best + ' m';
  setState('over');
}

/* ---------- Simulation step ---------- */
function step() {
  const T = V, ws = [wheelR, wheelF];
  const gas = input.gas && fuel > 0, brake = input.brake;
  if (gas) ws.forEach(w => { if (w.grounded) Body.setAngularVelocity(w, Math.min(w.angularVelocity + T.accel, T.maxAV)); });
  else if (brake) ws.forEach(w => Body.setAngularVelocity(w, w.angularVelocity > 0.02 ? w.angularVelocity * 0.88 : Math.max(w.angularVelocity - T.accel * 0.6, -T.reverseAV)));
  // anti-wheelie: damp nose-up rotation while driving on the ground
  if (gas && (wheelR.grounded || wheelF.grounded) && chassis.angularVelocity < -0.004) Body.setAngularVelocity(chassis, chassis.angularVelocity * 0.7);
  // air control: gas tilts nose up, brake tilts nose down, A/D keys too
  if (!wheelR.grounded && !wheelF.grounded) {
    const d = (input.gas ? -1 : 0) + (input.brake ? 1 : 0) + input.tilt;
    if (d) Body.setAngularVelocity(chassis, Math.max(-0.07, Math.min(0.07, chassis.angularVelocity + d * T.air)));
  }
  ws.forEach(w => { w.grounded = false; }); chassis.hit = false;   // refreshed by collision events
  Engine.update(engine, STEP);
  // landing / jump sounds + dust burst + camera shake
  const gnd = wheelR.grounded || wheelF.grounded;
  if (!gnd) airVy = Math.max(airVy, chassis.velocity.y);
  else { if (!wasGround && airVy > 4) { Sfx.land(airVy); shake = Math.min(8, airVy * 0.5);
    for (let k = 0; k < 10; k++) particles.push({ x: chassis.position.x + (Math.random() - 0.5) * 120, y: chassis.position.y + 50, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 2.5, life: 30 }); }
    airVy = 0; }
  if (!gnd && wasGround && chassis.velocity.y < -3) Sfx.jump();
  wasGround = gnd;
  Sfx.update(Math.min(1, (Math.abs(wheelR.angularVelocity) + Math.abs(wheelF.angularVelocity)) / 2 / T.maxAV), gas, gnd && gas && Math.abs(wheelR.angularVelocity) > 0.2 ? 1 : 0);
  // fuel
  fuel = Math.max(0, fuel - (gas ? 0.045 : 0.012));
  // pickups
  const c = chassis.position;
  for (const [id, p] of pickups) if (Math.hypot(p.x - c.x, p.y - c.y) < 60) {
    pickups.delete(id); done.add(id);
    if (p.type === 'coin') { coins++; Sfx.coin(); } else { fuel = Math.min(T.fuel, fuel + 50); Sfx.fuel(); }
  }
  // dust
  ws.forEach(w => { if (w.grounded && Math.abs(w.angularVelocity) > 0.08 && Math.random() < 0.5)
    particles.push({ x: w.position.x, y: w.position.y + T.wheelR, vx: -Math.sign(w.angularVelocity) * (1 + Math.random() * 2), vy: -Math.random() * 2, life: 30 }); });
  particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life--; });
  particles = particles.filter(p => p.life > 0);
  // end conditions
  flipTicks = chassis.hit && Math.cos(chassis.angle) < -0.2 ? flipTicks + 1 : 0;
  stallTicks = fuel <= 0 && Math.hypot(chassis.velocity.x, chassis.velocity.y) < 0.4 ? stallTicks + 1 : 0;
  if (flipTicks > 40) gameOver('Crashed');
  else if (stallTicks > 90) gameOver('Out of fuel');
  else if (c.y > 3000) gameOver('Fell off the map');
  ensureTerrain(camX - 100, camX + W / scale + 1500);
}

/* ---------- Rendering ---------- */
function rrect(x, y, w, h, r, g = ctx) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function dunes(base, amp, wl, par, color, vw, vh) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, vh);
  for (let sx = 0; sx <= vw + 20; sx += 20) ctx.lineTo(sx, base + Math.sin((sx + camX * par) / wl) * amp + Math.sin((sx + camX * par) / (wl * 0.37)) * amp * 0.3);
  ctx.lineTo(vw, vh); ctx.closePath(); ctx.fill();
}
function paintWheel(g, v, x, y, ang) {
  g.save(); g.translate(x, y); g.rotate(ang); const r = v.wheelR;
  g.fillStyle = '#2B2623'; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
  g.fillStyle = '#4A413B'; g.beginPath(); g.arc(0, 0, r * 0.72, 0, 7); g.fill();
  g.strokeStyle = '#E6C07B'; g.lineWidth = 4;
  for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 4); g.beginPath(); g.moveTo(-r * 0.5, 0); g.lineTo(r * 0.5, 0); g.stroke(); }
  g.restore();
}
function paintBody(g, v) {            // drawn around the chassis centre (0,0), facing right
  const hw = v.w / 2, hh = v.h / 2;
  if (v.kind === 'bike') {
    g.strokeStyle = v.dark; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath();
    g.moveTo(-v.wheelX, v.wheelY); g.lineTo(-8, -6); g.lineTo(v.wheelX - 4, -14); g.lineTo(v.wheelX, v.wheelY); g.stroke();
    g.fillStyle = v.color; rrect(-24, -22, 50, 16, 7, g); g.fill();
    g.fillStyle = '#222'; rrect(-40, -12, 30, 8, 4, g); g.fill();
    g.strokeStyle = '#2B2B3A'; g.lineWidth = 8; g.beginPath(); g.moveTo(-28, -12); g.lineTo(-12, -44); g.lineTo(14, -24); g.stroke();
    g.fillStyle = '#F2C9A0'; g.beginPath(); g.arc(-8, -56, 9, 0, 7); g.fill();
    g.fillStyle = v.color; g.beginPath(); g.arc(-8, -58, 10, Math.PI, 0); g.fill();
    return;
  }
  g.fillStyle = v.color; rrect(-hw, -hh, v.w, v.h, 9, g); g.fill();                          // body
  g.fillStyle = v.dark; rrect(v.cab.x - v.cab.w / 2, -hh - v.cab.h + 4, v.cab.w, v.cab.h, 9, g); g.fill(); // cab
  g.fillStyle = '#BFE3F2'; rrect(v.cab.x - v.cab.w / 2 + 8, -hh - v.cab.h + 10, v.cab.w - 22, v.cab.h - 14, 5, g); g.fill();
  g.fillStyle = '#FFC93C'; g.fillRect(hw - 12, -4, 12, 10);                                  // headlight
  g.fillStyle = v.dark; g.fillRect(-hw, hh - 8, v.w, 8);                                     // skirt
}
function drawVehicle() {
  paintWheel(ctx, V, wheelR.position.x, wheelR.position.y, wheelR.angle);
  paintWheel(ctx, V, wheelF.position.x, wheelF.position.y, wheelF.angle);
  ctx.save(); ctx.translate(chassis.position.x, chassis.position.y); ctx.rotate(chassis.angle); paintBody(ctx, V); ctx.restore();
}
function render() {
  const vw = W / scale, vh = H / scale, D = DESERT;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  ctx.fillStyle = D.sky; ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = D.sun; ctx.beginPath(); ctx.arc(vw * 0.78, 110, 56, 0, 7); ctx.fill();
  dunes(vh * 0.5, 40, 260, 0.15, D.far, vw, vh); dunes(vh * 0.62, 34, 190, 0.35, D.mid, vw, vh);
  if (!chassis) return;
  const tx = chassis.position.x - vw * 0.33, ty = chassis.position.y - vh * 0.58;
  camX += (tx - camX) * 0.12; camY += (ty - camY) * 0.1;
  const sx = shake > 0.2 ? (Math.random() - 0.5) * shake : 0, sy = shake > 0.2 ? (Math.random() - 0.5) * shake : 0; shake *= 0.88;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, -(camX + sx) * dpr * scale, -(camY + sy) * dpr * scale);
  // ground
  ctx.beginPath(); ctx.moveTo(camX - 40, camY + vh + 400);
  for (let x = Math.floor(camX / 20) * 20 - 40; x <= camX + vw + 60; x += 20) ctx.lineTo(x, terrainY(x));
  ctx.lineTo(camX + vw + 60, camY + vh + 400); ctx.closePath();
  ctx.fillStyle = D.ground; ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = D.edge; ctx.lineJoin = 'round';
  ctx.beginPath(); for (let x = Math.floor(camX / 20) * 20 - 40; x <= camX + vw + 60; x += 20) (x === Math.floor(camX / 20) * 20 - 40 ? ctx.moveTo : ctx.lineTo).call(ctx, x, terrainY(x));
  ctx.stroke();
  // pickups
  const t = performance.now() / 300;
  for (const p of pickups.values()) {
    if (p.type === 'coin') { const sx = Math.abs(Math.cos(t + p.x)); ctx.fillStyle = '#F2B01E'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 13 * (0.35 + 0.65 * sx), 13, 0, 0, 7); ctx.fill(); }
    else { ctx.fillStyle = '#D9402B'; rrect(p.x - 14, p.y - 18, 28, 36, 5); ctx.fill(); ctx.fillStyle = '#FFF7E0'; ctx.fillRect(p.x - 3, p.y - 10, 6, 20); ctx.fillRect(p.x - 10, p.y - 3, 20, 6); }
  }
  particles.forEach(p => { ctx.globalAlpha = p.life / 30 * 0.7; ctx.fillStyle = D.dust; ctx.beginPath(); ctx.arc(p.x, p.y, 4 + (30 - p.life) * 0.25, 0, 7); ctx.fill(); });
  ctx.globalAlpha = 1; drawVehicle();
  // HUD values
  $('fuelFill').style.width = fuel + '%'; $('fuelFill').classList.toggle('low', fuel < 20);
  $('coinsVal').textContent = coins; $('distVal').textContent = Math.floor(dist()) + ' m';
  $('speedVal').textContent = Math.round(Math.abs(chassis.velocity.x) * 60 / PX_PER_M * 3.6) + ' km/h';
}

/* ---------- Setup, loop, input ---------- */
const canvas = $('game'), ctx = canvas.getContext('2d');
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr; scale = H / VIEW_H;
}
window.addEventListener('resize', resize); resize();

function frame(now) {
  const dt = Math.min(100, now - last); last = now;
  if (state === 'play') { acc += dt; while (acc >= STEP) { step(); acc -= STEP; if (state !== 'play') break; } }
  render(); requestAnimationFrame(frame);
}

function hold(el, key) {                       // touch / mouse press-and-hold buttons
  const on = e => { e.preventDefault(); el.setPointerCapture(e.pointerId); input[key] = true; el.classList.add('pressed'); };
  const off = () => { input[key] = false; el.classList.remove('pressed'); };
  el.addEventListener('pointerdown', on); ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => el.addEventListener(n, off));
}
hold($('btnGas'), 'gas'); hold($('btnBrake'), 'brake');

const keys = { ArrowRight: ['gas', 1], ArrowLeft: ['brake', 1], KeyD: ['tilt', 1], KeyA: ['tilt', -1] };
function key(e, down) {
  const k = keys[e.code]; if (!k) return; e.preventDefault();
  if (k[0] === 'tilt') { input.tilt = down ? k[1] : (input.tilt === k[1] ? 0 : input.tilt); }
  else { input[k[0]] = down; $(k[0] === 'gas' ? 'btnGas' : 'btnBrake').classList.toggle('pressed', down); }
}
window.addEventListener('keydown', e => key(e, true)); window.addEventListener('keyup', e => key(e, false));
window.addEventListener('keydown', e => { if (e.code === 'Escape') { if (state === 'play') setState('pause'); else if (state === 'pause') setState('play'); } });
document.addEventListener('contextmenu', e => e.preventDefault());

$('btnPlay').onclick = startRun; $('btnRetry').onclick = startRun; $('btnRestart').onclick = startRun;
function toggles() { $('btnSound').textContent = 'Sound: ' + (save.sound ? 'On' : 'Off'); $('btnMusic').textContent = 'Music: ' + (save.music ? 'On' : 'Off'); }
$('btnSound').onclick = () => { save.sound = !save.sound; Sfx.set('sound', save.sound); persist(); toggles(); };
$('btnMusic').onclick = () => { save.music = !save.music; Sfx.set('music', save.music); persist(); toggles(); };
Sfx.set('sound', save.sound); Sfx.set('music', save.music); toggles();
$('btnResume').onclick = () => { Sfx.unlock(); last = performance.now(); setState('play'); };
$('btnPause').onclick = () => setState('pause');
$('btnMenu').onclick = () => setState('menu');
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') setState('pause'); });

/* ---------- Garage ---------- */
let gi = 0;
function openGarage() { gi = Math.max(0, VEHICLES.findIndex(v => v.id === V.id)); setState('garage'); drawGarage(); }
function drawGarage() {
  const v = VEHICLES[gi], owned = save.unlocked.includes(v.id), btn = $('gAction');
  $('gName').textContent = v.name; $('gCoins').textContent = save.coins;
  $('gStats').innerHTML = Object.entries(v.stats).map(([k, n]) => '<div>' + k + '<div class="bar"><div style="width:' + n * 20 + '%"></div></div></div>').join('');
  btn.disabled = false;
  if (owned) { btn.textContent = V.id === v.id ? 'Selected' : 'Select'; btn.disabled = V.id === v.id; }
  else { btn.textContent = 'Unlock - ' + v.price + ' coins'; btn.disabled = save.coins < v.price; }
  const g = $('pv').getContext('2d'); g.clearRect(0, 0, 300, 150); g.fillStyle = '#FFF0B3'; g.fillRect(0, 0, 300, 150);
  g.fillStyle = '#8F4F1F'; g.fillRect(0, 118, 300, 32);
  g.save(); g.translate(150, 118 - v.wheelY - v.wheelR); g.scale(0.9, 0.9);
  paintWheel(g, v, -v.wheelX, v.wheelY, 0.5); paintWheel(g, v, v.wheelX, v.wheelY, 0.5); paintBody(g, v); g.restore();
}
function garageStep(d) { gi = (gi + d + VEHICLES.length) % VEHICLES.length; drawGarage(); }
$('gPrev').onclick = () => garageStep(-1); $('gNext').onclick = () => garageStep(1);
$('gBack').onclick = () => setState('menu'); $('btnGarage').onclick = openGarage; $('btnOverGarage').onclick = openGarage;
$('gAction').onclick = () => {
  const v = VEHICLES[gi];
  if (!save.unlocked.includes(v.id)) { if (save.coins < v.price) return; save.coins -= v.price; save.unlocked.push(v.id); }
  V = v; save.selected = v.id; persist(); drawGarage();
};
window.addEventListener('keydown', e => { if (state === 'garage' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) garageStep(e.code === 'ArrowLeft' ? -1 : 1); });

createWorld(); setState('menu'); requestAnimationFrame(frame);
