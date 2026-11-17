<template>
  <div>
    <el-card shadow="never">
      <div class="toolbar">
        <div class="toolbar-title">用户管理</div>
        <el-radio-group v-model="statusFilter" size="small" style="margin-left: 20px" @change="load">
          <el-radio-button value="">全部</el-radio-button>
          <el-radio-button value="pending">待审核</el-radio-button>
          <el-radio-button value="active">正常</el-radio-button>
          <el-radio-button value="disabled">已停用</el-radio-button>
        </el-radio-group>
        <div class="toolbar-spacer"></div>
        <el-button type="primary" @click="openAddDialog">新增用户</el-button>
      </div>

      <el-table :data="filtered" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="username" label="用户名" min-width="160" />
        <el-table-column label="角色" width="190">
          <template #default="{ row }">
            <el-select
              :model-value="row.role"
              size="small"
              :disabled="row.id === myId"
              style="width: 110px"
              @change="(v) => changeRole(row, v)"
            >
              <el-option label="考生" value="user" />
              <el-option label="管理员" value="admin" />
            </el-select>
            <el-tag v-if="row.id === myId" size="small" type="info" style="margin-left: 8px">我</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="注册时间" width="180" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <template v-if="row.id !== myId">
              <el-button v-if="row.status === 'pending'" link type="success" @click="setStatus(row, 'active')">审核通过</el-button>
              <el-button v-else-if="row.status === 'active'" link type="warning" @click="setStatus(row, 'disabled')">停用</el-button>
              <el-button v-else link type="success" @click="setStatus(row, 'active')">启用</el-button>
              <el-button link type="primary" @click="openReset(row)">重置密码</el-button>
            </template>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增用户 -->
    <template v-if="addVisible">
      <div class="dlg-mask" @click="addVisible = false"></div>
      <div class="dlg-box">
        <div class="dlg-title">新增用户</div>
        <div class="dlg-field">
          <text class="dlg-label">用户名</text>
          <el-input v-model="addForm.username" placeholder="2-20 位字母、数字、下划线或中文" />
        </div>
        <div class="dlg-field">
          <text class="dlg-label">初始密码</text>
          <el-input v-model="addForm.password" type="password" show-password placeholder="至少 6 位" />
        </div>
        <div class="dlg-field">
          <text class="dlg-label">角色</text>
          <el-radio-group v-model="addForm.role">
            <el-radio value="user">考生</el-radio>
            <el-radio value="admin">管理员</el-radio>
          </el-radio-group>
        </div>
        <el-alert title="管理员添加的账号立即生效，无需审核" type="info" :closable="false" />
        <div class="dlg-footer">
          <el-button @click="addVisible = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="addUser">创建</el-button>
        </div>
      </div>
    </template>

    <!-- 重置密码 -->
    <template v-if="resetVisible">
      <div class="dlg-mask" @click="resetVisible = false"></div>
      <div class="dlg-box">
        <div class="dlg-title">重置密码 — {{ resetRow?.username }}</div>
        <div class="dlg-field">
          <text class="dlg-label">新密码</text>
          <el-input v-model="resetPwd" type="password" show-password placeholder="至少 6 位" />
        </div>
        <el-alert title="重置后该用户的所有旧登录态将立即失效，需用新密码重新登录" type="warning" :closable="false" />
        <div class="dlg-footer">
          <el-button @click="resetVisible = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="saveReset">重置</el-button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../../api';
import { useAuthStore } from '../../stores/auth';

const auth = useAuthStore();
const users = ref([]);
const loading = ref(false);
const statusFilter = ref('');
const myId = auth.user?.id;

const addVisible = ref(false);
const saving = ref(false);
const addForm = ref({ username: '', password: '', role: 'user' });

const resetVisible = ref(false);
const resetRow = ref(null);
const resetPwd = ref('');

function openReset(row) {
  resetRow.value = row;
  resetPwd.value = '';
  resetVisible.value = true;
}

async function saveReset() {
  if (!resetPwd.value || resetPwd.value.length < 6) return ElMessage.warning('新密码至少 6 位');
  saving.value = true;
  try {
    await api(`/api/admin/users/${resetRow.value.id}/reset-password`, {
      method: 'PUT',
      body: { newPassword: resetPwd.value },
    });
    ElMessage.success(`已重置「${resetRow.value.username}」的密码`);
    resetVisible.value = false;
  } catch (e) {
    ElMessage.error(e.message);
  } finally {
    saving.value = false;
  }
}

const STATUS_LABEL = { pending: '待审核', active: '正常', disabled: '已停用' };
const STATUS_TAG = { pending: 'warning', active: 'success', disabled: 'danger' };

function statusLabel(s) {
  return STATUS_LABEL[s] || s;
}
function statusTag(s) {
  return STATUS_TAG[s] || 'info';
}

const filtered = computed(() =>
  statusFilter.value ? users.value.filter((u) => u.status === statusFilter.value) : users.value
);

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

function openAddDialog() {
  addForm.value = { username: '', password: '', role: 'user' };
  addVisible.value = true;
}

async function addUser() {
  saving.value = true;
  try {
    await api('/api/admin/users', { method: 'POST', body: { ...addForm.value } });
    ElMessage.success('用户已创建，账号立即生效');
    addVisible.value = false;
    load();
  } catch (e) {
    ElMessage.error(e.message);
  } finally {
    saving.value = false;
  }
}

async function setStatus(row, status) {
  const actionText = { active: '启用/审核通过', disabled: '停用' }[status] || status;
  try {
    await ElMessageBox.confirm(
      `确定将用户「${row.username}」的状态设为「${statusLabel(status)}」吗？停用后该用户将无法登录与使用接口。`,
      '确认',
      { type: 'warning', confirmButtonText: '确定', cancelButtonText: '取消' }
    );
    await api(`/api/admin/users/${row.id}/status`, { method: 'PUT', body: { status } });
    ElMessage.success('状态已更新');
    load();
  } catch (e) {
    if (e !== 'cancel' && e?.message) ElMessage.error(e.message);
    load();
  }
}

async function changeRole(row, role) {
  try {
    await ElMessageBox.confirm(
      `将用户「${row.username}」的角色改为「${role === 'admin' ? '管理员' : '考生'}」？`,
      '确认',
      { type: 'warning' }
    );
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
.toolbar-spacer {
  flex: 1;
}
.muted {
  color: #c0c4cc;
}
.dlg-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 100;
}
.dlg-box {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(440px, 92vw);
  background: #fff;
  border-radius: 10px;
  padding: 24px;
  z-index: 101;
  box-shadow: 0 8px 30px rgba(0, 21, 41, 0.2);
}
.dlg-title {
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 18px;
}
.dlg-field {
  margin-bottom: 14px;
}
.dlg-label {
  display: block;
  font-size: 13px;
  color: #606266;
  margin-bottom: 6px;
}
.dlg-footer {
  margin-top: 20px;
  text-align: right;
}
</style>
