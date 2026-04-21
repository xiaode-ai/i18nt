# i18nt

> Ultra-lightweight i18n framework — Zero-dependency · Proxy-driven · ICU Standard · Nested Namespace

[简体中文](./README.md) | English

[![npm](https://img.shields.io/npm/v/@xiaode-ai/i18nt)](https://www.npmjs.com/package/@xiaode-ai/i18nt)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@xiaode-ai/i18nt)](https://bundlephobia.com/package/@xiaode-ai/i18nt)
[![license](https://img.shields.io/github/license/xiaode-ai/i18nt)](https://github.com/xiaode-ai/i18nt/blob/main/LICENSE)

## ✨ Features

- **🚀 Instant Start**: Based on **Recursive Proxy**, paths are generated on-the-fly. Initialization performance is **O(1)**, supporting infinite nesting with perfect Intellisense.
- **📦 Zero-dependency**: Core code **< 3KB** (gzip). No third-party libraries required.
- **🎯 100% ICU Compliance**: **[NEW]** Full support for `plural`, `select`, `list`, `unit`, `relative`, and complex `skeleton` syntax.
- **🎨 Rich Text Support**: Built-in `<tag>` syntax support for easy insertion of React/Vue components or HTML tags.
- **⚛️ Full Framework Support**: Native support for React (Hook/RSC), Vue 3, Angular, Next.js, and React Native.
- **🛠️ Intelligent CLI**: Supports source code **AST extraction**, dictionary auto-fix, and **AI-powered translation completion**.
- **🌐 Plugin Ecosystem**: Browser detection, persistence, **Visual Edit v2 (Shadow DOM)**, and cross-tab state sync.
- **🛡️ Static Validation**: **[NEW]** Official `@xiaode-ai/eslint-plugin-i18nt` for key existence and ICU syntax validation.
- **🛡️ Audit & Monitoring**: **[NEW]** Built-in `auditPlugin` to track translation hits, missing keys, and redundant entries.
- **🔄 Nuanced Framework Integration**: **[NEW]** Next.js support for `prefixStrategy` (e.g., prefix only for non-default locales) and LocaleSwitcher components.
- **⚡ Extreme JIT Engine**: Compiles ICU messages into optimized pure function chains at runtime.

## 📦 Installation

```bash
npm i @xiaode-ai/i18nt
# Optional: Install ESLint plugin for static validation
npm i -D @xiaode-ai/eslint-plugin-i18nt
```

### 🛡️ Static Analysis (ESLint)
Add the plugin to your `.eslintrc.js` to catch invalid keys in real-time:
```js
module.exports = {
  plugins: ['@xiaode-ai/i18nt'],
  rules: {
    '@xiaode-ai/i18nt/no-unknown-key': ['error', { dictionaryPath: 'src/i18n/dict.ts' }],
    '@xiaode-ai/i18nt/valid-icu-message': 'warn'
  }
};
```

## 🚀 Quick Start

### 1. Define Dictionary

```ts
// src/i18n/dict.ts
export const LANG_ORDER = ["zh-CN", "en-US"] as const;

export const TRANSLATIONS = {
  buttons: {
    save: ["保存", "Save"],
  },
  cart: [
    "{count, plural, =0{Empty} other{# items in cart}}",
    "{count, plural, =0{空购物车} other{购物车中有 # 件商品}}",
  ],
};
```

### 2. Initialize and Use

```ts
import { createI18n } from "@xiaode-ai/i18nt";
import { TRANSLATIONS, LANG_ORDER } from "./i18n/dict";

const i18n = createI18n({
  translations: TRANSLATIONS,
  langOrder: LANG_ORDER,
  locale: "en-US",
  detection: {
    order: ['querystring', 'cookie', 'navigator'],
    lookupQuerystring: 'lng'
  }
});

const { t } = i18n;

// Proxy-driven property access
console.log(t.buttons.save); // "Save"

// ICU MessageFormat
console.log(t("cart", { count: 3 })); // "3 items in cart"
```

## 🛠️ CLI Advanced

```bash
# 1. Auto-fix dictionary
npx i18nt fix --input src/

# 2. AI Translation
npx i18nt translate

# 3. Export to JSON
npx i18nt export --input src/ --lang all --json ./.i18nt/locales/

# 4. Sync with TMS (Lokalise, Crowdin)
npx i18nt sync --provider lokalise --projectId xxx
```

## 🔌 Plugins

```ts
import { 
  browserDetector, 
  languageCache, 
  auditPlugin,
  reportMissingKey 
} from "@xiaode-ai/i18nt/plugins";

const i18n = createI18n({
  plugins: [
    browserDetector(),
    languageCache(),
    auditPlugin({
      onReport: (rep) => console.log('I18n Audit:', rep)
    }),
    reportMissingKey({
      endpoint: 'https://api.example.com/report'
    })
  ]
});
```

## 🛣️ Routing (Next.js Middleware)

```ts
// middleware.ts
import { createI18nMiddleware } from '@xiaode-ai/i18nt/next';

export default createI18nMiddleware({
  locales: ['en', 'zh'],
  defaultLocale: 'en',
  prefixStrategy: 'as-needed' // Prefix only for non-default locales
});
```

#### LocaleSwitcher Component
```tsx
const { LocaleSwitcher } = createNavigation(config);

function LanguageSelect() {
  return (
    <LocaleSwitcher>
      {({ locales, current, switch: changeLocale }) => (
        <select value={current} onChange={(e) => changeLocale(e.target.value)}>
          {locales.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      )}
    </LocaleSwitcher>
  );
}
```

## ⚔️ Comparison

| Feature / Library             | **i18nt** | i18next | FormatJS | next-intl |
| :---------------------------- | :---: | :---: | :---: | :---: |
| **Bundle Size (Gzip)**        | **< 3KB** | ~40KB+ | ~30KB | ~10KB |
| **Type Safety**               | **Proxy (Auto)** | String (Manual) | ID-based | String |
| **ICU Validation**            | **✅ Auto** | ❌ | ✅ | ✅ |
| **Audit & Pruning**           | **✅ Built-in** | ❌ | ❌ | ❌ |
| **AI Workflow**               | **✅ Built-in** | ❌ | ❌ | ❌ |

## 📄 License

MIT
