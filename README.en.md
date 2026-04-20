# i18nt

> Ultra-lightweight i18n framework — Zero-dependency · Proxy-driven · ICU Standard · Nested Namespace

[简体中文](./README.md) | English

[![npm](https://img.shields.io/npm/v/@xiaode-ai/i18nt)](https://www.npmjs.com/package/@xiaode-ai/i18nt)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@xiaode-ai/i18nt)](https://bundlephobia.com/package/@xiaode-ai/i18nt)
[![license](https://img.shields.io/github/license/xiaode-ai/i18nt)](https://github.com/xiaode-ai/i18nt/blob/main/LICENSE)

## ✨ Features

- **🚀 Instant Start**: Based on **Recursive Proxy**, paths are generated on-the-fly. Initialization performance is **O(1)**, supporting infinite nesting with perfect Intellisense.
- **📦 Zero-dependency**: Core code **< 3KB** (gzip). No third-party libraries required, not even `intl-messageformat`.
- **🎯 ICU Standard**: Built-in lightweight ICU parser (1.2KB), supporting `plural`, `select`, `selectordinal`, `offset`, and nested syntax.
- **⚛️ React Native Support**: Built-in `I18nProvider` and `useI18n` Hook with RTL auto-sync and lazy loading support.
- **🛠️ Powerful CLI**: Supports distributed dictionary scanning, automatic namespace generation, and multi-language union export, tailored for Monorepo architectures.
- **🌐 Global Ready**: Numbers, dates, and relative time formatting call the browser's `Intl` API directly for minimal size and maximum consistency.

## 📦 Installation

```bash
npm i @xiaode-ai/i18nt
```

## 🚀 Quick Start

### 1. Define Dictionary

```ts
// src/i18n/dict.ts
export const LANG_ORDER = ["zh-CN", "en-US"] as const;

export const TRANSLATIONS = {
  // Basic text
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

### 2. Initialize and Use

```ts
import { createI18n } from "@xiaode-ai/i18nt";
import { TRANSLATIONS, LANG_ORDER } from "./i18n/dict";

const i18n = createI18n({
  translations: TRANSLATIONS,
  langOrder: LANG_ORDER,
  locale: "en-US",
});

const { t } = i18n;

// Proxy-driven property access with perfect autocomplete
console.log(t.buttons.save); // "Save"

// Functional call for ICU logic
console.log(t("cart", { count: 3 })); // "3 items in cart"
```

## ⚛️ React Integration

`i18nt` provides an official React adapter for global state management and component re-rendering.

### Setup Provider

```tsx
import { I18nProvider } from "@xiaode-ai/i18nt/react";

function Root() {
  return (
    <I18nProvider config={{ translations, langOrder, locale: 'en-US' }}>
      <App />
    </I18nProvider>
  );
}
```

### Use in Components

```tsx
import { useI18n } from "@xiaode-ai/i18nt/react";

function UserProfile() {
  const { t, setLocale, locale } = useI18n();

  return (
    <div>
      <p>{t.profile.welcome}</p>
      <button onClick={() => setLocale('zh-CN')}>Switch to Chinese</button>
    </div>
  );
}
```

## 🛠️ CLI Advanced: Distributed Translation

For large projects, it's recommended to split dictionaries across modules. `i18nt` CLI can aggregate them automatically.

### Directory Example
```text
src/
  auth/
    i18n.ts      // Defines 'auth' namespace
  settings/
    i18n.ts      // Defines 'settings' namespace
```

### Automation
```bash
# 1. Recursively scan src/, aggregate namespaces based on file paths, and export to JSON
npx i18nt export --input src/ --lang all --json ./locales/

# 2. Batch import translated JSON (if needed)
npx i18nt import --json ./locales/
```

## 🛡️ TypeScript Type Safety

Thanks to **Recursive Proxy**, you get automatic code completion everywhere once your dictionary is defined:

```ts
// Even with 10-level nesting, i18nt infers types accurately
t.a.b.c.d.e.f.g.h.i.j; 
```

## ⚔️ Comparison

| Feature / Library             | i18nt |  i18next  | FormatJS |
| :---------------------------- | :---: | :-------: | :------: |
| **Size (Gzip)**               | **< 3KB** |  ~40KB    |  ~30KB   |
| **Zero-dependency**           |  ✅   |    ❌     |    ❌    |
| **Proxy-driven (Autocomplete)**|  ✅   |    ❌     |    ❌    |
| **Core ICU Support**          |  ✅   | ✅ (Plugin)|    ✅    |
| **RTL Auto-sync**             |  ✅   |    ❌     |    ❌    |

## 📄 License

MIT
