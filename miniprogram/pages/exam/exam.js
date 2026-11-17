const { api } = require('../../utils/api');

const LETTERS = 'ABCDEFGH'.split('');

Page({
  data: {
    letters: LETTERS,
    paper: { title: '', passScore: 0 },
    questions: [],
    sections: [],
    flatIndex: {},
    answers: {},
    answeredMap: {},
    marksMap: {},
    answeredCount: 0,
    current: 0,
    currentQ: null,
    currentAnswer: { value: '', marked: false },
    selMap: {},
    textLen: 0,
    remainSeconds: 0,
    timeText: '00:00:00',
    sheetOpen: false,
    saveHint: '',
  },

  recordId: null,
  timer: null,
  saveTimer: null,
  lastSavedAt: 0,
  submitting: false,
  loaded: false,

  onLoad(options) {
    this.recordId = options.recordId;
    wx.showLoading({ title: '加载试卷' });
    api('/api/exams/' + this.recordId)
      .then((data) => {
        wx.hideLoading();
        if (data.record.status === 'submitted') {
          wx.redirectTo({ url: '/pages/detail/detail?id=' + data.record.id });
          return;
        }
        const answers = {};
        data.questions.forEach((q) => {
          const saved = data.record.answers.find((a) => a.questionId === q.question_id);
          answers[q.question_id] = { value: saved ? saved.value : null, marked: !!(saved && saved.marked) };
        });
        const flatIndex = {};
        data.questions.forEach((q, i) => (flatIndex[q.question_id] = i));
        // 按首现顺序分节
        const sections = [];
        const map = {};
        data.questions.forEach((q) => {
          if (!map[q.section]) {
            map[q.section] = { name: q.section, questions: [] };
            sections.push(map[q.section]);
          }
          map[q.section].questions.push(q);
        });
        this.setData({
          paper: { title: data.paper.title, passScore: data.paper.passScore },
          questions: data.questions,
          sections,
          flatIndex,
          answers,
          remainSeconds: data.record.remainSeconds,
        });
        this.loaded = true;
        this.refreshView();
        this.startTimer();
        wx.setNavigationBarTitle({ title: data.paper.title });
      })
      .catch((e) => {
        wx.hideLoading();
        wx.showModal({ title: '加载失败', content: e.message, showCancel: false, success: () => wx.reLaunch({ url: '/pages/index/index' }) });
      });
  },

  onUnload() {
    this.stopTimer();
    if (this.loaded) this.doSave();
  },
  onHide() {
    if (this.loaded) this.doSave();
  },

  // ---------- 计时 ----------
  startTimer() {
    this.timer = setInterval(() => {
      if (this.data.remainSeconds > 0) {
        const r = this.data.remainSeconds - 1;
        this.setData({ remainSeconds: r, timeText: this.formatTime(r) });
        if (r <= 0) this.submitExam(true);
      }
    }, 1000);
    this.setData({ timeText: this.formatTime(this.data.remainSeconds) });
  },
  stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  },
  formatTime(s) {
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return h + ':' + m + ':' + sec;
  },

  // ---------- 视图刷新 ----------
  refreshView() {
    const { questions, answers, flatIndex, current } = this.data;
    const q = questions[current];
    const answeredMap = {};
    const marksMap = {};
    let answeredCount = 0;
    questions.forEach((x) => {
      const a = answers[x.question_id] || {};
      const ok = x.type === 'text' ? typeof a.value === 'string' && a.value.trim().length > 0 : !!a.value;
      answeredMap[x.question_id] = ok;
      marksMap[x.question_id] = !!a.marked;
      if (ok) answeredCount++;
    });
    const selMap = {};
    if (q && q.type === 'multiple') {
      String((answers[q.question_id] || {}).value || '').split('').forEach((c) => (selMap[c] = true));
    }
    const ca = answers[q.question_id] || { value: '', marked: false };
    this.setData({
      currentQ: q,
      currentAnswer: ca,
      selMap,
      textLen: q.type === 'text' ? (ca.value || '').length : 0,
      answeredMap,
      marksMap,
      answeredCount,
      unansweredCount: questions.length - answeredCount,
    });
  },

  typeLabel(type) {
    return type === 'single' ? '单选题' : type === 'multiple' ? '多选题' : '主观题';
  },

  // ---------- 作答 ----------
  pickSingle(e) {
    const i = e.currentTarget.dataset.i;
    const q = this.data.currentQ;
    const a = this.data.answers[q.question_id];
    a.value = LETTERS[i];
    this.setData({ answers: this.data.answers });
    this.refreshView();
    this.scheduleSave();
  },

  toggleMulti(e) {
    const i = e.currentTarget.dataset.i;
    const q = this.data.currentQ;
    const a = this.data.answers[q.question_id];
    const set = {};
    String(a.value || '').split('').forEach((c) => (set[c] = true));
    const letter = LETTERS[i];
    if (set[letter]) delete set[letter];
    else set[letter] = true;
    a.value = Object.keys(set).sort().join('');
    this.setData({ answers: this.data.answers });
    this.refreshView();
    this.scheduleSave();
  },

  onText(e) {
    const q = this.data.currentQ;
    this.data.answers[q.question_id].value = e.detail.value;
    this.setData({ textLen: e.detail.value.length, 'currentAnswer.value': e.detail.value });
    this.scheduleSave();
  },

  toggleMark() {
    const q = this.data.currentQ;
    const a = this.data.answers[q.question_id];
    a.marked = !a.marked;
    this.setData({ answers: this.data.answers });
    this.refreshView();
    this.scheduleSave();
  },

  prev() {
    if (this.data.current > 0) {
      this.setData({ current: this.data.current - 1 });
      this.refreshView();
      this.scheduleSave();
    }
  },
  next() {
    if (this.data.current < this.data.questions.length - 1) {
      this.setData({ current: this.data.current + 1 });
      this.refreshView();
      this.scheduleSave();
    }
  },
  toggleSheet() {
    this.setData({ sheetOpen: !this.data.sheetOpen });
  },
  jump(e) {
    const fid = e.currentTarget.dataset.fid;
    this.setData({ current: fid, sheetOpen: false });
    this.refreshView();
    this.scheduleSave();
  },

  // ---------- 自动保存 ----------
  scheduleSave() {
    const now = Date.now();
    if (now - this.lastSavedAt >= 5000) return this.doSave();
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => this.doSave(), 5000 - (now - this.lastSavedAt));
  },

  doSave() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (!this.loaded) return;
    const payload = this.data.questions.map((q) => {
      const a = this.data.answers[q.question_id] || {};
      return { questionId: q.question_id, value: a.value === undefined ? null : a.value, marked: !!a.marked };
    });
    api('/api/exams/' + this.recordId + '/answers', { method: 'PUT', body: { answers: payload } })
      .then(() => {
        this.lastSavedAt = Date.now();
        this.setData({ saveHint: '已自动保存 ' + new Date().toLocaleTimeString('zh-CN', { hour12: false }) });
      })
      .catch(() => this.setData({ saveHint: '保存失败，继续作答后会自动重试' }));
  },

  // ---------- 交卷 ----------
  confirmSubmit() {
    const { answeredCount, questions, answers } = this.data;
    const unanswered = questions.length - answeredCount;
    let marked = 0;
    questions.forEach((q) => {
      if ((answers[q.question_id] || {}).marked) marked++;
    });
    let msg = '已作答 ' + answeredCount + ' 题，未作答 ' + unanswered + ' 题';
    if (marked) msg += '，标记 ' + marked + ' 题';
    msg += '。确认交卷吗？交卷后将立即评分，不能再修改答案。';
    wx.showModal({
      title: '交卷确认',
      content: msg,
      confirmText: '确认交卷',
      cancelText: '继续作答',
      success: (r) => {
        if (r.confirm) this.submitExam(false);
      },
    });
  },

  submitExam(auto) {
    if (this.submitting) return;
    this.submitting = true;
    this.stopTimer();
    this.doSave();
    api('/api/exams/' + this.recordId + '/submit', { method: 'POST' })
      .then((r) => {
        if (r.autoSubmitted) wx.showToast({ title: '考试时间已到，已自动交卷', icon: 'none' });
        else wx.showToast({ title: '交卷成功', icon: 'success' });
        setTimeout(() => wx.redirectTo({ url: '/pages/detail/detail?id=' + this.recordId }), 800);
      })
      .catch((e) => {
        this.submitting = false;
        wx.showModal({ title: '交卷失败', content: e.message, showCancel: false });
        this.startTimer();
      });
  },
});
