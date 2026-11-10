// ============================================================
// meta/economy.js — 商店 / 升级 / 洗练 / 天赋点选 / 装备
// ============================================================

import { CONFIG } from '../config.js';
import { SKILLS, MAX_EQUIPPED_SKILLS } from '../data/skills.js';
import { ITEMS, ITEM_POOL, ITEMS_PER_BATTLE } from '../data/items.js';
import { WEAPONS, WEAPON_POOL, rollAffixes, sumAffixes } from '../data/weapons.js';
import { TALENT_TREES, canUnlockTier, totalSpentPoints } from '../data/talents.js';
import { addCoins, addExp, grantWeapon, unlockSkill, addSkillFragment, hasWeapon } from '../save.js';

// ===== 价格 =====
export function skillUpgradePrice(level) {
  return CONFIG.PRICES.skillUpgrade + (level - 1) * 220;
}
export function weaponUpgradePrice(level) {
  return CONFIG.PRICES.weaponUpgrade + (level - 1) * 260;
}
export function itemUpgradePrice(level) {
  return CONFIG.PRICES.itemUpgrade + (level - 1) * 180;
}

// ===== 武器包（抽卡）=====
export function rollWeaponQuality() {
  const g = CONFIG.WEAPON_GACHA;
  const r = Math.random();
  if (r < g.gold) return 'gold';
  if (r < g.gold + g.purple) return 'purple';
  if (r < g.gold + g.purple + g.blue) return 'blue';
  return 'green';
}

export function buyWeaponPack(save) {
  const price = CONFIG.PRICES.weaponPack;
  if (save.coins < price) return { ok: false, reason: '金币不足' };
  save.coins -= price;

  // 按品质抽一把同品质的武器；没有同品质就退一档
  const quality = rollWeaponQuality();
  const order = ['gold', 'purple', 'blue', 'green'];
  let pick = null;
  for (let i = order.indexOf(quality); i < order.length && !pick; i++) {
    const pool = WEAPON_POOL.filter(id => WEAPONS[id].quality === order[i]);
    if (pool.length) pick = pool[Math.floor(Math.random() * pool.length)];
  }
  if (!pick) pick = 'pen_gun';

  const weapon = WEAPONS[pick];
  const affixes = rollAffixes(weapon.quality);
  const res = grantWeapon(save, pick, affixes);
  return {
    ok: true,
    weaponId: pick,
    weapon,
    affixes,
    duplicated: res.duplicated,
    refund: res.refund || 0,
    quality,
  };
}

// ===== 技能升级 =====
export function upgradeSkill(save, skillId) {
  const lv = save.skillLevels[skillId] || 1;
  if (lv >= CONFIG.SKILL_MAX_LEVEL) return { ok: false, reason: '已满级' };
  const price = skillUpgradePrice(lv);
  if (save.coins < price) return { ok: false, reason: '金币不足', price };
  save.coins -= price;
  save.skillLevels[skillId] = lv + 1;
  return { ok: true, level: lv + 1 };
}

// ===== 武器升级 =====
export function upgradeWeapon(save, weaponId) {
  const inst = save.weapons.owned[weaponId];
  if (!inst) return { ok: false, reason: '未拥有' };
  if (inst.level >= CONFIG.WEAPON_MAX_LEVEL) return { ok: false, reason: '已满级' };
  const price = weaponUpgradePrice(inst.level);
  if (save.coins < price) return { ok: false, reason: '金币不足', price };
  save.coins -= price;
  inst.level += 1;
  return { ok: true, level: inst.level };
}

// ===== 道具升级 =====
export function upgradeItem(save, itemId) {
  const item = ITEMS[itemId];
  if (!item) return { ok: false, reason: '道具不存在' };
  if (item.upgradable === false) return { ok: false, reason: '该道具不可升级' };
  const lv = save.itemLevels[itemId] || 1;
  if (lv >= CONFIG.ITEM_MAX_LEVEL) return { ok: false, reason: '已满级' };
  const price = itemUpgradePrice(lv);
  if (save.coins < price) return { ok: false, reason: '金币不足', price };
  save.coins -= price;
  save.itemLevels[itemId] = lv + 1;
  return { ok: true, level: lv + 1 };
}

// ===== 买积分 =====
export function buyExp(save) {
  const price = CONFIG.PRICES.exp100;
  if (save.coins < price) return { ok: false, reason: '金币不足' };
  save.coins -= price;
  const gained = addExp(save, 100);
  return { ok: true, levels: gained, level: save.level };
}

// ===== 买技能碎片 =====
export function buyFragment(save, skillId) {
  const skill = SKILLS[skillId];
  if (!skill) return { ok: false, reason: '技能不存在' };
  if (save.skillsUnlocked[skillId]) return { ok: false, reason: '已解锁' };
  const price = CONFIG.PRICES.skillFragment;
  if (save.coins < price) return { ok: false, reason: '金币不足' };
  save.coins -= price;
  const n = addSkillFragment(save, skillId, 1);
  const need = skill.fragments || 10;
  let unlocked = false;
  if (n >= need) {
    unlockSkill(save, skillId);
    unlocked = true;
  }
  return { ok: true, fragments: n, need, unlocked };
}

// ===== 洗词条 =====
export function rerollWeapon(save, weaponId) {
  const inst = save.weapons.owned[weaponId];
  if (!inst) return { ok: false, reason: '未拥有' };
  const price = CONFIG.PRICES.rerollCard;
  if (save.coins < price) return { ok: false, reason: '金币不足' };
  save.coins -= price;
  const weapon = WEAPONS[weaponId];
  const negative = Math.random() < CONFIG.REROLL_NEGATIVE_CHANCE;
  inst.affixes = rollAffixes(weapon.quality, negative);
  return { ok: true, affixes: inst.affixes, hasNegative: negative };
}

// ===== 天赋 =====
export function unlockTalent(save, treeId, tierIndex) {
  const tree = TALENT_TREES[treeId];
  if (!tree) return { ok: false, reason: '天赋系不存在' };
  if (!canUnlockTier(save, treeId, tierIndex)) return { ok: false, reason: '前置未点满或点数不足' };
  save.talents.points -= 1;
  save.talents.spent[tree.tiers[tierIndex].id] = 1;
  return { ok: true };
}

export function respecTalents(save) {
  const price = CONFIG.PRICES.respecTicket;
  if (save.coins < price) return { ok: false, reason: '金币不足' };
  const spent = totalSpentPoints(save);
  if (spent === 0) return { ok: false, reason: '还没有已点天赋' };
  save.coins -= price;
  save.talents.points += spent;
  save.talents.spent = {};
  return { ok: true, refunded: spent };
}

// ===== 装备 =====
export function equipSkill(save, skillId) {
  if (!save.skillsUnlocked[skillId]) return { ok: false, reason: '未解锁' };
  const list = save.equipped.skills;
  if (list.includes(skillId)) {
    if (list.length <= 1) return { ok: false, reason: '至少保留 1 个技能' };
    save.equipped.skills = list.filter(s => s !== skillId);
    return { ok: true, removed: true };
  }
  if (list.length >= MAX_EQUIPPED_SKILLS) return { ok: false, reason: `最多携带 ${MAX_EQUIPPED_SKILLS} 个技能` };
  save.equipped.skills = [...list, skillId];
  return { ok: true, added: true };
}

export function equipWeapon(save, weaponId) {
  if (!hasWeapon(save, weaponId)) return { ok: false, reason: '未拥有' };
  save.weapons.equipped = weaponId;
  return { ok: true };
}

// 每关开始自动补齐道具（4 个，不重复，优先等级高的）
export function prepareBattleItems(save) {
  const pool = [...ITEM_POOL];
  // 按等级降序排列，等级高的优先
  pool.sort((a, b) => (save.itemLevels[b] || 1) - (save.itemLevels[a] || 1));
  // 洗牌保留一点随机性
  for (let i = pool.length - 1; i > 0; i--) {
    if (Math.random() < 0.5) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
  }
  return pool.slice(0, ITEMS_PER_BATTLE);
}

// 武器总览（含词条汇总）
export function weaponSummary(save, weaponId) {
  const inst = save.weapons.owned[weaponId];
  const def = WEAPONS[weaponId];
  if (!inst || !def) return null;
  return {
    def, level: inst.level, affixes: inst.affixes, stats: sumAffixes(inst.affixes),
  };
}
