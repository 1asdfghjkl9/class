// ============================================================
// battle/terrain.js — 地形对象与关卡地形
// ============================================================

import { CONFIG } from '../config.js';

// 材质属性表
export const MATERIALS = {
  wood:   { hp: 60,  destructible: true,  color: '#C89B6A', stroke: '#8B6B3F' },
  wall:   { hp: Infinity, destructible: false, color: '#F5F0E1', stroke: '#C0BBA8' },
  podium: { hp: 220, destructible: false, color: '#8B7355', stroke: '#5C4A33' },
  paper:  { hp: 25,  destructible: true,  color: '#E8E8E8', stroke: '#BBBBBB' },
  sauce:  { hp: 999, destructible: false, color: '#E64A19', stroke: '#BF360C' },
};

let _idCounter = 0;

export class TerrainObject {
  constructor(opts) {
    this.id = ++_idCounter;
    this.shape = opts.shape || 'rect';
    this.x = opts.x;
    this.y = opts.y;
    this.w = opts.w || 0;
    this.h = opts.h || 0;
    this.r = opts.r || 0;
    this.material = opts.material;
    this.destructible = opts.destructible !== undefined ? opts.destructible : (MATERIALS[this.material]?.destructible ?? false);
    this.maxHp = opts.hp ?? (MATERIALS[this.material]?.hp ?? 100);
    this.hp = this.maxHp;
    this.destroyed = false;
    this.decals = [];
    this.crackStage = 0;
  }

  containsPoint(px, py) {
    if (this.destroyed) return false;
    if (this.shape === 'rect') {
      return px >= this.x && px <= this.x + this.w &&
             py >= this.y && py <= this.y + this.h;
    } else {
      const dx = px - this.x;
      const dy = py - this.y;
      return dx * dx + dy * dy <= this.r * this.r;
    }
  }

  hitTest(px, py, pr = 0) {
    if (this.destroyed) return null;
    if (this.shape === 'rect') {
      const cx = Math.max(this.x, Math.min(px, this.x + this.w));
      const cy = Math.max(this.y, Math.min(py, this.y + this.h));
      const dx = px - cx;
      const dy = py - cy;
      const d = Math.hypot(dx, dy);
      if (d <= pr + 1) return { x: cx, y: cy, dist: d, nx: dx / (d || 1), ny: dy / (d || 1) };
      return null;
    } else {
      const dx = px - this.x;
      const dy = py - this.y;
      const d = Math.hypot(dx, dy);
      if (d <= this.r + pr) return { x: this.x, y: this.y, dist: d, nx: dx / (d || 1), ny: dy / (d || 1) };
      return null;
    }
  }

  takeDamage(dmg) {
    if (this.destroyed || !this.destructible) return false;
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.destroyed = true;
      return true;
    }
    return false;
  }

  addDecal(x, y, r, type = 'crater') {
    this.decals.push({ x, y, r, seed: Math.random() * 9999, type });
    if (this.decals.length > CONFIG.MAX_DECALS) {
      this.decals.shift();
    }
  }
}

// ========== 关卡地形工厂 ==========

export function createJinLevelTerrain() {
  const list = [];
  const gy = CONFIG.GROUND_Y;

  // 地面
  list.push(new TerrainObject({ shape: 'rect', x: 0, y: gy, w: CONFIG.WIDTH, h: CONFIG.HEIGHT - gy, material: 'wall', destructible: false }));
  // 边界墙
  list.push(new TerrainObject({ shape: 'rect', x: 0, y: 0, w: 30, h: gy, material: 'wall' }));
  list.push(new TerrainObject({ shape: 'rect', x: CONFIG.WIDTH - 30, y: 0, w: 30, h: gy, material: 'wall' }));
  list.push(new TerrainObject({ shape: 'rect', x: 0, y: 0, w: CONFIG.WIDTH, h: 30, material: 'wall' }));

  // 课桌组（玩家侧）
  for (let i = 0; i < 3; i++) {
    list.push(new TerrainObject({ shape: 'rect', x: 380 + i * 90, y: gy - 50, w: 70, h: 50, material: 'wood' }));
  }
  // 课桌组（Boss 侧）
  for (let i = 0; i < 3; i++) {
    list.push(new TerrainObject({ shape: 'rect', x: 850 + i * 90, y: gy - 50, w: 70, h: 50, material: 'wood' }));
  }
  // 试卷堆
  list.push(new TerrainObject({ shape: 'rect', x: 700, y: gy - 35, w: 60, h: 35, material: 'paper' }));
  list.push(new TerrainObject({ shape: 'rect', x: 750, y: gy - 35, w: 55, h: 35, material: 'paper' }));
  // 讲台
  list.push(new TerrainObject({ shape: 'rect', x: 1150, y: gy - 80, w: 120, h: 80, material: 'podium' }));
  // 黑板（背景墙上）
  list.push(new TerrainObject({ shape: 'rect', x: 600, y: 80, w: 400, h: 120, material: 'wall' }));
  // 番茄炒蛋汤汁（不可破坏，杀虫剂可清）
  list.push(new TerrainObject({ shape: 'circle', x: 640, y: gy - 12, r: 46, material: 'sauce' }));
  list.push(new TerrainObject({ shape: 'circle', x: 980, y: gy - 10, r: 38, material: 'sauce' }));

  return list;
}

export function createHanLevelTerrain() {
  const list = [];
  const gy = CONFIG.GROUND_Y;

  list.push(new TerrainObject({ shape: 'rect', x: 0, y: gy, w: CONFIG.WIDTH, h: CONFIG.HEIGHT - gy, material: 'wall', destructible: false }));
  list.push(new TerrainObject({ shape: 'rect', x: 0, y: 0, w: 30, h: gy, material: 'wall' }));
  list.push(new TerrainObject({ shape: 'rect', x: CONFIG.WIDTH - 30, y: 0, w: 30, h: gy, material: 'wall' }));
  list.push(new TerrainObject({ shape: 'rect', x: 0, y: 0, w: CONFIG.WIDTH, h: 30, material: 'wall' }));

  // 课桌组（玩家侧）— 更密集
  for (let i = 0; i < 4; i++) {
    list.push(new TerrainObject({ shape: 'rect', x: 350 + i * 80, y: gy - 50, w: 65, h: 50, material: 'wood' }));
  }
  // 试卷堆（中间多堆 — 韩老师的题海预兆）
  for (let i = 0; i < 3; i++) {
    list.push(new TerrainObject({ shape: 'rect', x: 650 + i * 55, y: gy - 35, w: 50, h: 35, material: 'paper' }));
  }
  // 课桌组（Boss 侧）
  for (let i = 0; i < 3; i++) {
    list.push(new TerrainObject({ shape: 'rect', x: 880 + i * 85, y: gy - 50, w: 70, h: 50, material: 'wood' }));
  }
  // 讲台
  list.push(new TerrainObject({ shape: 'rect', x: 1150, y: gy - 80, w: 120, h: 80, material: 'podium' }));
  // 黑板
  list.push(new TerrainObject({ shape: 'rect', x: 550, y: 80, w: 500, h: 130, material: 'wall' }));
  // 番茄炒蛋汤汁
  list.push(new TerrainObject({ shape: 'circle', x: 720, y: gy - 12, r: 40, material: 'sauce' }));
  list.push(new TerrainObject({ shape: 'circle', x: 1080, y: gy - 12, r: 34, material: 'sauce' }));

  return list;
}

export function createWuLevelTerrain() {
  const list = [];
  const gy = CONFIG.GROUND_Y;

  list.push(new TerrainObject({ shape: 'rect', x: 0, y: gy, w: CONFIG.WIDTH, h: CONFIG.HEIGHT - gy, material: 'wall', destructible: false }));
  list.push(new TerrainObject({ shape: 'rect', x: 0, y: 0, w: 30, h: gy, material: 'wall' }));
  list.push(new TerrainObject({ shape: 'rect', x: CONFIG.WIDTH - 30, y: 0, w: 30, h: gy, material: 'wall' }));
  list.push(new TerrainObject({ shape: 'rect', x: 0, y: 0, w: CONFIG.WIDTH, h: 30, material: 'wall' }));

  // 课桌组（玩家侧）— 吴老师管纪律，课桌排列整齐
  for (let i = 0; i < 3; i++) {
    list.push(new TerrainObject({ shape: 'rect', x: 370 + i * 90, y: gy - 50, w: 70, h: 50, material: 'wood' }));
  }
  // 中间少量试卷堆
  list.push(new TerrainObject({ shape: 'rect', x: 700, y: gy - 35, w: 55, h: 35, material: 'paper' }));
  // 课桌组（Boss 侧）
  for (let i = 0; i < 3; i++) {
    list.push(new TerrainObject({ shape: 'rect', x: 860 + i * 88, y: gy - 50, w: 72, h: 50, material: 'wood' }));
  }
  // 讲台（更大，象征权威）
  list.push(new TerrainObject({ shape: 'rect', x: 1130, y: gy - 90, w: 140, h: 90, material: 'podium' }));
  // 黑板（更宽）
  list.push(new TerrainObject({ shape: 'rect', x: 520, y: 70, w: 560, h: 140, material: 'wall' }));
  // 番茄炒蛋汤汁
  list.push(new TerrainObject({ shape: 'circle', x: 800, y: gy - 12, r: 42, material: 'sauce' }));

  return list;
}

// 关卡地形工厂注册表
export const TERRAIN_FACTORIES = {
  jin: createJinLevelTerrain,
  han: createHanLevelTerrain,
  wu: createWuLevelTerrain,
};
