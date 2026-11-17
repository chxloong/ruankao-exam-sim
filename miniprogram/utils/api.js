// 统一请求封装：服务器地址可配置，自动携带 token，非 2xx 抛出后端 error 消息
const SERVER_KEY = 'rk_server';
const TOKEN_KEY = 'rk_token';
const USER_KEY = 'rk_user';

// 默认连接电脑端后端（局域网模式），登录页可修改
const DEFAULT_SERVER = 'http://192.168.31.146:3001';

function getServer() {
  return wx.getStorageSync(SERVER_KEY) || DEFAULT_SERVER;
}

function setServer(url) {
  const cleaned = (url || '').trim().replace(/\/+$/, '');
  if (cleaned) wx.setStorageSync(SERVER_KEY, cleaned);
  else wx.removeStorageSync(SERVER_KEY);
  return cleaned;
}

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || '';
}

function setToken(token) {
  if (token) wx.setStorageSync(TOKEN_KEY, token);
  else wx.removeStorageSync(TOKEN_KEY);
}

function getStoredUser() {
  return wx.getStorageSync(USER_KEY) || null;
}

function setStoredUser(user) {
  if (user) wx.setStorageSync(USER_KEY, user);
  else wx.removeStorageSync(USER_KEY);
}

function api(path, { method = 'GET', body } = {}) {
  return new Promise((resolve, reject) => {
    const header = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) header.Authorization = 'Bearer ' + token;
    wx.request({
      url: getServer() + path,
      method,
      data: body,
      header,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          const msg = (res.data && res.data.error) || '请求失败（' + res.statusCode + '）';
          reject(new Error(msg));
        }
      },
      fail() {
        reject(new Error('网络连接失败：请确认电脑端服务已启动（uvicorn --host 0.0.0.0），且手机与电脑在同一网络，服务器地址填写正确'));
      },
    });
  });
}

module.exports = { api, getServer, setServer, getToken, setToken, getStoredUser, setStoredUser, DEFAULT_SERVER };
