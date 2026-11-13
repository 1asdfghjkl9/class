// ============================================================
// config.js — 全局可调参数表（v3：数值×100，新增盲盒/粉色品质）
// ============================================================

export const CONFIG = {
  // ---------- 分辨率（横屏 16:9）----------
  WIDTH: 1600,
  HEIGHT: 1200,
  ASPECT: 1600 / 1200,

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
  PREDICT_POINTS: 10,
  PREDICT_TIME: 0.4,

  // ---------- ATB ----------
  ATB_MAX: 100,
  PLAYER_SPEED: 20,
  BOSS_SPEED: 18,
  MINION_SPEED: 15,

  // ---------- AP ----------
  AP_MAX: 12,
  AP_PER_TURN: 3,
  NORMAL_SHOT_AP: 0,
  STANDBY_BONUS_AP: 3,
  BOSS_AP_PER_TURN: 3,

  // ---------- 玩家（×100）----------
  PLAYER_HP: 14000,
  PLAYER_MAX_HP: 14000,
  PLAYER_X: 200,
  PLAYER_RADIUS: 28,
  PLAYER_MOVE_SPEED: 150,
  PLAYER_MOVE_MAX: 200,

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
  GROUND_Y: 1080,
  GROUND_DEPTH: 200,
  GROUND_HP: 50,
  MAX_DECALS: 200,

  // ---------- 金老师（×100）----------
  BOSS_HP: 40000,
  BOSS_DR: 0.10,
  BOSS_PATROL_MIN: 850,
  BOSS_PATROL_MAX: 1150,
  BOSS_PATROL_SPEED: 38,
  BOSS_RADIUS: 36,
  BOSS_ENRAGE_THRESHOLD: 0.20,
  MINION_HP: 4000,
  MINION_RADIUS: 24,
  WEAKPOINT_PENBAG_HP: 3000,
  WEAKPOINT_BOOK_HP: 4000,

  // ---------- 韩老师（×100）----------
  BOSS_HAN_HP: 38000,
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
  BOSS_HAN_SHOT_DAMAGE: 1600,
  BOSS_HAN_SHOT_SPEED: 620,
  BOSS_HAN_X: 1050,

  // ---------- 吴老师（×100）----------
  BOSS_WU_HP: 36000,
  BOSS_WU_SPEED: 20,
  BOSS_WU_DR: 0.12,
  BOSS_WU_RADIUS: 34,
  BOSS_WU_HOMEWORK_INTERVAL: 2,
  BOSS_WU_DISCIPLINE_INTERVAL: 3,
  BOSS_WU_DISCIPLINE_INTERVAL_BROKEN: 5,
  BOSS_WU_DISCIPLINE_DURATION: 3,
  BOSS_WU_DISCIPLINE_DAMAGE: 3000,
  BOSS_WU_AIM_ERROR: 30,
  BOSS_WU_SHOT_DAMAGE: 1400,
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
  SKILL_DMG_MUL_PER_LEVEL: 0.18,
  WEAPON_DMG_MUL_PER_LEVEL: 0.15,
  ITEM_EFFECT_MUL_PER_LEVEL: 0.20,

  // ---------- 角色等级 ----------
  LEVEL_MAX: 999,
  EXP_PER_LEVEL: 100,
  EXP_GROWTH: 25,
  TALENT_POINT_PER_LEVEL: 1,

  // ---------- 商店价格（×100）----------
  PRICES: {
    weaponBlindBox: 20000,    // 武器盲盒
    skillUpgrade: 30000,      // 技能升级
    weaponUpgrade: 35000,     // 武器升级
    itemUpgrade: 25000,       // 道具升级
    exp100: 15000,            // 100 积分
    skillFragment: 12000,     // 1 个技能碎片
    itemFragment: 10000,      // 1 个道具碎片
    rerollCard: 15000,        // 奸商的重铸券
    respecTicket: 30000,      // 转班申请单
  },

  // ---------- 盲盒系统 ----------
  BLINDBOX: {
    price: 20000,             // 单个盲盒价格
    bulkPrice: 180000,        // 10连价格（9折）
    minFragments: 1,          // 最少出碎片数
    maxFragments: 3,          // 最多出碎片数
    // 品质概率
    qualityOdds: { green: 0.50, blue: 0.28, purple: 0.13, pink: 0.07, gold: 0.02 },
    // 解锁所需碎片数（按品质）
    fragmentsToUnlock: { green: 5, blue: 10, purple: 20, pink: 35, gold: 50 },
  },

  // ---------- 武器包概率（旧，保留兼容）----------
  WEAPON_GACHA: { green: 0.50, blue: 0.28, purple: 0.13, pink: 0.07, gold: 0.02 },
  REROLL_NEGATIVE_CHANCE: 0.15,

  // ---------- 怒气大招 ----------
  ULT_AP_COST: 0,
  ULT_HEAL_SINGLE: 0.30,
  ULT_HEAL_GROUP: 0.22,

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
    groundDark: '#6B5340',
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
    pink:       '#FF69B4',
  },

  // ---------- 品质（新增粉色）----------
  QUALITY: {
    green:  { name: '绿', color: '#4CAF50', affixes: 0, order: 0 },
    blue:   { name: '蓝', color: '#2196F3', affixes: 1, order: 1 },
    purple: { name: '紫', color: '#9C27B0', affixes: 2, order: 2 },
    pink:   { name: '粉', color: '#FF69B4', affixes: 3, order: 3 },
    gold:   { name: '金', color: '#FFD700', affixes: 4, order: 4 },
  },
  QUALITY_ORDER: ['green', 'blue', 'purple', 'pink', 'gold'],

  // ---------- 道具 ----------
  ITEM_FRAGMENT_COST: 5,      // 解锁所需碎片数
  ITEMS_PER_BATTLE: 4,        // 每关自动补齐道具数
  MAX_EQUIPPED_ITEMS: 4,      // 最多装备道具数
};
