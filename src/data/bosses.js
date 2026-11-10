// ============================================================
// data/bosses.js — 三个 Boss 配置
// ============================================================

// ===== 金老师（班主任）=====
export const BOSS_JIN = {
  id: 'jin',
  name: '金老师',
  title: '班主任',
  hp: 340,
  speed: 18,
  dr: 0.10,
  patrolMin: 850,
  patrolMax: 1150,
  patrolSpeed: 38,
  radius: 36,
  enrageThreshold: 0.20,
  rollCallInterval: 3,
  dragClassInterval: 2,
  weakpoints: [
    { id: 'penbag', name: '绿色笔袋', hp: 30, offsetX: -8, offsetY: 16, radius: 16, color: '#4CAF50', breakEffect: 'no_drag' },
    { id: 'book', name: '大富贵英语书', hp: 40, offsetX: -34, offsetY: -24, radius: 18, color: '#FFD700', breakEffect: 'no_rollcall' },
  ],
  quotes: {
    intro: '我看你是唯恐天下不乱。',
    rollCall: '你，站起来回答一下。',
    dragClass: '这道题讲完再下课。',
    enrage: '行，那我叫你家长来一趟。',
  },
  aimError: 40,
  shotBaseDamage: 14,
  shotSpeed: 600,
  color: '#FF6B6B',
};

// ===== 韩老师（大力女皇）=====
export const BOSS_HAN = {
  id: 'han',
  name: '韩老师',
  title: '大力女皇',
  hp: 320,
  speed: 19,
  dr: 0.08,
  // 小范围晃动
  swayRange: 60,
  swaySpeed: 20,
  homeX: 1050,
  radius: 36,
  rageThreshold: 0.50,     // 半血触发题海
  quizInterval: 2,         // 口答间隔（回合）
  quizTimer: 5,            // 口答限时（秒）
  quizTimerBroken: 8,      // 打掉计时器后
  paperCount: 6,           // 题海试卷数
  aimError: 35,
  shotBaseDamage: 13,
  shotSpeed: 620,
  color: '#E91E63',
  weakpoints: [
    { id: 'papers', name: '一沓试卷', hp: 35, offsetX: -36, offsetY: 8, radius: 16, color: '#E0E0E0', breakEffect: 'quiz_interval_up' },
    { id: 'timer', name: '肩上计时器', hp: 30, offsetX: -14, offsetY: -34, radius: 14, color: '#FF9800', breakEffect: 'quiz_timer_up' },
  ],
  quotes: {
    intro: '口答！',
    quizWrong: '因为你还没有经历过300道题的锤炼。',
    rage: '来，300道，现在开始。',
    defeatPlayer: '下课来办公室。',
  },
};

// ===== 吴老师 =====
export const BOSS_WU = {
  id: 'wu',
  name: '吴老师',
  title: '纪律主任',
  hp: 300,
  speed: 20,
  dr: 0.12,
  homeX: 1050,
  radius: 34,
  homeworkInterval: 2,      // 禁写作业间隔
  disciplineInterval: 3,    // 纪律检查间隔
  disciplineIntervalBroken: 5,
  disciplineDuration: 3,    // 纪律检查持续秒数
  disciplineDamage: 30,     // 违规伤害
  aimError: 30,
  shotBaseDamage: 12,
  shotSpeed: 640,
  color: '#7B68EE',
  weakpoints: [
    { id: 'pointer', name: '教鞭', hp: 30, offsetX: -28, offsetY: -22, radius: 15, color: '#8BC34A', breakEffect: 'discipline_interval_up' },
    { id: 'homework_stack', name: '作业本堆', hp: 40, offsetX: -38, offsetY: 14, radius: 17, color: '#42A5F5', breakEffect: 'no_homework' },
  ],
  quotes: {
    intro: '在我的课上不允许有人写作业！',
    discipline: '手都放桌上，我看看谁在动。',
    confiscate: '这本，我没收了。',
    lowHp: '你们这届，是我带过最差的一届。',
  },
};

// ===== 小怪（金老师叫家长召唤）=====
export const MINION = {
  hp: 40,
  radius: 24,
  speed: 15,
  dr: 0,
  shotDamage: 15,
  shotSpeed: 500,
};

// ===== Boss 注册表 =====
export const BOSSES = {
  jin: BOSS_JIN,
  han: BOSS_HAN,
  wu: BOSS_WU,
};
