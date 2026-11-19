// ============================================================
// battle/collision.js — 碰撞检测、材质破坏、贴花生成
// ============================================================

import { CONFIG } from '../config.js';

// 检测弹丸与所有碰撞体
// groundHeightmap: Float32Array, 每像素一个地面Y值
export function checkCollision(projectile, terrainList, units, groundHeightmap) {
  const px = projectile.x;
  const py = projectile.y;
  const pr = projectile.radius;

  // 1. 地形碰撞
  for (const t of terrainList) {
    const hit = t.hitTest(px, py, pr);
    if (hit) {
      return { type: 'terrain', terrain: t, point: { x: px, y: py }, normal: { x: hit.nx, y: hit.ny } };
    }
  }

  // 2. 地面碰撞（高度图：弹丸触到地面表面就碰撞）
  if (px >= 0 && px < CONFIG.WIDTH && groundHeightmap) {
    const xi = Math.floor(px);
    const groundY = groundHeightmap[xi];
    // 弹丸底部触到地面表面 → 碰撞
    if (py + pr >= groundY) {
      return { type: 'ground', point: { x: px, y: groundY }, normal: { x: 0, y: -1 } };
    }
  } else if (py + pr >= CONFIG.GROUND_Y) {
    return { type: 'ground', point: { x: px, y: CONFIG.GROUND_Y }, normal: { x: 0, y: -1 } };
  }

  // 3. 单位碰撞（Boss、小怪、玩家）
  for (const u of units) {
    if (u.dead || u === projectile._sourceUnit) continue;
    // 不要打到发射者
    if (projectile.source === 'player' && u.team === 'player') continue;
    if (projectile.source === 'boss' && u.team === 'enemy') continue;
    if (projectile.source === 'minion' && u.team === 'enemy') continue;

    // 3.1 弱点部件优先判定（挂在身体外沿，必须先于本体判断，否则永远打不到）
    if (u.weakpoints) {
      for (const wp of u.weakpoints) {
        if (wp.destroyed) continue;
        const wx = u.x + wp.offsetX;
        const wy = u.y + wp.offsetY;
        const wdx = px - wx;
        const wdy = py - wy;
        const wd = Math.hypot(wdx, wdy);
        if (wd <= wp.radius + pr) {
          return { type: 'weakpoint', unit: u, weakpoint: wp, point: { x: px, y: py }, dist: wd };
        }
      }
    }

    // 3.2 本体
    const dx = px - u.x;
    const dy = py - u.y;
    const d = Math.hypot(dx, dy);
    if (d <= u.radius + pr) {
      return { type: 'unit', unit: u, point: { x: px, y: py }, dist: d };
    }
  }

  return null;
}

// 生成贴花
export function createDecal(x, y, material) {
  const r = 8 + Math.random() * 8;
  const seed = Math.random() * 9999;
  let type = 'crater';
  if (material === 'wood') type = 'crack';
  else if (material === 'wall') type = 'chalk';
  else if (material === 'podium') type = 'crack';
  else if (material === 'paper') type = 'paper';
  else if (material === 'sauce') type = 'crater';
  else if (material === 'ground') type = 'crater';
  return { x, y, r, seed, type };
}

// 粒子效果数据
export function createHitParticles(x, y, color, count = 8, intensity = 1) {
  const particles = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (50 + Math.random() * 150) * intensity;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 50,
      life: 0.3 + Math.random() * 0.4,
      maxLife: 0.5,
      color,
      size: 2 + Math.random() * 3,
    });
  }
  return particles;
}
