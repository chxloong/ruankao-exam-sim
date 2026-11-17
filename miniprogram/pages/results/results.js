const { api } = require('../../utils/api');

Page({
  data: {
    results: [],
    loading: true,
  },

  onShow() {
    if (!wx.getStorageSync('rk_token')) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.load();
  },

  load() {
    api('/api/my/results')
      .then((data) => {
        const results = data.results.map((r) => ({ ...r, timeText: this.formatTime(r.submittedAt) }));
        this.setData({ results, loading: false });
      })
      .catch((e) => {
        this.setData({ loading: false });
        wx.showToast({ title: e.message, icon: 'none' });
      });
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id });
  },

  formatTime(iso) {
    if (!iso) return '-';
    const d = new Date(iso.replace(' ', 'T'));
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  },
});
