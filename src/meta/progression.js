// ============================================================
// meta/progression.js — 解锁判定（技能 / 学科线关卡 / 学科徽章）
// ============================================================

import { SKILLS } from '../data/skills.js';
import { SUBJECTS, SUBJECT_ORDER, isSubjectCleared, countClearedSubjects } from '../data/subjects.js';
import { unlockSkill } from '../save.js';

// 检查所有"随进度解锁"的技能
export function refreshSkillUnlocks(save) {
  const newly = [];
  for (const id in SKILLS) {
    const sk = SKILLS[id];
    if (sk.unlock !== 'progress') continue;
    if (save.skillsUnlocked[id]) continue;
    if (checkUnlockCond(save, sk.unlockCond)) {
      unlockSkill(save, id);
      newly.push(sk);
    }
  }
  return newly;
}

function checkUnlockCond(save, cond) {
  if (!cond) return false;
  if (cond.type === 'boss') return save.progress.bosses[cond.id] === 1;
  if (cond.type === 'level') return (save.level || 1) >= cond.value;
  if (cond.type === 'subject') return countClearedSubjects(save) >= cond.value;
  return false;
}

// 学科线关卡是否解锁：第一关永远开，之后要前一关通关
export function isStageUnlocked(save, subjectId, index) {
  if (index === 0) return true;
  const sub = SUBJECTS[subjectId];
  if (!sub) return false;
  const prev = sub.stages[index - 1];
  return save.progress.stages[prev.id] === 1;
}

// 学科线是否全通
export function isSubjectDone(save, subjectId) {
  return isSubjectCleared(save, subjectId);
}

// 战斗胜利后统一结算进度
export function onBattleWin(save, opts) {
  const { bossId, stageId, subjectId, difficulty, reward } = opts;

  if (bossId && !stageId) {
    save.progress.bosses[bossId] = 1;
  }
  if (stageId) {
    save.progress.stages[stageId] = 1;
  }
  // 学科徽章
  if (subjectId) {
    if (isSubjectCleared(save, subjectId)) {
      save.progress.subjectBadges[subjectId] = 1;
    }
  }

  if (difficulty === 'nightmare') {
    save.stats.nightmareWins = (save.stats.nightmareWins || 0) + 1;
  }

  // 奖励
  if (reward) {
    save.coins += reward.coins || 0;
    save.stats.totalCoinsEarned = (save.stats.totalCoinsEarned || 0) + (reward.coins || 0);
  }

  return refreshSkillUnlocks(save);
}

// 判断 Boss 支线是否全部通关
export function allBossesCleared(save) {
  return SUBJECT_ORDER.length > 0 &&
    save.progress.bosses.jin === 1 &&
    save.progress.bosses.han === 1 &&
    save.progress.bosses.wu === 1;
}

// 学科线通关数
export function subjectProgress(save, subjectId) {
  const sub = SUBJECTS[subjectId];
  if (!sub) return { done: 0, total: 0 };
  const done = sub.stages.filter(st => save.progress.stages[st.id] === 1).length;
  return { done, total: sub.stages.length };
}
