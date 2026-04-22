import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // 包含所有 .test.js 或 .spec.js 文件
    include: ['**/*.{test,spec}.{js,ts}'],
    // 环境：node (默认)
    environment: 'node',
    // 自动重跑 (开发模式)
    watch: false,
    exclude: ['node_modules', 'dist', 'examples'],
  },
  resolve: {
    alias: {
      // 将对 dist 的引用映射到 src，确保测试可以直接跑在源码上
      '../dist/index.js': path.resolve(__dirname, './src/index.ts'),
      '../dist/core.js': path.resolve(__dirname, './src/core.ts'),
      '../dist/rtl.js': path.resolve(__dirname, './src/rtl.ts'),
      '../dist/icu.js': path.resolve(__dirname, './src/icu.ts'),
      './dist/index.js': path.resolve(__dirname, './src/index.ts'),
    }
  }
});
