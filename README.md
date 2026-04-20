# i18nt

> Ultra-lightweight i18n framework — Zero-dependency · Proxy-driven · ICU Standard · Nested Namespace

[简体中文](./README.zh-CN.md) | English

[![npm](https://img.shields.io/npm/v/@xiaode-ai/i18nt)](https://www.npmjs.com/package/@xiaode-ai/i18nt)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@xiaode-ai/i18nt)](https://bundlephobia.com/package/@xiaode-ai/i18nt)

## ✨ Features

- **Zero-dependency**: Core code < 3KB (gzip).
- **Ultimate DX**: Based on **Recursive Proxy**, support `t.auth.login` with infinite nested access and perfect Intellisense.
- **ICU Standard**: Built-in lightweight ICU parser (1.2KB), support `plural`, `select`, `selectordinal`, `offset`, and nested syntax.
- **Native Intl-driven**: Numbers, dates, and relative time formatting call the browser's `Intl` API directly.
- **Dual Syntax**: Perfectly compatible with traditional `{{var}}` interpolation and industrial-grade ICU MessageFormat.
- **RTL Support**: Auto-detect language direction and sync DOM `dir` attribute.
- **CLI Tool**: One-click export/import JSON translation templates from TypeScript dictionaries.

## 📦 Installation

```bash
npm install @xiaode-ai/i18nt
```

## 🚀 Quick Start

### 1. Define Dictionary (Nested Support)

```ts
// src/translations.ts
export const LANG_ORDER = ["zh-CN", "en-US"] as const;

export const TRANSLATIONS = {
  buttons: {
    save: ["保存", "Save"],
  },
  cart_status: [
    "{count, plural, =0{Empty} other{# items}}",
    "{count, plural, =0{Empty} other{# items}}",
  ],
};
```

### 2. Create i18n Instance

```ts
import { createI18n } from "i18nt";
import { TRANSLATIONS, LANG_ORDER } from "./translations";

const i18n = createI18n({
  translations: TRANSLATIONS,
  langOrder: LANG_ORDER,
  locale: "en-US",
});

const { t } = i18n;
t.buttons.save; // → "Save"
t("cart_status", { count: 3 }); // → "3 items"
```

---

## 🚀 Advanced Production

### 1. Persistence & Caching
For a "near-instant" experience, cache the dictionary to `localStorage`. `i18nt` is lightweight enough to be initialized instantly from cache.

Example: [examples/persistence.ts](file:///c:/Users/i-cgh/Documents/GitHub/i18nt/examples/persistence.ts)

### 2. Cloud Sync & Hot Update
Using `extraDicts`, you can update copy without re-deploying. Fetch the latest JSON from your cloud DB and call `setLocale` to perform a **deep recursive merge**.

Example: [examples/cloud_sync.ts](file:///c:/Users/i-cgh/Documents/GitHub/i18nt/examples/cloud_sync.ts)

---

## 🔌 Backend & Polyglot Integration

`i18nt` uses the **ICU MessageFormat** standard. The exported JSON can be consumed by any backend language.

### Recommended Backend ICU Libraries

| Language | Recommended Library |
| :--- | :--- |
| **Python** | [PyICU](https://pypi.org/project/PyICU/) |
| **Go** | [golang.org/x/text/message](https://pkg.go.dev/golang.org/x/text/message) |
| **Rust** | [icu_messageformat](https://crates.io/crates/icu_messageformat) |
| **Java** | [ICU4J](https://unicode-org.github.io/icu/userguide/icu4j/) |

See [examples/polyglot/](file:///c:/Users/i-cgh/Documents/GitHub/i18nt/examples/polyglot/) for more.

---

## 📄 License

MIT
