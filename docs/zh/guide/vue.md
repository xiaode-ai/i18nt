---
title: Vue 3 实战
description: 在 Vue 3 中使用 i18nt 进行国际化开发
---

# Vue 3 实战

i18nt 与 Vue 3 的组合可以提供响应式的国际化体验，配合 Composition API 使用非常自然。

## 1. 安装适配器

虽然 i18nt 核心是框架无关的，但我们推荐使用 `ref` 来包装实例以实现响应式。

```bash
npm install @i18nt/vue # 假设我们有这个适配器，或者直接使用核心库
```

## 2. 基础配置

在 Vue 3 中，您可以创建一个全局的 i18n 插件。

```ts
// i18n.ts
import { createI18n } from 'i18nt';
import { ref, reactive } from 'vue';

const translations = {
  welcome: ['Hello', '你好']
};

export const i18n = createI18n({
  translations,
  locale: 'zh-CN'
});

// 使用 reactive 包装以支持 Vue 响应式
export const t = reactive(i18n.t);
```

## 3. 在组件中使用

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
    <button @click="toggleLocale">切换语言</button>
  </div>
</template>
```

## 4. 优势

- **类型安全**：在 `<script setup>` 中享受完整的 TS 补全。
- **按需加载**：结合 Vue 的异步组件，可以轻松实现语言包的分包加载。
- **极致性能**：Proxy 访问几乎没有开销，且不会触发不必要的全量重渲染。
