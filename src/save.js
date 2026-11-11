// ============================================================
// save.js — 存档系统 v2（金币 / 积分 / 等级 / 天赋 / 成就 / 武器实例 / 挑战）
// 支持账号隔离：每个账号有独立的存档
// ============================================================

import { getCurrentSaveKey, isLoggedIn } from './account.js';

const OLD_KEY = 'class_battle_save_v1';
function getSaveKey() {
  if (isLoggedIn()) return getCurrentSaveKey();
  return 'class_battle_save_v2';
}

export function createDefaultSave() {
  return {
    version: 2,
    coins: 1000,
    exp: 0,          // 当前等级内的积分
    level: 1,

    progress: {
      bosses: { jin: 0, han: 0, wu: 0 },
      stages: {},                 // { stageId: 1 }
      subjectBadges: { chinese: 0, math: 0, english: 0, art: 0, pe: 0 },
    },

    // 技能
    skillsUnlocked: { wall: 1, chalk: 1, justice: 1 },
    skillLevels: { wall: 1, chalk: 1, justice: 1 },
    skillFragments: {},           // { skillId: count }

    // 道具
    itemLevels: {},

    // 武器（每把武器一个实例：等级 + 词条）
    weapons: {
      owned: {
        pen_gun: { level: 1, affixes: [] },
      },
      equipped: 'pen_gun',
    },

    // 装备
    equipped: {
      skills: ['wall', 'chalk', 'justice'],
      items: [],
    },

    // 天赋
    talents: {
      points: 0,
      spent: {},                  // { tierId: 1 }
    },

    // 成就
    achievements: {
      unlocked: {},               // { achId: timestamp }
      title: '',
    },

    // 挑战
    challenges: {
      cleared: {},                // { challengeId: timestamp }
    },

    // 统计
    stats: {
      totalShots: 0,
      totalWins: 0,
      totalLosses: 0,
      superCrits: 0,
      maxSingleHit: 0,
      maxWeakpointsOneBattle: 0,
      noDamageWins: 0,
      dailyClears: 0,
      nightmareWins: 0,
      totalCoinsEarned: 0,
      totalPlayTime: 0,
    },

    // 设置
    settings: {
      sound: true,
      difficulty: 'normal',
      ultId: 'bomb',
      showAimLine: true,
    },

    battleState: null,
  };
}

// 深合并：保留新字段默认值，同时吃进旧存档数据
function deepMerge(def, data) {
  if (data === null || data === undefined) return def;
  if (Array.isArray(def) || typeof def !== 'object') return data;
  const out = { ...def };
  for (const k in data) {
    if (typeof def[k] === 'object' && def[k] !== null && !Array.isArray(def[k])) {
      out[k] = deepMerge(def[k], data[k]);
    } else {
      out[k] = data[k];
    }
  }
  return out;
}

// 旧版存档迁移
function migrateOld(old) {
  const def = createDefaultSave();
  if (!old) return def;
  const s = deepMerge(def, old);
  s.version = 2;
  s.coins = old.coins ?? 1000;
  if (old.progress?.bosses) s.progress.bosses = { ...def.progress.bosses, ...old.progress.bosses };
  if (old.equipped?.skills) s.equipped.skills = old.equipped.skills;
  if (old.equipped?.weapon && old.weapons?.owned?.[old.equipped.weapon]) {
    s.weapons.equipped = old.equipped.weapon;
  }
  if (old.stats) s.stats = { ...def.stats, ...old.stats };
  return s;
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(getSaveKey());
    if (raw) {
      const data = JSON.parse(raw);
      const merged = deepMerge(createDefaultSave(), data);
      merged.version = 2;
      return merged;
    }
    // 尝试迁移旧存档
    const oldRaw = localStorage.getItem(OLD_KEY);
    if (oldRaw) {
      const old = JSON.parse(oldRaw);
      const migrated = migrateOld(old);
      saveData(migrated);
      return migrated;
    }
    return createDefaultSave();
  } catch (e) {
    console.warn('存档读取失败，使用默认存档', e);
    return createDefaultSave();
  }
}

export function saveData(data) {
  try {
    localStorage.setItem(getSaveKey(), JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('存档保存失败', e);
    return false;
  }
}

export function resetSave() {
  try {
    localStorage.removeItem(getSaveKey());
    localStorage.removeItem(OLD_KEY);
  } catch (e) { /* ignore */ }
  return createDefaultSave();
}

// ===== 等级 / 积分 =====
export function expForLevel(level) {
  return 100 + (level - 1) * 25;
}

export function addExp(save, amount) {
  save.exp += amount;
  let gained = 0;
  while (save.level < 999 && save.exp >= expForLevel(save.level)) {
    save.exp -= expForLevel(save.level);
    save.level++;
    save.talents.points += 1;
    gained++;
  }
  return gained;
}

// ===== 金币 =====
export function addCoins(save, amount) {
  save.coins += amount;
  if (amount > 0) save.stats.totalCoinsEarned = (save.stats.totalCoinsEarned || 0) + amount;
}

// ===== 武器 =====
export function getWeaponInstance(save, weaponId) {
  return save.weapons.owned[weaponId] || null;
}

export function hasWeapon(save, weaponId) {
  return !!save.weapons.owned[weaponId];
}

// 获得武器；已有则转碎片（金币）
export function grantWeapon(save, weaponId, affixes = []) {
  if (save.weapons.owned[weaponId]) {
    const refund = 80;
    addCoins(save, refund);
    return { duplicated: true, refund };
  }
  save.weapons.owned[weaponId] = { level: 1, affixes };
  return { duplicated: false };
}

// ===== 技能 =====
export function unlockSkill(save, skillId) {
  if (save.skillsUnlocked[skillId]) return false;
  save.skillsUnlocked[skillId] = 1;
  if (!save.skillLevels[skillId]) save.skillLevels[skillId] = 1;
  return true;
}

export function addSkillFragment(save, skillId, n = 1) {
  save.skillFragments[skillId] = (save.skillFragments[skillId] || 0) + n;
  return save.skillFragments[skillId];
}

// ===== 战斗状态 =====
export function saveBattleState(state) {
  const data = loadSave();
  data.battleState = state;
  saveData(data);
}

export function clearBattleState() {
  const data = loadSave();
  data.battleState = null;
  saveData(data);
}

export function getBattleState() {
  const data = loadSave();
  return data.battleState;
}
