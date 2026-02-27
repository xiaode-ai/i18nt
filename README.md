# i18nt

> 极致轻量的国际化框架 — 零依赖 · Proxy 驱动 · ICU 标准化 · 嵌套命名空间

[![npm](https://img.shields.io/npm/v/i18nt)](https://www.npmjs.com/package/i18nt)
[![bundle size](https://img.shields.io/bundlephobia/minzip/i18nt)](https://bundlephobia.com/package/i18nt)

## ✨ 特性

- **零依赖**：核心代码 < 3KB (gzip)，不引入任何第三方库。
- **极致 DX**：基于 **Recursive Proxy**，支持 `t.auth.login` 无限级嵌套访问，享受完美类型提示。
- **ICU 标准化**：内置轻量级 ICU 解析器（1.2KB），支持 `plural`, `select`, `selectordinal`, `offset` 及嵌套语法。
- **Intl 原生驱动**：数字、日期、相对时间格式化直接调用浏览器 `Intl` API。
- **双语法并存**：完美兼容传统 `{{var}}` 插值与工业级 ICU MessageFormat。
- **RTL 自适应**：自动检测语种方向并同步 DOM `dir` 属性。
- **CLI 工具**：一键从 TypeScript 字典导出/导入 JSON 翻译模板。
- **极致对比**：相比 i18next / FormatJS，更轻、更准、更现代（[查看对比详情](#-为什么选择-i18nt)）。

## 📦 安装

```bash
npm install i18nt
```

## 🚀 快速上手

### 1. 定义翻译字典 (支持嵌套)

```ts
// src/translations.ts
export const LANG_ORDER = ["zh-CN", "en-US"] as const;

export const TRANSLATIONS = {
  // 基础文本 (按索引匹配)
  buttons: {
    save: ["保存", "Save"],
    cancel: ["取消", "Cancel"],
  },

  // ICU MessageFormat (强大、灵活)
  // 支持复数、偏移、变量
  cart_status: [
    "{count, plural, offset:1 =0{空空如也} =1{只有您自己} other{您和另外 # 人}}",
    "{count, plural, offset:1 =0{Empty} =1{Just you} other{You and # others}}",
  ],

  // 变量插值 (简单模式)
  greeting: ["你好，{{name}}！", "Hello, {{name}}!"],
};
```

### 2. 创建 i18n 实例

```ts
import { createI18n } from "i18nt";
import { TRANSLATIONS, LANG_ORDER } from "./translations";

const i18n = createI18n({
  translations: TRANSLATIONS,
  langOrder: LANG_ORDER,
  locale: "zh-CN",
});

const { t } = i18n;

// 1. 无限级嵌套访问 (Proxy 驱动)
t.buttons.save; // → "保存"

// 2. ICU 格式化
t("cart_status", { count: 3 }); // → "您和另外 2 人" (offset:1)

// 3. 数字 & 日期助手
t.n(12345.6, { style: "currency", currency: "USD" }); // → "$12,345.60"
t.d(new Date(), { dateStyle: "long" }); // → "2026年2月28日"

// 4. 切换语言
i18n.setLocale("en-US");
t.buttons.save; // → "Save"
```

## 🌐 动态加载 (Lazy Loading)

i18nt 保持零依赖，不强制绑定 AJAX，但提供 `extraDicts` 进行**深度递归合并**：

```ts
// 模拟从远程拉取部分翻译 (如 auth 模块)
const remoteAuthDict = {
  auth: {
    login: "Login Now",
    forgot: "Forgot Password?",
  },
};

i18n.setLocale("en-US"); // 切换到动态语种
// 注入字典片段，它会自动合并到现有的命名空间树中
// 配置更新示例
// i18n.setLocale("en-US", { extraDicts: [remoteAuthDict] });
```

## 🔧 CLI 工具

```bash
# 导出 JSON 模板
npx i18nt export --lang en-US

# 批量导入翻译后的 JSON
npx i18nt import --json ./locales/
```

## ⚔️ 为什么选择 i18nt?

| 特性 / 库                     | i18nt |  i18next  | FormatJS |
| :---------------------------- | :---: | :-------: | :------: |
| **极致轻量 (< 3KB)**          |  ✅   |    ❌     |    ❌    |
| **零依赖 (Zero-dependency)**  |  ✅   |    ❌     |    ❌    |
| **Proxy 驱动 (类型补全)**     |  ✅   |    ❌     |    ❌    |
| **原生 Intl 标准 (ECMA-402)** |  ✅   |    ✅     |    ✅    |
| **核心 ICU 语法支持**         |  ✅   | ✅ (插件) |    ✅    |
| **多级命名空间 (Nested)**     |  ✅   |    ✅     |    ❌    |
| **动态加载 (Lazy Loading)**   |  ✅   |    ✅     |    ❌    |
| **RTL 自动检测与同步**        |  ✅   |    ❌     |    ❌    |

### 核心优势 (Deep Dive)

1. **渲染零成本**：基于 **Recursive Proxy**。访问 `t.auth.login` 时按需生成代理，而非在项目启动时预处理庞大的路径树，初始化性能为常数级 **O(1)**。
2. **极小 ICU 解析器**：内置仅 **1.2KB** 的解析引擎，直接映射原生 `Intl` API，性能与体积的完美平衡。
3. **本地化开发友好**：完美支持“双语插值”与“显式语法”，让中英文对照开发不再是痛苦。

## 🌍 跨语言支持 (Cross-Language Support)

i18nt 目前主要支持以下编程语言和生态系统：

1. 核心开发语言
   TypeScript (TS)：原生支持。整个框架使用 TypeScript 编写，提供自动化的类型推导，使您在访问 t.key 时能够享受顺滑的代码补齐（Intellisense）。
   JavaScript (JS)：完全支持。兼容现代 JavaScript（ESM），可以在任何支持 ES6+ 的环境中使用。
2. 前端框架适配
   React：官方内置适配（提供 I18nProvider 和 useI18n Hook）。
   原生 Web (Vanilla JS)：完全支持。由于不强依赖 React，它可以在任何简单的 HTML/JS 页面、Vue、Svelte 或 Angular 项目中作为底层 i18n 引擎使用。
3. 运行环境
   浏览器 (Browser)：主要运行环境，深度利用浏览器原生的 Intl API。
   Node.js：CLI 工具（如 i18nt export/import）运行在 Node.js 环境下。
4. 翻译语法（国际化标准）
   ICU MessageFormat：支持这一工业级标准语法。
   Mustache 风格：支持 {{var}} 简单占位符。

如果您在开发基于 JavaScript 或 TypeScript 的项目（无论是 React 应用还是其他 Web 项目），i18nt 都能提供最佳的支持。

---

## 🛠️ 最佳实践：模块化与规模化 (Modularity & Scale)

对于大型项目，建议将翻译字典拆分为多个模块，并利用 TypeScript 的导入特性进行聚合：

### 1. 拆分文件 (Split Files)

```ts
// src/i18n/auth.ts
export const auth = {
  login: ["登录", "Login"],
  register: ["注册", "Register"],
};

// src/i18n/settings.ts
export const settings = {
  theme: ["主题", "Theme"],
};
```

### 2. 统一入口 (Central Hub)

```ts
// src/translations.ts
import { auth } from "./i18n/auth";
import { settings } from "./i18n/settings";

export const LANG_ORDER = ["zh-CN", "en-US"] as const;
export const MAIN_LANG = "zh-CN";

export const TRANSLATIONS = {
  auth,
  settings,
  common: {
    home: ["首页", "Home"],
  },
};
```

### 3. 类型安全与 CLI

`i18nt` 的 CLI 工具支持**递归解析**嵌套结构。即使您的字典跨越多个文件（只要在入口主文件中通过展开或对象嵌套进行聚合），CLI 也能将其准确导出为嵌套的 JSON 目录，并完美支持同步回传。

---

## 🌍 跨语言支持 (Cross-Language Support)

1. **标准 JSON 导出**：通过 `npx i18nt export` 将 TS 字典转化为通用 JSON。
2. **ICU 标准兼容**：`i18nt` 使用的复数和格式化语法符合 **ICU MessageFormat** 工业标准。Java, Python, Go, Rust, C++ 等语言均有成熟的 ICU 解析库，可直接读取并运行 `i18nt` 导出的逻辑。
3. **工作流中枢**：您可以将 TypeScript 字典作为“唯一事实来源 (Single Source of Truth)”，通过 CLI 同步给后端（如 Spring, Django, Gin, Actix）使用。

使用其他编程语言（如 Python、Go、Java、Rust 等），i18nt 依然可以通过其 CLI 工具链 和 标准协议 成为跨语言项目的国际化枢纽。

以下是支持其他语言的几种方案：

1. 通过标准 JSON 交换数据 (最推荐)
   i18nt 的 CLI 工具可以将 TypeScript 字典导出为标准的跨语言 JSON 格式。

导出步骤：运行 npx i18nt export --lang all。
跨语言消费：
Python: 使用 icu 库或 babel 库。
Java: 原生支持 MessageFormat (ICU)。
Go: 使用 golang.org/x/text/message。
Rust: 使用 icu_messageformat 库。
优势：您可以继续在 TypeScript 中集中管理翻译字典（享受类型提示），而其他后端的编程语言只需读取生成的 JSON 文件。2. 基于 ICU MessageFormat 的协议兼容
由于 i18nt 的核心语法遵循 ICU 标准，这是一种跨语言的通用标准。这意味着您在 i18nt 中编写的复数逻辑（{n, plural, ...}）在其他语言的 ICU 解析器中是 完全通用的，不需要进行任何语法转换。

3. 作为“翻译管理中枢” (Workflow)
   您可以建立如下工作流：

定义端：在前端项目中使用 TypeScript 定义翻译主文件（唯一事实来源）。
同步端：通过 i18nt export 持续输出各语种 JSON。
消费端：
前端：直接调用 i18nt 库。
后端（Java/Python 等）：挂载 locales/\*.json 目录，读取并格式化。
闭环：如果翻译团队修改了某语言的 JSON，通过 i18nt import 一键同步回 TypeScript 字典。4. 云端/远程加载方案
如果您的应用是跨平台的（比如同时有 Web 网页和 C++ 桌面端），可以将 i18nt 导出的 JSON 存放在 CDN 上。各端通过网络请求读取相同的翻译配置，确保多语言文本在全平台 100% 一致。

核心逻辑图：

mermaid
graph LR
A[TS Dictionary] -- i18nt CLI --> B[Standard JSON]
B -- SDK --> C[i18nt / React]
B -- Logic --> D[Python / Django]
B -- Logic --> E[Java / Spring]
B -- Logic --> F[Go / Rust]

i18nt 不仅仅是一个 JS 库，更是一个基于 TS 驱动 + JSON 交换 + ICU 标准 的工具链。只要目标语言支持读取 JSON 并解析 ICU 语法，就能完美配合。

---

## 📄 License

MIT
