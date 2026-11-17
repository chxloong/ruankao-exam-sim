<template>
  <div class="exam-page" v-if="loaded">
    <!-- 顶栏 -->
    <header class="exam-topbar">
      <div class="exam-title">{{ paper.title }}</div>
      <div class="exam-topbar-right">
        <div class="timer" :class="{ danger: remainSeconds <= 300 }">
          <span class="timer-label">剩余时间</span>
          <span class="timer-value">{{ timeText }}</span>
        </div>
        <el-button type="danger" @click="submitExam(false)">交 卷</el-button>
      </div>
    </header>

    <div class="exam-body">
      <!-- 题目区 -->
      <main class="question-pane">
        <div class="question-card">
          <div class="question-meta">
            <span class="q-index">第 {{ currentIndex + 1 }} / {{ questions.length }} 题</span>
            <el-tag size="small" type="info">{{ currentQuestion.section }}</el-tag>
            <el-tag size="small">{{ typeLabel(currentQuestion.type) }}</el-tag>
            <el-tag size="small" type="warning" effect="plain">{{ currentQuestion.score }} 分</el-tag>
            <el-button
              size="small"
              :type="currentAnswer.marked ? 'warning' : 'default'"
              :plain="!currentAnswer.marked"
              @click="toggleMark"
            >
              {{ currentAnswer.marked ? '★ 已标记' : '☆ 标记此题' }}
            </el-button>
          </div>

          <div class="q-stem">{{ currentQuestion.stem }}</div>

          <!-- 单选 -->
          <div v-if="currentQuestion.type === 'single'" class="options">
            <div
              v-for="(opt, i) in currentQuestion.options"
              :key="i"
              class="option-row"
              :class="{ selected: currentAnswer.value === LETTERS[i] }"
              @click="selectSingle(LETTERS[i])"
            >
              <span class="option-letter">{{ LETTERS[i] }}</span>
              <span class="option-text">{{ opt }}</span>
            </div>
          </div>

          <!-- 多选 -->
          <div v-else-if="currentQuestion.type === 'multiple'" class="options">
            <div
              v-for="(opt, i) in currentQuestion.options"
              :key="i"
              class="option-row"
              :class="{ selected: selectedLetters.includes(LETTERS[i]) }"
              @click="toggleMultiple(LETTERS[i])"
            >
              <span class="option-letter">{{ LETTERS[i] }}</span>
              <span class="option-text">{{ opt }}</span>
            </div>
            <div class="multi-tip">多选题：少选得部分分，错选不得分</div>
          </div>

          <!-- 主观题 -->
          <div v-else class="text-answer">
            <el-input
              v-model="currentAnswer.value"
              type="textarea"
              :autosize="{ minRows: 14, maxRows: 24 }"
              placeholder="请在此作答…（案例分析请按问题序号分条作答；论文请写完整文章）"
              @input="scheduleSave"
            />
            <div class="word-count">已输入 {{ (currentAnswer.value || '').length }} 字</div>
          </div>

          <div class="question-footer">
            <el-button :disabled="currentIndex === 0" @click="prevQuestion">上一题</el-button>
            <span class="save-hint">{{ saveHint }}</span>
            <el-button :disabled="currentIndex === questions.length - 1" type="primary" @click="nextQuestion">
              下一题
            </el-button>
          </div>
        </div>
      </main>

      <!-- 答题卡 -->
      <aside class="sheet-pane">
        <div class="sheet-card">
          <div class="sheet-title">答题卡</div>
          <div class="sheet-legend">
            <span class="legend-item"><i class="dot dot-answered"></i>已作答</span>
            <span class="legend-item"><i class="dot dot-marked"></i>已标记</span>
            <span class="legend-item"><i class="dot dot-blank"></i>未作答</span>
          </div>
          <div v-for="sec in sections" :key="sec.name" class="sheet-section">
            <div class="sheet-section-name">{{ sec.name }}（{{ sec.questions.length }} 题）</div>
            <div class="sheet-grid">
              <div
                v-for="(q, i) in sec.questions"
                :key="q.question_id"
                class="sheet-item"
                :class="{
                  answered: isAnswered(q),
                  marked: answers[q.question_id]?.marked,
                  current: flatIndexOf(q) === currentIndex,
                }"
                @click="jumpTo(flatIndexOf(q))"
              >
                {{ flatIndexOf(q) + 1 }}
              </div>
            </div>
          </div>
          <div class="sheet-stat">
            已答 {{ answeredCount }} / {{ questions.length }}，未答 {{ questions.length - answeredCount }}
          </div>
        </div>

        <el-button class="calc-btn" @click="calcVisible = true">计 算 器</el-button>
        <el-button class="calc-btn" type="danger" plain @click="submitExam(false)">交 卷</el-button>
      </aside>
    </div>

    <ExamCalculator v-model="calcVisible" />
  </div>

  <div v-else class="exam-loading">
    <el-skeleton :rows="8" animated />
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api, LETTERS } from '../api';
import ExamCalculator from '../components/ExamCalculator.vue';

const route = useRoute();
const router = useRouter();
const recordId = route.params.recordId;

const loaded = ref(false);
const paper = ref(null);
const questions = ref([]);
const answers = reactive({});
const currentIndex = ref(0);
const remainSeconds = ref(0);
const saveHint = ref('');
const calcVisible = ref(false);
const submitting = ref(false);

let timer = null;
let saveTimer = null;
let lastSavedAt = 0;

// ---------- 数据加载 ----------
onMounted(async () => {
  try {
    const data = await api(`/api/exams/${recordId}`);
    paper.value = data.paper;
    questions.value = data.questions;
    remainSeconds.value = data.record.remainSeconds;
    for (const q of data.questions) {
      const saved = data.record.answers.find((a) => a.questionId === q.question_id);
      answers[q.question_id] = { value: saved?.value ?? null, marked: !!saved?.marked };
    }
    loaded.value = true;
    startTimer();
    window.addEventListener('beforeunload', onBeforeUnload);
  } catch (e) {
    ElMessage.error(e.message);
    router.replace('/');
  }
});

onBeforeUnmount(() => {
  clearInterval(timer);
  clearTimeout(saveTimer);
  window.removeEventListener('beforeunload', onBeforeUnload);
});

function onBeforeUnload() {
  // 页面关闭前用 keepalive 尽力保存一次
  doSave(true);
}

// ---------- 计时 ----------
function startTimer() {
  timer = setInterval(() => {
    if (remainSeconds.value > 0) remainSeconds.value--;
    if (remainSeconds.value <= 0) {
      clearInterval(timer);
      submitExam(true);
    }
  }, 1000);
}

const timeText = computed(() => {
  const s = remainSeconds.value;
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
});

// ---------- 结构推导 ----------
const sections = computed(() => {
  const list = [];
  const map = new Map();
  for (const q of questions.value) {
    if (!map.has(q.section)) {
      const sec = { name: q.section, questions: [] };
      map.set(q.section, sec);
      list.push(sec);
    }
    map.get(q.section).questions.push(q);
  }
  return list;
});

function flatIndexOf(q) {
  return questions.value.findIndex((x) => x.question_id === q.question_id);
}

const currentQuestion = computed(() => questions.value[currentIndex.value]);
const currentAnswer = computed(() => answers[currentQuestion.value.question_id]);
const selectedLetters = computed(() => String(currentAnswer.value?.value || '').split('').filter(Boolean));

const answeredCount = computed(() => questions.value.filter((q) => isAnswered(q)).length);

function isAnswered(q) {
  const v = answers[q.question_id]?.value;
  if (q.type === 'text') return typeof v === 'string' && v.trim().length > 0;
  return !!v;
}

function typeLabel(type) {
  return type === 'single' ? '单选题' : type === 'multiple' ? '多选题' : type === 'text' ? '主观题' : type;
}

// ---------- 作答交互 ----------
function selectSingle(letter) {
  currentAnswer.value.value = letter;
  scheduleSave();
}

function toggleMultiple(letter) {
  const set = new Set(selectedLetters.value);
  if (set.has(letter)) set.delete(letter);
  else set.add(letter);
  currentAnswer.value.value = [...set].sort().join('');
  scheduleSave();
}

function toggleMark() {
  currentAnswer.value.marked = !currentAnswer.value.marked;
  scheduleSave();
}

function prevQuestion() {
  if (currentIndex.value > 0) {
    currentIndex.value--;
    scheduleSave();
  }
}

function nextQuestion() {
  if (currentIndex.value < questions.value.length - 1) {
    currentIndex.value++;
    scheduleSave();
  }
}

function jumpTo(index) {
  currentIndex.value = index;
  scheduleSave();
}

// ---------- 自动保存 ----------
function scheduleSave() {
  const now = Date.now();
  if (now - lastSavedAt >= 5000) return doSave();
  if (saveTimer) return;
  saveTimer = setTimeout(() => doSave(), 5000 - (now - lastSavedAt));
}

async function doSave(keepalive = false) {
  clearTimeout(saveTimer);
  saveTimer = null;
  const payload = questions.value.map((q) => ({
    questionId: q.question_id,
    value: answers[q.question_id]?.value ?? null,
    marked: !!answers[q.question_id]?.marked,
  }));
  try {
    await api(`/api/exams/${recordId}/answers`, { method: 'PUT', body: { answers: payload }, keepalive });
    lastSavedAt = Date.now();
    saveHint.value = `已自动保存 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`;
  } catch {
    saveHint.value = '保存失败，继续作答后会自动重试';
  }
}

// ---------- 交卷 ----------
async function submitExam(auto = false) {
  if (submitting.value) return;
  if (!auto) {
    const unanswered = questions.value.length - answeredCount.value;
    const marked = questions.value.filter((q) => answers[q.question_id]?.marked).length;
    let msg = `已作答 ${answeredCount.value} 题，未作答 ${unanswered} 题`;
    if (marked) msg += `，标记 ${marked} 题`;
    msg += '。确认交卷吗？交卷后将立即评分，不能再修改答案。';
    try {
      await ElMessageBox.confirm(msg, '交卷确认', {
        type: 'warning',
        confirmButtonText: '确认交卷',
        cancelButtonText: '继续作答',
      });
    } catch {
      return;
    }
  }
  submitting.value = true;
  try {
    await doSave();
    const r = await api(`/api/exams/${recordId}/submit`, { method: 'POST' });
    if (r.autoSubmitted) ElMessage.warning('考试时间已到，系统已自动交卷');
    else ElMessage.success('交卷成功');
    router.replace(`/results/${recordId}`);
  } catch (e) {
    submitting.value = false;
    ElMessage.error(e.message);
  }
}
</script>

<style scoped>
.exam-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f0f2f5;
}
.exam-topbar {
  height: 56px;
  background: #1c3faa;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  flex-shrink: 0;
}
.exam-title {
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.exam-topbar-right {
  display: flex;
  align-items: center;
  gap: 20px;
}
.timer {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  padding: 6px 14px;
}
.timer-label {
  font-size: 13px;
}
.timer-value {
  font-family: Consolas, monospace;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 1px;
}
.timer.danger .timer-value {
  color: #ffd04b;
  animation: blink 1s infinite;
}
@keyframes blink {
  50% {
    opacity: 0.55;
  }
}
.exam-body {
  flex: 1;
  display: flex;
  gap: 16px;
  padding: 16px;
  min-height: 0;
}
.question-pane {
  flex: 1;
  min-width: 0;
  display: flex;
}
.question-card {
  flex: 1;
  background: #fff;
  border-radius: 8px;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.question-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.q-index {
  font-weight: 700;
  font-size: 15px;
}
.q-stem {
  white-space: pre-wrap;
  line-height: 1.8;
  font-size: 15px;
  background: #f8f9fb;
  border-left: 4px solid #1c3faa;
  padding: 14px 16px;
  border-radius: 4px;
  margin-bottom: 18px;
}
.options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.option-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  font-size: 15px;
  line-height: 1.6;
}
.option-row:hover {
  border-color: #1c3faa;
  background: #f5f8ff;
}
.option-row.selected {
  border-color: #1c3faa;
  background: #ecf2ff;
}
.option-letter {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1px solid #c0c4cc;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}
.option-row.selected .option-letter {
  background: #1c3faa;
  border-color: #1c3faa;
  color: #fff;
}
.multi-tip {
  color: #909399;
  font-size: 12px;
}
.text-answer {
  display: flex;
  flex-direction: column;
}
.word-count {
  align-self: flex-end;
  color: #909399;
  font-size: 12px;
  margin-top: 4px;
}
.question-footer {
  margin-top: auto;
  padding-top: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.save-hint {
  color: #909399;
  font-size: 12px;
}
.sheet-pane {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}
.sheet-card {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  flex: 1;
}
.sheet-title {
  font-weight: 700;
  margin-bottom: 12px;
}
.sheet-legend {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #606266;
  margin-bottom: 14px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}
.dot {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  display: inline-block;
  border: 1px solid #dcdfe6;
  background: #fff;
}
.dot-answered {
  background: #67c23a;
  border-color: #67c23a;
}
.dot-marked {
  background: #fdf6ec;
  border-color: #e6a23c;
  position: relative;
}
.sheet-section {
  margin-bottom: 14px;
}
.sheet-section-name {
  font-size: 13px;
  color: #303133;
  font-weight: 600;
  margin-bottom: 8px;
}
.sheet-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
}
.sheet-item {
  height: 32px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  cursor: pointer;
  background: #fff;
  user-select: none;
}
.sheet-item:hover {
  border-color: #1c3faa;
}
.sheet-item.answered {
  background: #67c23a;
  border-color: #67c23a;
  color: #fff;
}
.sheet-item.marked {
  border-color: #e6a23c;
  box-shadow: inset 0 0 0 2px #e6a23c;
}
.sheet-item.current {
  outline: 2px solid #1c3faa;
  outline-offset: 1px;
}
.sheet-stat {
  font-size: 13px;
  color: #606266;
  border-top: 1px solid #ebeef5;
  padding-top: 10px;
}
.calc-btn {
  width: 100%;
  margin: 0;
}
.exam-loading {
  max-width: 900px;
  margin: 40px auto;
  background: #fff;
  padding: 24px;
  border-radius: 8px;
}
</style>
