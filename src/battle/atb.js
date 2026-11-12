// ============================================================
// battle/atb.js — 回合轮换 + 行动力(AP) + 冷却(CD)
// ============================================================

import { CONFIG } from '../config.js';

// 回合轮换管理器：玩家 → 敌方 → 玩家 → ...
export class ATBSystem {
  constructor() {
    this.units = [];
    this.activeUnit = null;
    this.frozen = false;
    this.turnCount = 0; // 总回合数
  }

  register(unit) {
    unit.atb = 0;
    unit.ap = 0;
    unit.apMax = CONFIG.AP_MAX;
    unit.cooldowns = {};
    this.units.push(unit);
  }

  unregister(unit) {
    this.units = this.units.filter(u => u !== unit);
  }

  // 不再自动填充行动条；改由 battle 手动切换回合
  update(dt) {
    return null;
  }

  // 开始某个单位的回合
  startTurn(unit) {
    this.activeUnit = unit;
    this.frozen = false;
    this.turnCount++;
    // 获得 AP
    const apGain = unit.isPlayer ? CONFIG.AP_PER_TURN : CONFIG.BOSS_AP_PER_TURN || 3;
    unit.ap = Math.min(unit.apMax, unit.ap + apGain);
    return unit;
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

  consumeAP(unit, amount) {
    unit.ap -= amount;
  }

  startCooldown(unit, skillId, cdMax) {
    // 技能有独立冷却
    if (!unit.cooldowns) unit.cooldowns = {};
    unit.cooldowns[skillId] = cdMax;
  }

  isReady(unit, skillId) {
    if (!unit.cooldowns) return true;
    return !unit.cooldowns[skillId] || unit.cooldowns[skillId] <= 0;
  }

  getCDProgress(unit, skillId, cdMax) {
    if (!unit.cooldowns || !unit.cooldowns[skillId]) return 0;
    return unit.cooldowns[skillId] / cdMax;
  }

  // 每回合结束时推进冷却
  tickCooldowns(unit) {
    if (!unit.cooldowns) return;
    for (const k in unit.cooldowns) {
      if (unit.cooldowns[k] > 0) unit.cooldowns[k]--;
    }
  }

  standby(unit) {
    const bonus = CONFIG.STANDBY_BONUS_AP || 3;
    unit.ap = Math.min(unit.apMax, unit.ap + bonus);
    this.endAction();
  }
}
