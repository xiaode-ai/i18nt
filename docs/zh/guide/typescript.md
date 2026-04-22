---
title: TypeScript 支持
description: 探索 i18nt 强大的类型推导与自动化补全功能
---

# TypeScript 支持

i18nt 深度利用了 TypeScript 的类型系统，为您提供极致的开发体验。

## 1. 自动路径推导

无论您的翻译字典嵌套有多深，i18nt 都能通过 Proxy 链条准确推导出每一层的类型。

```ts
const TRANSLATIONS = {
  a: { b: { c: { d: ["Hello", "你好"] } } }
};

// IDE 会为您提供完整的路径补全
t.a.b.c.d; 
```

## 2. ICU 变量推断

i18nt 会解析您的 ICU 字符串，并自动提取其中的变量作为函数参数的类型。

```ts
// 字典定义
const TRANSLATIONS = {
  welcome: ["Hello, {name}!", "你好, {name}!"]
};

// t 函数会自动推导出参数类型：{ name: string | number }
t("welcome", { name: "Alice" }); 
```

## 3. 严格模式下的 Key 校验

配合 `@xiaode-ai/eslint-plugin-i18nt`，您可以在编译前就发现无效的 Key 引用或错误的 ICU 语法。
