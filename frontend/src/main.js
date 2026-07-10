import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { fetchUser } from './store/auth';
import './styles/global.css';

// 启动即尝试拉取登录态（失败也无妨，导航会回退为未登录态）
fetchUser();

createApp(App).use(router).mount('#app');
