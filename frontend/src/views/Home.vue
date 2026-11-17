<template>
  <div class="home-page">
    <header class="topbar">
      <div class="topbar-title">软考机考模拟练习系统</div>
      <div class="topbar-right">
        <template v-if="auth.isAdmin">
          <el-button link type="primary" @click="router.push('/admin/questions')">管理后台</el-button>
          <el-divider direction="vertical" />
        </template>
        <el-button link type="primary" @click="router.push('/results')">我的成绩</el-button>
        <el-divider direction="vertical" />
        <span class="username">{{ auth.user?.username }}</span>
        <el-button link @click="onLogout">退出</el-button>
      </div>
    </header>

    <main class="main">
      <div class="banner">
        <div class="banner-title">选择试卷，开始机考模拟练习</div>
        <div class="banner-sub">仿真实考界面：倒计时 · 答题卡 · 标记复查 · 自动保存 · 交卷自动评分</div>
      </div>

      <div v-if="loading" class="loading">
        <el-skeleton :rows="4" animated />
      </div>

      <el-empty v-else-if="!papers.length" description="暂无已发布的试卷，请联系管理员在后台组卷" />

      <div v-else class="paper-grid">
        <el-card v-for="p in papers" :key="p.id" class="paper-card" shadow="hover">
          <div class="paper-head">
            <el-tag effect="dark" type="primary">{{ p.subject }}</el-tag>
            <span v-if="p.myInProgress" class="status-dot">有未完成的考试</span>
          </div>
          <div class="paper-title">{{ p.title }}</div>
          <div class="paper-meta">
            <span>共 {{ p.question_count }} 题</span>
            <el-divider direction="vertical" />
            <span>满分 {{ p.total_score }} 分</span>
            <el-divider direction="vertical" />
            <span>时长 {{ p.duration_minutes }} 分钟</span>
            <el-divider direction="vertical" />
            <span>及格 {{ p.pass_score }} 分</span>
          </div>
          <div class="paper-actions">
            <el-button type="primary" @click="startExam(p)">
              {{ p.myInProgress ? '继续考试' : '开始考试' }}
            </el-button>
            <el-button v-if="p.myLatest" @click="router.push(`/results/${p.myLatest.recordId}`)">
              查看最近成绩（{{ p.myLatest.totalScore }} 分 · {{ p.myLatest.passed ? '通过' : '未通过' }}）
            </el-button>
          </div>
        </el-card>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();
const papers = ref([]);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    const data = await api('/api/papers');
    papers.value = data.papers;
  } catch (e) {
    ElMessage.error(e.message);
  } finally {
    loading.value = false;
  }
}

// 开始或恢复考试：先创建/定位考试记录，再进入须知页
async function startExam(p) {
  try {
    const data = await api('/api/exams', { method: 'POST', body: { paperId: p.id } });
    if (!data.resumed) ElMessage.success('考试已创建，请先阅读考场须知');
    router.push(`/exam/${data.recordId}/notice`);
  } catch (e) {
    ElMessage.error(e.message);
  }
}

function onLogout() {
  ElMessageBox.confirm('确定退出登录吗？', '提示', { type: 'warning' })
    .then(() => {
      auth.logout();
      router.push('/login');
    })
    .catch(() => {});
}

onMounted(load);
</script>

<style scoped>
.home-page {
  min-height: 100%;
}
.topbar {
  height: 56px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
}
.topbar-title {
  font-size: 18px;
  font-weight: 700;
  color: #1c3faa;
}
.topbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}
.username {
  color: #606266;
  margin-right: 4px;
}
.main {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px;
}
.banner {
  background: linear-gradient(120deg, #1c3faa, #2f6fdb);
  color: #fff;
  border-radius: 10px;
  padding: 28px 32px;
  margin-bottom: 24px;
}
.banner-title {
  font-size: 22px;
  font-weight: 700;
}
.banner-sub {
  margin-top: 8px;
  font-size: 13px;
  opacity: 0.85;
}
.paper-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(480px, 1fr));
  gap: 16px;
}
.paper-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.status-dot {
  color: #e6a23c;
  font-size: 13px;
}
.paper-title {
  font-size: 18px;
  font-weight: 600;
  margin: 12px 0 8px;
}
.paper-meta {
  color: #909399;
  font-size: 13px;
}
.paper-actions {
  margin-top: 16px;
  display: flex;
  gap: 8px;
}
.loading {
  background: #fff;
  padding: 24px;
  border-radius: 8px;
}
</style>
