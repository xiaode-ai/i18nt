---
title: CLI Extraction
description: Automate your translation workflow with i18nt CLI
---

# CLI Extraction & Sync

i18nt provides powerful command-line tools to automate the extraction of translation keys from source code and sync them with your dictionary files.

## Basic Extraction

Run the following command to scan the `src` directory and update `src/i18n/dict.ts`:

```bash
npx i18nt extract --input src/
```

## Enhanced Extraction (Metadata)

i18nt supports extracting descriptions and context from source code comments. This is extremely helpful for translators to understand the background of a key and improves the accuracy of AI translations.

### Using `@i18nt-desc`

You can add a description to any translation call:

```ts
// @i18nt-desc: Main button on the login page
t.auth.login;

t('common.save', 'Save'); // @i18nt-desc: Generic save button
```

After extraction, comments will be automatically generated in `dict.ts`:

```ts
export const TRANSLATIONS = {
  auth_login: ["登录", "Login"], // Main button on the login page
  common_save: ["保存", "Save"], // Generic save button
};
```

### Using `@i18nt-meta`

Supports extracting more complex key-value metadata:

```ts
// @i18nt-meta: context="user_profile", priority="high"
t.user.nickname;
```

## Pruning

As your project evolves, some translation keys may become unused. The `prune` command scans your source code and physically removes keys from the dictionary that are never referenced:

```bash
npx i18nt prune --input src/
```

> [!WARNING]
> The `prune` command modifies your dictionary files directly. Ensure your code is committed to Git before running it.
