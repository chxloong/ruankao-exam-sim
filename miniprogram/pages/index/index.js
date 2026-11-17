const { api } = require('../../utils/api');

Page({
  data: {
    papers: [],
    loading: true,
  },

  onShow() {
    // 每次进入都刷新（考试状态可能变化）
    if (wx.getStorageSync('rk_token')) this.load();
  },

  load() {
    api('/api/papers')
      .then((data) => this.setData({ papers: data.papers, loading: false }))
      .catch((e) => {
        this.setData({ loading: false });
        if (e.message.indexOf('未登录') >= 0 || e.message.indexOf('登录已过期') >= 0) {
          wx.reLaunch({ url: '/pages/login/login' });
        } else {
          wx.showToast({ title: e.message, icon: 'none' });
        }
      });
  },

  goExam(e) {
    const paperId = e.currentTarget.dataset.id;
    const title = e.currentTarget.dataset.title;
    api('/api/exams', { method: 'POST', body: { paperId } })
      .then((data) => {
        if (!data.resumed) wx.showToast({ title: '请先阅读考场须知', icon: 'none' });
        wx.navigateTo({ url: '/pages/notice/notice?recordId=' + data.recordId + '&title=' + encodeURIComponent(title) });
      })
      .catch((err) => wx.showToast({ title: err.message, icon: 'none' }));
  },

  goResults() {
    wx.navigateTo({ url: '/pages/results/results' });
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id });
  },

  logout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录吗？',
      success: (r) => {
        if (r.confirm) {
          wx.removeStorageSync('rk_token');
          wx.removeStorageSync('rk_user');
          wx.reLaunch({ url: '/pages/login/login' });
        }
      },
    });
  },
});
