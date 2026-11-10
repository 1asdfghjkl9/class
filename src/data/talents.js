// ============================================================
// data/talents.js — 天赋三系（内卷 / 摸鱼 / 均衡）
// 规则：每系点满一层才能点下一层；洗点需"转班申请单"
// ============================================================

export const TALENT_TREES = {
  grind: {
    id: 'grind',
    name: '内卷',
    subtitle: '进攻',
    color: '#FF6B6B',
    icon: '卷',
    desc: '把分数堆到别人绝望',
    tiers: [
      { id: 'grind_1', name: '刷题到深夜', desc: '弹射伤害 +8%',   effect: { dmgPct: 8 } },
      { id: 'grind_2', name: '错题本背三遍', desc: '暴击率 +6%',    effect: { critPct: 6 } },
      { id: 'grind_3', name: '提前学完下学期', desc: '技能伤害 +12%', effect: { skillDmgPct: 12 } },
      { id: 'grind_4', name: '压轴题专攻', desc: '超暴击伤害 +25%', effect: { superCritMul: 25 } },
      { id: 'grind_5', name: '年级第一', desc: '弱点伤害 +30%',    effect: { weakpointPct: 30 } },
    ],
  },
  slack: {
    id: 'slack',
    name: '摸鱼',
    subtitle: '防守 / 生存',
    color: '#4ECDC4',
    icon: '鱼',
    desc: '活得久才刷得到分',
    tiers: [
      { id: 'slack_1', name: '课桌底下看小说', desc: '最大生命 +20',  effect: { maxHp: 20 } },
      { id: 'slack_2', name: '老师看不见我', desc: '受到伤害 -8%',     effect: { drPct: 8 } },
      { id: 'slack_3', name: '课间补觉', desc: '每回合回复 3 生命',    effect: { regen: 3 } },
      { id: 'slack_4', name: '厚脸皮', desc: '护盾效果 +25%',          effect: { shieldPct: 25 } },
      { id: 'slack_5', name: '家长签字模仿大师', desc: '濒死时回复 30% 生命（每场一次）', effect: { revive: 30 } },
    ],
  },
  balance: {
    id: 'balance',
    name: '均衡',
    subtitle: '战术',
    color: '#FFD700',
    icon: '衡',
    desc: '节奏掌握在自己手里',
    tiers: [
      { id: 'balance_1', name: '作业抄得刚刚好', desc: '行动力上限 +1', effect: { apMax: 1 } },
      { id: 'balance_2', name: '踩点进教室', desc: '每回合行动力 +1',    effect: { apPerTurn: 1 } },
      { id: 'balance_3', name: '临时抱佛脚', desc: '技能冷却 -1',        effect: { cdReduce: 1 } },
      { id: 'balance_4', name: '老师面前刷存在', desc: '怒气获取 +25%',  effect: { ragePct: 25 } },
      { id: 'balance_5', name: '人缘好', desc: '道具效果 +30%',          effect: { itemPct: 30 } },
    ],
  },
};

export const TALENT_ORDER = ['grind', 'slack', 'balance'];

// 某系已点层数
export function tierSpent(save, treeId) {
  const tree = TALENT_TREES[treeId];
  if (!tree) return 0;
  let n = 0;
  for (const t of tree.tiers) if (save.talents.spent[t.id]) n++;
  return n;
}

// 是否可点该层：前面的层都要点满
export function canUnlockTier(save, treeId, tierIndex) {
  if (save.talents.points <= 0) return false;
  if (tierIndex > 0) {
    const tree = TALENT_TREES[treeId];
    const prev = tree.tiers[tierIndex - 1];
    if (!save.talents.spent[prev.id]) return false;
  }
  return !save.talents.spent[TALENT_TREES[treeId].tiers[tierIndex].id];
}

// 汇总所有已点天赋的加成
export function aggregateTalents(save) {
  const out = {
    dmgPct: 0, critPct: 0, skillDmgPct: 0, superCritMul: 0, weakpointPct: 0,
    maxHp: 0, drPct: 0, regen: 0, shieldPct: 0, revive: 0,
    apMax: 0, apPerTurn: 0, cdReduce: 0, ragePct: 0, itemPct: 0,
  };
  for (const tid of TALENT_ORDER) {
    const tree = TALENT_TREES[tid];
    for (const t of tree.tiers) {
      if (!save.talents.spent[t.id]) continue;
      for (const k in t.effect) {
        out[k] = (out[k] || 0) + t.effect[k];
      }
    }
  }
  return out;
}

export function totalSpentPoints(save) {
  return TALENT_ORDER.reduce((n, tid) => n + tierSpent(save, tid), 0);
}
