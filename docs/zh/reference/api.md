---
title: API 参考
description: i18nt 核心 API、配置项及插件系统详尽参考
---

# API 参考

## `createI18n(options)`

创建一个 i18n 实例的核心工厂函数。

### 配置项 (Options)

| 参数 | 类型 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- |
| `translations` | `object` | `{}` | 翻译字典对象 |
| `langOrder` | `string[]` | `[]` | 语言顺序列表，如 `['zh-CN', 'en-US']` |
| `locale` | `string` | `''` | 当前活跃语言 |
| `fallbackLocale` | `string` | `''` | 当 Key 缺失时的回退语言 |
| `plugins` | `Plugin[]` | `[]` | 插件列表 |
| `loaders` | `object` | `{}` | 动态命名空间加载器 |
| `preParse` | `boolean` | `false` | 是否开启预解析以提升运行时性能 |

---

## `i18n.t`

翻译函数/属性访问器。

### 属性访问
```ts
t.path.to.key; // 返回当前语言对应的字符串
```

### 函数式调用
```ts
t(key, params, options);
```
- `key`: 词条路径字符串
- `params`: ICU 变量映射
- `options`: 局部配置（如 `locale`）

---

## 钩子与插件 API

### `i18n.onChange(callback)`
当语言切换时触发回调。

### `i18n.setLocale(locale)`
异步/同步切换当前语言。
