// ============================================================
// battle/damage.js — 命中判定、暴击、伤害结算
// ============================================================

import { CONFIG } from '../config.js';

// 计算入射陡峭度（0°=水平平射，90°=垂直吊射）
// 说明：原实现用"目标朝向"判断背后命中，但双方站位固定（玩家在左、Boss 在右），
// 玩家永远无法绕到背后，导致暴击几乎不触发。这里改为用弹道陡峭度判定，
// 玩家可以通过高抛吊射主动追求暴击/超暴击，手感更接近弹射游戏。
function calcEntryAngle(projectile) {
  const speed = Math.hypot(projectile.vx, projectile.vy) || 1;
  const verticalRatio = Math.min(1, Math.abs(projectile.vy) / speed);
  return Math.asin(verticalRatio) * 180 / Math.PI;  // 0 ~ 90
}

// 三档判定：平射 / 斜抛 / 吊射
function calcTier(entryAngle) {
  if (entryAngle < 25) return 0;   // 平射
  if (entryAngle < 55) return 1;   // 斜抛
  return 2;                        // 吊射
}

// 风向暴击加成
function calcWindCritBonus(wind, projectile, target) {
  if (!wind) return 0;
  const windDir = wind.dir === 'cold' ? -1 : 1;  // cold=左, hot=右
  // 子弹水平速度方向
  const bulletDir = Math.sign(projectile.vx);
  // 目标相对子弹的水平方向
  const targetDir = Math.sign(target.x - projectile.x);

  // 逆风：风把子弹推离目标
  if (windDir === -bulletDir && bulletDir === targetDir) {
    return CONFIG.HEADWIND_CRIT_BONUS;
  }
  // 顺风
  if (windDir === bulletDir && bulletDir === targetDir) {
    return 0;
  }
  // 侧风（档位≥3）
  if (wind.level >= CONFIG.SIDEWIND_MIN_LEVEL) {
    return CONFIG.SIDEWIND_CRIT_BONUS;
  }
  return 0;
}

// 主伤害结算函数
// opts: { projectile, target, wind, skillData, skillLevel, weaponData, isWeakpoint, weakpointData }
export function calculateDamage(opts) {
  const {
    projectile, target, wind,
    skillData = null, skillLevel = 1,
    weaponData = null, isWeakpoint = false, allowCrit = true,
  } = opts;

  // 1. 入射陡峭度与档位
  const entryAngle = calcEntryAngle(projectile);
  let tier = calcTier(entryAngle);

  // 弱点判定放宽一档
  if (isWeakpoint) {
    tier = Math.min(2, tier + 1);
  }

  // 技能追踪判定
  const isTracking = skillData?.isTracking ?? false;

  // 2. 暴击率（只有玩家攻击享受暴击）
  let critChance = 0;
  if (allowCrit) {
    critChance = CONFIG.BASE_CRIT + CONFIG.TIER_CRIT_BONUS[tier];
    critChance += calcWindCritBonus(wind, projectile, target);
    // 追踪类技能暴击率封顶，且不享受超暴击
    if (isTracking) critChance = Math.min(critChance, 0.5);
  }

  // 3. 暴击判定
  const isCrit = allowCrit && Math.random() < critChance;
  let isSuper = false;
  if (isCrit && tier === 2 && !isTracking) {
    isSuper = Math.random() < CONFIG.SUPER_CRIT_CHANCE;
  }

  // 4. 伤害倍率
  let critMul = 1.0;
  if (isSuper) critMul = CONFIG.SUPER_CRIT_MUL;
  else if (isCrit) critMul = CONFIG.CRIT_MUL;

  // 5. 基础伤害
  // projectile.damage 已由发射方算入武器等级 / 技能等级 / 词条 / 天赋加成，
  // 这里不能再按 skillData.baseDamage / weaponData.baseDamage 覆盖，否则加成会全部丢失。
  const baseDamage = projectile.damage;

  // 6. 目标减伤
  let targetDR = target.dr ?? 0;
  targetDR = Math.min(CONFIG.DR_CAP, targetDR);

  // 7. 最终伤害
  const finalDamage = Math.round(
    baseDamage * critMul * (1 - targetDR)
  );

  // 8. 档位标签
  const tierLabel = ['平射', '斜抛', '吊射'][tier];

  return {
    damage: finalDamage,
    baseDamage,
    isCrit,
    isSuper,
    critMul,
    tier,
    tierLabel,
    entryAngle,
  };
}

// 生成飘字数据
export function createDamageText(x, y, damage, result) {
  let color = '#FFFFFF';
  let size = 24;
  let label = '';
  if (result.isSuper) {
    color = CONFIG.COLORS.critRed;
    size = 42;
    label = '超暴击! ';
  } else if (result.isCrit) {
    color = CONFIG.COLORS.critYellow;
    size = 32;
    label = '暴击! ';
  }
  return {
    x, y: y - 20,
    text: label + damage,
    color,
    size,
    life: 1.2,
    maxLife: 1.2,
    vy: -60,
    vx: (Math.random() - 0.5) * 30,
  };
}
