---
title: Next.js (RSC) Tutorial
description: Implementing server-side internationalization in Next.js App Router
---

# Next.js (RSC) Tutorial

i18nt perfectly supports Next.js React Server Components (RSC), providing excellent SEO and zero runtime JS overhead when rendered on the server.

## 1. Server Components (RSC)

In RSC, you can import and use i18nt directly as it doesn't depend on browser APIs.

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

## 2. Routing Integration

We recommend using Next.js dynamic routes `[locale]` to manage languages.

```ts
// middleware.ts
import { NextResponse } from 'next/server';

export function middleware(request) {
  // Simple language redirection logic
  const locale = request.headers.get('accept-language')?.split(',')[0] || 'en';
  // ...
}
```

## 3. Client Components

In `'use client'` components, you can use the Context API or a global instance.

```tsx
'use client';
import { useI18n } from '@/hooks/useI18n';

export function ClientComponent() {
  const { t } = useI18n();
  return <button>{t.actions.submit}</button>;
}
```

## 4. AOT Compilation

During the Next.js build phase, use the i18nt CLI to pre-compile translation dictionaries into static JSON or JS to further improve response speeds in the Edge Runtime.

```bash
npx i18nt compile --out-dir ./public/locales
```
