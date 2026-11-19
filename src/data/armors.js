// ============================================================
// data/armors.js — 防具系统（民立中学校服）
// 防具提供固定减伤(dr)和额外生命(hpBonus)
// 每次只能装备一件防具
// ============================================================

export const ARMORS = {
  summer_uniform: {
    id: 'summer_uniform', name: '夏季校服', quality: 'blue',
    dr: 0.08, hpBonus: 800, speedBonus: 0.05,
    desc: '民立中学夏季校服·短袖，轻便灵活，减伤 8%，生命 +800，移动速度 +5%',
    icon: '夏', color: '#42A5F5',
    unlock: 'default',
  },
  autumn_uniform: {
    id: 'autumn_uniform', name: '春秋季校服', quality: 'purple',
    dr: 0.15, hpBonus: 2000, speedBonus: 0,
    desc: '民立中学春秋季校服·长袖，均衡防护，减伤 15%，生命 +2000',
    icon: '秋', color: '#AB47BC',
    unlock: 'fragment', fragments: 15,
  },
  winter_uniform: {
    id: 'winter_uniform', name: '冬季校服', quality: 'pink',
    dr: 0.25, hpBonus: 5000, speedBonus: -0.05,
    desc: '民立中学冬季校服·棉服，厚重保暖，减伤 25%，生命 +5000，移动速度 -5%',
    icon: '冬', color: '#EF5350',
    unlock: 'fragment', fragments: 30,
  },
};

export const ARMOR_POOL = Object.keys(ARMORS);

export function getArmor(id) {
  return ARMORS[id] || null;
}

export function isArmorUnlocked(save, armorId) {
  const a = ARMORS[armorId];
  if (!a) return false;
  if (a.unlock === 'default') return true;
  const frags = (save.armorFragments && save.armorFragments[armorId]) || 0;
  return frags >= (a.fragments || 0);
}

export function getEquippedArmor(save) {
  const id = save.equipped && save.equipped.armor;
  return id ? ARMORS[id] : null;
}

export function equipArmor(save, armorId) {
  if (!isArmorUnlocked(save, armorId)) return { ok: false, reason: '未解锁' };
  if (!save.equipped) save.equipped = {};
  if (save.equipped.armor === armorId) {
    delete save.equipped.armor;
    return { ok: true, removed: true };
  }
  save.equipped.armor = armorId;
  return { ok: true, added: true };
}

export function buyArmorFragment(save, armorId) {
  const a = ARMORS[armorId];
  if (!a) return { ok: false, reason: '防具不存在' };
  if (a.unlock === 'default') return { ok: false, reason: '默认防具无需碎片' };
  if (!save.armorFragments) save.armorFragments = {};
  const cost = 20000; // 每次购买花费
  if (save.coins < cost) return { ok: false, reason: '金币不足' };
  save.coins -= cost;
  save.armorFragments[armorId] = (save.armorFragments[armorId] || 0) + 1;
  const need = a.fragments || 0;
  const got = save.armorFragments[armorId];
  if (got >= need) {
    return { ok: true, unlocked: true, armor: a.name, fragments: got, need };
  }
  return { ok: true, unlocked: false, fragments: got, need };
}
