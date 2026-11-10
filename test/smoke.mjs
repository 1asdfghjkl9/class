// 无头冒烟测试：mock canvas，实际跑战斗帧，抓运行时异常
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

const canvas = {
  getContext: () => makeCtx(),
  addEventListener: noop,
  removeEventListener: noop,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 900 }),
  setPointerCapture: noop,
  releasePointerCapture: noop,
  style: {},
  width: 1600,
  height: 900,
};

globalThis.window = {
  addEventListener: noop, removeEventListener: noop,
  devicePixelRatio: 1, innerWidth: 1600, innerHeight: 900,
};
globalThis.document = { getElementById: () => canvas, addEventListener: noop };
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = noop;
globalThis.performance = { now: () => Date.now() };
const mem = {};
globalThis.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; },
};

const { BattleScene } = await import('../src/battle/battle.js');
const { createDefaultSave } = await import('../src/save.js');

let errors = [];
const origErr = console.error;
console.error = (...a) => { errors.push(a.join(' ')); origErr(...a); };

async function runBoss(bossId) {
  const save = createDefaultSave();
  const scene = new BattleScene(canvas, bossId, save, {});
  scene._init();

  const dt = 1 / 120;
  let shots = 0, frames = 0;

  for (let round = 0; round < 60; round++) {
    // 玩家回合就开火
    if (scene.state === 'player_turn' || scene.state === 'player_aiming') {
      scene.aimMode = 'normal';
      scene.state = 'player_aiming';
      scene._aimDragging = true;
      scene.input.downX = 800; scene.input.downY = 500;
      scene.input.isDown = true;
      scene.input.x = 700; scene.input.y = 600;
      // 弹道解析反解：给定水平速度，反算 vy 精确穿过 Boss
      const G = 900, VMIN = 420, VMAX = 1200, DRAG_MAX = 180, DEAD = 20;
      const dist = Math.abs(scene.boss.x - scene.player.x);
      const vxMag = 780;
      const t = dist / vxMag;
      const sy = scene.player.y - scene.player.radius / 2;
      const ty = scene.boss.y - 4;
      const vy = (ty - sy - 0.5 * G * t * t) / t;
      const speed = Math.hypot(vxMag, vy);
      const ratio = Math.min(1, Math.max(0, (speed - VMIN) / (VMAX - VMIN)));
      const drag = DEAD + ratio * (DRAG_MAX - DEAD);
      const ang = Math.atan2(vy, vxMag);
      const dx = -Math.cos(ang) * drag;
      const dy = -Math.sin(ang) * drag;
      scene._firePlayerShot(dx, dy, Math.hypot(dx, dy));
      scene._aimDragging = false;
      scene.input.isDown = false;
      shots++;
    }
    // 答题直接选第一个
    if (scene.state === 'quiz') {
      scene._onQuizAnswer(0);
    }
    for (let f = 0; f < 240; f++) {
      scene._update(dt);
      scene._render();
      frames++;
      if (scene.state === 'ended') break;
    }
    if (scene.state === 'ended') break;
  }

  return { bossId, shots, frames, state: scene.state, playerHp: scene.player?.hp, bossHp: scene.boss?.hp };
}

for (const b of ['jin', 'han', 'wu']) {
  try {
    const r = await runBoss(b);
    console.log('RESULT', JSON.stringify(r));
  } catch (e) {
    console.log('FAIL', b, e && e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : e);
  }
}
console.log('ERRORS:', errors.length);
