<template>
  <div class="detail-page" v-if="loaded">
    <header class="topbar">
      <el-button link @click="router.push('/results')">← 返回成绩列表</el-button>
      <div class="topbar-title">成绩详情</div>
      <span></span>
    </header>

    <main class="main">
      <!-- 总览 -->
      <el-card class="summary" shadow="never">
        <div class="summary-title">{{ paper.title }}</div>
        <div class="summary-sub">{{ paper.subject }} · 交卷时间 {{ formatTime(record.submittedAt) }}</div>
        <div class="summary-stats">
          <div class="stat">
            <div class="stat-value" :class="passed ? 'pass' : 'fail'">{{ record.totalScore ?? '-' }}</div>
            <div class="stat-label">总分（满分 {{ paper.totalScore }}）</div>
          </div>
          <div class="stat">
            <div class="stat-value">{{ paper.passScore }}</div>
            <div class="stat-label">及格线</div>
          </div>
          <div class="stat">
            <el-tag :type="passed ? 'success' : 'danger'" size="large">{{ passed ? '通 过' : '未通过' }}</el-tag>
          </div>
          <div class="stat">
            <el-tag v-if="record.selfScored" type="success" size="large">主观题已自评</el-tag>
            <el-tag v-else type="warning" size="large">主观题待自评</el-tag>
          </div>
        </div>
        <el-alert
          v-if="!record.selfScored && hasSubjective"
          title="案例分析/论文为主观题，系统无法自动评分。请对照各题【参考答案】自评分数，自评后总分与通过判定才会最终生效。"
          type="warning"
          :closable="false"
          style="margin-top: 12px"
        />
      </el-card>

      <!-- 分节回看 -->
      <div v-for="sec in sections" :key="sec.name" class="section">
        <div class="section-name">{{ sec.name }}</div>
        <el-card v-for="q in sec.questions" :key="q.question_id" class="q-card" shadow="never">
          <div class="q-head">
            <span class="q-no">第 {{ flatNo(q) }} 题</span>
            <el-tag size="small">{{ typeLabel(q.type) }}</el-tag>
            <el-tag size="small" type="warning" effect="plain">{{ q.score }} 分</el-tag>
            <span class="q-score">得分：
              <b :class="scoreClass(q)">{{ scoreOf(q) ?? '待自评' }}</b> / {{ q.score }}
            </span>
          </div>

          <div class="q-stem">{{ q.stem }}</div>

          <!-- 客观题 -->
          <template v-if="q.type !== 'text'">
            <div class="q-options">
              <div v-for="(opt, i) in q.options" :key="i" class="opt" :class="optClass(q, LETTERS[i])">
                <b>{{ LETTERS[i] }}.</b> {{ opt }}
              </div>
            </div>
            <div class="q-answer-line">
              你的答案：<b :class="myAnswerClass(q)">{{ myAnswer(q) || '未作答' }}</b>
              <el-divider direction="vertical" />
              正确答案：<b class="correct">{{ q.answer }}</b>
              <el-divider direction="vertical" />
              <el-tag :type="isCorrect(q) ? 'success' : 'danger'" size="small">
                {{ isCorrect(q) ? '答对' : '答错' }}
              </el-tag>
            </div>
          </template>

          <!-- 主观题 -->
          <template v-else>
            <div class="q-answer-line">
              你的作答：
              <span v-if="!myAnswer(q)" class="muted">（未作答）</span>
            </div>
            <div v-if="myAnswer(q)" class="my-text">{{ myAnswer(q) }}</div>

            <div class="q-answer-line" style="margin-top: 12px">参考答案：</div>
            <div class="ref-text">{{ q.answer_text }}</div>

            <div class="self-score">
              <span>自评得分：</span>
              <el-input-number
                v-model="selfScores[q.question_id]"
                :min="0"
                :max="q.score"
                :step="1"
                size="small"
              />
              <el-button size="small" type="primary" @click="saveSelfScore(q)">保存自评</el-button>
            </div>
          </template>

          <div v-if="q.analysis" class="q-analysis">解析：{{ q.analysis }}</div>
        </el-card>
      </div>
    </main>
  </div>
  <div v-else class="detail-page">
    <el-skeleton :rows="8" animated style="max-width: 900px; margin: 40px auto" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api, LETTERS } from '../api';

const route = useRoute();
const router = useRouter();
const loaded = ref(false);
const record = ref(null);
const paper = ref(null);
const questions = ref([]);
const selfScores = reactive({});

function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN', { hour12: false });
}

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

function flatNo(q) {
  return questions.value.findIndex((x) => x.question_id === q.question_id) + 1;
}

const hasSubjective = computed(() => questions.value.some((q) => q.type === 'text'));
const passed = computed(() => record.value.totalScore != null && record.value.totalScore >= paper.value.passScore);

function myAnswer(q) {
  const a = record.value.answers.find((x) => x.questionId === q.question_id);
  return a?.value ?? '';
}

function scoreItem(q) {
  return record.value.scores.find((x) => x.questionId === q.question_id);
}

function scoreOf(q) {
  return scoreItem(q)?.score;
}

function scoreClass(q) {
  const item = scoreItem(q);
  if (!item || item.score == null) return 'muted';
  return item.score >= item.max ? 'pass' : item.score > 0 ? 'partial' : 'fail';
}

function isCorrect(q) {
  return !!scoreItem(q)?.correct;
}

function myAnswerClass(q) {
  return isCorrect(q) ? 'pass' : 'fail';
}

function optClass(q, letter) {
  const answer = String(q.answer || '');
  const mine = String(myAnswer(q) || '');
  const isAnswer = answer.includes(letter);
  const isMine = mine.includes(letter);
  return { 'opt-answer': isAnswer, 'opt-wrong': isMine && !isAnswer };
}

function typeLabel(type) {
  return type === 'single' ? '单选题' : type === 'multiple' ? '多选题' : type === 'text' ? '主观题' : type;
}

async function saveSelfScore(q) {
  try {
    const r = await api(`/api/exams/${record.value.id}/self-score`, {
      method: 'PUT',
      body: { questionId: q.question_id, score: selfScores[q.question_id] ?? 0 },
    });
    record.value.totalScore = r.totalScore;
    const item = record.value.scores.find((x) => x.questionId === q.question_id);
    if (item) item.score = selfScores[q.question_id] ?? 0;
    record.value.selfScored = true;
    ElMessage.success(`已记录自评分数，当前总分 ${r.totalScore}`);
  } catch (e) {
    ElMessage.error(e.message);
  }
}

onMounted(async () => {
  try {
    const data = await api(`/api/my/results/${route.params.id}`);
    record.value = data.record;
    paper.value = data.paper;
    questions.value = data.questions;
    for (const q of questions.value.filter((x) => x.type === 'text')) {
      const item = scoreItem(q);
      selfScores[q.question_id] = item?.score ?? 0;
    }
    loaded.value = true;
  } catch (e) {
    ElMessage.error(e.message);
    router.replace('/results');
  }
});
</script>

<style scoped>
.detail-page {
  min-height: 100%;
  padding-bottom: 40px;
}
.topbar {
  height: 56px;
  background: #fff;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 24px;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
}
.topbar-title {
  flex: 1;
  text-align: center;
  font-size: 17px;
  font-weight: 700;
  color: #1c3faa;
}
.main {
  max-width: 900px;
  margin: 24px auto;
  padding: 0 24px;
}
.summary-title {
  font-size: 20px;
  font-weight: 700;
}
.summary-sub {
  color: #909399;
  margin-top: 6px;
  font-size: 13px;
}
.summary-stats {
  display: flex;
  align-items: center;
  gap: 48px;
  margin-top: 18px;
}
.stat {
  text-align: center;
}
.stat-value {
  font-size: 28px;
  font-weight: 700;
}
.stat-label {
  color: #909399;
  font-size: 12px;
  margin-top: 4px;
}
.section {
  margin-top: 24px;
}
.section-name {
  font-size: 17px;
  font-weight: 700;
  border-left: 4px solid #1c3faa;
  padding-left: 10px;
  margin-bottom: 12px;
}
.q-card {
  margin-bottom: 16px;
}
.q-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.q-no {
  font-weight: 700;
}
.q-score {
  margin-left: auto;
  font-size: 14px;
}
.q-stem {
  white-space: pre-wrap;
  line-height: 1.8;
  background: #f8f9fb;
  border-left: 4px solid #1c3faa;
  padding: 12px 14px;
  border-radius: 4px;
  margin: 14px 0;
  font-size: 14px;
}
.q-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.opt {
  padding: 8px 12px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  line-height: 1.6;
}
.opt-answer {
  border-color: #67c23a;
  background: #f0f9eb;
}
.opt-wrong {
  border-color: #f56c6c;
  background: #fef0f0;
}
.q-answer-line {
  margin-top: 12px;
  font-size: 14px;
  line-height: 1.8;
}
.pass {
  color: #67c23a;
}
.partial {
  color: #e6a23c;
}
.fail {
  color: #f56c6c;
}
.muted {
  color: #909399;
}
.correct {
  color: #67c23a;
}
.my-text,
.ref-text {
  white-space: pre-wrap;
  background: #f8f9fb;
  border-radius: 4px;
  padding: 12px 14px;
  line-height: 1.8;
  font-size: 14px;
  margin-top: 8px;
}
.ref-text {
  background: #f0f9eb;
}
.self-score {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.q-analysis {
  margin-top: 12px;
  color: #909399;
  font-size: 13px;
  border-top: 1px dashed #ebeef5;
  padding-top: 10px;
  white-space: pre-wrap;
}

/* 竖屏手机适配 */
@media (max-width: 768px) {
  .main {
    margin: 14px auto;
    padding: 0 12px;
  }
  .summary-stats {
    flex-wrap: wrap;
    gap: 20px;
  }
  .stat-value {
    font-size: 22px;
  }
  .q-stem {
    font-size: 13px;
    padding: 10px 12px;
  }
  .my-text,
  .ref-text {
    font-size: 13px;
    padding: 10px 12px;
  }
  .self-score {
    flex-wrap: wrap;
  }
  .topbar {
    padding: 0 12px;
  }
  .topbar-title {
    font-size: 15px;
  }
}
</style>
