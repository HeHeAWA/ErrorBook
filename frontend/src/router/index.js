import { createRouter, createWebHistory } from 'vue-router';
import { auth, fetchUser } from '@/store/auth';

const routes = [
  { path: '/', name: 'plaza', component: () => import('@/views/PlazaView.vue') },
  { path: '/error/:id', name: 'detail', component: () => import('@/views/DetailView.vue'), meta: { public: true } },
  { path: '/add', name: 'add', component: () => import('@/views/AddView.vue') },
  { path: '/my', name: 'my', component: () => import('@/views/MyErrorView.vue') },
  { path: '/rank', name: 'rank', component: () => import('@/views/RankView.vue'), meta: { public: true } },
  { path: '/report', name: 'report', component: () => import('@/views/ReportView.vue') },
  { path: '/review', name: 'review', component: () => import('@/views/ReviewView.vue') },
  { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
  { path: '/aifind', name: 'aifind', component: () => import('@/views/AiFindView.vue') },
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
  { path: '/register', name: 'register', component: () => import('@/views/RegisterView.vue'), meta: { public: true } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

// 全局前置守卫：受保护页面需登录
router.beforeEach(async (to) => {
  if (to.meta.public) return true;
  if (!auth.loaded) await fetchUser();
  if (!auth.user) {
    return { path: '/login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} };
  }
  return true;
});

export default router;
