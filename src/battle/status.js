// ============================================================
// battle/status.js — 增益 / 减益状态
// 支持：护盾、隐身、免伤、易伤、点名、没收、沉默、持续伤害、
//       束缚、锁定、反射盾、视野模糊、粉笔灰、攻击力增益
// ============================================================

export class StatusSystem {
  constructor() {
    this.statuses = [];  // { type, target, duration, value, source }
  }

  add(target, type, duration, value = 0, source = '') {
    const existing = this.statuses.find(s => s.target === target && s.type === type);
    if (existing) {
      existing.duration = Math.max(existing.duration, duration);
      existing.value = Math.max(existing.value, value);
    } else {
      this.statuses.push({ target, type, duration, value, source });
    }
  }

  remove(target, type) {
    this.statuses = this.statuses.filter(s => !(s.target === target && s.type === type));
  }

  has(target, type) {
    return this.statuses.some(s => s.target === target && s.type === type);
  }

  getValue(target, type) {
    const s = this.statuses.find(s => s.target === target && s.type === type);
    return s ? s.value : 0;
  }

  /**
   * 回合结束：持续伤害先结算，再统一减持续时间
   * @returns {Array<{target, damage}>} 本回合触发的持续伤害
   */
  tickTurn() {
    const dots = [];
    for (const s of this.statuses) {
      if (s.type === 'dot' && s.duration > 0 && s.value > 0) {
        dots.push({ target: s.target, damage: s.value });
      }
    }
    this.statuses = this.statuses.filter(s => {
      s.duration -= 1;
      return s.duration > 0;
    });
    return dots;
  }

  // ===== 伤害计算相关 =====
  getDamageReduction(target) {
    let total = 0;
    for (const s of this.statuses) {
      if (s.target !== target) continue;
      if (s.type === 'shield' || s.type === 'stealth') total += s.value;
    }
    return Math.min(0.70, total);
  }

  getDamageTakenMultiplier(target) {
    let mul = 1.0;
    for (const s of this.statuses) {
      if (s.target !== target) continue;
      if (s.type === 'immune') mul = 0;
      else if (s.type === 'vulnerable') mul *= 2.0;
    }
    return mul;
  }

  // 反射盾反弹比例
  getReflectRatio(target) {
    let r = 0;
    for (const s of this.statuses) {
      if (s.target === target && s.type === 'reflect') r += s.value;
    }
    return Math.min(0.80, r);
  }

  // 攻击力修正
  getAttackModifier(target) {
    let mod = 1.0;
    for (const s of this.statuses) {
      if (s.target !== target) continue;
      if (s.type === 'named') mod *= 0.5;
      if (s.type === 'confiscate') mod *= 0.5;
      if (s.type === 'buff_dmg') mod *= (1 + s.value);
      if (s.type === 'chalkDust') mod *= 0.85;
    }
    return mod;
  }

  // 命中修正（粉笔灰、模糊）
  getAccuracyModifier(target) {
    let mod = 1.0;
    for (const s of this.statuses) {
      if (s.target === target && s.type === 'chalkDust') mod *= 0.85;
    }
    return mod;
  }

  // ===== 行为限制 =====
  isSilenced(target) {
    return this.statuses.some(s => s.target === target && s.type === 'silence');
  }

  isLocked(target) {
    return this.statuses.some(s => s.target === target && s.type === 'lock');
  }

  isRooted(target) {
    return this.statuses.some(s => s.target === target && s.type === 'root');
  }

  // ===== 净化 =====
  cleanse(target) {
    const NEGATIVE = ['vulnerable', 'named', 'confiscate', 'silence', 'dot', 'root', 'lock', 'chalkDust', 'blur'];
    this.statuses = this.statuses.filter(s => !(s.target === target && NEGATIVE.includes(s.type)));
  }

  consumeOnce(target, type) {
    const idx = this.statuses.findIndex(s => s.target === target && s.type === type);
    if (idx >= 0) {
      this.statuses.splice(idx, 1);
      return true;
    }
    return false;
  }

  clear(target) {
    this.statuses = this.statuses.filter(s => s.target !== target);
  }

  // 调试用
  list(target) {
    return this.statuses.filter(s => s.target === target).map(s => ({ type: s.type, duration: s.duration, value: s.value }));
  }
}
