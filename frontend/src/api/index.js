const TOKEN_KEY = 'rk_token';
const USER_KEY = 'rk_user';
const SERVER_KEY = 'rk_server';

// 安卓 App 默认连接的电脑端服务器（构建时固化，登录页可修改）
export const DEFAULT_SERVER = 'http://192.168.31.146:3001';

// 安卓/iOS 原生 App 内运行时返回 true（浏览器/Web 版为 false）
export function isNativeApp() {
  try {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  } catch {
    return false;
  }
}

export function getServer() {
  if (isNativeApp()) return localStorage.getItem(SERVER_KEY) || DEFAULT_SERVER;
  return localStorage.getItem(SERVER_KEY) || '';
}

export function setServer(url) {
  const cleaned = (url || '').trim().replace(/\/+$/, '');
  if (cleaned) localStorage.setItem(SERVER_KEY, cleaned);
  else localStorage.removeItem(SERVER_KEY);
  return cleaned;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

// 统一请求封装：自动带 token，非 2xx 抛出后端 error 消息
export async function api(path, { method = 'GET', body, keepalive = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(getServer() + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    keepalive,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* 空响应体 */
  }
  if (!res.ok) {
    // 登录态失效：清除本地凭据并跳转登录页（登录/注册接口自身的 401 除外）
    if (res.status === 401 && !path.startsWith('/api/auth/login') && !path.startsWith('/api/auth/register')) {
      setToken(null);
      setStoredUser(null);
      if (!location.pathname.startsWith('/login')) location.href = '/login';
    }
    const err = new Error(data?.error || `请求失败（${res.status}）`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// 组装答题卡展示用的选项字母
export const LETTERS = 'ABCDEFGH'.split('');
