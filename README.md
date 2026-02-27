# i18nt

> 极致轻量的国际化框架 — 零依赖 · Proxy 驱动 · Intl 标准化 · RTL 自适应

[![npm](https://img.shields.io/npm/v/i18nt)](https://www.npmjs.com/package/i18nt)
[![bundle size](https://img.shields.io/bundlephobia/minzip/i18nt)](https://bundlephobia.com/package/i18nt)

## ✨ 特性

- **零依赖**：核心代码 < 3KB (gzip)，不引入任何第三方库
- **极致 DX**：通过 `Proxy`，你可以用 `t.hello` 直接访问翻译，享受完整的类型提示
- **Intl 标准化**：内置 `t.n()` (数字)、`t.d()` (日期)、`t.relative()` (相对时间) 格式化助手
- **复数支持**：基于原生 `Intl.PluralRules`，自动匹配 CLDR 复数规则
- **变量插值**：`{{var}}` 语法，简单直观
- **RTL 自适应**：自动检测阿拉伯语等 RTL 语言并同步 DOM `dir` 属性
- **Dev 哨兵**：开发模式下自动提示缺失的翻译 Key
- **CLI 工具**：一键从 TypeScript 字典导出 JSON 翻译模板
- **React 适配**：提供 `I18nProvider` + `useI18n` 开箱即用

## 📦 安装

```bash
npm install i18nt
```

## 🚀 快速上手

### 1. 定义翻译字典

```ts
// src/translations.ts
export const LANG_ORDER = ["zh-CN", "en-US"] as const;
export const MAIN_LANG = "zh-CN";

export const TRANSLATIONS = {
  // 语法 A：最简语法（按 LANG_ORDER 索引匹配）
  hello: ["你好", "Hello"],

  // 语法 B：显式语法（不受索引顺序限制，更直观）
  save: ["en-US: Save", "zh-CN: 保存"],

  // 变量插值
  greeting: ["你好，{{name}}！", "Hello, {{name}}!"],

  // 复数支持
  items: [
    { one: "{{count}} 项", other: "{{count}} 项" },
    { one: "{{count}} item", other: "{{count}} items" },
  ],
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

// 属性访问
i18n.t.hello; // → "你好"

// 变量插值
i18n.t("greeting", { name: "Alice" }); // → "你好，Alice！"

// 复数
i18n.t("items", { count: 3 }); // → "3 项"

// 格式化助手
i18n.t.n(1234567); // → "1,234,567"
i18n.t.d(new Date()); // → "2026/2/28"
i18n.t.relative(-3, "day"); // → "3天前"

// 切换语言
i18n.setLocale("en-US");
i18n.t.hello; // → "Hello"
```

### 3. 在 React 中使用

```tsx
import { I18nProvider, useI18n } from "i18nt/react";

function App() {
  return (
    <I18nProvider
      config={{
        translations: TRANSLATIONS,
        langOrder: LANG_ORDER,
        locale: "zh-CN",
      }}
    >
      <MyComponent />
    </I18nProvider>
  );
}

function MyComponent() {
  const { t, locale, setLocale } = useI18n();

  return (
    <div>
      <h1>{t.hello}</h1>
      <p>{t("greeting", { name: "World" })}</p>
      <button onClick={() => setLocale(locale === "zh-CN" ? "en-US" : "zh-CN")}>
        切换语言
      </button>
    </div>
  );
}
```

### 4. 导出 JSON 翻译模板

你可以轻而易举地将字典导出为符合 i18next 规范或简单结构的 JSON 文件，供翻译团队使用。

```bash
# 默认导出主语言 (扫描 src/translations.ts)
npx i18nt export

# 导出指定语言并存放到自定义目录
npx i18nt export --lang en-US --output ./locales
```

输出格式（例如 `zh-CN.json`）：

```json
{
  "language": "zh-CN",
  "translations": {
    "hello": "你好",
    "save": "保存",
    "greeting": "你好，{{name}}！"
  }
}
```

## 📖 API

### `createI18n(config)`

| 参数            | 类型                       | 说明                           |
| --------------- | -------------------------- | ------------------------------ |
| `translations`  | `Record<string, string[]>` | 翻译字典                       |
| `langOrder`     | `string[]`                 | 语言代码顺序                   |
| `locale`        | `string`                   | 当前语言                       |
| `fallbackIndex` | `number`                   | 回退索引 (默认 `0`)            |
| `extraDicts`    | `Record<string, string>[]` | 动态 JSON 语言包               |
| `extraLangs`    | `string[]`                 | 动态语言代码                   |
| `devWarnings`   | `boolean`                  | Missing Key 警告 (默认 `true`) |

返回：

| 属性/方法               | 说明                             |
| ----------------------- | -------------------------------- |
| `t`                     | 翻译函数 + 属性访问 + 格式化助手 |
| `t.n(val)`              | 数字本地化格式化                 |
| `t.d(val)`              | 日期本地化格式化                 |
| `t.relative(val, unit)` | 相对时间                         |
| `locale`                | 当前语言代码                     |
| `setLocale(lang)`       | 切换语言                         |
| `isRTL`                 | 当前是否为 RTL 语言              |
| `availableLocales`      | 所有可用语言列表                 |

### React: `<I18nProvider>` + `useI18n()`

```tsx
<I18nProvider config={i18nConfig}>{children}</I18nProvider>;

const { t, locale, setLocale, isRTL } = useI18n();
```

## 🔧 CLI

一键导出翻译包，支持自动识别显式语法并净化文本。

```bash
i18nt export [选项]

选项:
  --input <path>    指定字典文件路径 (默认: 自动搜寻 src/translations.ts)
  --output <dir>    指定导出目录 (默认: 当前执行路径下的 ./locales/)
  --lang <code>     指定导出语种 (默认: MAIN_LANG)
  --help            显示帮助
```

更多真实场景用例，请参考 [examples/translations.ts](./examples/translations.ts)。

## 📄 License

MIT
