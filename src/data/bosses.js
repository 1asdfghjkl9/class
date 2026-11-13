// ============================================================
// data/bosses.js — Boss + 学科线学生敌人配置（v3，数值×100）
// ============================================================

// ===== 金老师 =====
export const BOSS_JIN = {
  id: 'jin',
  name: '金老师',
  title: '班主任',
  hp: 34000,
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
    { id: 'penbag', name: '绿色笔袋', hp: 3000, offsetX: -8, offsetY: 16, radius: 16, color: '#4CAF50', breakEffect: 'no_drag' },
    { id: 'book', name: '大富贵英语书', hp: 4000, offsetX: -34, offsetY: -24, radius: 18, color: '#FFD700', breakEffect: 'no_rollcall' },
  ],
  quotes: {
    intro: '我看你是唯恐天下不乱。',
    rollCall: '你，站起来回答一下。',
    dragClass: '这道题讲完再下课。',
    enrage: '行，那我叫你家长来一趟。',
  },
  aimError: 40,
  shotBaseDamage: 1400,
  shotSpeed: 600,
  color: '#FF6B6B',
};

// ===== 韩老师 =====
export const BOSS_HAN = {
  id: 'han',
  name: '韩老师',
  title: '大力女皇',
  hp: 32000,
  speed: 19,
  dr: 0.08,
  swayRange: 60,
  swaySpeed: 20,
  homeX: 1050,
  radius: 36,
  rageThreshold: 0.50,
  quizInterval: 2,
  quizTimer: 5,
  quizTimerBroken: 8,
  paperCount: 6,
  aimError: 35,
  shotBaseDamage: 1300,
  shotSpeed: 620,
  color: '#E91E63',
  weakpoints: [
    { id: 'papers', name: '一沓试卷', hp: 3500, offsetX: -36, offsetY: 8, radius: 16, color: '#E0E0E0', breakEffect: 'quiz_interval_up' },
    { id: 'timer', name: '肩上计时器', hp: 3000, offsetX: -14, offsetY: -34, radius: 14, color: '#FF9800', breakEffect: 'quiz_timer_up' },
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
  hp: 30000,
  speed: 20,
  dr: 0.12,
  homeX: 1050,
  radius: 34,
  homeworkInterval: 2,
  disciplineInterval: 3,
  disciplineIntervalBroken: 5,
  disciplineDuration: 3,
  disciplineDamage: 3000,
  aimError: 30,
  shotBaseDamage: 1200,
  shotSpeed: 640,
  color: '#7B68EE',
  weakpoints: [
    { id: 'pointer', name: '教鞭', hp: 3000, offsetX: -28, offsetY: -22, radius: 15, color: '#8BC34A', breakEffect: 'discipline_interval_up' },
    { id: 'homework_stack', name: '作业本堆', hp: 4000, offsetX: -38, offsetY: 14, radius: 17, color: '#42A5F5', breakEffect: 'no_homework' },
  ],
  quotes: {
    intro: '在我的课上不允许有人写作业！',
    discipline: '手都放桌上，我看看谁在动。',
    confiscate: '这本，我没收了。',
    lowHp: '你们这届，是我带过最差的一届。',
  },
};

// ===== 丁老师（美术支线 Boss）=====
export const BOSS_DING = {
  id: 'ding',
  name: '丁老师',
  title: '色彩暴君',
  hp: 30000,
  speed: 21,
  dr: 0.08,
  patrolMin: 850,
  patrolMax: 1150,
  patrolSpeed: 42,
  radius: 34,
  enrageThreshold: 0.25,
  weakpoints: [
    { id: 'palette', name: '调色盘', hp: 2800, offsetX: -8, offsetY: 16, radius: 16, color: '#FF6B6B', breakEffect: 'no_drag' },
    { id: 'brush', name: '大号画笔', hp: 3600, offsetX: -34, offsetY: -24, radius: 18, color: '#8BC34A', breakEffect: 'no_rollcall' },
  ],
  quotes: {
    intro: '今天画静物写生，谁画不好重画一百遍。',
    enrage: '你给我出去，对着走廊画！',
  },
  aimError: 32,
  shotBaseDamage: 1300,
  shotSpeed: 620,
  color: '#FF9800',
};

// ===== 黄老师（体育支线 Boss）=====
export const BOSS_HUANG = {
  id: 'huang',
  name: '黄老师',
  title: '体能魔王',
  hp: 36000,
  speed: 24,
  dr: 0.15,
  homeX: 1050,
  swayRange: 80,
  swaySpeed: 28,
  radius: 38,
  rageThreshold: 0.45,
  aimError: 28,
  shotBaseDamage: 1600,
  shotSpeed: 680,
  color: '#4CAF50',
  weakpoints: [
    { id: 'whistle', name: '银哨子', hp: 3000, offsetX: -36, offsetY: 8, radius: 14, color: '#C0C0C0', breakEffect: 'quiz_interval_up' },
    { id: 'stopwatch', name: '秒表', hp: 3000, offsetX: -14, offsetY: -34, radius: 14, color: '#FF9800', breakEffect: 'quiz_timer_up' },
  ],
  quotes: {
    intro: '全班跑十圈，跑不完的留下来！',
    rage: '再加五圈，现在开始！',
    defeatPlayer: '下节课补测。',
  },
};

// ===== 小怪 =====
export const MINION = {
  hp: 4000,
  radius: 24,
  speed: 15,
  dr: 0,
  shotDamage: 1500,
  shotSpeed: 500,
};

// ===== 学科线学生敌人（数值×100）=====
export const STUDENT_ENEMIES = {
  // 体育线
  pe1: { id: 'pe1', name: '马铭喆', hp: 10000, shotType: 'lob', skillPref: 'heavy', aimError: 38, shotBaseDamage: 1800, shotSpeed: 580, color: '#66BB6A', radius: 30, speed: 20, homeX: 1100, dr: 0.05 },
  pe2: { id: 'pe2', name: '武睿晞', hp: 11000, shotType: 'lob', skillPref: 'annoy', aimError: 35, shotBaseDamage: 1400, shotSpeed: 600, color: '#42A5F5', radius: 30, speed: 22, homeX: 1100, dr: 0.05 },
  pe3: { id: 'pe3', name: '张书格', hp: 12000, shotType: 'flat', skillPref: 'heavy', aimError: 32, shotBaseDamage: 1600, shotSpeed: 640, color: '#FFA726', radius: 30, speed: 20, homeX: 1100, dr: 0.06 },
  pe4: { id: 'pe4', name: '谭梓峻', hp: 10000, shotType: 'lob', skillPref: 'heavy', aimError: 36, shotBaseDamage: 1700, shotSpeed: 590, color: '#EF5350', radius: 30, speed: 21, homeX: 1100, dr: 0.05 },
  pe5: { id: 'pe5', name: '封佳琪', hp: 14000, shotType: 'flat', skillPref: 'scatter', aimError: 30, shotBaseDamage: 1400, shotSpeed: 660, color: '#AB47BC', radius: 32, speed: 23, homeX: 1100, dr: 0.08 },

  // 语文线
  cn1: { id: 'cn1', name: '盛丽文', hp: 10000, shotType: 'flat', skillPref: 'heavy', aimError: 36, shotBaseDamage: 1700, shotSpeed: 600, color: '#8D6E63', radius: 30, speed: 18, homeX: 1100, dr: 0.05, stealthCharges: 3 }, // 盛丽文3次隐身
  cn2: { id: 'cn2', name: '叶辰希', hp: 11000, shotType: 'lob', skillPref: 'rapid', aimError: 32, shotBaseDamage: 1200, shotSpeed: 580, color: '#5C6BC0', radius: 30, speed: 20, homeX: 1100, dr: 0.05 },
  cn3: { id: 'cn3', name: '徐紫菡', hp: 13000, shotType: 'flat', skillPref: 'heavy', aimError: 28, shotBaseDamage: 1800, shotSpeed: 640, color: '#EC407A', radius: 32, speed: 19, homeX: 1100, dr: 0.08, isRep: true },

  // 美术线
  art1: { id: 'art1', name: '武睿晞', hp: 11000, shotType: 'flat', skillPref: 'rapid', aimError: 33, shotBaseDamage: 1300, shotSpeed: 620, color: '#42A5F5', radius: 30, speed: 22, homeX: 1100, dr: 0.05 },
  art2: { id: 'art2', name: '张书格', hp: 12000, shotType: 'flat', skillPref: 'rapid', aimError: 30, shotBaseDamage: 1400, shotSpeed: 640, color: '#FFA726', radius: 30, speed: 20, homeX: 1100, dr: 0.06 },
  art3: { id: 'art3', name: '李为先', hp: 13000, shotType: 'lob', skillPref: 'rapid', aimError: 22, shotBaseDamage: 1500, shotSpeed: 600, color: '#26A69A', radius: 32, speed: 21, homeX: 1100, dr: 0.08, isRep: true },
  art4: { id: 'art4', name: '朱婉宁·残影', hp: 8000, shotType: 'lob', skillPref: 'annoy', aimError: 30, shotBaseDamage: 1000, shotSpeed: 560, color: '#9E9E9E', radius: 30, speed: 18, homeX: 1100, dr: 0.03, isPhantom: true },
  art5: { id: 'art5', name: '朱婉宁·真身', hp: 18000, shotType: 'flat', skillPref: 'heavy', aimError: 24, shotBaseDamage: 2000, shotSpeed: 680, color: '#7B1FA2', radius: 34, speed: 22, homeX: 1100, dr: 0.12, isTrueForm: true },

  // 数学线
  ma1: { id: 'ma1', name: '张书格', hp: 12000, shotType: 'flat', skillPref: 'rapid', aimError: 32, shotBaseDamage: 1400, shotSpeed: 640, color: '#FFA726', radius: 30, speed: 20, homeX: 1100, dr: 0.06 },
  ma2a: { id: 'ma2a', name: '徐子森', hp: 10000, shotType: 'flat', skillPref: 'rapid', aimError: 30, shotBaseDamage: 1300, shotSpeed: 640, color: '#7986CB', radius: 28, speed: 21, homeX: 1000, dr: 0.05, isTwin: true, twinId: 'ma2b' },
  ma2b: { id: 'ma2b', name: '李清逸', hp: 10000, shotType: 'lob', skillPref: 'heal', aimError: 34, shotBaseDamage: 1100, shotSpeed: 580, color: '#AED581', radius: 28, speed: 20, homeX: 1200, dr: 0.05, isTwin: true },
  ma3: { id: 'ma3', name: '李为先', hp: 13000, shotType: 'lob', skillPref: 'rapid', aimError: 22, shotBaseDamage: 1500, shotSpeed: 600, color: '#26A69A', radius: 32, speed: 21, homeX: 1100, dr: 0.08 },
  ma4: { id: 'ma4', name: '吴谦祥', hp: 13000, shotType: 'flat', skillPref: 'scatter', aimError: 28, shotBaseDamage: 1500, shotSpeed: 650, color: '#789262', radius: 32, speed: 20, homeX: 1100, dr: 0.08 },

  // 英语线
  en1: { id: 'en1', name: '吴谦祥', hp: 13000, shotType: 'flat', skillPref: 'scatter', aimError: 28, shotBaseDamage: 1500, shotSpeed: 650, color: '#789262', radius: 32, speed: 20, homeX: 1100, dr: 0.08 },
  en2: { id: 'en2', name: '封佳琪', hp: 14000, shotType: 'flat', skillPref: 'scatter', aimError: 30, shotBaseDamage: 1400, shotSpeed: 660, color: '#AB47BC', radius: 32, speed: 23, homeX: 1100, dr: 0.08 },
  en3: { id: 'en3', name: '李为先', hp: 13000, shotType: 'lob', skillPref: 'rapid', aimError: 22, shotBaseDamage: 1500, shotSpeed: 600, color: '#26A69A', radius: 32, speed: 21, homeX: 1100, dr: 0.08 },
  en4a: { id: 'en4a', name: '叶辰希', hp: 11000, shotType: 'lob', skillPref: 'rapid', aimError: 30, shotBaseDamage: 1200, shotSpeed: 580, color: '#5C6BC0', radius: 30, speed: 20, homeX: 1000, dr: 0.05, isTwin: true, twinId: 'en4b' },
  en4b: { id: 'en4b', name: '陈玥菱', hp: 11000, shotType: 'lob', skillPref: 'heavy', aimError: 32, shotBaseDamage: 1600, shotSpeed: 580, color: '#F48FB1', radius: 30, speed: 20, homeX: 1200, dr: 0.05, isTwin: true },
};

// ===== Boss 注册表 =====
export const BOSSES = {
  jin: BOSS_JIN,
  han: BOSS_HAN,
  wu: BOSS_WU,
  ding: BOSS_DING,
  huang: BOSS_HUANG,
  ...STUDENT_ENEMIES,
};
