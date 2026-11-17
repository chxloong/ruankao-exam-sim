const { api, getServer, setServer, setToken, setStoredUser } = require('../../utils/api');

Page({
  data: {
    server: '',
    username: '',
    password: '',
    loading: false,
  },

  onLoad() {
    this.setData({ server: getServer() });
    // 已登录直接进首页
    if (wx.getStorageSync('rk_token')) {
      wx.reLaunch({ url: '/pages/index/index' });
    }
  },

  onServer(e) {
    this.setData({ server: e.detail.value });
  },
  onUser(e) {
    this.setData({ username: e.detail.value });
  },
  onPwd(e) {
    this.setData({ password: e.detail.value });
  },

  doLogin() {
    const { server, username, password } = this.data;
    if (!username || !password) {
      wx.showToast({ title: '请输入用户名和密码', icon: 'none' });
      return;
    }
    setServer(server);
    this.setData({ loading: true });
    api('/api/auth/login', { method: 'POST', body: { username: username.trim(), password } })
      .then((data) => {
        setToken(data.token);
        setStoredUser(data.user);
        wx.showToast({ title: '登录成功', icon: 'success' });
        setTimeout(() => wx.reLaunch({ url: '/pages/index/index' }), 500);
      })
      .catch((e) => {
        wx.showModal({
          title: '登录失败',
          content: e.message,
          showCancel: false,
        });
      })
      .finally(() => this.setData({ loading: false }));
  },
});
