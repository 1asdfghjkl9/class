// ============================================================
// battle/terrain.js — 地形对象与关卡地形（5学科独立地图）
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
  platform: { hp: Infinity, destructible: false, color: '#8D6E63', stroke: '#5D4037' },
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

// ========== 辅助 ==========

function _boundaryWalls() {
  const list = [];
  const gy = CONFIG.GROUND_Y;
  list.push(new TerrainObject({ shape: 'rect', x: 0, y: 0, w: 30, h: gy, material: 'wall' }));
  list.push(new TerrainObject({ shape: 'rect', x: CONFIG.WIDTH - 30, y: 0, w: 30, h: gy, material: 'wall' }));
  return list;
}

// 悬空平台（不可破坏，可站立可碰撞）
function _platform(x, y, w, h = 20) {
  return new TerrainObject({ shape: 'rect', x, y, w, h, material: 'platform' });
}

// ========== 5 学科独立地图 ==========

// 体育（pe）— 操场：跨栏平台 + 跑道台阶
export function createPeLevelTerrain() {
  const list = _boundaryWalls();
  const gy = CONFIG.GROUND_Y;
  // 左侧低台阶
  list.push(_platform(200, gy - 120, 160, 20));
  // 中央高台（跨栏式）
  list.push(_platform(600, gy - 200, 120, 20));
  list.push(_platform(640, gy - 340, 40, 140)); // 跨栏柱
  // 右侧双层平台
  list.push(_platform(1000, gy - 150, 180, 20));
  list.push(_platform(1050, gy - 300, 100, 20));
  // 球门状拱
  list.push(_platform(1300, gy - 250, 20, 250));
  list.push(_platform(1450, gy - 250, 20, 250));
  list.push(_platform(1300, gy - 270, 170, 20));
  return list;
}

// 语文（chinese）— 教室：书堆平台 + 卷轴桥
export function createChineseLevelTerrain() {
  const list = _boundaryWalls();
  const gy = CONFIG.GROUND_Y;
  // 书堆（左中右各一组）
  list.push(_platform(250, gy - 100, 120, 20));
  list.push(_platform(270, gy - 160, 80, 20));
  list.push(_platform(290, gy - 220, 40, 20));
  // 中央卷轴桥
  list.push(_platform(550, gy - 250, 300, 20));
  // 右侧书本塔
  list.push(_platform(1000, gy - 80, 100, 20));
  list.push(_platform(1020, gy - 140, 80, 20));
  list.push(_platform(1040, gy - 200, 60, 20));
  list.push(_platform(1060, gy - 260, 40, 20));
  // 高处小平台
  list.push(_platform(1200, gy - 350, 150, 20));
  return list;
}

// 美术（art）— 画室：调色盘平台 + 画架
export function createArtLevelTerrain() {
  const list = _boundaryWalls();
  const gy = CONFIG.GROUND_Y;
  // 左侧画架（三角形阶梯）
  list.push(_platform(200, gy - 100, 100, 20));
  list.push(_platform(240, gy - 200, 60, 20));
  list.push(_platform(270, gy - 300, 30, 20));
  // 中央调色盘（大平台）
  list.push(_platform(550, gy - 180, 200, 20));
  // 颜料管斜坡（阶梯式）
  list.push(_platform(850, gy - 100, 80, 20));
  list.push(_platform(900, gy - 180, 80, 20));
  list.push(_platform(950, gy - 260, 80, 20));
  // 右侧高处画板
  list.push(_platform(1200, gy - 320, 180, 20));
  list.push(_platform(1250, gy - 220, 80, 20));
  return list;
}

// 数学（math）— 教室：三角尺平台 + 几何阶梯
export function createMathLevelTerrain() {
  const list = _boundaryWalls();
  const gy = CONFIG.GROUND_Y;
  // 左侧三角阶梯
  list.push(_platform(200, gy - 80, 120, 20));
  list.push(_platform(260, gy - 160, 80, 20));
  list.push(_platform(320, gy - 240, 40, 20));
  // 中央量角器弧（多段模拟）
  list.push(_platform(550, gy - 120, 80, 20));
  list.push(_platform(660, gy - 200, 80, 20));
  list.push(_platform(770, gy - 280, 80, 20));
  // 右侧圆规平台
  list.push(_platform(1000, gy - 150, 100, 20));
  list.push(_platform(1150, gy - 250, 100, 20));
  // 高处 π 平台
  list.push(_platform(1300, gy - 350, 120, 20));
  return list;
}

// 英语（english）— 教室：词典塔 + 字母台阶
export function createEnglishLevelTerrain() {
  const list = _boundaryWalls();
  const gy = CONFIG.GROUND_Y;
  // 左侧词典塔
  list.push(_platform(200, gy - 80, 100, 20));
  list.push(_platform(220, gy - 160, 80, 20));
  list.push(_platform(240, gy - 240, 60, 20));
  // 中央字母桥
  list.push(_platform(500, gy - 200, 100, 20));
  list.push(_platform(650, gy - 280, 100, 20));
  list.push(_platform(800, gy - 200, 100, 20));
  // 右侧阶梯
  list.push(_platform(1000, gy - 100, 80, 20));
  list.push(_platform(1080, gy - 200, 80, 20));
  list.push(_platform(1160, gy - 300, 80, 20));
  // 顶部小台
  list.push(_platform(1350, gy - 380, 120, 20));
  return list;
}

// ========== 老师 Boss 关卡（保持简单） ==========

// 金老师 — 数学教室
export function createJinLevelTerrain() {
  return createMathLevelTerrain();
}
// 韩老师 — 语文教室
export function createHanLevelTerrain() {
  return createChineseLevelTerrain();
}
// 吴老师 — 英语教室
export function createWuLevelTerrain() {
  return createEnglishLevelTerrain();
}
// 丁老师 — 美术教室
export function createDingLevelTerrain() {
  return createArtLevelTerrain();
}
// 黄老师 — 体育操场
export function createHuangLevelTerrain() {
  return createPeLevelTerrain();
}

// 关卡地形工厂注册表（支持学科 key 和老师 key）
export const TERRAIN_FACTORIES = {
  // 学科
  pe: createPeLevelTerrain,
  chinese: createChineseLevelTerrain,
  art: createArtLevelTerrain,
  math: createMathLevelTerrain,
  english: createEnglishLevelTerrain,
  // 老师
  jin: createJinLevelTerrain,
  han: createHanLevelTerrain,
  wu: createWuLevelTerrain,
  ding: createDingLevelTerrain,
  huang: createHuangLevelTerrain,
};
