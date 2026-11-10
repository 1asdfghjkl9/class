// ============================================================
// battle/projectile.js — 弹道、重力、风力物理
// ============================================================

import { CONFIG } from '../config.js';

export class Projectile {
  constructor(x, y, vx, vy, opts = {}) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.prevX = x;
    this.prevY = y;
    this.radius = opts.radius ?? 5;
    this.color = opts.color ?? '#333333';
    this.damage = opts.damage ?? 30;
    this.source = opts.source ?? 'player';    // 'player' | 'boss' | 'minion'
    this.skillId = opts.skillId ?? null;       // 关联技能（用于追踪判定等）
    this.isTracking = opts.isTracking ?? false;
    this.trackingTarget = opts.trackingTarget ?? null;
    this.alive = true;
    this.age = 0;
    this.trail = [];                            // 轨迹点
    this.maxTrail = 12;
    this.onHit = opts.onHit ?? null;
    this.onMiss = opts.onMiss ?? null;
    this.spawnTime = 0;
  }

  update(dt, windAccelX) {
    if (!this.alive) return;
    this.prevX = this.x;
    this.prevY = this.y;

    // 追踪弹逻辑
    if (this.isTracking && this.trackingTarget) {
      const t = this.trackingTarget;
      const dx = t.x - this.x;
      const dy = t.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d > 1) {
        const trackForce = 800;
        this.vx += (dx / d) * trackForce * dt;
        this.vy += (dy / d) * trackForce * dt;
        // 限速
        const sp = Math.hypot(this.vx, this.vy);
        const maxSp = 700;
        if (sp > maxSp) {
          this.vx = (this.vx / sp) * maxSp;
          this.vy = (this.vy / sp) * maxSp;
        }
      }
    }

    // 物理：重力 + 风力
    this.vy += CONFIG.GRAVITY * dt;
    this.vx += windAccelX * dt;

    // 积分
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.age += dt;

    // 轨迹
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > this.maxTrail) this.trail.shift();

    // 出界检测
    if (this.x < -CONFIG.OUT_OF_BOUNDS_MARGIN || this.x > CONFIG.WIDTH + CONFIG.OUT_OF_BOUNDS_MARGIN ||
        this.y > CONFIG.HEIGHT + CONFIG.OUT_OF_BOUNDS_MARGIN) {
      this.alive = false;
      if (this.onMiss) this.onMiss();
    }
  }

  // 获取当前速度方向（弧度）
  get angle() {
    return Math.atan2(this.vy, this.vx);
  }

  // 获取速度大小
  get speed() {
    return Math.hypot(this.vx, this.vy);
  }
}

// 预测弹道采样
export function predictTrajectory(x, y, vx, vy, windAccelX, time = CONFIG.PREDICT_TIME, points = CONFIG.PREDICT_POINTS) {
  const result = [];
  const dt = time / points;
  let px = x, py = y, pvx = vx, pvy = vy;
  for (let i = 0; i < points; i++) {
    pvy += CONFIG.GRAVITY * dt;
    pvx += windAccelX * dt;
    px += pvx * dt;
    py += pvy * dt;
    result.push({ x: px, y: py });
    if (py > CONFIG.GROUND_Y || px < 0 || px > CONFIG.WIDTH) break;
  }
  return result;
}
