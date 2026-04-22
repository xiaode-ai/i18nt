---
title: Next.js (RSC) 实战
description: 在 Next.js App Router 中实现服务端国际化
---

# Next.js (RSC) 实战

i18nt 完美支持 Next.js 的 React Server Components (RSC)，提供极佳的 SEO 和零运行时 JS 开销（在服务端渲染时）。

## 1. 服务端组件 (RSC)

在 RSC 中，您可以直接导入并使用 i18nt，因为它不依赖浏览器 API。

```tsx
// app/[locale]/page.tsx
import { createI18n } from 'i18nt';

export default async function Page({ params: { locale } }) {
  const i18n = createI18n({
    translations: await getTranslations(locale),
    locale
  });

  return (
    <main>
      <h1>{i18n.t.home.title}</h1>
    </main>
  );
}
```

## 2. 路由集成

推荐使用 Next.js 的动态路由 `[locale]` 来管理语言。

```ts
// middleware.ts
import { NextResponse } from 'next/server';

export function middleware(request) {
  // 简单的语言重定向逻辑
  const locale = request.headers.get('accept-language')?.split(',')[0] || 'en';
  // ...
}
```

## 3. 客户端组件

在 `'use client'` 组件中，您可以使用 Context API 或者全局实例。

```tsx
'use client';
import { useI18n } from '@/hooks/useI18n';

export function ClientComponent() {
  const { t } = useI18n();
  return <button>{t.actions.submit}</button>;
}
```

## 4. AOT 预编译

在 Next.js 构建阶段，使用 i18nt CLI 将翻译字典预编译为静态 JSON 或 JS，可以进一步提升边缘计算（Edge Runtime）的响应速度。

```bash
npx i18nt compile --out-dir ./public/locales
```
