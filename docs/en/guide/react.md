---
title: React 19 Tutorial
description: Master i18nt in React 19 with Tailwind CSS for high-performance UIs
---

# React 19 Tutorial

i18nt provides deep native support for React 19. By combining React 19's new features with Tailwind CSS, you can build beautiful and high-performance multi-language applications.

## 1. Configure Context Provider

In React 19, we recommend using Context to distribute i18n instances, ensuring reactive updates across the component tree.

```tsx
// i18n-provider.tsx
import { createContext, useContext, useState } from "react";
import { createI18n } from "@xiaode-ai/i18nt";

const I18nContext = createContext(null);

export function I18nProvider({ children, initialConfig }) {
  const [i18n] = useState(() => createI18n(initialConfig));
  
  return (
    <I18nContext.Provider value={i18n}>
      {children}
    </I18nContext.Provider>
  );
}
```

## 2. Custom Hook & Tailwind Integration

```tsx
// use-i18n.ts
import { useContext } from "react";
export const useI18n = () => useContext(I18nContext);

// components/Profile.tsx
export function Profile() {
  const { t, locale, setLocale } = useI18n();

  return (
    <section className="p-6 max-w-sm mx-auto bg-white rounded-xl shadow-lg flex items-center space-x-4 border border-slate-100">
      <div className="flex-shrink-0">
        <div className="h-12 w-12 bg-indigo-500 rounded-full flex items-center justify-center text-white font-bold">
          {locale.slice(0, 2).toUpperCase()}
        </div>
      </div>
      <div>
        <div className="text-xl font-medium text-black">{t.profile.name}</div>
        <p className="text-slate-500 text-sm">{t.profile.role}</p>
        <button 
          onClick={() => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')}
          className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-semibold uppercase tracking-wide"
        >
          {t.actions.switch_lang}
        </button>
      </div>
    </section>
  );
}
```

## 3. Benefits in React 19

### Blazing Performance
i18nt uses **Proxy** technology. Even in complex React 19 render trees, the overhead of accessing translation items is virtually zero.

### Dynamic Tailwind Text
Since i18nt exports plain strings, you can seamlessly embed them into any Tailwind class or attributes like `aria-label`.

```tsx
<div title={t.tooltip.info} className="hover:after:content-[attr(title)]">
  {t.common.help}
</div>
```

## 4. Best Practice: AOT Compilation

For production, use the i18nt CLI for AOT (Ahead-of-Time) compilation. This ensures that ICU syntax is converted into efficient JS functions during the React 19 render phase.

```bash
npx i18nt compile --target react
```
