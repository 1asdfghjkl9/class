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

  // 消耗 AP（已取消技能独立冷却，不再推进冷却）
  consumeAP(unit, amount) {
    unit.ap -= amount;
  }

  // 设置技能冷却（已取消技能独立冷却，此方法不再生效）
  startCooldown(unit, skillId, cdMax) {
    // no-op: 技能不再有独立冷却
  }

  // 技能是否就绪（已取消技能独立冷却，始终返回 true）
  isReady(unit, skillId) {
    return true;
  }

  // 获取冷却进度（已取消技能独立冷却，始终返回 0）
  getCDProgress(unit, skillId, cdMax) {
    return 0;
  }

  // 待机（AP 不足时）
  standby(unit) {
    unit.ap = Math.min(unit.apMax, unit.ap + CONFIG.STANDBY_BONUS_AP);
    this.endAction();
  }
}
