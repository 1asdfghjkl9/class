// ============================================================
// account.js — 账号系统（注册/登录/存档隔离）
// 使用 localStorage 存储，每个账号独立存档
// ============================================================

const ACCOUNTS_KEY = 'class_battle_accounts';
const SESSION_KEY = 'class_battle_session';

// ===== 账号注册 =====
export function register(username, password) {
  if (!username || username.length < 2) return { ok: false, msg: '用户名至少2个字符' };
  if (!password || password.length < 3) return { ok: false, msg: '密码至少3个字符' };
  
  const accounts = getAllAccounts();
  if (accounts[username]) return { ok: false, msg: '用户名已存在' };
  
  accounts[username] = {
    username,
    password, // 简单存储，本地游戏不涉及高安全性
    createdAt: Date.now(),
  };
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  return { ok: true, username };
}

// ===== 账号登录 =====
export function login(username, password) {
  const accounts = getAllAccounts();
  const acc = accounts[username];
  if (!acc) return { ok: false, msg: '用户名不存在' };
  if (acc.password !== password) return { ok: false, msg: '密码错误' };
  
  localStorage.setItem(SESSION_KEY, username);
  return { ok: true, username };
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
