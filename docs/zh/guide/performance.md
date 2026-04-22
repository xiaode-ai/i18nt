---
title: AOT 性能优化
description: 通过预编译与剪枝技术打造极致性能的 i18n 体验
---

# 性能优化 (AOT & JIT)

i18nt 在性能方面进行了多维度的优化，确保在超大型项目中依然保持流畅。

## 1. 运行时 JIT 编译

当您第一次访问某个 ICU 词条时，i18nt 会将其解析为 AST 并即时编译为一个高效的 JS 函数链。后续访问将直接执行该函数，几乎没有解析开销。

## 2. 构建时 AOT 预编译

通过 `i18ntVitePlugin`，您可以在构建生产包时提前解析所有 ICU 字符串：

```ts
// vite.config.ts
import { i18ntVitePlugin } from '@xiaode-ai/i18nt';

export default {
  plugins: [
    i18ntVitePlugin({
      preCompile: true // 开启 AOT 预编译
    })
  ]
}
```

## 3. 精准剪枝 (Pruning)

CLI 的 `prune` 命令可以扫描源码并自动物理移除字典中未被使用的 Key。这不仅减小了 `dict.ts` 的体积，还降低了客户端的内存占用。

## 4. 自动化分包 (Splitting)

当单语言字典超过阈值（如 50KB）时，Vite 插件支持将其按命名空间拆分为独立的 Chunk，实现按需加载（Lazy Loading）。
