<template>
  <div class="admin-page">
    <aside class="admin-aside">
      <div class="admin-logo">管理后台</div>
      <el-menu :default-active="route.path" router background-color="#001529" text-color="#c7c9d1" active-text-color="#fff">
        <el-menu-item index="/admin/questions">题库管理</el-menu-item>
        <el-menu-item index="/admin/papers">试卷管理</el-menu-item>
        <el-menu-item index="/admin/users">用户管理</el-menu-item>
      </el-menu>
      <div class="admin-back">
        <el-button link @click="router.push('/')">← 返回前台</el-button>
      </div>
    </aside>
    <div class="admin-main">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
</script>

<style scoped>
.admin-page {
  height: 100vh;
  display: flex;
}
.admin-aside {
  width: 200px;
  background: #001529;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}
.admin-logo {
  color: #fff;
  font-weight: 700;
  text-align: center;
  padding: 18px 0;
  font-size: 16px;
}
.admin-aside .el-menu {
  border-right: none;
  flex: 1;
}
.admin-back {
  padding: 14px;
  text-align: center;
}
.admin-back :deep(.el-button) {
  color: #c7c9d1;
}
.admin-main {
  flex: 1;
  overflow-y: auto;
  background: #f0f2f5;
  padding: 20px;
}
</style>
