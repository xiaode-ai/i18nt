---
title: TypeScript Support
description: Explore powerful type inference and autocompletion features in i18nt
---

# TypeScript Support

i18nt leverages the TypeScript type system to provide an exceptional developer experience.

## 1. Automatic Path Inference

No matter how deep your translation dictionary is nested, i18nt accurately infers the type of each layer through the Proxy chain.

```ts
const TRANSLATIONS = {
  a: { b: { c: { d: ["Hello", "Bonjour"] } } }
};

// Your IDE provides full path autocomplete
t.a.b.c.d; 
```

## 2. ICU Variable Inference

i18nt parses your ICU strings and automatically extracts variables as types for function arguments.

```ts
// Dictionary definition
const TRANSLATIONS = {
  welcome: ["Hello, {name}!", "Bonjour, {name}!"]
};

// The t function infers the argument type: { name: string | number }
t("welcome", { name: "Alice" }); 
```

## 3. Strict Key Validation

Combined with `@xiaode-ai/eslint-plugin-i18nt`, you can detect invalid key references or incorrect ICU syntax before compilation.
