// ============================================================
// data/subjects.js — 学科线（语文 → 数学 → 英语）
// 每条线：3 个突出人物 + 课代表（放最后）；英语线课代表为双胞胎双目标
// ============================================================

// 通用学生模板：纯战斗关卡，机制较简单
function student(o) {
  return {
    kind: 'student',
    radius: 32,
    dr: 0.05,
    speed: 18,
    aimError: 45,
    shotSpeed: 600,
    homeX: 1050,
    patrolMin: 900,
    patrolMax: 1150,
    patrolSpeed: 30,
    shotBaseDamage: 10,
    mechanics: [],
    weakpoints: [],
    ...o,
  };
}

export const SUBJECTS = {
  chinese: {
    id: 'chinese',
    name: '语文线',
    color: '#E57373',
    badge: '语文徽章',
    desc: '背书、作文、文言文，一路打过去',
    stages: [
      student({
        id: 'chinese_1', name: '郑小雨', title: '背诵狂魔', nickname: '复读机',
        hp: 130, color: '#EF9A9A', shotBaseDamage: 9,
        quote: '再背一遍，从头开始。',
        weakpoints: [{ id: 'recite_book', name: '语文书', hp: 22, offsetX: -30, offsetY: -20, radius: 14, color: '#FFCDD2', breakEffect: 'none' }],
        mechanics: [],
        reward: { coins: 60, exp: 20 },
      }),
      student({
        id: 'chinese_2', name: '苏文轩', title: '作文天才', nickname: '八百字',
        hp: 150, color: '#E57373', shotBaseDamage: 10,
        quote: '字数不够，重写。',
        weakpoints: [{ id: 'draft', name: '作文草稿', hp: 26, offsetX: -34, offsetY: 10, radius: 15, color: '#FFF9C4', breakEffect: 'none' }],
        mechanics: ['buff_low_hp'],
        reward: { coins: 70, exp: 25 },
      }),
      student({
        id: 'chinese_3', name: '陈墨', title: '古文刺客', nickname: '之乎者也',
        hp: 170, color: '#C62828', shotBaseDamage: 11,
        quote: '之乎者也，你懂几个？',
        weakpoints: [{ id: 'classic_book', name: '文言文注解', hp: 30, offsetX: -30, offsetY: -24, radius: 15, color: '#8D6E63', breakEffect: 'none' }],
        mechanics: ['silence_shot'],
        reward: { coins: 85, exp: 30 },
      }),
      student({
        id: 'chinese_rep', name: '林清和', title: '语文课代表', nickname: '默写本',
        hp: 280, color: '#B71C1C', shotBaseDamage: 14, radius: 34,
        quote: '全对，下一个。',
        weakpoints: [
          { id: 'dictation', name: '默写本', hp: 40, offsetX: -36, offsetY: 12, radius: 17, color: '#FFCDD2', breakEffect: 'none' },
          { id: 'red_pen', name: '红笔', hp: 32, offsetX: -28, offsetY: -26, radius: 14, color: '#D32F2F', breakEffect: 'none' },
        ],
        mechanics: ['silence_shot', 'buff_low_hp'],
        isRep: true,
        reward: { coins: 200, exp: 80 },
      }),
    ],
  },

  math: {
    id: 'math',
    name: '数学线',
    color: '#64B5F6',
    badge: '数学徽章',
    desc: '心算、几何、函数，全是硬仗',
    stages: [
      student({
        id: 'math_1', name: '王大锤', title: '计算器', nickname: '心算',
        hp: 135, color: '#90CAF9', shotBaseDamage: 10,
        quote: '这题我口算。',
        weakpoints: [{ id: 'calc', name: '计算器', hp: 24, offsetX: -32, offsetY: -18, radius: 14, color: '#BBDEFB', breakEffect: 'none' }],
        mechanics: [],
        reward: { coins: 60, exp: 20 },
      }),
      student({
        id: 'math_2', name: '李方圆', title: '几何杀手', nickname: '圆规',
        hp: 155, color: '#42A5F5', shotBaseDamage: 11,
        quote: '辅助线连一下。',
        weakpoints: [{ id: 'compass', name: '圆规', hp: 26, offsetX: -30, offsetY: -24, radius: 14, color: '#90CAF9', breakEffect: 'none' }],
        mechanics: ['shield_self'],
        reward: { coins: 70, exp: 25 },
      }),
      student({
        id: 'math_3', name: '周极限', title: '函数狂人', nickname: '导数',
        hp: 175, color: '#1976D2', shotBaseDamage: 12,
        quote: '求个导就行。',
        weakpoints: [{ id: 'graph', name: '函数图像', hp: 30, offsetX: -34, offsetY: 8, radius: 15, color: '#BBDEFB', breakEffect: 'none' }],
        mechanics: ['double_shot'],
        reward: { coins: 85, exp: 30 },
      }),
      student({
        id: 'math_rep', name: '赵九章', title: '数学课代表', nickname: '满分卷',
        hp: 290, color: '#0D47A1', shotBaseDamage: 15, radius: 34,
        quote: '这题有三种解法。',
        weakpoints: [
          { id: 'perfect_paper', name: '满分卷', hp: 42, offsetX: -36, offsetY: 12, radius: 17, color: '#E3F2FD', breakEffect: 'none' },
          { id: 'ruler', name: '直尺', hp: 34, offsetX: -28, offsetY: -26, radius: 14, color: '#64B5F6', breakEffect: 'none' },
        ],
        mechanics: ['shield_self', 'double_shot'],
        isRep: true,
        reward: { coins: 200, exp: 80 },
      }),
    ],
  },

  english: {
    id: 'english',
    name: '英语线',
    color: '#81C784',
    badge: '英语徽章',
    desc: '单词、语法、听力，最后是双胞胎课代表',
    stages: [
      student({
        id: 'english_1', name: '孙莉莉', title: '单词机器', nickname: '词典',
        hp: 140, color: '#A5D6A7', shotBaseDamage: 10,
        quote: '这个单词你会吗？',
        weakpoints: [{ id: 'dictionary', name: '词典', hp: 26, offsetX: -32, offsetY: -18, radius: 15, color: '#C8E6C9', breakEffect: 'none' }],
        mechanics: [],
        reward: { coins: 65, exp: 22 },
      }),
      student({
        id: 'english_2', name: '何文文', title: '语法警察', nickname: '时态',
        hp: 160, color: '#4CAF50', shotBaseDamage: 11,
        quote: '时态错了，重说。',
        weakpoints: [{ id: 'grammar_book', name: '语法书', hp: 28, offsetX: -34, offsetY: 10, radius: 15, color: '#A5D6A7', breakEffect: 'none' }],
        mechanics: ['silence_shot'],
        reward: { coins: 75, exp: 26 },
      }),
      student({
        id: 'english_3', name: '吴声', title: '听力幽灵', nickname: '耳机',
        hp: 180, color: '#2E7D32', shotBaseDamage: 12,
        quote: 'Listen and repeat.',
        weakpoints: [{ id: 'headphone', name: '耳机', hp: 30, offsetX: -28, offsetY: -26, radius: 14, color: '#81C784', breakEffect: 'none' }],
        mechanics: ['double_shot'],
        reward: { coins: 90, exp: 32 },
      }),
      // 双胞胎课代表：双目标
      student({
        id: 'english_rep', name: '蒋一 / 蒋二', title: '英语课代表', nickname: '双胞胎',
        hp: 200, color: '#1B5E20', shotBaseDamage: 13, radius: 32,
        quote: '我们俩一起答。',
        weakpoints: [
          { id: 'twin_book_1', name: '课本 A', hp: 34, offsetX: -32, offsetY: -22, radius: 15, color: '#C8E6C9', breakEffect: 'none' },
        ],
        mechanics: ['silence_shot'],
        isRep: true, isTwin: true,
        twin: {
          name: '蒋二', hp: 160, color: '#388E3C', shotBaseDamage: 11, radius: 30,
          offsetX: 110,
          weakpoints: [{ id: 'twin_book_2', name: '课本 B', hp: 30, offsetX: -30, offsetY: -20, radius: 14, color: '#A5D6A7', breakEffect: 'none' }],
          mechanics: ['double_shot'],
        },
        reward: { coins: 260, exp: 110 },
      }),
    ],
  },
};

export const SUBJECT_ORDER = ['chinese', 'math', 'english'];

// 展开成可查询的关卡表
export const ALL_STAGES = (() => {
  const map = {};
  for (const sid of SUBJECT_ORDER) {
    const sub = SUBJECTS[sid];
    sub.stages.forEach((st, idx) => {
      map[st.id] = { ...st, subject: sid, index: idx, stageCount: sub.stages.length };
    });
  }
  return map;
})();

export function getStage(id) {
  return ALL_STAGES[id] || null;
}

// 判断某条线是否全通
export function isSubjectCleared(save, subjectId) {
  const sub = SUBJECTS[subjectId];
  if (!sub) return false;
  return sub.stages.every(st => save.progress.stages[st.id] === 1);
}

// 统计已通关的学科线数量
export function countClearedSubjects(save) {
  return SUBJECT_ORDER.filter(sid => isSubjectCleared(save, sid)).length;
}
