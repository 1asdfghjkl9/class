// ============================================================
// data/items.js — 道具池（10 条，每关开始自动补齐，一次性使用）
// 可升 1-5 级（风筝除外，固定效果不升级）
// ============================================================

export const ITEMS = {
  kite: {
    id: 'kite', name: '风筝', ap: 2,
    type: 'displace', distance: 180, upgradable: false,
    desc: '向瞄准方向位移 180px（固定效果，不升级）',
    color: '#29B6F6', icon: '筝',
  },
  leave: {
    id: 'leave', name: '请假', ap: 2,
    type: 'stealth', duration: 1, value: 0.50, upgradable: true,
    desc: '隐身 1 回合，期间受到伤害 -50%',
    color: '#4ECDC4', icon: '假',
  },
  no_leave: {
    id: 'no_leave', name: '不批假', ap: 3,
    type: 'lock_single', duration: 1, upgradable: true,
    desc: '锁定单个敌方目标 1 回合（不能行动）',
    color: '#7E57C2', icon: '批',
  },
  none_leave: {
    id: 'none_leave', name: '都不批', ap: 5,
    type: 'lock_all', duration: 1, upgradable: true,
    desc: '锁定场上所有敌方目标 1 回合',
    color: '#5E35B1', icon: '都',
  },
  not_our_class: {
    id: 'not_our_class', name: '不是我们班', ap: 3,
    type: 'shield', duration: 2, value: 0.40, upgradable: true,
    desc: '守护盾：受到伤害 -40%，持续 2 回合',
    color: '#4169E1', icon: '班',
  },
  unknown_report: {
    id: 'unknown_report', name: '不知道成绩的成绩单', ap: 2,
    type: 'gamble', healRatio: 0.30, penalty: 0.25, chance: 0.5, upgradable: true,
    desc: '50% 概率回复 30% 生命；否则受到伤害 +25%（2 回合）',
    color: '#9E9E9E', icon: '绩',
  },
  not_me: {
    id: 'not_me', name: '不是我', ap: 4,
    type: 'reflect', duration: 2, value: 0.45, upgradable: true,
    desc: '反射盾：受到伤害的 45% 反弹给攻击者，持续 2 回合',
    color: '#FF7043', icon: '我',
  },
  what_doing: {
    id: 'what_doing', name: '你干嘛', ap: 1,
    type: 'rage', value: 35, upgradable: true,
    desc: '怒气 +35（大招条）',
    color: '#FF4500', icon: '干',
  },
  teacher_snack: {
    id: 'teacher_snack', name: '老师奖励的零食', ap: 3,
    type: 'heal_single', healRatio: 0.30, upgradable: true,
    desc: '回复 30% 最大生命',
    color: '#8BC34A', icon: '食',
  },
  teacher_class: {
    id: 'teacher_class', name: '老师奖励全班', ap: 5,
    type: 'heal_group', healRatio: 0.45, cleanse: true, upgradable: true,
    desc: '回复 45% 最大生命，并清除所有负面状态',
    color: '#66BB6A', icon: '班',
  },
};

export const ITEM_POOL = Object.keys(ITEMS);

// 每关开始自动补齐的道具数量
export const ITEMS_PER_BATTLE = 4;

export function getItem(id) {
  return ITEMS[id] || null;
}

// 道具实际效果倍率（含等级）
export function itemEffectMul(item, level = 1) {
  if (!item || item.upgradable === false) return 1;
  return 1 + (level - 1) * 0.20;
}
