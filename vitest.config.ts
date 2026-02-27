import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 包含所有 .test.js 或 .spec.js 文件
    include: ['**/*.{test,spec}.{js,ts}'],
    // 环境：node (默认)
    environment: 'node',
    // 自动重跑 (开发模式)
    watch: false,
  },
});
