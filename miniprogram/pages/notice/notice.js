const { api } = require('../../utils/api');

Page({
  data: {
    paper: null,
    recordId: null,
  },

  onLoad(options) {
    const recordId = options.recordId;
    this.setData({ recordId });
    api('/api/exams/' + recordId)
      .then((data) => {
        if (data.record.status === 'submitted') {
          wx.showToast({ title: '该考试已交卷', icon: 'none' });
          setTimeout(() => wx.redirectTo({ url: '/pages/detail/detail?id=' + data.record.id }), 600);
          return;
        }
        this.setData({
          paper: {
            title: data.paper.title,
            subject: data.paper.subject,
            duration: data.paper.durationMinutes,
            passScore: data.paper.passScore,
          },
        });
      })
      .catch((e) => {
        wx.showToast({ title: e.message, icon: 'none' });
        setTimeout(() => wx.reLaunch({ url: '/pages/index/index' }), 800);
      });
  },

  enterExam() {
    wx.redirectTo({ url: '/pages/exam/exam?recordId=' + this.data.recordId });
  },
});
