# i18nt

> 极致轻量的国际化框架 — 零依赖 · Proxy 驱动 · ICU 标准化 · 嵌套命名空间

简体中文 | [English](./README.md)

[![npm](https://img.shields.io/npm/v/i18nt)](https://www.npmjs.com/package/i18nt)
[![bundle size](https://img.shields.io/bundlephobia/minzip/i18nt)](https://bundlephobia.com/package/i18nt)

## ✨ 特性

- **零依赖**：核心代码 < 3KB (gzip)，不引入 any 任何第三方库。
- **极致 DX**：基于 **Recursive Proxy**，支持 `t.auth.login` 无限级嵌套访问，享受完美类型提示。
- **ICU 标准化**：内置轻量级 ICU 解析器（1.2KB），支持 `plural`, `select`, `selectordinal`, `offset` 及嵌套语法。
- **Intl 原生驱动**：数字、日期、相对时间格式化直接调用浏览器 `Intl` API。
- **双语法并存**：完美兼容传统 `{{var}}` 插值与工业级 ICU MessageFormat。
- **RTL 自适应**：自动检测语种方向并同步 DOM `dir` 属性。
- **CLI 工具**：一键从 TypeScript 字典导出/导入 JSON 翻译模板。
- **极致对比**：相比 i18next / FormatJS，更轻、更准、更现代（[查看对比详情](#why-choose-i18nt)）。

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

<a id="why-choose-i18nt"></a>

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
   TypeScript (TS)：原生支持。
   JavaScript (JS)：完全支持。
2. 前端框架适配
   React：官方内置适配。
   原生 Web (Vanilla JS)：完全支持。
3. 运行环境
   浏览器 (Browser)：深度利用原生 Intl API。
   Node.js：CLI 工具运行环境。

---

## 🛠️ 最佳实践：模块化与规模化 (Modularity & Scale)

对于大型项目，建议将翻译字典拆分为多个模块，并利用 TypeScript 的导入特性进行聚合：

### 1. 拆分文件 (Split Files)

```ts
// src/i18n/auth.ts
export const auth = {
  login: ["登录", "Login"],
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
export const TRANSLATIONS = {
  auth,
  settings,
};
```

### 3. 类型安全与 CLI

`i18nt` 的 CLI 工具支持**分布式组合翻译**。
- **目录扫描**：`--input` 指向目录，自动递归扫描。
- **自动命名空间**：基于文件名和路径生成嵌套命名空间。
- **混合多语种**：支持不同模块拥有不同的语种集，CLI 会自动处理并集。

---

## 🔧 CLI 进阶用法

```bash
# 1. 导出目录 (分布式组合 + 递归扫描)
npx i18nt export --input src/i18n/

# 2. 聚合文件模式 (Import Following)
npx i18nt export --input src/index.ts

# 3. 导出多语种并集
npx i18nt export --lang all
```

---

## 🚀 生产环境进阶 (Advanced Production)

### 1. 本地持久化缓存 (Persistence)
建议将翻译字典缓存至 `localStorage` 或 `IndexedDB`。`i18nt` 的轻量级设计允许您在初始化前快速读取缓存并注入。

代码示例：[examples/persistence.ts](file:///c:/Users/i-cgh/Documents/GitHub/i18nt/examples/persistence.ts)

### 2. 云端热更新 (Cloud Sync / Hot Update)
利用 `extraDicts` 功能，您可以实现无需发版即可更新 App 文案。只需从云数据库拉取最新的 JSON 片段并调用 `setLocale` 即可完成**深度递归合并**。

代码示例：[examples/cloud_sync.ts](file:///c:/Users/i-cgh/Documents/GitHub/i18nt/examples/cloud_sync.ts)

---

## 🔌 后端与跨语言集成 (Polyglot Integration)

`i18nt` 使用 **ICU MessageFormat** 标准，导出的 JSON 可被任何后端语言消费。

### 推荐的后端 ICU 库

| 语言 | 推荐库 | 特点 |
| :--- | :--- | :--- |
| **Python** | [PyICU](https://pypi.org/project/PyICU/) | 性能最强，语法最全 |
| **Go** | [golang.org/x/text/message](https://pkg.go.dev/golang.org/x/text/message) | 官方维护 |
| **Rust** | [icu_messageformat](https://crates.io/crates/icu_messageformat) | 纯 Rust 实现 |
| **Java** | [ICU4J](https://unicode-org.github.io/icu/userguide/icu4j/) | 行业标准 |

具体代码示例请参考 [examples/polyglot/](file:///c:/Users/i-cgh/Documents/GitHub/i18nt/examples/polyglot/)。

---

## 📄 开源协议

MIT
