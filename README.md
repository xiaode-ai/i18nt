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

## 📄 License

MIT
