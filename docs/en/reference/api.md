---
title: API Reference
description: Detailed reference for i18nt core API, configuration options, and plugin system
---

# API Reference

## `createI18n(options)`

The core factory function to create an i18n instance.

### Options

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `translations` | `object` | `{}` | The translation dictionary object |
| `langOrder` | `string[]` | `[]` | List of language codes, e.g., `['zh-CN', 'en-US']` |
| `locale` | `string` | `''` | Currently active locale |
| `fallbackLocale` | `string` | `''` | Fallback locale when a key is missing |
| `plugins` | `Plugin[]` | `[]` | List of plugins |
| `loaders` | `object` | `{}` | Dynamic namespace loaders |
| `preParse` | `boolean` | `false` | Enable pre-parsing for better runtime performance |

---

## `i18n.t`

The translation function/property accessor.

### Property Access
```ts
t.path.to.key; // Returns the string for the current locale
```

### Functional Call
```ts
t(key, params, options);
```
- `key`: The key path string
- `params`: Map of ICU variables
- `options`: Local configurations (e.g., `locale`)

---

## Hooks & Plugin API

### `i18n.onChange(callback)`
Triggers a callback when the locale changes.

### `i18n.setLocale(locale)`
Asynchronously/Synchronously switches the current locale.
