import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

// 后端 Node 服务地址（开发模式下由 Vite 代理 /api 与 /img 到此）
const BACKEND = 'http://localhost:3000';

export default defineConfig({
  plugins: [vue({ template: { transformAssetUrls: false } })],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      // 将接口与静态图片代理到后端，避免开发态跨域 / Cookie 问题
      '/api': { target: BACKEND, changeOrigin: true },
      '/img': { target: BACKEND, changeOrigin: true },
    },
  },
  build: {
    // 构建产物输出到 public/dist，由现有 Node 服务托管（SPA 模式）
    outDir: '../public/dist',
    emptyOutDir: true,
  },
});
