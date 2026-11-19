// ============================================================
// meta/economy.js — 商店 / 升级 / 洗练 / 天赋点选 / 装备 v2
// 新增：武器盲盒碎片系统、道具解锁/配装
// ============================================================

import { CONFIG } from '../config.js';
import { SKILLS, MAX_EQUIPPED_SKILLS } from '../data/skills.js';
import { ITEMS, ITEM_POOL, ITEMS_PER_BATTLE, DEFAULT_ITEMS } from '../data/items.js';
import { WEAPONS, WEAPON_POOL, rollAffixes, sumAffixes, fragmentsNeeded } from '../data/weapons.js';
import { TALENT_TREES, canUnlockTier, totalSpentPoints } from '../data/talents.js';
import { addCoins, addExp, grantWeapon, unlockSkill, addSkillFragment, hasWeapon,
  getWeaponFragments, addWeaponFragments, isItemUnlocked as saveIsItemUnlocked,
  unlockItem, getItemFragments, addItemFragments } from '../save.js';

// ===== 价格 =====
export function skillUpgradePrice(level) {
  return CONFIG.PRICES.skillUpgrade + (level - 1) * 2200;
}
export function weaponUpgradePrice(level) {
  return CONFIG.PRICES.weaponUpgrade + (level - 1) * 2600;
}
export function itemUpgradePrice(level) {
  return CONFIG.PRICES.itemUpgrade + (level - 1) * 1800;
}

// ===== 武器盲盒（抽卡 → 碎片）=====
export function rollWeaponQuality() {
  const g = CONFIG.WEAPON_GACHA;
  const r = Math.random();
  if (r < g.gold) return 'gold';
  if (r < g.gold + g.pink) return 'pink';
  if (r < g.gold + g.pink + g.purple) return 'purple';
  if (r < g.gold + g.pink + g.purple + g.blue) return 'blue';
  return 'green';
}

// 买盲盒 → 获得随机武器碎片
export function buyWeaponPack(save) {
  const price = CONFIG.PRICES.weaponBlindBox;
  if (save.coins < price) return { ok: false, reason: '金币不足' };
  save.coins -= price;

  // 按品质抽一把武器
  const quality = rollWeaponQuality();
  const order = ['gold', 'pink', 'purple', 'blue', 'green'];
  let pick = null;
  for (let i = order.indexOf(quality); i < order.length && !pick; i++) {
    const pool = WEAPON_POOL.filter(id => WEAPONS[id].quality === order[i]);
    if (pool.length) pick = pool[Math.floor(Math.random() * pool.length)];
  }
  if (!pick) pick = 'pen_gun';

  const weapon = WEAPONS[pick];
  const need = fragmentsNeeded(pick);

  // 初始化碎片记录（使用 save.weapons.fragments）
  const prev = getWeaponFragments(save, pick);
  const now = prev + 1;

  // 已拥有的武器 → 返还金币
  if (hasWeapon(save, pick)) {
    const refund = Math.floor(price * 0.5);
    save.coins += refund;
    return {
      ok: true, weaponId: pick, weapon, quality,
      duplicated: true, refund,
    };
  }

  // 碎片够了 → 解锁武器
  if (now >= need) {
    addWeaponFragments(save, pick, -prev); // 清零
    const affixes = rollAffixes(weapon.quality);
    const res = grantWeapon(save, pick, affixes);
    return {
      ok: true, weaponId: pick, weapon, quality,
      duplicated: false, unlocked: true, affixes,
      fragments: 0, need,
    };
  }

  // 碎片不够
  addWeaponFragments(save, pick, 1);
  return {
    ok: true, weaponId: pick, weapon, quality,
    duplicated: false, unlocked: false,
    fragments: now, need,
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

// ===== 买道具碎片 =====
export function buyItemFragment(save, itemId) {
  const item = ITEMS[itemId];
  if (!item) return { ok: false, reason: '道具不存在' };
  // 默认拥有的道具不可购买碎片
  if (DEFAULT_ITEMS.includes(itemId)) return { ok: false, reason: '默认拥有' };
  // 已解锁
  if (saveIsItemUnlocked(save, itemId)) return { ok: false, reason: '已解锁' };
  const price = CONFIG.PRICES.itemFragment;
  if (save.coins < price) return { ok: false, reason: '金币不足' };
  save.coins -= price;
  const now = addItemFragments(save, itemId, 1);
  const need = item.fragments || 8;
  let unlocked = false;
  if (now >= need) {
    unlockItem(save, itemId);
    unlocked = true;
  }
  return { ok: true, fragments: now, need, unlocked };
}

// 检查道具是否已解锁
export function isItemUnlocked(save, itemId) {
  if (DEFAULT_ITEMS.includes(itemId)) return true;
  return saveIsItemUnlocked(save, itemId);
}

// ===== 洗词条（奸商的重铸券）=====
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

// 道具配装
export function equipItem(save, itemId) {
  if (!isItemUnlocked(save, itemId)) return { ok: false, reason: '未解锁' };
  const list = save.equipped.items || [];
  if (list.includes(itemId)) {
    save.equipped.items = list.filter(i => i !== itemId);
    return { ok: true, removed: true };
  }
  if (list.length >= ITEMS_PER_BATTLE) return { ok: false, reason: `最多携带 ${ITEMS_PER_BATTLE} 个道具` };
  save.equipped.items = [...list, itemId];
  return { ok: true, added: true };
}

// 每关开始：使用已装备的道具，不足则用默认道具补齐
export function prepareBattleItems(save) {
  const equipped = save.equipped.items || [];
  const result = [...equipped];
  // 不足时用默认道具补齐
  for (const id of DEFAULT_ITEMS) {
    if (result.length >= ITEMS_PER_BATTLE) break;
    if (!result.includes(id)) result.push(id);
  }
  // 仍然不足则随机补
  if (result.length < ITEMS_PER_BATTLE) {
    const pool = ITEM_POOL.filter(id => isItemUnlocked(save, id) && !result.includes(id));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    while (result.length < ITEMS_PER_BATTLE && pool.length) {
      result.push(pool.shift());
    }
  }
  return result.slice(0, ITEMS_PER_BATTLE);
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
