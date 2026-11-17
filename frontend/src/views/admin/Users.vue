<template>
  <div>
    <el-card shadow="never">
      <div class="toolbar">
        <div class="toolbar-title">用户管理</div>
      </div>
      <el-table :data="users" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" label="用户名" min-width="180" />
        <el-table-column label="角色" width="200">
          <template #default="{ row }">
            <el-select :model-value="row.role" size="small" :disabled="row.id === myId" @change="(v) => changeRole(row, v)">
              <el-option label="考生" value="user" />
              <el-option label="管理员" value="admin" />
            </el-select>
            <el-tag v-if="row.id === myId" size="small" type="info" style="margin-left: 8px">当前登录</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="注册时间" width="200" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../../api';
import { useAuthStore } from '../../stores/auth';

const auth = useAuthStore();
const users = ref([]);
const loading = ref(false);
const myId = auth.user?.id;

async function load() {
  loading.value = true;
  try {
    const data = await api('/api/admin/users');
    users.value = data.users;
  } catch (e) {
    ElMessage.error(e.message);
  } finally {
    loading.value = false;
  }
}

async function changeRole(row, role) {
  try {
    await ElMessageBox.confirm(`将用户「${row.username}」的角色改为「${role === 'admin' ? '管理员' : '考生'}」？`, '确认', {
      type: 'warning',
    });
    await api(`/api/admin/users/${row.id}`, { method: 'PUT', body: { role } });
    ElMessage.success('角色已更新');
    load();
  } catch (e) {
    if (e !== 'cancel' && e?.message) ElMessage.error(e.message);
    load();
  }
}

onMounted(load);
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}
.toolbar-title {
  font-size: 16px;
  font-weight: 700;
}
</style>
