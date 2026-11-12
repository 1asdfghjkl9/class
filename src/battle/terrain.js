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
  ruler:  { hp: Infinity, destructible: false, color: '#FFD54F', stroke: '#F9A825' },
  ball:   { hp: Infinity, destructible: false, color: '#FF7043', stroke: '#D84315' },
  book:   { hp: 80, destructible: true, color: '#90CAF9', stroke: '#1565C0' },
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
// 去掉顶部黑板碰撞箱，只保留左右边界墙

// 通用：只有边界墙（无顶部黑板碰撞）
function _boundaryWalls() {
  const list = [];
  const gy = CONFIG.GROUND_Y;
  list.push(new TerrainObject({ shape: 'rect', x: 0, y: 0, w: 30, h: gy, material: 'wall' }));
  list.push(new TerrainObject({ shape: 'rect', x: CONFIG.WIDTH - 30, y: 0, w: 30, h: gy, material: 'wall' }));
  return list;
}

// 金老师 — 数学教室：巨型三角尺
export function createJinLevelTerrain() {
  return _boundaryWalls();
}

// 韩老师 — 语文教室：书本堆
export function createHanLevelTerrain() {
  return _boundaryWalls();
}

// 吴老师 — 英语教室：词典塔
export function createWuLevelTerrain() {
  return _boundaryWalls();
}

// 丁老师 — 美术教室：颜料管和画架
export function createDingLevelTerrain() {
  return _boundaryWalls();
}

// 黄老师 — 体育操场：跨栏和球门
export function createHuangLevelTerrain() {
  return _boundaryWalls();
}

// 关卡地形工厂注册表
export const TERRAIN_FACTORIES = {
  jin: createJinLevelTerrain,
  han: createHanLevelTerrain,
  wu: createWuLevelTerrain,
  ding: createDingLevelTerrain,
  huang: createHuangLevelTerrain,
};
