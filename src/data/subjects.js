// ============================================================
// data/subjects.js — 五条学科线（体育 → 语文 → 美术 → 数学 → 英语）
// 每条线：纯战斗关卡；课代表放最后，双课代表合并进同一关
// 通关整条线得该学科徽章
// ============================================================

function student(o) {
  return {
    kind: 'student',
    radius: 32,
    dr: 0.05,
    speed: 18,
    aimError: 42,
    shotSpeed: 600,
    homeX: 1050,
    patrolMin: 900,
    patrolMax: 1150,
    patrolSpeed: 30,
    shotBaseDamage: 10,
    mechanics: [],
    weakpoints: [],
    shotType: 'flat', // 'flat' 平射 | 'lob' 吊射
    skillPref: 'normal', // normal/connon/high/annoying/scatter/heal
    ...o,
  };
}

export const SUBJECTS = {
  pe: {
    id: 'pe',
    name: '体育线',
    color: '#FFB74D',
    badge: '体育徽章',
    desc: '马铭喆 → 武睿晞 → 张书格 → 谭梓峻 → 封佳琪（课代表）',
    mapTheme: 'pe',
    stages: [
      student({
        id: 'pe_1', name: '马铭喆', title: '体育委员', nickname: '短跑王',
        hp: 130, color: '#FFCC80', shotBaseDamage: 11,
        shotType: 'lob', skillPref: 'high',
        quote: '跑起来！别磨蹭！',
        weakpoints: [{ id: 'whistle', name: '口哨', hp: 22, offsetX: -30, offsetY: -20, radius: 14, color: '#FFE0B2', breakEffect: 'none' }],
        mechanics: [],
        reward: { coins: 60, exp: 20 },
      }),
      student({
        id: 'pe_2', name: '武睿晞', title: '体育课尖子', nickname: '跳远王',
        hp: 150, color: '#FFA726', shotBaseDamage: 12,
        shotType: 'lob', skillPref: 'annoying',
        quote: '看我跳过去！',
        weakpoints: [{ id: 'tape', name: '皮尺', hp: 26, offsetX: -34, offsetY: 10, radius: 15, color: '#FFE0B2', breakEffect: 'none' }],
        mechanics: ['shield_self'],
        reward: { coins: 70, exp: 25 },
      }),
      student({
        id: 'pe_3', name: '张书格', title: '铅球手', nickname: '铁球',
        hp: 170, color: '#EF6C00', shotBaseDamage: 13,
        shotType: 'flat', skillPref: 'high',
        quote: '看我推过去！',
        weakpoints: [{ id: 'shotput', name: '铅球', hp: 30, offsetX: -30, offsetY: -24, radius: 15, color: '#FFB74D', breakEffect: 'none' }],
        mechanics: ['double_shot'],
        reward: { coins: 85, exp: 30 },
      }),
      student({
        id: 'pe_4', name: '谭梓峻', title: '长跑选手', nickname: '耐力王',
        hp: 185, color: '#E65100', shotBaseDamage: 13,
        shotType: 'lob', skillPref: 'high',
        quote: '十圈只是热身。',
        weakpoints: [{ id: 'stopwatch', name: '秒表', hp: 32, offsetX: -32, offsetY: -22, radius: 15, color: '#FFB74D', breakEffect: 'none' }],
        mechanics: ['buff_low_hp'],
        reward: { coins: 95, exp: 35 },
      }),
      student({
        id: 'pe_rep', name: '封佳琪', title: '体育课代表', nickname: '魔鬼教练',
        hp: 310, color: '#BF360C', shotBaseDamage: 16, radius: 34,
        shotType: 'flat', skillPref: 'scatter',
        quote: '给我跑十圈！跑不完别想下课！',
        weakpoints: [
          { id: 'stopwatch', name: '秒表', hp: 44, offsetX: -36, offsetY: 12, radius: 17, color: '#FFE0B2', breakEffect: 'none' },
          { id: 'coneblock', name: '锥形桶', hp: 36, offsetX: -28, offsetY: -26, radius: 14, color: '#FFA726', breakEffect: 'none' },
        ],
        mechanics: ['silence_shot', 'double_shot'],
        isRep: true,
        reward: { coins: 240, exp: 100 },
      }),
    ],
  },

  chinese: {
    id: 'chinese',
    name: '语文线',
    color: '#E57373',
    badge: '语文徽章',
    desc: '盛丽文 → 叶辰希 → 徐紫菡（课代表）→ 封佳琪',
    mapTheme: 'chinese',
    stages: [
      student({
        id: 'chinese_1', name: '盛丽文', title: '背诵狂魔', nickname: '复读机',
        hp: 130, color: '#EF9A9A', shotBaseDamage: 10,
        shotType: 'flat', skillPref: 'high',
        quote: '再背一遍，从头开始。',
        weakpoints: [{ id: 'recite_book', name: '语文书', hp: 22, offsetX: -30, offsetY: -20, radius: 14, color: '#FFCDD2', breakEffect: 'none' }],
        mechanics: [],
        reward: { coins: 60, exp: 20 },
      }),
      student({
        id: 'chinese_2', name: '叶辰希', title: '作文天才', nickname: '八百字',
        hp: 155, color: '#E57373', shotBaseDamage: 11,
        shotType: 'lob', skillPref: 'connon',
        quote: '字数不够，重写。',
        weakpoints: [{ id: 'draft', name: '作文草稿', hp: 26, offsetX: -34, offsetY: 10, radius: 15, color: '#FFF9C4', breakEffect: 'none' }],
        mechanics: ['double_shot'],
        reward: { coins: 75, exp: 25 },
      }),
      student({
        id: 'chinese_rep', name: '徐紫菡', title: '语文课代表', nickname: '默写本',
        hp: 280, color: '#B71C1C', shotBaseDamage: 14, radius: 34,
        shotType: 'flat', skillPref: 'high',
        quote: '全对，下一个。',
        weakpoints: [
          { id: 'dictation', name: '默写本', hp: 40, offsetX: -36, offsetY: 12, radius: 17, color: '#FFCDD2', breakEffect: 'none' },
          { id: 'red_pen', name: '红笔', hp: 32, offsetX: -28, offsetY: -26, radius: 14, color: '#D32F2F', breakEffect: 'none' },
        ],
        mechanics: ['silence_shot', 'buff_low_hp'],
        isRep: true,
        reward: { coins: 200, exp: 80 },
      }),
      student({
        id: 'chinese_3', name: '封佳琪', title: '语文课尖子', nickname: '朗读王',
        hp: 250, color: '#C62828', shotBaseDamage: 13,
        shotType: 'flat', skillPref: 'scatter',
        quote: '有感情地朗读课文！',
        weakpoints: [{ id: 'textbook', name: '课本', hp: 36, offsetX: -32, offsetY: -22, radius: 15, color: '#FFCDD2', breakEffect: 'none' }],
        mechanics: ['double_shot', 'buff_low_hp'],
        reward: { coins: 120, exp: 50 },
      }),
    ],
  },

  art: {
    id: 'art',
    name: '美术线',
    color: '#CE93D8',
    badge: '美术徽章',
    desc: '武睿晞 → 张书格 → 李为先（课代表）→ 朱婉宁·残影 → 朱婉宁·真身',
    mapTheme: 'art',
    stages: [
      student({
        id: 'art_1', name: '武睿晞', title: '美术课尖子', nickname: '调色盘',
        hp: 140, color: '#B39DDB', shotBaseDamage: 10,
        shotType: 'flat', skillPref: 'connon',
        quote: '先打个稿。',
        weakpoints: [{ id: 'pencil', name: '2B铅笔', hp: 24, offsetX: -32, offsetY: -18, radius: 14, color: '#E1BEE7', breakEffect: 'none' }],
        mechanics: ['double_shot'],
        reward: { coins: 65, exp: 22 },
      }),
      student({
        id: 'art_2', name: '张书格', title: '水彩手', nickname: '渐变',
        hp: 160, color: '#AB47BC', shotBaseDamage: 11,
        shotType: 'flat', skillPref: 'connon',
        quote: '色调不对，重来。',
        weakpoints: [{ id: 'palette', name: '调色盘', hp: 28, offsetX: -34, offsetY: 10, radius: 15, color: '#E1BEE7', breakEffect: 'none' }],
        mechanics: ['double_shot'],
        reward: { coins: 75, exp: 26 },
      }),
      student({
        id: 'art_3', name: '李为先', title: '美术课代表', nickname: '画魂',
        hp: 300, color: '#4A148C', shotBaseDamage: 15, radius: 34,
        shotType: 'lob', skillPref: 'connon',
        quote: '我画什么，什么就是真的。',
        weakpoints: [
          { id: 'brush', name: '神笔', hp: 44, offsetX: -36, offsetY: 12, radius: 17, color: '#E1BEE7', breakEffect: 'none' },
          { id: 'canvas', name: '画板', hp: 36, offsetX: -28, offsetY: -26, radius: 14, color: '#BA68C8', breakEffect: 'none' },
        ],
        mechanics: ['shield_self', 'double_shot'],
        isRep: true,
        reward: { coins: 220, exp: 90 },
      }),
      // 朱婉宁·残影：低数值，受到致命伤判定通关 → 跳到真身
      student({
        id: 'art_4', name: '朱婉宁·残影', title: '转走的课代表', nickname: '残影',
        hp: 120, color: '#7B1FA2', shotBaseDamage: 10, radius: 30,
        shotType: 'lob', skillPref: 'annoying',
        quote: '……我已经转走了。',
        weakpoints: [{ id: 'shadow', name: '残影核心', hp: 20, offsetX: -28, offsetY: -20, radius: 12, color: '#E1BEE7', breakEffect: 'none' }],
        mechanics: ['silence_shot'],
        isPhantom: true, // 残影标记：受到致命伤 → 通关 → 跳到真身
        reward: { coins: 100, exp: 40 },
      }),
      // 朱婉宁·真身：高数值，彻底击败才算通关
      student({
        id: 'art_5', name: '朱婉宁·真身', title: '原美术课代表', nickname: '真身',
        hp: 360, color: '#311B92', shotBaseDamage: 17, radius: 36,
        shotType: 'flat', skillPref: 'high',
        quote: '我回来了。这次，不会输。',
        weakpoints: [
          { id: 'true_brush', name: '真·神笔', hp: 50, offsetX: -38, offsetY: 14, radius: 18, color: '#E1BEE7', breakEffect: 'none' },
          { id: 'true_canvas', name: '真·画板', hp: 40, offsetX: -30, offsetY: -28, radius: 15, color: '#BA68C8', breakEffect: 'none' },
        ],
        mechanics: ['shield_self', 'double_shot', 'buff_low_hp'],
        isRep: true, isTrueForm: true,
        reward: { coins: 300, exp: 120 },
      }),
    ],
  },

  math: {
    id: 'math',
    name: '数学线',
    color: '#64B5F6',
    badge: '数学徽章',
    desc: '张书格 → 徐子森+李清逸（双课代表合并关）→ 李为先 → 吴谦祥',
    mapTheme: 'math',
    stages: [
      student({
        id: 'math_1', name: '张书格', title: '几何杀手', nickname: '圆规',
        hp: 135, color: '#90CAF9', shotBaseDamage: 10,
        shotType: 'flat', skillPref: 'annoying',
        quote: '辅助线连一下。',
        weakpoints: [{ id: 'compass', name: '圆规', hp: 26, offsetX: -30, offsetY: -24, radius: 14, color: '#90CAF9', breakEffect: 'none' }],
        mechanics: ['shield_self'],
        reward: { coins: 60, exp: 20 },
      }),
      // 双课代表合并关：徐子森 + 李清逸
      student({
        id: 'math_2', name: '徐子森 + 李清逸', title: '双数学课代表', nickname: '双子星',
        hp: 200, color: '#1976D2', shotBaseDamage: 12, radius: 32,
        shotType: 'flat', skillPref: 'connon',
        quote: '这题有两种解法。',
        weakpoints: [
          { id: 'perfect_paper', name: '满分卷', hp: 40, offsetX: -36, offsetY: 12, radius: 17, color: '#E3F2FD', breakEffect: 'none' },
        ],
        mechanics: ['double_shot'],
        isRep: true, isTwin: true,
        twin: {
          name: '李清逸', hp: 160, color: '#42A5F5', shotBaseDamage: 11, radius: 30,
          offsetX: 110,
          shotType: 'lob', skillPref: 'heal',
          weakpoints: [{ id: 'heal_book', name: '练习册B', hp: 30, offsetX: -30, offsetY: -20, radius: 14, color: '#BBDEFB', breakEffect: 'none' }],
          mechanics: ['shield_self'],
        },
        reward: { coins: 200, exp: 80 },
      }),
      student({
        id: 'math_3', name: '李为先', title: '函数狂人', nickname: '导数',
        hp: 175, color: '#1565C0', shotBaseDamage: 13,
        shotType: 'lob', skillPref: 'connon',
        quote: '求个导就行。',
        weakpoints: [{ id: 'graph', name: '函数图像', hp: 30, offsetX: -34, offsetY: 8, radius: 15, color: '#BBDEFB', breakEffect: 'none' }],
        mechanics: ['double_shot', 'buff_low_hp'],
        reward: { coins: 95, exp: 35 },
      }),
      student({
        id: 'math_4', name: '吴谦祥', title: '数学高手', nickname: '满分',
        hp: 220, color: '#0D47A1', shotBaseDamage: 14,
        shotType: 'flat', skillPref: 'scatter',
        quote: '这题太简单了。',
        weakpoints: [{ id: 'calc', name: '计算器', hp: 34, offsetX: -32, offsetY: -22, radius: 15, color: '#BBDEFB', breakEffect: 'none' }],
        mechanics: ['silence_shot', 'buff_low_hp'],
        reward: { coins: 120, exp: 50 },
      }),
    ],
  },

  english: {
    id: 'english',
    name: '英语线',
    color: '#81C784',
    badge: '英语徽章',
    desc: '吴谦祥 → 封佳琪 → 李为先 → 叶辰希+陈玥菱（双课代表合并关，收尾）',
    mapTheme: 'english',
    stages: [
      student({
        id: 'english_1', name: '吴谦祥', title: '英语高手', nickname: '词典',
        hp: 140, color: '#A5D6A7', shotBaseDamage: 10,
        shotType: 'flat', skillPref: 'annoying',
        quote: '这个单词你会吗？',
        weakpoints: [{ id: 'dictionary', name: '词典', hp: 26, offsetX: -32, offsetY: -18, radius: 15, color: '#C8E6C9', breakEffect: 'none' }],
        mechanics: ['shield_self'],
        reward: { coins: 65, exp: 22 },
      }),
      student({
        id: 'english_2', name: '封佳琪', title: '英语课尖子', nickname: '朗读王',
        hp: 160, color: '#4CAF50', shotBaseDamage: 11,
        shotType: 'flat', skillPref: 'scatter',
        quote: 'Read after me.',
        weakpoints: [{ id: 'textbook', name: '课本', hp: 28, offsetX: -34, offsetY: 10, radius: 15, color: '#C8E6C9', breakEffect: 'none' }],
        mechanics: ['silence_shot'],
        reward: { coins: 75, exp: 26 },
      }),
      student({
        id: 'english_3', name: '李为先', title: '语法警察', nickname: '时态',
        hp: 180, color: '#2E7D32', shotBaseDamage: 12,
        shotType: 'lob', skillPref: 'connon',
        quote: '时态错了，重说。',
        weakpoints: [{ id: 'grammar_book', name: '语法书', hp: 30, offsetX: -28, offsetY: -26, radius: 14, color: '#81C784', breakEffect: 'none' }],
        mechanics: ['double_shot'],
        reward: { coins: 90, exp: 32 },
      }),
      // 双课代表合并关（收尾）：叶辰希 + 陈玥菱
      student({
        id: 'english_rep', name: '叶辰希 + 陈玥菱', title: '双英语课代表', nickname: '双子星',
        hp: 220, color: '#1B5E20', shotBaseDamage: 13, radius: 32,
        shotType: 'lob', skillPref: 'connon',
        quote: 'We answer together.',
        weakpoints: [
          { id: 'twin_book_1', name: '课本 A', hp: 36, offsetX: -32, offsetY: -22, radius: 15, color: '#C8E6C9', breakEffect: 'none' },
        ],
        mechanics: ['silence_shot', 'buff_low_hp'],
        isRep: true, isTwin: true,
        twin: {
          name: '陈玥菱', hp: 180, color: '#388E3C', shotBaseDamage: 12, radius: 30,
          offsetX: 110,
          shotType: 'lob', skillPref: 'high',
          weakpoints: [{ id: 'twin_book_2', name: '课本 B', hp: 32, offsetX: -30, offsetY: -20, radius: 14, color: '#A5D6A7', breakEffect: 'none' }],
          mechanics: ['double_shot'],
        },
        reward: { coins: 300, exp: 130 },
      }),
    ],
  },
};

export const SUBJECT_ORDER = ['pe', 'chinese', 'art', 'math', 'english'];

// 展开成可查询的关卡表
export const ALL_STAGES = (() => {
  // stageId → STUDENT_ENEMIES key 映射
  const enemyMap = {
    'pe_1': 'pe1', 'pe_2': 'pe2', 'pe_3': 'pe3', 'pe_4': 'pe4', 'pe_rep': 'pe5',
    'chinese_1': 'cn1', 'chinese_2': 'cn2', 'chinese_rep': 'cn3', 'chinese_3': 'pe5',
    'art_1': 'art1', 'art_2': 'art2', 'art_3': 'art3', 'art_4': 'art4', 'art_5': 'art5',
    'math_1': 'ma1', 'math_2': 'ma2a', 'math_3': 'ma3', 'math_4': 'ma4',
    'english_1': 'en1', 'english_2': 'en2', 'english_3': 'en3', 'english_rep': 'en4a',
  };
  const map = {};
  for (const sid of SUBJECT_ORDER) {
    const sub = SUBJECTS[sid];
    sub.stages.forEach((st, idx) => {
      map[st.id] = { ...st, subject: sid, index: idx, stageCount: sub.stages.length, enemyId: enemyMap[st.id] || st.id };
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
