// ============================================================
// data/skills.js — 技能池（12 条，单局最多带 6 个）
// type: single 单发 / multi 连发 / scatter 散射 / aoe 落点范围
//       tracking 追踪 / utility 无弹道（治疗类）
// effect: 命中后附加效果
// ============================================================

export const SKILLS = {
  // ===== 基础技能（开局直接可用）=====
  wall: {
    id: 'wall', name: '颜某某的墙', type: 'multi',
    ap: 2, cdMax: 5, baseDamage: 8, count: 3, interval: 0.15, spread: 0,
    desc: '3 连发，每发 8 伤',
    unlock: 'start', color: '#FF6B6B', icon: '墙', isTracking: false,
  },
  chalk: {
    id: 'chalk', name: '张某某的粉笔头', type: 'scatter',
    ap: 2, cdMax: 6, baseDamage: 6, count: 5, interval: 0, spread: 25,
    desc: '5 发扇形（±25°），每发 6 伤',
    unlock: 'start', color: '#FFE66D', icon: '粉', isTracking: false,
  },
  justice: {
    id: 'justice', name: '没有正义感', type: 'single',
    ap: 3, cdMax: 8, baseDamage: 45, count: 1, interval: 0, spread: 0,
    desc: '高伤单发，45 伤',
    unlock: 'start', color: '#556270', icon: '义', isTracking: false,
  },

  // ===== 随进度解锁 =====
  snack: {
    id: 'snack', name: '偷偷给零食', type: 'utility',
    ap: 2, cdMax: 6, baseDamage: 0,
    healRatio: 0.25, cleanse: true,
    desc: '回复 25% 最大生命，并清除自身所有负面状态',
    unlock: 'progress', unlockText: '通关金老师支线',
    unlockCond: { type: 'boss', id: 'jin' },
    color: '#8BC34A', icon: '零', isTracking: false,
  },
  lecture: {
    id: 'lecture', name: '你讲还是我讲', type: 'single',
    ap: 2, cdMax: 7, baseDamage: 10, effect: 'silence', effectTurns: 2,
    desc: '命中后目标沉默 2 回合（不能用技能）',
    unlock: 'progress', unlockText: '通关韩老师支线',
    unlockCond: { type: 'boss', id: 'han' },
    color: '#7B68EE', icon: '讲', isTracking: false,
  },
  swap: {
    id: 'swap', name: '上课换位', type: 'single',
    ap: 3, cdMax: 9, baseDamage: 8, effect: 'swap',
    desc: '命中后与目标交换站位',
    unlock: 'progress', unlockText: '通关吴老师支线',
    unlockCond: { type: 'boss', id: 'wu' },
    color: '#4ECDC4', icon: '位', isTracking: false,
  },
  kickout: {
    id: 'kickout', name: '被老师请出去', type: 'single',
    ap: 2, cdMax: 7, baseDamage: 15, effect: 'knockback', effectValue: 130,
    desc: '命中后把目标击退 130px，撞墙额外受伤',
    unlock: 'progress', unlockText: '角色等级达到 3 级',
    unlockCond: { type: 'level', value: 3 },
    color: '#FF9800', icon: '出', isTracking: false,
  },
  orange: {
    id: 'orange', name: '不知哪儿来的橘子', type: 'aoe',
    ap: 3, cdMax: 8, baseDamage: 30, aoeRadius: 120,
    desc: '落点 120 半径内造成 30 伤',
    unlock: 'progress', unlockText: '通关任意一条学科线',
    unlockCond: { type: 'subject', value: 1 },
    color: '#FFA726', icon: '橘', isTracking: false,
  },

  // ===== 碎片合成解锁 =====
  tomato: {
    id: 'tomato', name: '番茄炒蛋', type: 'single',
    ap: 2, cdMax: 7, baseDamage: 12, effect: 'dot', effectTurns: 3, effectValue: 12,
    desc: '命中后附加 3 回合灼烧，每回合 12 伤（可被杀虫剂清理）',
    unlock: 'fragment', fragments: 10,
    color: '#E8553A', icon: '番', isTracking: false,
  },
  detain: {
    id: 'detain', name: '老师留人', type: 'single',
    ap: 2, cdMax: 8, baseDamage: 8, effect: 'root', effectTurns: 2,
    desc: '命中后目标 2 回合无法移动（束缚）',
    unlock: 'fragment', fragments: 10,
    color: '#607D8B', icon: '留', isTracking: false,
  },
  judge: {
    id: 'judge', name: '老师断案', type: 'tracking',
    ap: 3, cdMax: 9, baseDamage: 35,
    ignoreWind: true, noSuperCrit: true,
    nearFull: 1.0, farMin: 0.5, falloffRange: 700,
    desc: '追踪目标，不受风向影响；距离越近伤害越高（100%~50%），不享受超暴击',
    unlock: 'fragment', fragments: 12,
    color: '#3F51B5', icon: '断', isTracking: true,
  },
  desk: {
    id: 'desk', name: '桌子', type: 'aoe',
    ap: 2, cdMax: 5, baseDamage: 0, aoeRadius: 0, effect: 'obstacle',
    desc: '在落点放置一张课桌障碍（可被摧毁）',
    unlock: 'fragment', fragments: 8,
    color: '#C89B6A', icon: '桌', isTracking: false,
  },
};

// 开局自带
export const PLAYER_SKILLS = ['wall', 'chalk', 'justice'];

// 单局最多携带
export const MAX_EQUIPPED_SKILLS = 6;

// 按解锁方式分组
export const SKILL_POOLS = {
  start: Object.values(SKILLS).filter(s => s.unlock === 'start').map(s => s.id),
  progress: Object.values(SKILLS).filter(s => s.unlock === 'progress').map(s => s.id),
  fragment: Object.values(SKILLS).filter(s => s.unlock === 'fragment').map(s => s.id),
};

export function getSkill(id) {
  return SKILLS[id] || null;
}

// 技能实际伤害（含等级加成）
export function skillDamage(skill, level = 1) {
  const base = skill.baseDamage || 0;
  return Math.round(base * (1 + (level - 1) * 0.18));
}
