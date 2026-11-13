// ============================================================
// data/weapons.js — 武器池 v3
// 新增：粉色品质、碎片解锁系统、盲盒抽取、洗词条（重铸券）
// fireMode: single / aoe / burst / volley
// ============================================================

export const WEAPONS = {
  pen_gun: {
    id: 'pen_gun', name: '某人的笔枪', quality: 'green', fireMode: 'single',
    baseDamage: 2400, rounds: 1, shotsPerRound: 1,
    bulletColor: '#333333', bulletRadius: 5, bulletSpeedMul: 1.0,
    desc: '发射长款笔芯，弹速快、弹道直', icon: '笔',
  },
  insecticide: {
    id: 'insecticide', name: '杀虫剂', quality: 'blue', fireMode: 'aoe',
    baseDamage: 3000, rounds: 1, shotsPerRound: 1, aoeRadius: 100,
    bulletColor: '#81C784', bulletRadius: 7, bulletSpeedMul: 0.9,
    clearsSauce: true,
    desc: '一轮一发·范围，溅射 100 半径；可清理番茄炒蛋汤汁', icon: '杀',
  },
  han_chalk: {
    id: 'han_chalk', name: '韩老师的粉笔', quality: 'purple', fireMode: 'burst',
    baseDamage: 700, rounds: 8, shotsPerRound: 1, roundInterval: 0.22,
    bulletColor: '#FFF9C4', bulletRadius: 5, bulletSpeedMul: 1.05,
    desc: '多轮单发 8 连，每发 700 伤', icon: '韩',
  },
  exam_paper: {
    id: 'exam_paper', name: '考卷', quality: 'purple', fireMode: 'burst',
    baseDamage: 500, rounds: 12, shotsPerRound: 1, roundInterval: 0.16,
    bulletColor: '#ECEFF1', bulletRadius: 4, bulletSpeedMul: 1.1,
    desc: '多轮单发 12 连，每发 500 伤', icon: '卷',
  },
  homework: {
    id: 'homework', name: '作业本', quality: 'blue', fireMode: 'volley',
    baseDamage: 800, rounds: 2, shotsPerRound: 6, roundInterval: 0.35, spreadDeg: 12,
    bulletColor: '#42A5F5', bulletRadius: 5, bulletSpeedMul: 1.0,
    desc: '2 轮 × 6 发，每发 800 伤', icon: '本',
  },
  // ===== 新增粉色武器 =====
  ruler_sword: {
    id: 'ruler_sword', name: '巨型三角尺', quality: 'pink', fireMode: 'single',
    baseDamage: 12000, rounds: 1, shotsPerRound: 1,
    bulletColor: '#FF69B4', bulletRadius: 10, bulletSpeedMul: 0.85,
    effect: 'knockback', effectValue: 120,
    desc: '粉色巨型三角尺，单发 12000 伤，命中击退 120px', icon: '尺',
  },
  paint_brush: {
    id: 'paint_brush', name: '神笔马良', quality: 'pink', fireMode: 'aoe',
    baseDamage: 6000, rounds: 1, shotsPerRound: 1, aoeRadius: 160,
    bulletColor: '#FF1493', bulletRadius: 9, bulletSpeedMul: 0.9,
    desc: '粉色范围武器，160 半径 6000 伤', icon: '画',
  },
  chinese_class: {
    id: 'chinese_class', name: '语文课', quality: 'gold', fireMode: 'volley',
    baseDamage: 1200, rounds: 4, shotsPerRound: 3, roundInterval: 0.3, spreadDeg: 10,
    bulletColor: '#FFD54F', bulletRadius: 6, bulletSpeedMul: 1.0,
    exclusiveFx: true,
    desc: '4 轮 × 3 发，每发 1200 伤；金色专属特效', icon: '语',
  },
};

export const WEAPON_POOL = Object.keys(WEAPONS);
export const PLAYER_WEAPON = 'pen_gun';

// ===== 词条池 =====
export const AFFIXES = {
  dmg_pct:      { id: 'dmg_pct',      name: '伤害',        min: 6,  max: 15, unit: '%', positive: true },
  crit_pct:     { id: 'crit_pct',     name: '暴击率',      min: 3,  max: 8,  unit: '%', positive: true },
  weakpoint_pct:{ id: 'weakpoint_pct',name: '弱点伤害',    min: 10, max: 25, unit: '%', positive: true },
  speed_pct:    { id: 'speed_pct',    name: '弹速',        min: 5,  max: 12, unit: '%', positive: true },
  aoe_pct:      { id: 'aoe_pct',      name: '范围',        min: 10, max: 25, unit: '%', positive: true },
  lifesteal:    { id: 'lifesteal',    name: '吸血',        min: 3,  max: 8,  unit: '%', positive: true },
  rage_pct:     { id: 'rage_pct',     name: '怒气获取',    min: 8,  max: 20, unit: '%', positive: true },
  hp_pct:       { id: 'hp_pct',       name: '生命',        min: 5,  max: 12, unit: '%', positive: true },
  // 负面词条
  dmg_minus:    { id: 'dmg_minus',    name: '伤害',        min: 5,  max: 12, unit: '%', positive: false },
  ap_plus:      { id: 'ap_plus',      name: '行动力消耗',  min: 1,  max: 1,  unit: '',  positive: false },
  speed_minus:  { id: 'speed_minus',  name: '弹速',        min: 5,  max: 10, unit: '%', positive: false },
};

export const POSITIVE_AFFIX_IDS = Object.values(AFFIXES).filter(a => a.positive).map(a => a.id);
export const NEGATIVE_AFFIX_IDS = Object.values(AFFIXES).filter(a => !a.positive).map(a => a.id);

export function rollAffix(forceNegative = false) {
  const pool = forceNegative ? NEGATIVE_AFFIX_IDS : POSITIVE_AFFIX_IDS;
  const id = pool[Math.floor(Math.random() * pool.length)];
  const def = AFFIXES[id];
  const value = def.min + Math.floor(Math.random() * (def.max - def.min + 1));
  return { id, name: def.name, value, unit: def.unit, positive: def.positive };
}

// 按品质生成词条数量（含粉色）
export function rollAffixes(quality, forceNegative = false) {
  const count = { green: 0, blue: 1, purple: 2, pink: 3, gold: 4 }[quality] || 0;
  const list = [];
  for (let i = 0; i < count; i++) {
    const negative = forceNegative && i === count - 1;
    list.push(rollAffix(negative));
  }
  return list;
}

export function sumAffixes(affixes = []) {
  const out = { dmgPct: 0, critPct: 0, weakpointPct: 0, speedPct: 0, aoePct: 0, lifesteal: 0, ragePct: 0, hpPct: 0, apPlus: 0 };
  for (const a of affixes) {
    const v = a.positive ? a.value : -a.value;
    if (a.id === 'dmg_pct' || a.id === 'dmg_minus') out.dmgPct += v;
    else if (a.id === 'crit_pct') out.critPct += v;
    else if (a.id === 'weakpoint_pct') out.weakpointPct += v;
    else if (a.id === 'speed_pct' || a.id === 'speed_minus') out.speedPct += v;
    else if (a.id === 'aoe_pct') out.aoePct += v;
    else if (a.id === 'lifesteal') out.lifesteal += v;
    else if (a.id === 'rage_pct') out.ragePct += v;
    else if (a.id === 'hp_pct') out.hpPct += v;
    else if (a.id === 'ap_plus') out.apPlus += a.value;
  }
  return out;
}

// 武器实际伤害（×100 后不变，只是 baseDamage 大了）
export function weaponDamage(weapon, level = 1, affixes = []) {
  if (!weapon) return 0;
  const lvMul = 1 + (level - 1) * 0.15;
  const af = sumAffixes(affixes);
  return Math.max(1, Math.round(weapon.baseDamage * lvMul * (1 + af.dmgPct / 100)));
}

export function getWeapon(id) {
  return WEAPONS[id] || null;
}

// ===== 盲盒系统 =====
// 按品质概率随机选一把武器
export function rollBlindBoxWeapon(qualityOdds) {
  const r = Math.random();
  let acc = 0;
  for (const [q, odds] of Object.entries(qualityOdds)) {
    acc += odds;
    if (r < acc) {
      // 在该品质中随机选一把
      const pool = WEAPON_POOL.filter(id => WEAPONS[id].quality === q);
      if (pool.length === 0) continue;
      const wid = pool[Math.floor(Math.random() * pool.length)];
      return { weaponId: wid, quality: q };
    }
  }
  // fallback
  return { weaponId: 'pen_gun', quality: 'green' };
}

// 获取武器解锁所需碎片数
export function fragmentsNeeded(weaponId) {
  const w = WEAPONS[weaponId];
  if (!w) return 999;
  const cost = { green: 5, blue: 10, purple: 20, pink: 35, gold: 50 };
  return cost[w.quality] || 10;
}
