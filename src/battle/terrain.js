// ============================================================
// battle/terrain.js — 地形对象 + 学科特有地图 + 悬空平台（高度图制）
// ============================================================

import { CONFIG } from '../config.js';

// ---------- 地形对象 ----------
export class TerrainObject {
  constructor(opts) {
    this.x = opts.x;
    this.y = opts.y;
    this.w = opts.w;
    this.h = opts.h;
    this.shape = opts.shape || 'rect';
    this.material = opts.material || 'wall';
    this.destructible = opts.destructible !== false;
    this.hp = opts.hp || 100;
    this.maxHp = this.hp;
    this.destroyed = false;
    this.decals = [];
    this.material = opts.material || 'wall';
  }

  hitTest(px, py, pr) {
    if (this.destroyed) return null;
    if (this.shape === 'rect') {
      const cx = Math.max(this.x, Math.min(px, this.x + this.w));
      const cy = Math.max(this.y, Math.min(py, this.y + this.h));
      const dx = px - cx, dy = py - cy;
      return Math.hypot(dx, dy) <= pr + 1 ? { nx: dx, ny: dy } : null;
    }
    if (this.shape === 'circle') {
      const r = Math.max(this.w, this.h) / 2;
      const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
      const dx = px - cx, dy = py - cy;
      return Math.hypot(dx, dy) <= r + pr ? { nx: dx, ny: dy } : null;
    }
    return null;
  }

  takeDamage(dmg) {
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.destroyed = true;
      return true;
    }
    return false;
  }

  addDecal(x, y, r, type) {
    if (this.decals.length < 8) this.decals.push({ x, y, r, type });
  }
}

// ---------- 材质 ----------
export const MATERIALS = {
  wall:     { color: '#4A3F35', hp: 99999, destructible: false },
  wood:     { color: '#8B7355', hp: 200,   destructible: true },
  podium:   { color: '#6D4C41', hp: 300,   destructible: true },
  paper:    { color: '#FFF8E1', hp: 80,    destructible: true },
  sauce:    { color: '#FF6B6B', hp: 50,    destructible: true },
  chalk:    { color: '#FFFDE7', hp: 60,    destructible: true },
  ground:   { color: '#6D4C41', hp: 99999, destructible: false },
};

// ---------- 悬空平台（高度图制：点拼成，圆形弹坑）----------
export function createPlatform(x, y, w, h) {
  const heightmap = new Float32Array(w);
  heightmap.fill(y); // 顶部表面 Y
  const bottomHeightmap = new Float32Array(w);
  bottomHeightmap.fill(y + h); // 底部表面 Y
  return { x, y, w, h, width: w, heightmap, bottomHeightmap };
}

// 检测弹丸与平台碰撞（高度图制，区分上方/下方命中）
export function checkPlatformHit(px, py, pr, platforms) {
  if (!platforms) return null;
  for (const plat of platforms) {
    if (px < plat.x - pr || px > plat.x + plat.w + pr) continue;
    const localX = Math.floor(px - plat.x);
    if (localX < 0 || localX >= plat.width) continue;
    const topY = plat.heightmap[localX];
    const botY = plat.bottomHeightmap[localX];
    // 从上方命中（弹丸底部触到顶面）
    if (py + pr >= topY && py < topY + 5) {
      return { platform: plat, localX, fromBottom: false, point: { x: px, y: topY } };
    }
    // 从下方命中（弹丸顶部触到底面）
    if (py - pr <= botY && py > botY - 5) {
      return { platform: plat, localX, fromBottom: true, point: { x: px, y: botY } };
    }
    // 弹丸在平台内部（穿透中）
    if (py + pr >= topY && py - pr <= botY) {
      // 判断更接近哪个面
      if (py < (topY + botY) / 2) {
        return { platform: plat, localX, fromBottom: false, point: { x: px, y: topY } };
      } else {
        return { platform: plat, localX, fromBottom: true, point: { x: px, y: botY } };
      }
    }
  }
  return null;
}

// ---------- 学科地形工厂 ----------
export const TERRAIN_FACTORIES = {
  pe:      () => _peTerrain(),
  chinese: () => _chineseTerrain(),
  art:     () => _artTerrain(),
  math:    () => _mathTerrain(),
  english: () => _englishTerrain(),
  jin:     () => _mathTerrain(),    // 数学老师 → 数学地图
  han:     () => _chineseTerrain(), // 语文老师 → 语文地图
  wu:      () => _englishTerrain(), // 英语老师 → 英语地图
  ding:    () => _artTerrain(),     // 美术老师 → 美术地图
  huang:   () => _peTerrain(),      // 体育老师 → 体育地图
  default: () => [],
};

// ---------- 学科悬空平台工厂 ----------
export const PLATFORM_FACTORIES = {
  pe:      () => _pePlatforms(),
  chinese: () => _chinesePlatforms(),
  art:     () => _artPlatforms(),
  math:    () => _mathPlatforms(),
  english: () => _englishPlatforms(),
  jin:     () => _mathPlatforms(),
  han:     () => _chinesePlatforms(),
  wu:      () => _englishPlatforms(),
  ding:    () => _artPlatforms(),
  huang:   () => _pePlatforms(),
  default: () => [],
};

// 辅助：创建平台定义
function _plat(x, y, w, h) { return { x, y, w, h }; }

// ---------- 体育：跨栏 + 球门 + 台阶 ----------
function _peTerrain() { return []; }
function _pePlatforms() {
  return [
    _plat(280, 820, 120, 35),   // 跨栏平台1
    _plat(480, 760, 100, 35),   // 跨栏平台2
    _plat(680, 820, 120, 35),   // 球门横梁
    _plat(920, 700, 140, 35),   // 看台台阶1
    _plat(1120, 780, 120, 35),  // 看台台阶2
    _plat(380, 640, 80, 140),   // 跨栏柱（高）
  ];
}

// ---------- 语文：书堆 + 卷轴 + 书本塔 ----------
function _chineseTerrain() { return []; }
function _chinesePlatforms() {
  return [
    _plat(300, 840, 100, 35),   // 书堆底层
    _plat(440, 780, 120, 35),   // 书堆中层
    _plat(580, 720, 100, 35),   // 书堆顶层
    _plat(800, 800, 160, 35),   // 卷轴桥
    _plat(1050, 700, 80, 35),   // 书本塔顶
    _plat(1050, 760, 80, 35),   // 书本塔中
    _plat(380, 620, 100, 140),  // 书架柱
  ];
}

// ---------- 美术：画架 + 调色盘 + 颜料管 ----------
function _artTerrain() { return []; }
function _artPlatforms() {
  return [
    _plat(320, 800, 60, 140),   // 画架左腿
    _plat(420, 800, 60, 140),   // 画架右腿
    _plat(370, 740, 140, 35),   // 画架横梁
    _plat(620, 780, 180, 35),   // 调色盘大平台
    _plat(900, 820, 120, 35),   // 颜料管斜坡1
    _plat(1080, 740, 100, 35),  // 颜料管斜坡2
    _plat(250, 660, 80, 140),   // 颜料瓶柱
  ];
}

// ---------- 数学：三角尺 + 量角器 + 圆规 ----------
function _mathTerrain() { return []; }
function _mathPlatforms() {
  return [
    _plat(300, 820, 80, 35),    // 三角尺底
    _plat(380, 740, 80, 35),    // 三角尺中
    _plat(460, 660, 80, 35),    // 三角尺顶
    _plat(620, 780, 200, 35),   // 量角器弧形桥
    _plat(900, 820, 100, 35),   // 圆规左脚
    _plat(1080, 820, 100, 35),  // 圆规右脚
    _plat(990, 700, 100, 35),   // 圆规顶
    _plat(250, 680, 60, 140),   // 直尺柱
  ];
}

// ---------- 英语：词典塔 + 字母桥 + 阶梯 ----------
function _englishTerrain() { return []; }
function _englishPlatforms() {
  return [
    _plat(300, 820, 80, 35),    // 词典塔底
    _plat(300, 760, 80, 35),    // 词典塔中
    _plat(300, 700, 80, 35),    // 词典塔顶
    _plat(460, 780, 180, 35),   // 字母桥
    _plat(720, 820, 120, 35),   // 阶梯1
    _plat(900, 760, 120, 35),   // 阶梯2
    _plat(1080, 700, 120, 35),  // 阶梯3
    _plat(1200, 640, 80, 35),   // 顶部小台
  ];
}
