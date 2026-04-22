---
title: React 19 实战
description: 深度挖掘 i18nt 在 React 19 中的潜力，配合 Tailwind CSS 打造极致 UI
---

# React 19 实战

i18nt 为 React 19 提供了深度的原生支持。结合 React 19 的新特性（如组件级元数据处理）和 Tailwind CSS，您可以构建出既美观又高性能的多语言应用。

## 1. 配置 Context Provider

在 React 19 中，我们推荐使用 Context 来分发 i18n 实例，确保组件树的响应式更新。

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

## 2. 自定义 Hook 与 Tailwind 集成

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

## 3. React 19 与 i18nt 的结合点

### 极致性能
i18nt 使用 **Proxy** 技术，即使在 React 19 的复杂渲染树中，访问翻译项的开销也几乎可以忽略不计。

### Tailwind CSS 动态文本
由于 i18nt 导出的文本是纯字符串，您可以无缝地将其嵌入到 Tailwind 的任意 class 中，或者作为 `aria-label` 等属性。

```tsx
<div title={t.tooltip.info} className="hover:after:content-[attr(title)]">
  {t.common.help}
</div>
```

## 4. 最佳实践：AOT 预编译

在生产环境下，建议配合 i18nt CLI 进行 AOT（Ahead-of-Time）预编译。这样在 React 19 渲染时，所有的 ICU 语法已经转换为高效的 JavaScript 函数，进一步压榨性能。

```bash
npx i18nt compile --target react
```
