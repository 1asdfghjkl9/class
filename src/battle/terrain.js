// ============================================================
// battle/terrain.js — 地形对象与关卡地形（5学科独立地图）
// 平台采用分段制：和地面一样打出一个坑，坑多了变洞
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

// ========== 平台分段系统 ==========
// 每个平台由多个 40px 分段组成，和地面一样逐段破坏

const PLATFORM_SEG_W = 40;

// 创建一个分段平台，返回 { segments: [...], y, h }
// segments[i] = { x, w, destroyed: false }
export function createPlatform(x, y, w, h = 20) {
  const segCount = Math.ceil(w / PLATFORM_SEG_W);
  const segments = [];
  for (let i = 0; i < segCount; i++) {
    segments.push({
      x: x + i * PLATFORM_SEG_W,
      w: Math.min(PLATFORM_SEG_W, x + w - (x + i * PLATFORM_SEG_W)),
      y, h,
      destroyed: false,
      craterDepth: 0, // 半球形坑深（向下凹陷）
    });
  }
  return { segments, y, h };
}

// 检查弹丸与所有平台分段的碰撞
// platforms: array of createPlatform() results
// 返回 { platform, seg, segIdx } 或 null
export function checkPlatformHit(px, py, pr, platforms) {
  if (!platforms) return null;
  for (const plat of platforms) {
    for (let i = 0; i < plat.segments.length; i++) {
      const seg = plat.segments[i];
      if (seg.destroyed) {
        // 坑内：弹丸在坑底以上穿过，到坑底碰撞
        const craterBottom = seg.y + (seg.craterDepth || 0);
        if (py >= craterBottom - pr && py <= craterBottom + seg.h) {
          return { platform: plat, seg, segIdx: i, point: { x: px, y: craterBottom } };
        }
        continue; // 在坑内空间，穿过
      }
      // rect hit test
      const cx = Math.max(seg.x, Math.min(px, seg.x + seg.w));
      const cy = Math.max(seg.y, Math.min(py, seg.y + seg.h));
      const dx = px - cx;
      const dy = py - cy;
      const d = Math.hypot(dx, dy);
      if (d <= pr + 1) {
        return { platform: plat, seg, segIdx: i, point: { x: cx, y: cy } };
      }
    }
  }
  return null;
}

// ========== 辅助 ==========

function _boundaryWalls() {
  const list = [];
  const gy = CONFIG.GROUND_Y;
  list.push(new TerrainObject({ shape: 'rect', x: 0, y: 0, w: 30, h: gy, material: 'wall' }));
  list.push(new TerrainObject({ shape: 'rect', x: CONFIG.WIDTH - 30, y: 0, w: 30, h: gy, material: 'wall' }));
  return list;
}

// 平台定义（返回 { x, y, w, h } 描述，由 battle.js 统一创建分段）
function _platDef(x, y, w, h = 20) {
  return { x, y, w, h };
}

// ========== 5 学科独立地图 ==========

// 体育（pe）— 操场：跨栏平台 + 跑道台阶
export function getPePlatforms() {
  const gy = CONFIG.GROUND_Y;
  return [
    _platDef(200, gy - 120, 160),
    _platDef(600, gy - 200, 120),
    _platDef(640, gy - 340, 40, 140), // 跨栏柱
    _platDef(1000, gy - 150, 180),
    _platDef(1050, gy - 300, 100),
    _platDef(1300, gy - 270, 170), // 球门横梁
  ];
}

// 语文（chinese）— 教室：书堆平台 + 卷轴桥
export function getChinesePlatforms() {
  const gy = CONFIG.GROUND_Y;
  return [
    _platDef(250, gy - 100, 120),
    _platDef(270, gy - 160, 80),
    _platDef(290, gy - 220, 40),
    _platDef(550, gy - 250, 300), // 卷轴桥
    _platDef(1000, gy - 80, 100),
    _platDef(1020, gy - 140, 80),
    _platDef(1040, gy - 200, 60),
    _platDef(1060, gy - 260, 40),
    _platDef(1200, gy - 350, 150),
  ];
}

// 美术（art）— 画室：调色盘平台 + 画架
export function getArtPlatforms() {
  const gy = CONFIG.GROUND_Y;
  return [
    _platDef(200, gy - 100, 100),
    _platDef(240, gy - 200, 60),
    _platDef(270, gy - 300, 30),
    _platDef(550, gy - 180, 200), // 调色盘大平台
    _platDef(850, gy - 100, 80),
    _platDef(900, gy - 180, 80),
    _platDef(950, gy - 260, 80),
    _platDef(1200, gy - 320, 180),
    _platDef(1250, gy - 220, 80),
  ];
}

// 数学（math）— 教室：三角尺平台 + 几何阶梯
export function getMathPlatforms() {
  const gy = CONFIG.GROUND_Y;
  return [
    _platDef(200, gy - 80, 120),
    _platDef(260, gy - 160, 80),
    _platDef(320, gy - 240, 40),
    _platDef(550, gy - 120, 80),
    _platDef(660, gy - 200, 80),
    _platDef(770, gy - 280, 80),
    _platDef(1000, gy - 150, 100),
    _platDef(1150, gy - 250, 100),
    _platDef(1300, gy - 350, 120),
  ];
}

// 英语（english）— 教室：词典塔 + 字母台阶
export function getEnglishPlatforms() {
  const gy = CONFIG.GROUND_Y;
  return [
    _platDef(200, gy - 80, 100),
    _platDef(220, gy - 160, 80),
    _platDef(240, gy - 240, 60),
    _platDef(500, gy - 200, 100),
    _platDef(650, gy - 280, 100),
    _platDef(800, gy - 200, 100),
    _platDef(1000, gy - 100, 80),
    _platDef(1080, gy - 200, 80),
    _platDef(1160, gy - 300, 80),
    _platDef(1350, gy - 380, 120),
  ];
}

// ========== 平台工厂注册表 ==========
export const PLATFORM_FACTORIES = {
  pe: getPePlatforms,
  chinese: getChinesePlatforms,
  art: getArtPlatforms,
  math: getMathPlatforms,
  english: getEnglishPlatforms,
  // 老师 Boss 映射
  jin: getMathPlatforms,
  han: getChinesePlatforms,
  wu: getEnglishPlatforms,
  ding: getArtPlatforms,
  huang: getPePlatforms,
};

// ========== 关卡地形工厂（仅边界墙） ==========
// 平台现在由 battle.js 通过 PLATFORM_FACTORIES + createPlatform 管理

export function createJinLevelTerrain() { return _boundaryWalls(); }
export function createHanLevelTerrain() { return _boundaryWalls(); }
export function createWuLevelTerrain() { return _boundaryWalls(); }
export function createDingLevelTerrain() { return _boundaryWalls(); }
export function createHuangLevelTerrain() { return _boundaryWalls(); }

export const TERRAIN_FACTORIES = {
  jin: createJinLevelTerrain,
  han: createHanLevelTerrain,
  wu: createWuLevelTerrain,
  ding: createDingLevelTerrain,
  huang: createHuangLevelTerrain,
};
