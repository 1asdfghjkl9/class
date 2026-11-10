// ============================================================
// data/achievements.js — 成就系统
// 达成条件给金币 + 称号，称号显示在玩家名旁
// ============================================================

export const ACHIEVEMENTS = {
  first_blood: {
    id: 'first_blood', name: '第一次举手', title: '新人',
    desc: '赢得第一场战斗', coins: 100,
    check: (s) => (s.stats.totalWins || 0) >= 1,
  },
  jin_clear: {
    id: 'jin_clear', name: '班主任也拦不住', title: '刺头',
    desc: '通关金老师支线', coins: 200,
    check: (s) => s.progress.bosses.jin === 1,
  },
  han_clear: {
    id: 'han_clear', name: '口答满分', title: '学霸',
    desc: '通关韩老师支线', coins: 200,
    check: (s) => s.progress.bosses.han === 1,
  },
  wu_clear: {
    id: 'wu_clear', name: '纪律标兵', title: '老油条',
    desc: '通关吴老师支线', coins: 200,
    check: (s) => s.progress.bosses.wu === 1,
  },
  crit_10: {
    id: 'crit_10', name: '手感来了', title: '',
    desc: '累计触发 10 次超暴击', coins: 120,
    check: (s) => (s.stats.superCrits || 0) >= 10,
  },
  crit_50: {
    id: 'crit_50', name: '角度大师', title: '吊射王',
    desc: '累计触发 50 次超暴击', coins: 300,
    check: (s) => (s.stats.superCrits || 0) >= 50,
  },
  crit_100: {
    id: 'crit_100', name: '抛物线之神', title: '物理课代表',
    desc: '累计触发 100 次超暴击', coins: 600,
    check: (s) => (s.stats.superCrits || 0) >= 100,
  },
  weakpoint_all: {
    id: 'weakpoint_all', name: '拆件专家', title: '拆解工',
    desc: '单场打掉 2 个弱点', coins: 150,
    check: (s) => (s.stats.maxWeakpointsOneBattle || 0) >= 2,
  },
  no_damage: {
    id: 'no_damage', name: '毫发无伤', title: '影子',
    desc: '满血通关任意一场战斗', coins: 400,
    check: (s) => (s.stats.noDamageWins || 0) >= 1,
  },
  big_hit: {
    id: 'big_hit', name: '一击必杀', title: '',
    desc: '单发造成 100 以上伤害', coins: 250,
    check: (s) => (s.stats.maxSingleHit || 0) >= 100,
  },
  weapon_3: {
    id: 'weapon_3', name: '武器收藏家', title: '收藏家',
    desc: '拥有 3 把不同的武器', coins: 300,
    check: (s) => Object.keys(s.weapons.owned || {}).length >= 3,
  },
  weapon_all: {
    id: 'weapon_all', name: '军火库', title: '军火商',
    desc: '集齐全部 6 把武器', coins: 800,
    check: (s) => Object.keys(s.weapons.owned || {}).length >= 6,
  },
  skill_max: {
    id: 'skill_max', name: '一门深入', title: '',
    desc: '把任意技能升到 5 级', coins: 350,
    check: (s) => Object.values(s.skillLevels || {}).some(v => v >= 5),
  },
  skill_all: {
    id: 'skill_all', name: '全能选手', title: '六边形战士',
    desc: '解锁全部 12 个技能', coins: 900,
    check: (s) => Object.keys(s.skillsUnlocked || {}).length >= 12,
  },
  chinese_clear: {
    id: 'chinese_clear', name: '语文通关', title: '语文课代表',
    desc: '通关语文线全部关卡', coins: 400,
    check: (s) => s.progress.subjectBadges?.chinese === 1,
  },
  math_clear: {
    id: 'math_clear', name: '数学通关', title: '数学课代表',
    desc: '通关数学线全部关卡', coins: 400,
    check: (s) => s.progress.subjectBadges?.math === 1,
  },
  english_clear: {
    id: 'english_clear', name: '英语通关', title: '英语课代表',
    desc: '通关英语线全部关卡', coins: 400,
    check: (s) => s.progress.subjectBadges?.english === 1,
  },
  nightmare_clear: {
    id: 'nightmare_clear', name: '噩梦幸存者', title: '噩梦',
    desc: '在噩梦难度下赢一场', coins: 500,
    check: (s) => (s.stats.nightmareWins || 0) >= 1,
  },
  level_10: {
    id: 'level_10', name: '十级选手', title: '',
    desc: '角色等级达到 10 级', coins: 300,
    check: (s) => (s.level || 1) >= 10,
  },
  daily_5: {
    id: 'daily_5', name: '全勤奖', title: '全勤',
    desc: '完成 5 次每日挑战', coins: 400,
    check: (s) => (s.stats.dailyClears || 0) >= 5,
  },
  rich: {
    id: 'rich', name: '小富即安', title: '',
    desc: '累计获得 5000 金币', coins: 500,
    check: (s) => (s.stats.totalCoinsEarned || 0) >= 5000,
  },
};

export const ACHIEVEMENT_LIST = Object.values(ACHIEVEMENTS);

// 检查并返回本次新解锁的成就
export function checkAchievements(save) {
  const newly = [];
  for (const a of ACHIEVEMENT_LIST) {
    if (save.achievements.unlocked[a.id]) continue;
    let ok = false;
    try { ok = !!a.check(save); } catch (e) { ok = false; }
    if (ok) {
      save.achievements.unlocked[a.id] = Date.now();
      save.coins += a.coins;
      save.stats.totalCoinsEarned = (save.stats.totalCoinsEarned || 0) + a.coins;
      newly.push(a);
    }
  }
  return newly;
}
