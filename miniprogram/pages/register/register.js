const { api, setServer, getServer } = require('../../utils/api');

Page({
  data: {
    server: '',
    username: '',
    password: '',
    confirm: '',
    loading: false,
  },

  onLoad() {
    this.setData({ server: getServer() });
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
  onConfirm(e) {
    this.setData({ confirm: e.detail.value });
  },

  doRegister() {
    const { server, username, password, confirm } = this.data;
    if (!username || !password) {
      wx.showToast({ title: '请输入用户名和密码', icon: 'none' });
      return;
    }
    if (password !== confirm) {
      wx.showToast({ title: '两次输入的密码不一致', icon: 'none' });
      return;
    }
    setServer(server);
    this.setData({ loading: true });
    api('/api/auth/register', { method: 'POST', body: { username: username.trim(), password } })
      .then((data) => {
        wx.showModal({
          title: '注册成功',
          content: data.message || '账号待管理员审核通过后即可登录',
          showCancel: false,
          confirmText: '去登录',
          success: () => wx.navigateBack(),
        });
      })
      .catch((e) => wx.showModal({ title: '注册失败', content: e.message, showCancel: false }))
      .finally(() => this.setData({ loading: false }));
  },
});
