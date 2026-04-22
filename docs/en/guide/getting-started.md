---
title: Getting Started (React 19)
description: Experience lightning-fast i18n with React 19 + Tailwind CSS
---

# Getting Started

i18nt is an internationalization framework designed specifically for modern React applications (especially React 19+). It focuses on **Zero Runtime Overhead**, **Extreme Type Safety**, and a **Tailwind CSS-friendly** developer experience.

## Installation

Install the core library using your preferred package manager:

```bash
npm i @xiaode-ai/i18nt
```

## Core Workflow

i18nt perfectly adapts to React 19 features and recommends using Tailwind CSS for style management.

### 1. Define Dictionary (SSOT)

Define your translations in a TS file.

```ts
// i18n/dict.ts
export const TRANSLATIONS = {
  welcome: ["Welcome to i18nt", "欢迎使用 i18nt"],
  cta: ["Get Started", "立即开始"]
};
export const LANG_ORDER = ["en-US", "zh-CN"] as const;
```

### 2. Initialize Instance (React 19)

In React 19, you can use the i18n instance with Context for seamless updates.

```tsx
import { createI18n } from "@xiaode-ai/i18nt";
import { TRANSLATIONS, LANG_ORDER } from "./i18n/dict";

const i18n = createI18n({
  translations: TRANSLATIONS,
  langOrder: LANG_ORDER,
  locale: "en-US"
});

export const { t } = i18n;
```

### 3. Usage in UI (Tailwind CSS)

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

## Next Steps

Explore deep integration guides:
- [React 19 Tutorial](./react)
- [Next.js (RSC) Tutorial](./nextjs)
- [AOT Optimization](./performance)
