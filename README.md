# i18nt

> 极致轻量的国际化框架 — 零依赖 · Proxy 驱动 · ICU 标准化 · 嵌套命名空间

简体中文 | [English](./README.en.md)

[![npm](https://img.shields.io/npm/v/@xiaode-ai/i18nt)](https://www.npmjs.com/package/@xiaode-ai/i18nt)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@xiaode-ai/i18nt)](https://bundlephobia.com/package/@xiaode-ai/i18nt)
[![license](https://img.shields.io/github/license/xiaode-ai/i18nt)](https://github.com/xiaode-ai/i18nt/blob/main/LICENSE)

## ✨ 特性

- **🚀 极速启动**：基于 **Recursive Proxy**，仅在访问时生成路径，初始化性能恒定为 **O(1)**，完美支持无限级嵌套。
- **📦 零依赖**：核心代码 **< 3KB** (gzip)，不引入任何第三方库，甚至不需要 `intl-messageformat`。
- **🎯 ICU 标准化**：内置精简版 ICU 解析器（1.2KB），完美支持 `plural`, `select`, `selectordinal`, `offset` 及嵌套语法。
- **⚛️ React 原生支持**：内置 `I18nProvider` 与 `useI18n` Hook，支持 RTL 自动切换与异步加载。
- **🛠️ 强力 CLI**：支持分布式字典扫描、自动命名空间生成、多语种并集导出，适配大型 Monorepo 架构。
- **🌐 全球化就绪**：数字、日期、相对时间格式化直接调用原生 `Intl` API，确保最小体积与最大一致性。

## 📦 安装

```bash
npm i @xiaode-ai/i18nt
```

## 🚀 快速上手

### 1. 定义翻译字典

```ts
// src/i18n/dict.ts
export const LANG_ORDER = ["zh-CN", "en-US"] as const;

export const TRANSLATIONS = {
  // 基础文本
  buttons: {
    save: ["保存", "Save"],
  },
  // ICU MessageFormat
  cart: [
    "{count, plural, =0{空购物车} other{购物车中有 # 件商品}}",
    "{count, plural, =0{Empty} other{# items in cart}}",
  ],
};
```

### 2. 初始化并使用

```ts
import { createI18n } from "@xiaode-ai/i18nt";
import { TRANSLATIONS, LANG_ORDER } from "./i18n/dict";

const i18n = createI18n({
  translations: TRANSLATIONS,
  langOrder: LANG_ORDER,
  locale: "zh-CN",
});

const { t } = i18n;

// Proxy 驱动的属性访问，享受完美类型提示
console.log(t.buttons.save); // "保存"

// 函数式调用处理 ICU 逻辑
console.log(t("cart", { count: 3 })); // "购物车中有 3 件商品"
```

## ⚛️ React 集成

`i18nt` 提供了官方 React 适配层，支持全局状态管理与组件级重绘。

### 配置 Provider

```tsx
import { I18nProvider } from "@xiaode-ai/i18nt/react";

function Root() {
  return (
    <I18nProvider config={{ translations, langOrder, locale: 'zh-CN' }}>
      <App />
    </I18nProvider>
  );
}
```

### 在组件中使用

```tsx
import { useI18n } from "@xiaode-ai/i18nt/react";

function UserProfile() {
  const { t, setLocale, locale } = useI18n();

  return (
    <div>
      <p>{t.profile.welcome}</p>
      <button onClick={() => setLocale('en-US')}>Switch to English</button>
    </div>
  );
}
```

## 🛠️ CLI 进阶：分布式翻译管理

对于大型项目，建议将翻译字典分散在各业务模块中。`i18nt` CLI 可以自动聚合它们。

### 目录结构示例
```text
src/
  auth/
    i18n.ts      // 定义 auth 命名空间
  settings/
    i18n.ts      // 定义 settings 命名空间
```

### 自动化操作
```bash
# 1. 递归扫描 src/ 目录，自动基于文件名聚合命名空间并导出 JSON
npx i18nt export --input src/ --lang all --json ./.i18nt/locales/

# 2. 将翻译后的 JSON 批量回填（如果需要）
npx i18nt import --json ./.i18nt/locales/
```

## 🛡️ TypeScript 类型安全

得益于 **Recursive Proxy**，您只需定义好基础字典，即可在任何地方获得全自动的代码补全：

```ts
// 即使是 10 层嵌套，i18nt 也能准确推导出类型
t.a.b.c.d.e.f.g.h.i.j; 
```

## ⚔️ 库对比

| 特性 / 库                     | i18nt |  i18next  | FormatJS |
| :---------------------------- | :---: | :-------: | :------: |
| **体积 (Gzip)**               | **< 3KB** |  ~40KB    |  ~30KB   |
| **零依赖**                    |  ✅   |    ❌     |    ❌    |
| **Proxy 驱动 (类型补全)**     |  ✅   |    ❌     |    ❌    |
| **核心 ICU 语法支持**         |  ✅   | ✅ (插件) |    ✅    |
| **RTL 自动同步**              |  ✅   |    ❌     |    ❌    |

## 📄 开源协议

MIT
