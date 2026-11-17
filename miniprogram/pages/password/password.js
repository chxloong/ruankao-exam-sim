const { api, setToken } = require('../../utils/api');

Page({
  data: {
    oldPassword: '',
    newPassword: '',
    confirm: '',
    loading: false,
  },

  onOld(e) {
    this.setData({ oldPassword: e.detail.value });
  },
  onNew(e) {
    this.setData({ newPassword: e.detail.value });
  },
  onConfirm(e) {
    this.setData({ confirm: e.detail.value });
  },

  doChange() {
    const { oldPassword, newPassword, confirm } = this.data;
    if (!oldPassword || !newPassword) {
      wx.showToast({ title: '请输入旧密码和新密码', icon: 'none' });
      return;
    }
    if (newPassword.length < 6) {
      wx.showToast({ title: '新密码至少 6 位', icon: 'none' });
      return;
    }
    if (newPassword !== confirm) {
      wx.showToast({ title: '两次输入的新密码不一致', icon: 'none' });
      return;
    }
    this.setData({ loading: true });
    api('/api/auth/change-password', { method: 'PUT', body: { oldPassword, newPassword } })
      .then((data) => {
        setToken(null); // 旧登录态已失效，需重新登录
        wx.showModal({
          title: '修改成功',
          content: data.message || '密码修改成功，请使用新密码重新登录',
          showCancel: false,
          confirmText: '去登录',
          success: () => wx.reLaunch({ url: '/pages/login/login' }),
        });
      })
      .catch((e) => wx.showModal({ title: '修改失败', content: e.message, showCancel: false }))
      .finally(() => this.setData({ loading: false }));
  },
});
