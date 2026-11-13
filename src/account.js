// ============================================================
// account.js — 账号系统（注册/登录/存档隔离/官方账号）v3
// ============================================================

const ACCOUNTS_KEY = 'class_battle_accounts';
const SESSION_KEY = 'class_battle_session';
const OFFICIAL_CODE = '7618';

export function register(username, password, inviteCode) {
  if (!username || username.length < 2) return { ok: false, msg: '用户名至少2个字符' };
  if (!password || password.length < 3) return { ok: false, msg: '密码至少3个字符' };
  
  const accounts = getAllAccounts();
  if (accounts[username]) return { ok: false, msg: '用户名已存在' };
  
  const isOfficial = inviteCode === OFFICIAL_CODE;
  
  accounts[username] = {
    username,
    password,
    createdAt: Date.now(),
    isOfficial,
  };
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  
  if (isOfficial) {
    const saveKey = getSaveKey(username);
    const defaultSave = createOfficialSave();
    localStorage.setItem(saveKey, JSON.stringify(defaultSave));
  }
  
  return { ok: true, username, isOfficial };
}

export function login(username, password) {
  const accounts = getAllAccounts();
  const acc = accounts[username];
  if (!acc) return { ok: false, msg: '用户名不存在' };
  if (acc.password !== password) return { ok: false, msg: '密码错误' };
  
  localStorage.setItem(SESSION_KEY, username);
  return { ok: true, username, isOfficial: !!acc.isOfficial };
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
}

export function getCurrentUser() {
  return localStorage.getItem(SESSION_KEY) || null;
}

export function isLoggedIn() {
  return !!getCurrentUser();
}

export function isOfficialAccount() {
  const user = getCurrentUser();
  if (!user) return false;
  const accounts = getAllAccounts();
  return !!(accounts[user] && accounts[user].isOfficial);
}

function getAllAccounts() {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '{}');
  } catch (e) {
    return {};
  }
}

export function getSaveKey(username) {
  return `class_battle_save_${username}`;
}

export function getCurrentSaveKey() {
  const user = getCurrentUser();
  return user ? getSaveKey(user) : 'class_battle_save_v3';
}

// ===== 官方账号专用初始存档 v3 =====
function createOfficialSave() {
  const allSkills = ['wall', 'chalk', 'justice', 'snack', 'lecture', 'swap', 'kickout', 'orange', 'tomato', 'detain', 'judge', 'desk', 'paint', 'sketch', 'sprint', 'ball'];
  const skillsUnlocked = {};
  const skillLevels = {};
  allSkills.forEach(id => { skillsUnlocked[id] = 1; skillLevels[id] = 5; });

  // 所有武器（含粉色新武器）
  const weaponIds = ['pen_gun', 'insecticide', 'han_chalk', 'exam_paper', 'homework', 'ruler_sword', 'paint_brush', 'chinese_class'];
  const weaponsOwned = {};
  weaponIds.forEach(id => { weaponsOwned[id] = { level: 5, affixes: [] }; });

  // 所有道具解锁
  const allItems = ['kite', 'leave', 'no_leave', 'none_leave', 'not_our_class', 'unknown_report', 'not_me', 'what_doing', 'teacher_snack', 'teacher_class'];
  const itemUnlocked = {};
  const itemLevels = {};
  allItems.forEach(id => { itemUnlocked[id] = true; itemLevels[id] = 5; });

  return {
    version: 3,
    coins: 99999900,
    exp: 0,
    level: 10,

    progress: {
      bosses: { jin: 1, han: 1, wu: 1, ding: 1, huang: 1 },
      stages: {},
      subjectBadges: { chinese: 0, math: 0, english: 0, art: 0, pe: 0 },
    },

    skillsUnlocked,
    skillLevels,
    skillFragments: {},

    itemUnlocked,
    itemLevels,
    itemFragments: {},

    weapons: {
      owned: weaponsOwned,
      equipped: 'chinese_class',
      fragments: {},
    },

    equipped: {
      skills: ['wall', 'chalk', 'justice', 'paint', 'ball', 'sprint'],
      items: ['kite', 'not_our_class', 'what_doing', 'teacher_snack'],
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

// ===== 封装为 Account 对象 =====
export const Account = {
  init() {
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
