const { api } = require('../../utils/api');

const LETTERS = 'ABCDEFGH'.split('');

Page({
  data: {
    paper: null,
    record: null,
    sections: [],
    scoreMap: {},
    answerMap: {},
    myScoreText: {},
    selfInput: {},
    totalScore: null,
  },

  id: null,

  onLoad(options) {
    this.id = options.id;
    wx.showLoading({ title: '加载成绩' });
    api('/api/my/results/' + this.id)
      .then((data) => {
        wx.hideLoading();
        const scoreMap = {};
        data.record.scores.forEach((s) => (scoreMap[s.questionId] = s));
        const answerMap = {};
        data.record.answers.forEach((a) => (answerMap[a.questionId] = a));
        const sections = [];
        const map = {};
        const selfInput = {};
        data.questions.forEach((q) => {
          if (!map[q.section]) {
            map[q.section] = { name: q.section, questions: [] };
            sections.push(map[q.section]);
          }
          const enriched = {
            ...q,
            letters: q.type === 'text' ? [] : LETTERS.slice(0, (q.options || []).length),
            myAnswer: (answerMap[q.question_id] || {}).value || '',
            scoreItem: scoreMap[q.question_id] || { score: null, max: q.score, correct: null },
          };
          if (q.type === 'text') {
            selfInput[q.question_id] = scoreMap[q.question_id] && scoreMap[q.question_id].score !== null ? scoreMap[q.question_id].score : 0;
          }
          map[q.section].questions.push(enriched);
        });
        this.setData({
          record: { ...data.record },
          paper: data.paper,
          sections,
          scoreMap,
          answerMap,
          selfInput,
          totalScore: data.record.totalScore,
        });
        wx.setNavigationBarTitle({ title: '成绩详情' });
      })
      .catch((e) => {
        wx.hideLoading();
        wx.showToast({ title: e.message, icon: 'none' });
        setTimeout(() => wx.navigateBack(), 800);
      });
  },

  fmt(q) {
    return (this.data.selfInput[q.question_id] || 0).toString();
  },

  // 自评输入
  onSelfInput(e) {
    const qid = e.currentTarget.dataset.qid;
    this.setData({ ['selfInput.' + qid]: Number(e.detail.value) || 0 });
  },

  saveSelf(e) {
    const qid = Number(e.currentTarget.dataset.qid);
    const score = this.data.selfInput[qid] || 0;
    api('/api/exams/' + this.id + '/self-score', { method: 'PUT', body: { questionId: qid, score } })
      .then((r) => {
        const sections = this.data.sections.map((sec) => ({
          ...sec,
          questions: sec.questions.map((q) =>
            q.question_id === qid ? { ...q, scoreItem: { ...q.scoreItem, score } } : q
          ),
        }));
        this.setData({ sections, totalScore: r.totalScore, 'record.selfScored': true });
        wx.showToast({ title: '已记录自评，总分 ' + r.totalScore, icon: 'success' });
      })
      .catch((err) => wx.showToast({ title: err.message, icon: 'none' }));
  },
});
