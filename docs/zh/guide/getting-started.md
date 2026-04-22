---
title: 快速开始 (React 19)
description: 配合 React 19 + Tailwind CSS，开启极速国际化开发体验
---

# 快速开始

i18nt 是为现代 React 应用（特别是 React 19+）设计的国际化框架。它专注于 **零运行时开销**、**极致类型安全** 以及 **Tailwind CSS 友好** 的开发体验。

## 安装

使用您喜欢的包管理器安装核心库：

```bash
npm i @xiaode-ai/i18nt
```

## 核心工作流

i18nt 完美适配 React 19 的新特性，并推荐结合 Tailwind CSS 进行样式管理。

### 1. 定义字典 (SSOT)

在 TS 文件中定义您的翻译内容。

```ts
// i18n/dict.ts
export const TRANSLATIONS = {
  welcome: ["欢迎使用 i18nt", "Welcome to i18nt"],
  cta: ["立即开始", "Get Started"]
};
export const LANG_ORDER = ["zh-CN", "en-US"] as const;
```

### 2. 初始化实例 (React 19)

在 React 19 中，您可以将 i18n 实例与 Context 结合使用。

```tsx
import { createI18n } from "@xiaode-ai/i18nt";
import { TRANSLATIONS, LANG_ORDER } from "./i18n/dict";

const i18n = createI18n({
  translations: TRANSLATIONS,
  langOrder: LANG_ORDER,
  locale: "zh-CN"
});

export const { t } = i18n;
```

### 3. 在 UI 中使用 (Tailwind CSS)

```tsx
export default function Hero() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] bg-slate-50 rounded-2xl p-8 border border-slate-200">
      <h1 className="text-4xl font-bold text-slate-900 mb-4">
        {t.welcome}
      </h1>
      <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
        {t.cta}
      </button>
    </div>
  );
}
```

## 接下来

查看深度集成方案：
- [React 19 实战](./react)
- [Next.js (RSC) 实战](./nextjs)
- [AOT 性能优化](./performance)
