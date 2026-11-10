// ============================================================
// config.js — 全局可调参数表
// ============================================================

export const CONFIG = {
  // ---------- 分辨率（横屏 16:9）----------
  WIDTH: 1600,
  HEIGHT: 900,
  ASPECT: 1600 / 900,

  // ---------- 物理 ----------
  GRAVITY: 900,
  DT: 1 / 120,
  WIND_ACCEL_PER_LEVEL: 40,
  DRAG_DEADZONE: 20,
  DRAG_MAX: 180,
  VELOCITY_MIN: 420,
  VELOCITY_MAX: 1200,
  OUT_OF_BOUNDS_MARGIN: 200,
  SLOWMO_DURATION: 0.15,
  SLOWMO_SCALE: 0.4,
  SUPER_CRIT_SLOWMO: 0.3,
  PREDICT_POINTS: 20,
  PREDICT_TIME: 0.8,

  // ---------- ATB ----------
  ATB_MAX: 100,
  PLAYER_SPEED: 20,
  BOSS_SPEED: 18,
  MINION_SPEED: 15,

  // ---------- AP ----------
  AP_MAX: 6,
  AP_PER_TURN: 3,
  NORMAL_SHOT_AP: 3,
  STANDBY_BONUS_AP: 1,

  // ---------- 玩家 ----------
  PLAYER_HP: 140,
  PLAYER_MAX_HP: 140,
  PLAYER_X: 240,
  PLAYER_RADIUS: 28,

  // ---------- 暴击 ----------
  BASE_CRIT: 0.15,
  TIER_CRIT_BONUS: [0, 0.25, 0.45],
  SUPER_CRIT_CHANCE: 0.35,
  CRIT_MUL: 1.5,
  SUPER_CRIT_MUL: 2.0,
  SKILL_DMG_PER_LEVEL: 0.12,
  DR_CAP: 0.70,

  // ---------- 风向暴击加成 ----------
  HEADWIND_CRIT_BONUS: 0.15,
  SIDEWIND_CRIT_BONUS: 0.10,
  SIDEWIND_MIN_LEVEL: 3,

  // ---------- 怒气 / 大招 ----------
  RAGE_MAX: 100,
  RAGE_ON_HIT: 8,
  RAGE_ON_HITTED: 10,
  RAGE_CRIT_BONUS: 5,
  RAGE_SUPER_CRIT_BONUS: 10,
  RAGE_ON_WEAKPOINT: 6,

  // ---------- 地形 ----------
  GROUND_Y: 780,
  MAX_DECALS: 200,

  // ---------- 金老师 ----------
  BOSS_HP: 400,
  BOSS_DR: 0.10,
  BOSS_PATROL_MIN: 850,
  BOSS_PATROL_MAX: 1150,
  BOSS_PATROL_SPEED: 38,
  BOSS_RADIUS: 36,
  BOSS_ENRAGE_THRESHOLD: 0.20,
  MINION_HP: 40,
  MINION_RADIUS: 24,
  WEAKPOINT_PENBAG_HP: 30,
  WEAKPOINT_BOOK_HP: 40,

  // ---------- 韩老师 ----------
  BOSS_HAN_HP: 380,
  BOSS_HAN_SPEED: 19,
  BOSS_HAN_DR: 0.08,
  BOSS_HAN_RADIUS: 36,
  BOSS_HAN_SWAY_RANGE: 60,
  BOSS_HAN_SWAY_SPEED: 20,
  BOSS_HAN_QUIZ_INTERVAL: 2,
  BOSS_HAN_QUIZ_TIMER: 5,
  BOSS_HAN_QUIZ_TIMER_BROKEN: 8,
  BOSS_HAN_RAGE_THRESHOLD: 0.50,
  BOSS_HAN_PAPER_COUNT: 6,
  BOSS_HAN_AIM_ERROR: 35,
  BOSS_HAN_SHOT_DAMAGE: 16,
  BOSS_HAN_SHOT_SPEED: 620,
  BOSS_HAN_X: 1050,

  // ---------- 吴老师 ----------
  BOSS_WU_HP: 360,
  BOSS_WU_SPEED: 20,
  BOSS_WU_DR: 0.12,
  BOSS_WU_RADIUS: 34,
  BOSS_WU_HOMEWORK_INTERVAL: 2,
  BOSS_WU_DISCIPLINE_INTERVAL: 3,
  BOSS_WU_DISCIPLINE_INTERVAL_BROKEN: 5,
  BOSS_WU_DISCIPLINE_DURATION: 3,
  BOSS_WU_DISCIPLINE_DAMAGE: 30,
  BOSS_WU_AIM_ERROR: 30,
  BOSS_WU_SHOT_DAMAGE: 14,
  BOSS_WU_SHOT_SPEED: 640,
  BOSS_WU_X: 1050,

  // ---------- 难度 ----------
  DIFFICULTIES: {
    normal: {
      id: 'normal', name: '普通', hpMul: 1.0, dmgMul: 1.0, coinMul: 1.0,
      extraMechanic: false, desc: '标准体验，适合先熟悉机制',
    },
    hard: {
      id: 'hard', name: '困难', hpMul: 1.3, dmgMul: 1.2, coinMul: 1.6,
      extraMechanic: false, desc: '老师血更厚、出手更疼，金币 +60%',
    },
    nightmare: {
      id: 'nightmare', name: '噩梦', hpMul: 1.6, dmgMul: 1.4, coinMul: 2.5,
      extraMechanic: true, desc: '老师多一个机制，金币 +150%',
    },
  },

  // ---------- 技能等级 ----------
  SKILL_MAX_LEVEL: 5,
  WEAPON_MAX_LEVEL: 5,
  ITEM_MAX_LEVEL: 5,
  SKILL_DMG_MUL_PER_LEVEL: 0.18,   // 每级 +18% 伤害
  WEAPON_DMG_MUL_PER_LEVEL: 0.15,  // 每级 +15% 伤害
  ITEM_EFFECT_MUL_PER_LEVEL: 0.20, // 每级 +20% 效果

  // ---------- 角色等级 ----------
  LEVEL_MAX: 999,
  EXP_PER_LEVEL: 100,        // 每级所需积分（线性递增）
  EXP_GROWTH: 25,            // 每级额外递增
  TALENT_POINT_PER_LEVEL: 1,

  // ---------- 商店价格 ----------
  PRICES: {
    weaponPack: 200,         // 武器包
    skillUpgrade: 300,       // 技能升级（基础价，按等级递增）
    weaponUpgrade: 350,      // 武器升级
    itemUpgrade: 250,        // 道具升级
    exp100: 150,             // 100 积分
    skillFragment: 120,      // 1 个技能碎片
    rerollCard: 150,         // 改造卡
    respecTicket: 300,       // 转班申请单
  },

  // ---------- 武器包概率 ----------
  WEAPON_GACHA: { green: 0.60, blue: 0.25, purple: 0.12, gold: 0.03 },
  REROLL_NEGATIVE_CHANCE: 0.15,

  // ---------- 怒气大招 ----------
  ULT_AP_COST: 0,          // 大招不消耗行动力
  ULT_HEAL_SINGLE: 0.30,   // 单体治疗：30% 最大生命
  ULT_HEAL_GROUP: 0.22,    // 群体治疗：22% 最大生命（玩家侧等效自身）

  // ---------- 场景互动物 ----------
  INTERACTABLE: {
    fan:      { name: '吊扇',   hitRadius: 34, color: '#9E9E9E', effect: 'turbulence' },
    projector:{ name: '投影仪', hitRadius: 30, color: '#455A64', effect: 'blur' },
    board:    { name: '黑板报', hitRadius: 46, color: '#4CAF50', effect: 'chalkDust' },
  },

  // ---------- Q版配色 ----------
  COLORS: {
    primary:    '#FF6B6B',
    secondary:  '#4ECDC4',
    accent:     '#FFE66D',
    dark:       '#556270',
    blackboard: '#2F4F4F',
    wood:       '#C89B6A',
    wall:       '#F5F0E1',
    podium:     '#8B7355',
    sauce:      '#E8553A',
    grass:      '#7CB342',
    sky:        '#87CEEB',
    ground:     '#8B7355',
    textWhite:  '#FFFFFF',
    textDark:   '#333333',
    critYellow: '#FFD700',
    critRed:    '#FF3333',
    shieldBlue: '#4169E1',
    rageBar:    '#FF4500',
    hpGreen:    '#4CAF50',
    hpRed:      '#F44336',
    apBlue:     '#2196F3',
    cdBlack:    'rgba(0,0,0,0.65)',
    jinColor:   '#FF6B6B',
    hanColor:   '#E91E63',
    wuColor:    '#7B68EE',
    gold:       '#FFD700',
    purple:     '#9C27B0',
    blue:       '#2196F3',
    green:      '#4CAF50',
  },

  // ---------- 品质 ----------
  QUALITY: {
    green:  { name: '绿', color: '#4CAF50', affixes: 0 },
    blue:   { name: '蓝', color: '#2196F3', affixes: 1 },
    purple: { name: '紫', color: '#9C27B0', affixes: 2 },
    gold:   { name: '金', color: '#FFD700', affixes: 3 },
  },
};
