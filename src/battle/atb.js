// ============================================================
// battle/atb.js — 行动条(ATB) + 行动力(AP) + 冷却(CD)
// ============================================================

import { CONFIG } from '../config.js';

// ATB 管理器
export class ATBSystem {
  constructor() {
    this.units = [];     // 注册的单位
    this.activeUnit = null;
    this.frozen = false; // 弹射/动画期间冻结
  }

  register(unit) {
    unit.atb = 0;
    unit.ap = 0;
    unit.apMax = CONFIG.AP_MAX;
    unit.cooldowns = {};  // { skillId: cdLeft }
    this.units.push(unit);
  }

  unregister(unit) {
    this.units = this.units.filter(u => u !== unit);
  }

  // 每帧更新 ATB
  update(dt) {
    if (this.frozen) return null;
    for (const u of this.units) {
      if (u.dead) continue;
      if (u === this.activeUnit) continue;
      u.atb += u.speed * dt;
      if (u.atb >= CONFIG.ATB_MAX) {
        u.atb = CONFIG.ATB_MAX;
        this.activeUnit = u;
        // 获得 AP
        u.ap = Math.min(u.apMax, u.ap + CONFIG.AP_PER_TURN);
        return u;
      }
    }
    return null;
  }

  // 结束当前单位的行动
  endAction() {
    if (this.activeUnit) {
      this.activeUnit.atb = 0;
      this.activeUnit = null;
    }
    this.frozen = false;
  }

  freeze() { this.frozen = true; }
  unfreeze() { this.frozen = false; }

  // 消耗 AP 并推进冷却
  consumeAP(unit, amount) {
    unit.ap -= amount;
    // 推进所有冷却
    for (const id in unit.cooldowns) {
      if (unit.cooldowns[id] > 0) {
        unit.cooldowns[id] -= amount;
        if (unit.cooldowns[id] <= 0) {
          unit.cooldowns[id] = 0;
        }
      }
    }
  }

  // 设置技能冷却
  startCooldown(unit, skillId, cdMax) {
    unit.cooldowns[skillId] = cdMax;
  }

  // 技能是否就绪
  isReady(unit, skillId) {
    return !unit.cooldowns[skillId] || unit.cooldowns[skillId] <= 0;
  }

  // 获取冷却进度（0=就绪, 1=刚冷却）
  getCDProgress(unit, skillId, cdMax) {
    const cd = unit.cooldowns[skillId] || 0;
    return cd > 0 ? cd / cdMax : 0;
  }

  // 待机（AP 不足时）
  standby(unit) {
    unit.ap = Math.min(unit.apMax, unit.ap + CONFIG.STANDBY_BONUS_AP);
    this.endAction();
  }
}
