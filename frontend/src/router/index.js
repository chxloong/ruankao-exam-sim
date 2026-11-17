import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('../views/Login.vue'), meta: { public: true } },
    { path: '/register', component: () => import('../views/Register.vue'), meta: { public: true } },
    { path: '/', component: () => import('../views/Home.vue') },
    { path: '/exam/:recordId/notice', component: () => import('../views/ExamNotice.vue') },
    { path: '/exam/:recordId/run', component: () => import('../views/ExamRun.vue') },
    { path: '/results', component: () => import('../views/Results.vue') },
    { path: '/results/:id', component: () => import('../views/ResultDetail.vue') },
    {
      path: '/admin',
      component: () => import('../views/admin/Layout.vue'),
      meta: { admin: true },
      children: [
        { path: '', redirect: '/admin/questions' },
        { path: 'questions', component: () => import('../views/admin/Questions.vue') },
        { path: 'papers', component: () => import('../views/admin/Papers.vue') },
        { path: 'users', component: () => import('../views/admin/Users.vue') },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.public) {
    if (auth.isLoggedIn && (to.path === '/login' || to.path === '/register')) return '/';
    return true;
  }
  if (!auth.isLoggedIn) return { path: '/login', query: { redirect: to.fullPath } };
  if (to.meta.admin && !auth.isAdmin) return '/';
  return true;
});

export default router;
