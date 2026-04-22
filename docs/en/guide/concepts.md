---
title: Core Concepts
description: Deep dive into the design philosophy and core mechanisms of i18nt
---

# Core Concepts

i18nt is designed with two core principles: **"Extreme Lightweight"** and **"Developer Friendly"**.

## 1. Proxy-Driven

Traditional i18n libraries often use string-based paths, e.g., `t('auth.login.button')`. This makes refactoring difficult and prone to typos.

i18nt uses **Recursive Proxy** technology. When you access `t.auth.login`, the Proxy dynamically captures the path:
- **On-Demand Generation**: Paths are computed only when accessed.
- **O(1) Initialization**: Initialization time remains constant regardless of dictionary size.

## 2. ICU Standardization

We don't reinvent the wheel. i18nt strictly follows the Unicode ICU MessageFormat standard:
- **Plural**: Handles complex plural rules across different languages.
- **Select**: Chooses text based on gender, categories, etc.
- **Formatting**: Built-in internationalized formatting for dates, numbers, and lists.

## 3. Cross-Language Consistency (SSOT)

i18nt treats the TypeScript dictionary as the **Single Source of Truth**. Via the CLI, you can export these logics into constants for Python, Go, and other languages, ensuring consistent logic across the stack.
