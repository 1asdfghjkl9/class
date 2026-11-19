// ============================================================
// test/bundle.mjs — 验证打包后的单文件 HTML 可正常启动
// 从 ../班级弹射对战.html 抽出内联 script，在 mock 环境执行
// ============================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(here, '..', '..', '班级弹射对战.html');
const html = readFileSync(htmlPath, 'utf8');
const localPath = resolve(here, '..', 'index.html');
const localHtml = readFileSync(localPath, 'utf8');

const results = [];
const check = (name, ok, extra = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`);
};

// 抽出内联脚本：可能有多个 <script> 块（兜底检测 + 游戏主体），取最长的那个
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x => x[1].trim());
const m = blocks.length ? [null, blocks.reduce((a, b) => (a.length >= b.length ? a : b))] : null;
check('HTML 含内联脚本', !!m, m ? `${(m[1].length / 1024).toFixed(1)} KB` : '');
check('HTML 含横屏提示', html.includes('id="rotate-tip"'), '');
check('HTML 含 viewport-fit', html.includes('viewport-fit=cover'), '');
check('入口 script 已内联（无外链）', !html.includes('src="./src/main.js"'), '');
check('game/index.html 与顶层产物一致', localHtml === html, `${(localHtml.length / 1024).toFixed(1)} KB`);
check('含启动失败兜底', html.includes('id="boot-error"'), '');
check('含纯 CSS 横屏兜底', html.includes('orientation: portrait'), '');

// ---- mock 浏览器环境 ----
const noop = () => {};
const gradient = { addColorStop: noop };
function makeCtx() {
  const s = {};
  return new Proxy(s, {
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
const canvasListeners = {};
const canvas = {
  getContext: () => makeCtx(),
  addEventListener: (k, f) => { (canvasListeners[k] = canvasListeners[k] || []).push(f); },
  removeEventListener: noop,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 900 }),
  setPointerCapture: noop, releasePointerCapture: noop,
  style: {}, width: 1600, height: 900,
};
const winListeners = {};
globalThis.window = {
  addEventListener: (k, f) => { (winListeners[k] = winListeners[k] || []).push(f); },
  removeEventListener: noop, devicePixelRatio: 1, innerWidth: 1600, innerHeight: 900,
};
const tipEl = { style: {} };
globalThis.document = {
  getElementById: (id) => (id === 'game-canvas' ? canvas : id === 'rotate-tip' ? tipEl : null),
  addEventListener: noop,
};
const rafQueue = [];
globalThis.requestAnimationFrame = (f) => { rafQueue.push(f); return rafQueue.length; };
globalThis.cancelAnimationFrame = noop;
globalThis.performance = { now: () => Date.now() };
const mem = {};
globalThis.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; },
};
globalThis.setTimeout = globalThis.setTimeout || noop;

// ---- 执行 bundle ----
let execErr = null;
try {
  // eslint-disable-next-line no-new-func
  new Function(m[1])();
  for (const f of (winListeners['DOMContentLoaded'] || [])) f();
} catch (e) { execErr = e; }
check('bundle 执行不抛错', !execErr, execErr ? execErr.message : '');

const game = globalThis.window.__game;
check('游戏实例已创建', !!game, game ? `state=${game.state}` : '');

const frames = (n, base = 0) => {
  for (let i = 0; i < n; i++) {
    const q = rafQueue.splice(0);
    for (const f of q) f(performance.now() + base + i * 16);
  }
};

let renderErr = null;
try { frames(20); } catch (e) { renderErr = e; }
check('主菜单渲染不抛错', !renderErr, renderErr ? renderErr.message : '');
check('主菜单可交互', game && game.menu.hits.length > 0, game ? `hits=${game.menu.hits.length}` : '');

// 直接开战（跳过剧情，走 _startBattle）
let battleErr = null;
try {
  game._startBattle('jin', {});
  frames(400, 5000);
} catch (e) { battleErr = e; }
check('战斗渲染不抛错', !battleErr, battleErr ? battleErr.message : '');
check('战斗已启动', game && game.state === 'battle', game ? game.state : '');
check('竖屏提示已隐藏', tipEl.style.display === 'none' || tipEl.style.display === undefined, `${tipEl.style.display}`);

console.log(results.join('\n'));
console.log(results.every(r => r.startsWith('PASS')) ? 'ALL PASS' : 'HAS FAIL');
if (execErr) console.error(execErr);
if (battleErr) console.error(battleErr);
