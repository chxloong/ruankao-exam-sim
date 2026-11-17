<template>
  <div class="notice-page" v-if="paper">
    <div class="notice-card">
      <div class="notice-head">
        <div class="notice-title">{{ paper.title }}</div>
        <div class="notice-sub">{{ paper.subject }} · 时长 {{ paper.durationMinutes }} 分钟 · 及格线 {{ paper.passScore }} 分</div>
      </div>

      <div class="notice-body">
        <h3>考场须知</h3>
        <ol>
          <li>本系统为机考模拟练习环境，界面与操作方式仿照真实机考系统。</li>
          <li>点击"我已阅读"后系统开始计时，倒计时结束将自动交卷，请注意把握作答时间。</li>
          <li>作答过程中系统会自动保存你的答案；中途关闭浏览器后可从首页"继续考试"恢复。</li>
          <li>可对题目进行"标记"，答题卡中会以特殊颜色显示，便于考前复查。</li>
          <li>客观题（单选/多选）交卷后自动评分；多选题少选得部分分、错选不得分。</li>
          <li>主观题（案例分析/论文）在文本框中作答，交卷后对照参考答案自评计分。</li>
          <li>作答期间可使用右下角"计算器"工具进行数值计算。</li>
          <li>确认全部作答完成后，点击右上角"交卷"并确认，系统将立即评分。</li>
        </ol>
      </div>

      <div class="notice-footer">
        <el-button size="large" @click="router.push('/')">返回首页</el-button>
        <el-button type="primary" size="large" @click="enterExam">我已阅读，开始考试</el-button>
      </div>
    </div>
  </div>
  <div v-else class="notice-page">
    <el-skeleton class="notice-card" :rows="6" animated />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '../api';

const route = useRoute();
const router = useRouter();
const paper = ref(null);

onMounted(async () => {
  try {
    const data = await api(`/api/exams/${route.params.recordId}`);
    if (data.record.status === 'submitted') {
      ElMessage.warning('该考试已交卷，即将跳转到成绩详情');
      router.replace(`/results/${data.record.id}`);
      return;
    }
    paper.value = data.paper;
  } catch (e) {
    ElMessage.error(e.message);
    router.replace('/');
  }
});

function enterExam() {
  router.push(`/exam/${route.params.recordId}/run`);
}
</script>

<style scoped>
.notice-page {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.notice-card {
  width: 720px;
  background: #fff;
  border-radius: 10px;
  padding: 32px 40px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}
.notice-head {
  border-bottom: 1px solid #ebeef5;
  padding-bottom: 16px;
  margin-bottom: 20px;
}
.notice-title {
  font-size: 22px;
  font-weight: 700;
}
.notice-sub {
  color: #909399;
  margin-top: 8px;
  font-size: 14px;
}
.notice-body h3 {
  margin: 0 0 12px;
}
.notice-body ol li {
  line-height: 2;
  color: #606266;
}
.notice-footer {
  margin-top: 28px;
  display: flex;
  justify-content: center;
  gap: 12px;
}
</style>
