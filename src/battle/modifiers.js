// ============================================================
// battle/modifiers.js — 挑战修饰符 & 难度应用
// ============================================================

import { CONFIG } from '../config.js';
import { MODIFIERS } from '../data/challenges.js';

export function getDifficulty(id) {
  return CONFIG.DIFFICULTIES[id] || CONFIG.DIFFICULTIES.normal;
}

/**
 * 把修饰符应用到战斗上下文
 * @param {object} ctx { player, boss, bosses, mods: {windMul, dmgMulPlayer, dmgMulBoss, healAllowed, maxShotsPerTurn, speedMul, skillAllowed, fragile} }
 */
export function createModifierState(modifierIds = []) {
  const mods = {
    windMul: 1,
    dmgMulPlayer: 1,
    dmgMulBoss: 1,
    healAllowed: true,
    maxShotsPerTurn: 99,
    speedMul: 1,
    skillAllowed: true,
    fragile: 1,
    list: [],
  };
  for (const id of modifierIds) {
    const m = MODIFIERS[id];
    if (!m) continue;
    mods.list.push(m);
    switch (id) {
      case 'windstorm': mods.windMul = 1.8; break;
      case 'low_hp': mods.playerHpMul = 0.5; break;
      case 'glass_cannon': mods.dmgMulPlayer *= 1.8; mods.dmgMulBoss *= 1.8; break;
      case 'no_skill': mods.skillAllowed = false; break;
      case 'one_shot': mods.maxShotsPerTurn = 1; break;
      case 'speed_rush': mods.speedMul = 1.5; break;
      case 'no_heal': mods.healAllowed = false; break;
      case 'fragile': mods.fragile = 1.5; break;
      default: break;
    }
  }
  return mods;
}

// 难度应用到 Boss
export function applyDifficultyToBoss(boss, difficultyId) {
  const d = getDifficulty(difficultyId);
  boss.maxHp = Math.round(boss.maxHp * d.hpMul);
  boss.hp = boss.maxHp;
  boss.dmgMul = d.dmgMul;
  // 噩梦：额外机制
  if (d.extraMechanic && boss.mechanics) {
    const extras = { jin: 'enrage_early', han: 'quiz_more', wu: 'discipline_more' };
    const extra = extras[boss.id];
    if (extra && !boss.mechanics.includes(extra)) boss.mechanics.push(extra);
  }
  return boss;
}
