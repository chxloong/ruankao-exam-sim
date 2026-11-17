<template>
  <div class="auth-bg">
    <el-card class="auth-card">
      <div class="brand">
        <div class="brand-title">注册账号</div>
        <div class="brand-sub">注册后即可参加模拟练习并保存成绩</div>
      </div>
      <el-form :model="form" label-position="top" @keyup.enter="onRegister">
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="2-20 位字母、数字、下划线或中文" size="large" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password placeholder="至少 6 位" size="large" />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input v-model="form.confirm" type="password" show-password placeholder="再次输入密码" size="large" />
        </el-form-item>
        <el-button type="primary" size="large" style="width: 100%" :loading="loading" @click="onRegister">
          注 册
        </el-button>
        <div class="auth-links">
          <router-link to="/login">已有账号？去登录</router-link>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();
const form = reactive({ username: '', password: '', confirm: '' });
const loading = ref(false);

async function onRegister() {
  if (!form.username || !form.password) return ElMessage.warning('请输入用户名和密码');
  if (form.password !== form.confirm) return ElMessage.warning('两次输入的密码不一致');
  loading.value = true;
  try {
    const data = await auth.register(form.username.trim(), form.password);
    ElMessageBox.alert(data.message || '注册成功，账号待管理员审核通过后即可登录', '注册成功', {
      confirmButtonText: '去登录',
      callback: () => router.push('/login'),
    });
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

/* 竖屏手机适配 */
@media (max-width: 768px) {
  .auth-card {
    width: min(420px, 92vw);
  }
  .brand-title {
    font-size: 18px;
  }
}
</style>
