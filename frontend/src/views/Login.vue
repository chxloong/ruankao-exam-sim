<template>
  <div class="auth-bg">
    <el-card class="auth-card">
      <div class="brand">
        <div class="brand-title">软考机考模拟练习系统</div>
        <div class="brand-sub">全国计算机技术与软件专业技术资格（水平）考试 · 仿真练习</div>
      </div>
      <el-form :model="form" label-position="top" @keyup.enter="onLogin">
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="请输入用户名" size="large" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password placeholder="请输入密码" size="large" />
        </el-form-item>
        <el-button type="primary" size="large" style="width: 100%" :loading="loading" @click="onLogin">
          登 录
        </el-button>
        <div class="auth-links">
          <router-link to="/register">没有账号？去注册</router-link>
        </div>
        <el-alert
          title="演示账号：管理员 admin / admin123，考生 student / 123456"
          type="info"
          :closable="false"
          style="margin-top: 16px"
        />
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const form = reactive({ username: '', password: '' });
const loading = ref(false);

async function onLogin() {
  if (!form.username || !form.password) return ElMessage.warning('请输入用户名和密码');
  loading.value = true;
  try {
    await auth.login(form.username.trim(), form.password);
    ElMessage.success('登录成功');
    router.push(route.query.redirect || '/');
  } catch (e) {
    ElMessage.error(e.message);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.auth-bg {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1c3faa 0%, #2f6fdb 60%, #4a8ef0 100%);
}
.auth-card {
  width: 420px;
  border-radius: 10px;
}
.brand {
  text-align: center;
  margin-bottom: 20px;
}
.brand-title {
  font-size: 22px;
  font-weight: 700;
  color: #1c3faa;
}
.brand-sub {
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
}
.auth-links {
  margin-top: 12px;
  text-align: right;
  font-size: 13px;
}
</style>
