// ============================================================
// account.js — 账号系统（注册/登录/存档隔离/官方账号）
// 使用 localStorage 存储，每个账号独立存档
// ============================================================

const ACCOUNTS_KEY = 'class_battle_accounts';
const SESSION_KEY = 'class_battle_session';
const OFFICIAL_CODE = '7618';

// ===== 账号注册 =====
export function register(username, password, inviteCode) {
  if (!username || username.length < 2) return { ok: false, msg: '用户名至少2个字符' };
  if (!password || password.length < 3) return { ok: false, msg: '密码至少3个字符' };
  
  const accounts = getAllAccounts();
  if (accounts[username]) return { ok: false, msg: '用户名已存在' };
  
  const isOfficial = inviteCode === OFFICIAL_CODE;
  
  accounts[username] = {
    username,
    password, // 简单存储，本地游戏不涉及高安全性
    createdAt: Date.now(),
    isOfficial, // 官方账号标记
  };
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  
  // 如果是官方账号，初始化无限金币存档
  if (isOfficial) {
    const saveKey = getSaveKey(username);
    const defaultSave = createOfficialSave();
    localStorage.setItem(saveKey, JSON.stringify(defaultSave));
  }
  
  return { ok: true, username, isOfficial };
}

// ===== 账号登录 =====
export function login(username, password) {
  const accounts = getAllAccounts();
  const acc = accounts[username];
  if (!acc) return { ok: false, msg: '用户名不存在' };
  if (acc.password !== password) return { ok: false, msg: '密码错误' };
  
  localStorage.setItem(SESSION_KEY, username);
  return { ok: true, username, isOfficial: !!acc.isOfficial };
}

// ===== 退出登录 =====
export function logout() {
  localStorage.removeItem(SESSION_KEY);
}

// ===== 获取当前登录用户 =====
export function getCurrentUser() {
  return localStorage.getItem(SESSION_KEY) || null;
}

// ===== 检查是否已登录 =====
export function isLoggedIn() {
  return !!getCurrentUser();
}

// ===== 检查当前用户是否为官方账号 =====
export function isOfficialAccount() {
  const user = getCurrentUser();
  if (!user) return false;
  const accounts = getAllAccounts();
  return !!(accounts[user] && accounts[user].isOfficial);
}

// ===== 获取所有账号 =====
function getAllAccounts() {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '{}');
  } catch (e) {
    return {};
  }
}

// ===== 存档隔离：每个账号独立的 save key =====
export function getSaveKey(username) {
  return `class_battle_save_${username}`;
}

// ===== 获取当前用户的存档 key =====
export function getCurrentSaveKey() {
  const user = getCurrentUser();
  return user ? getSaveKey(user) : 'class_battle_save_v2';
}

// ===== 官方账号专用初始存档（无限金币） =====
function createOfficialSave() {
  // 所有技能
  const allSkills = ['wall', 'chalk', 'justice', 'snack', 'lecture', 'swap', 'kickout', 'orange', 'tomato', 'detain', 'judge', 'desk', 'paint', 'sketch', 'sprint', 'ball'];
  const skillsUnlocked = {};
  const skillLevels = {};
  allSkills.forEach(id => { skillsUnlocked[id] = 1; skillLevels[id] = 3; });

  // 所有武器（实例形式）
  const weaponIds = ['pen_gun', 'insecticide', 'han_chalk', 'exam_paper', 'homework', 'chinese_class'];
  const weaponsOwned = {};
  weaponIds.forEach(id => { weaponsOwned[id] = { level: 5, affixes: [] }; });

  // 所有道具
  const allItems = ['kite', 'leave', 'no_leave', 'none_leave', 'not_our_class', 'unknown_report', 'not_me', 'what_doing', 'teacher_snack', 'teacher_class'];
  const itemLevels = {};
  allItems.forEach(id => { itemLevels[id] = 3; });

  return {
    version: 2,
    coins: 999999,
    exp: 0,
    level: 10,

    progress: {
      bosses: { jin: 1, han: 1, wu: 1, lv: 1, ma: 1 },
      stages: {},
      subjectBadges: { chinese: 0, math: 0, english: 0, art: 0, pe: 0 },
    },

    skillsUnlocked,
    skillLevels,
    skillFragments: {},

    itemLevels,

    weapons: {
      owned: weaponsOwned,
      equipped: 'chinese_class',
    },

    equipped: {
      skills: ['wall', 'chalk', 'justice', 'paint', 'ball', 'sprint'],
      items: [],
    },

    talents: {
      points: 30,
      spent: {},
    },

    achievements: {
      unlocked: {},
      title: '',
    },

    challenges: {
      cleared: {},
    },

    stats: {
      totalShots: 0,
      totalWins: 0,
      totalLosses: 0,
      superCrits: 0,
      maxSingleHit: 0,
      maxWeakpointsOneBattle: 0,
      noDamageWins: 0,
      dailyClears: 0,
      nightmareWins: 0,
      totalCoinsEarned: 0,
      totalPlayTime: 0,
    },

    settings: {
      sound: true,
      difficulty: 'normal',
      ultId: 'bomb',
      showAimLine: true,
    },

    battleState: null,
    isOfficial: true,
  };
}

// ===== 封装为 Account 对象（供 menu.js 使用） =====
export const Account = {
  init() {
    // 自动恢复会话
    const user = getCurrentUser();
    if (user) {
      window.__account = { name: user, isOfficial: isOfficialAccount() };
    } else {
      window.__account = null;
    }
  },
  login(username, password) {
    const r = login(username, password);
    if (r.ok) {
      window.__account = { name: username, isOfficial: !!r.isOfficial };
    }
    return r;
  },
  register(username, password, inviteCode) {
    const r = register(username, password, inviteCode);
    if (r.ok) {
      window.__account = { name: username, isOfficial: !!r.isOfficial };
      // 自动登录
      localStorage.setItem(SESSION_KEY, username);
    }
    return r;
  },
  logout() {
    logout();
    window.__account = null;
  },
  isOfficial() {
    return isOfficialAccount();
  },
  getCurrentUser() {
    return getCurrentUser();
  },
  getSaveKey() {
    return getCurrentSaveKey();
  },
};
