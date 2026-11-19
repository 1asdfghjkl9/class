// ============================================================
// data/challenges.js — 每日 / 每周挑战（限时变体关卡）
// 用日期做种子，保证同一天看到的挑战固定
// ============================================================

export const MODIFIERS = {
  windstorm: {
    id: 'windstorm', name: '狂风模式', desc: '风向固定 5 档，弹道偏移极大',
    apply: (b) => { b.forceWind = 5; },
  },
  low_hp: {
    id: 'low_hp', name: '残血开局', desc: '开局只有 40% 生命',
    apply: (b) => { b.startHpRatio = 0.40; },
  },
  glass_cannon: {
    id: 'glass_cannon', name: '玻璃大炮', desc: '双方伤害 ×1.6',
    apply: (b) => { b.damageMul = (b.damageMul || 1) * 1.6; },
  },
  no_skill: {
    id: 'no_skill', name: '技能封印', desc: '本场不能用技能，只能普通弹射',
    apply: (b) => { b.noSkill = true; },
  },
  one_shot: {
    id: 'one_shot', name: '一箭定输赢', desc: '每回合只能弹射一次，伤害 ×3',
    apply: (b) => { b.oneShot = true; b.damageMul = (b.damageMul || 1) * 3; },
  },
  speed_rush: {
    id: 'speed_rush', name: '速度狂潮', desc: '双方行动条速度 ×1.7',
    apply: (b) => { b.atbMul = 1.7; },
  },
  no_heal: {
    id: 'no_heal', name: '断粮', desc: '所有治疗效果无效',
    apply: (b) => { b.noHeal = true; },
  },
  fragile: {
    id: 'fragile', name: '易碎课桌', desc: '地形耐久减半，破坏更快',
    apply: (b) => { b.terrainHpMul = 0.5; },
  },
};

export const MODIFIER_LIST = Object.values(MODIFIERS);

// 简单可复现的伪随机
function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function daySeed(d = new Date()) {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function weekSeed(d = new Date()) {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return d.getFullYear() * 100 + week;
}

const BOSS_IDS = ['jin', 'han', 'wu'];

// 生成每日 3 个挑战
export function getDailyChallenges(date = new Date()) {
  const rnd = seededRandom(daySeed(date));
  const modIds = Object.keys(MODIFIERS);
  const out = [];
  const used = new Set();
  for (let i = 0; i < 3; i++) {
    const bossId = BOSS_IDS[Math.floor(rnd() * BOSS_IDS.length)];
    let modId = modIds[Math.floor(rnd() * modIds.length)];
    let guard = 0;
    while (used.has(modId) && guard++ < 20) modId = modIds[Math.floor(rnd() * modIds.length)];
    used.add(modId);
    out.push({
      id: `daily_${daySeed(date)}_${i}`,
      kind: 'daily',
      bossId,
      difficulty: 'normal',
      modifiers: [modId],
      reward: { coins: 150 + i * 60, exp: 30 },
      label: `每日挑战 ${i + 1}`,
    });
  }
  return out;
}

// 生成每周挑战（1 个，双变体 + 高难）
export function getWeeklyChallenge(date = new Date()) {
  const rnd = seededRandom(weekSeed(date));
  const modIds = Object.keys(MODIFIERS);
  const bossId = BOSS_IDS[Math.floor(rnd() * BOSS_IDS.length)];
  const m1 = modIds[Math.floor(rnd() * modIds.length)];
  let m2 = modIds[Math.floor(rnd() * modIds.length)];
  let guard = 0;
  while (m2 === m1 && guard++ < 20) m2 = modIds[Math.floor(rnd() * modIds.length)];
  return {
    id: `weekly_${weekSeed(date)}`,
    kind: 'weekly',
    bossId,
    difficulty: 'hard',
    modifiers: [m1, m2],
    reward: { coins: 800, exp: 200 },
    label: '每周挑战',
  };
}

// 挑战进度 key（用于判断今天是否已完成）
export function challengeKey(ch) {
  return ch.id;
}
