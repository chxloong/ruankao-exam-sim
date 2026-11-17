<template>
  <div class="results-page">
    <header class="topbar">
      <el-button link @click="router.push('/')">← 返回首页</el-button>
      <div class="topbar-title">我的成绩</div>
      <span class="username">{{ auth.user?.username }}</span>
    </header>

    <main class="main">
      <el-empty v-if="!results.length" description="还没有考试记录，快去首页开始模拟练习吧" />
      <el-table v-else :data="results" stripe>
        <el-table-column prop="paperTitle" label="试卷" min-width="220" />
        <el-table-column prop="subject" label="科目" width="180" />
        <el-table-column label="总分" width="100">
          <template #default="{ row }">
            <span :class="row.passed ? 'pass' : 'fail'">{{ row.totalScore ?? '待自评' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="passScore" label="及格线" width="80" />
        <el-table-column label="判定" width="100">
          <template #default="{ row }">
            <el-tag :type="row.passed ? 'success' : 'danger'">{{ row.passed ? '通过' : '未通过' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="主观题自评" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.selfScored" type="success" size="small">已完成</el-tag>
            <el-tag v-else type="warning" size="small">待完成</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="submittedAt" label="交卷时间" width="180">
          <template #default="{ row }">{{ formatTime(row.submittedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="router.push(`/results/${row.id}`)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();
const results = ref([]);

function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN', { hour12: false });
}

onMounted(async () => {
  try {
    const data = await api('/api/my/results');
    results.value = data.results;
  } catch (e) {
    ElMessage.error(e.message);
  }
});
</script>

<style scoped>
.results-page {
  min-height: 100%;
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
.username {
  color: #606266;
  font-size: 14px;
}
.main {
  max-width: 1100px;
  margin: 24px auto;
  padding: 0 24px;
}
.pass {
  color: #67c23a;
  font-weight: 700;
}
.fail {
  color: #f56c6c;
  font-weight: 700;
}
</style>
