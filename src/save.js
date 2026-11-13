// ============================================================
// save.js — 存档系统 v3（金币×100 / 武器碎片 / 道具解锁 / 配装）
// ============================================================

import { getCurrentSaveKey, isLoggedIn } from './account.js';

const OLD_KEY = 'class_battle_save_v1';
function getSaveKey() {
  if (isLoggedIn()) return getCurrentSaveKey();
  return 'class_battle_save_v3';
}

export function createDefaultSave() {
  return {
    version: 3,
    coins: 100000,
    exp: 0,
    level: 1,

    progress: {
      bosses: { jin: 0, han: 0, wu: 0, ding: 0, huang: 0 },
      stages: {},
      subjectBadges: { chinese: 0, math: 0, english: 0, art: 0, pe: 0 },
    },

    // 技能
    skillsUnlocked: { wall: 1, chalk: 1, justice: 1 },
    skillLevels: { wall: 1, chalk: 1, justice: 1 },
    skillFragments: {},

    // 道具
    itemUnlocked: { kite: true, not_our_class: true, what_doing: true, teacher_snack: true },
    itemLevels: {},
    itemFragments: {},

    // 武器
    weapons: {
      owned: {
        pen_gun: { level: 1, affixes: [] },
      },
      equipped: 'pen_gun',
      fragments: {},   // { weaponId: count }
    },

    // 装备
    equipped: {
      skills: ['wall', 'chalk', 'justice'],
      items: [],       // 装备的道具ID列表
    },

    // 天赋
    talents: {
      points: 0,
      spent: {},
    },

    // 成就
    achievements: {
      unlocked: {},
      title: '',
    },

    // 挑战
    challenges: {
      cleared: {},
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

// 深合并
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
  s.version = 3;
  // 旧金币×100
  s.coins = (old.coins ?? 1000) * 100;
  if (old.progress?.bosses) s.progress.bosses = { ...def.progress.bosses, ...old.progress.bosses };
  if (old.equipped?.skills) s.equipped.skills = old.equipped.skills;
  if (old.equipped?.weapon && old.weapons?.owned?.[old.equipped.weapon]) {
    s.weapons.equipped = old.equipped.weapon;
  }
  if (old.stats) s.stats = { ...def.stats, ...old.stats };
  // 迁移默认道具解锁
  s.itemUnlocked = { kite: true, not_our_class: true, what_doing: true, teacher_snack: true };
  return s;
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(getSaveKey());
    if (raw) {
      const data = JSON.parse(raw);
      const merged = deepMerge(createDefaultSave(), data);
      merged.version = 3;
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

export function grantWeapon(save, weaponId, affixes = []) {
  if (save.weapons.owned[weaponId]) {
    const refund = 8000;
    addCoins(save, refund);
    return { duplicated: true, refund };
  }
  save.weapons.owned[weaponId] = { level: 1, affixes };
  return { duplicated: false };
}

// ===== 武器碎片 =====
export function getWeaponFragments(save, weaponId) {
  return save.weapons.fragments[weaponId] || 0;
}

export function addWeaponFragments(save, weaponId, n = 1) {
  save.weapons.fragments[weaponId] = (save.weapons.fragments[weaponId] || 0) + n;
  return save.weapons.fragments[weaponId];
}

// ===== 道具解锁 =====
export function isItemUnlocked(save, itemId) {
  return !!save.itemUnlocked[itemId];
}

export function unlockItem(save, itemId) {
  if (save.itemUnlocked[itemId]) return false;
  save.itemUnlocked[itemId] = true;
  return true;
}

export function getItemFragments(save, itemId) {
  return save.itemFragments[itemId] || 0;
}

export function addItemFragments(save, itemId, n = 1) {
  save.itemFragments[itemId] = (save.itemFragments[itemId] || 0) + n;
  return save.itemFragments[itemId];
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
