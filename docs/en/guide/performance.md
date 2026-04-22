---
title: AOT Optimization
description: Achieving extreme performance with pre-compilation and pruning techniques
---

# Performance Optimization (AOT & JIT)

i18nt is optimized across multiple dimensions to ensure smooth performance even in very large projects.

## 1. Runtime JIT Compilation

The first time you access an ICU entry, i18nt parses it into an AST and JIT-compiles it into an efficient chain of JS functions. Subsequent accesses execute this function directly, incurring almost zero parsing overhead.

## 2. Build-time AOT Pre-compilation

Using `i18ntVitePlugin`, you can pre-parse all ICU strings during the production build:

```ts
// vite.config.ts
import { i18ntVitePlugin } from '@xiaode-ai/i18nt';

export default {
  plugins: [
    i18ntVitePlugin({
      preCompile: true // Enable AOT pre-compilation
    })
  ]
}
```

## 3. Precise Pruning

The CLI `prune` command scans your source code and physically removes unused keys from your dictionary. This not only reduces the size of `dict.ts` but also lowers client-side memory usage.

## 4. Automatic Splitting

When a single language dictionary exceeds a threshold (e.g., 50KB), the Vite plugin supports splitting it into independent chunks based on namespaces, enabling Lazy Loading.
