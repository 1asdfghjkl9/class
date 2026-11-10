// ============================================================
// test/mobile.mjs — 手机/多视口适配验证
// 覆盖：canvas 等比缩放、竖屏遮罩、resize 重算、坐标映射
// ============================================================
const noop = () => {};
const gradient = { addColorStop: noop };

function makeCtx() {
  const store = {};
  return new Proxy(store, {
    get(t, k) {
      if (k === 'measureText') return () => ({ width: 50 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return () => gradient;
      if (k === 'canvas') return { width: 1600, height: 900 };
      if (k in t) return t[k];
      return noop;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

const canvasHandlers = {};
const winHandlers = {};

const canvas = {
  style: {},
  width: 300,
  height: 150,
  getContext: () => makeCtx(),
  addEventListener: (t, f) => { canvasHandlers[t] = f; },
  removeEventListener: noop,
  getBoundingClientRect: () => {
    const w = parseFloat(canvas.style.width) || 300;
    const h = parseFloat(canvas.style.height) || 150;
    return { left: 0, top: 0, width: w, height: h, right: w, bottom: h };
  },
  setPointerCapture: noop,
  releasePointerCapture: noop,
};

const tip = { style: {} };

globalThis.window = {
  innerWidth: 390,
  innerHeight: 844,
  devicePixelRatio: 3,
  addEventListener: (t, f) => { winHandlers[t] = f; },
  removeEventListener: noop,
};
globalThis.document = {
  readyState: 'complete',
  getElementById: (id) => (id === 'game-canvas' ? canvas : id === 'rotate-tip' ? tip : null),
  addEventListener: noop,
};
let rafCount = 0;
globalThis.requestAnimationFrame = () => { rafCount++; return rafCount; };
globalThis.cancelAnimationFrame = noop;
globalThis.performance = { now: () => Date.now() };
const mem = {};
globalThis.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; },
};

const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`);

await import('../src/main.js');
const game = globalThis.window.__game;
check('启动成功', !!game, game ? `state=${game.state}` : '');
check('首帧已渲染', rafCount > 0, `raf=${rafCount}`);

function resize(w, h) {
  window.innerWidth = w;
  window.innerHeight = h;
  if (winHandlers.resize) winHandlers.resize();
}

// ---------- 1. 竖屏手机：显示横屏提示 ----------
resize(390, 844);
check('竖屏手机→提示横屏', tip.style.display === 'flex', `display=${tip.style.display}`);
check('竖屏 canvas 逻辑尺寸 1600×900', canvas.width === 1600 && canvas.height === 900,
  `${canvas.width}×${canvas.height}`);

// ---------- 2. 横屏手机：铺满且等比 ----------
resize(844, 390);
check('横屏手机→隐藏提示', tip.style.display === 'none', `display=${tip.style.display}`);
const cw = parseFloat(canvas.style.width);
const ch = parseFloat(canvas.style.height);
check('横屏手机 等比缩放', Math.abs(cw / ch - 1600 / 900) < 0.02, `${cw}×${ch}`);
check('横屏手机 不超出视口', cw <= 844 && ch <= 390, `${cw}×${ch}`);
check('横屏手机 高度占满', Math.abs(ch - 390) <= 1, `h=${ch}`);

// ---------- 3. 坐标映射正确 ----------
const p = game._toLocal(cw / 2, ch / 2);
check('坐标映射中心', Math.abs(p.x - 800) < 2 && Math.abs(p.y - 450) < 2, `(${p.x.toFixed(0)},${p.y.toFixed(0)})`);
const p2 = game._toLocal(cw, ch);
check('坐标映射右下角', Math.abs(p2.x - 1600) < 3 && Math.abs(p2.y - 900) < 3, `(${p2.x.toFixed(0)},${p2.y.toFixed(0)})`);

// ---------- 4. 常见分辨率 ----------
const cases = [
  [1920, 1080, 'PC 1080p'],
  [1440, 900, 'PC 16:10'],
  [2560, 1440, 'PC 2K'],
  [1280, 720, '笔记本 720p'],
  [1024, 768, 'iPad 横屏 4:3'],
  [768, 1024, 'iPad 竖屏'],
  [320, 568, '小屏手机竖屏'],
  [932, 430, 'iPhone 横屏 19.5:9'],
];
for (const [w, h, name] of cases) {
  resize(w, h);
  const sw = parseFloat(canvas.style.width);
  const sh = parseFloat(canvas.style.height);
  const fit = sw <= w + 1 && sh <= h + 1;
  const ratio = Math.abs(sw / sh - 1600 / 900) < 0.02;
  const portrait = h > w && Math.min(w, h) < 820;
  const tipOk = portrait ? tip.style.display === 'flex' : tip.style.display === 'none';
  check(`${name} ${w}×${h}`, fit && ratio && tipOk,
    `${sw.toFixed(0)}×${sh.toFixed(0)} tip=${tip.style.display}`);
}

// ---------- 5. 极窄/极扁不崩 ----------
resize(200, 200);
check('极小视口不崩', canvas.width === 1600, `${parseFloat(canvas.style.width).toFixed(0)}px`);
resize(2560, 300);
check('极扁视口等比', Math.abs(parseFloat(canvas.style.width) / parseFloat(canvas.style.height) - 1600 / 900) < 0.05,
  `${canvas.style.width}×${canvas.style.height}`);

// ---------- 6. 触摸链路（pointer 事件） ----------
resize(844, 390);
const tapAt = (lx, ly) => {
  const sx = (lx / 1600) * parseFloat(canvas.style.width);
  const sy = (ly / 900) * parseFloat(canvas.style.height);
  const ev = (x, y) => ({ clientX: x, clientY: y, pointerId: 1, preventDefault: noop });
  if (canvasHandlers.pointerdown) canvasHandlers.pointerdown(ev(sx, sy));
  if (canvasHandlers.pointermove) canvasHandlers.pointermove(ev(sx, sy));
  if (winHandlers.pointerup) winHandlers.pointerup(ev(sx, sy));
};

game.state = 'menu';
game.menu.page = 'home';
game.menu.render(game.ctx);
const hit = (game.menu.hits || [])[0];
check('主菜单有可点区域', !!hit, hit ? `${hit.id || hit.action || ''}` : '');
if (hit) {
  const before = game.menu.page;
  tapAt(hit.x + hit.w / 2, hit.y + hit.h / 2);
  game.menu.render(game.ctx); // 模拟下一帧
  check('触摸点击被响应', game.menu.page !== before && (game.menu.hits || []).length > 0,
    `${before} → ${game.menu.page} hits=${(game.menu.hits || []).length}`);
}

// ---------- 汇总 ----------
console.log(results.join('\n'));
const fails = results.filter((r) => r.startsWith('FAIL'));
console.log(`\n===== 结果 =====\nPASS ${results.length - fails.length} / FAIL ${fails.length}`);
if (fails.length) process.exitCode = 1;
