---
title: Vue 3 Tutorial
description: Using i18nt for internationalization in Vue 3
---

# Vue 3 Tutorial

The combination of i18nt and Vue 3 provides a reactive internationalization experience, fitting naturally with the Composition API.

## 1. Installation

While i18nt core is framework-agnostic, we recommend using `ref` or `reactive` to wrap the instance for reactivity.

```bash
npm install i18nt
```

## 2. Basic Configuration

In Vue 3, you can create a global i18n utility.

```ts
// i18n.ts
import { createI18n } from 'i18nt';
import { reactive } from 'vue';

const translations = {
  welcome: ['Hello', '你好']
};

export const i18n = createI18n({
  translations,
  locale: 'en-US'
});

// Wrap with reactive to support Vue reactivity
export const t = reactive(i18n.t);
```

## 3. Usage in Components

```vue
<script setup>
import { t, i18n } from './i18n';

const toggleLocale = () => {
  i18n.setLocale(i18n.locale === 'zh-CN' ? 'en-US' : 'zh-CN');
};
</script>

<template>
  <div>
    <h1>{{ t.welcome }}</h1>
    <button @click="toggleLocale">Toggle Language</button>
  </div>
</template>
```

## 4. Advantages

- **Type Safety**: Enjoy full TS autocompletion within `<script setup>`.
- **Code Splitting**: Easily implement lazy-loading for language packs combined with Vue's async components.
- **Extreme Performance**: Proxy access has almost zero overhead and won't trigger unnecessary full re-renders.
