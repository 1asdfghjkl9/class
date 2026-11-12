// ============================================================
// data/weapons.js — 武器池（6 把，品质不可变，可升 1-5 级，可洗词条）
// fireMode:
//   single   一轮一发·单体
//   aoe      一轮一发·范围
//   burst    多轮单发（rounds 轮 × 1 发）
//   volley   N 轮 M 发（rounds 轮 × shotsPerRound 发）
// ============================================================

export const WEAPONS = {
  pen_gun: {
    id: 'pen_gun', name: '某人的笔枪', quality: 'green', fireMode: 'single',
    baseDamage: 24, rounds: 1, shotsPerRound: 1,
    bulletColor: '#333333', bulletRadius: 5, bulletSpeedMul: 1.0,
    desc: '发射长款笔芯，弹速快、弹道直',
    icon: '笔',
  },
  insecticide: {
    id: 'insecticide', name: '杀虫剂', quality: 'blue', fireMode: 'aoe',
    baseDamage: 30, rounds: 1, shotsPerRound: 1, aoeRadius: 100,
    bulletColor: '#81C784', bulletRadius: 7, bulletSpeedMul: 0.9,
    clearsSauce: true,
    desc: '一轮一发·范围，溅射 100 半径；可清理番茄炒蛋汤汁',
    icon: '杀',
  },
  han_chalk: {
    id: 'han_chalk', name: '韩老师的粉笔', quality: 'purple', fireMode: 'burst',
    baseDamage: 7, rounds: 8, shotsPerRound: 1, roundInterval: 0.22,
    bulletColor: '#FFF9C4', bulletRadius: 5, bulletSpeedMul: 1.05,
    desc: '多轮单发 8 连，每发 7 伤',
    icon: '韩',
  },
  exam_paper: {
    id: 'exam_paper', name: '考卷', quality: 'purple', fireMode: 'burst',
    baseDamage: 5, rounds: 12, shotsPerRound: 1, roundInterval: 0.16,
    bulletColor: '#ECEFF1', bulletRadius: 4, bulletSpeedMul: 1.1,
    desc: '多轮单发 12 连，每发 5 伤',
    icon: '卷',
  },
  homework: {
    id: 'homework', name: '作业本', quality: 'blue', fireMode: 'volley',
    baseDamage: 8, rounds: 2, shotsPerRound: 6, roundInterval: 0.35, spreadDeg: 12,
    bulletColor: '#42A5F5', bulletRadius: 5, bulletSpeedMul: 1.0,
    desc: '2 轮 × 6 发，每发 8 伤',
    icon: '本',
  },
  chinese_class: {
    id: 'chinese_class', name: '语文课', quality: 'gold', fireMode: 'volley',
    baseDamage: 12, rounds: 4, shotsPerRound: 3, roundInterval: 0.3, spreadDeg: 10,
    bulletColor: '#FFD54F', bulletRadius: 6, bulletSpeedMul: 1.0,
    exclusiveFx: true,
    desc: '4 轮 × 3 发，每发 12 伤；金色专属特效',
    icon: '语',
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
  // 负面词条（只有改造卡洗练时 15% 概率出现）
  dmg_minus:    { id: 'dmg_minus',    name: '伤害',        min: 5,  max: 12, unit: '%', positive: false },
  ap_plus:      { id: 'ap_plus',      name: '行动力消耗',  min: 1,  max: 1,  unit: '',  positive: false },
  speed_minus:  { id: 'speed_minus',  name: '弹速',        min: 5,  max: 10, unit: '%', positive: false },
};

export const POSITIVE_AFFIX_IDS = Object.values(AFFIXES).filter(a => a.positive).map(a => a.id);
export const NEGATIVE_AFFIX_IDS = Object.values(AFFIXES).filter(a => !a.positive).map(a => a.id);

// 随机生成一条词条
export function rollAffix(forceNegative = false) {
  const pool = forceNegative ? NEGATIVE_AFFIX_IDS : POSITIVE_AFFIX_IDS;
  const id = pool[Math.floor(Math.random() * pool.length)];
  const def = AFFIXES[id];
  const value = def.min + Math.floor(Math.random() * (def.max - def.min + 1));
  return { id, name: def.name, value, unit: def.unit, positive: def.positive };
}

// 按品质生成词条数量
export function rollAffixes(quality, forceNegative = false) {
  const count = { green: 0, blue: 1, purple: 2, gold: 3 }[quality] || 0;
  const list = [];
  for (let i = 0; i < count; i++) {
    const negative = forceNegative && i === count - 1;
    list.push(rollAffix(negative));
  }
  return list;
}

// 汇总词条对武器的加成
export function sumAffixes(affixes = []) {
  const out = { dmgPct: 0, critPct: 0, weakpointPct: 0, speedPct: 0, aoePct: 0, lifesteal: 0, ragePct: 0, apPlus: 0 };
  for (const a of affixes) {
    const v = a.positive ? a.value : -a.value;
    if (a.id === 'dmg_pct' || a.id === 'dmg_minus') out.dmgPct += v;
    else if (a.id === 'crit_pct') out.critPct += v;
    else if (a.id === 'weakpoint_pct') out.weakpointPct += v;
    else if (a.id === 'speed_pct' || a.id === 'speed_minus') out.speedPct += v;
    else if (a.id === 'aoe_pct') out.aoePct += v;
    else if (a.id === 'lifesteal') out.lifesteal += v;
    else if (a.id === 'rage_pct') out.ragePct += v;
    else if (a.id === 'ap_plus') out.apPlus += a.value;
  }
  return out;
}

// 武器实际伤害
export function weaponDamage(weapon, level = 1, affixes = []) {
  if (!weapon) return 0;
  const lvMul = 1 + (level - 1) * 0.15;
  const af = sumAffixes(affixes);
  return Math.max(1, Math.round(weapon.baseDamage * lvMul * (1 + af.dmgPct / 100)));
}

export function getWeapon(id) {
  return WEAPONS[id] || null;
}
