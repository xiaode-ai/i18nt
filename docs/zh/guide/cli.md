---
title: CLI 提取与同步
description: 使用 i18nt 命令行工具自动化您的翻译工作流
---

# CLI 提取与同步

i18nt 提供了强大的命令行工具，支持自动化提取源码中的翻译 Key，并同步到您的字典文件中。

## 基础提取

运行以下命令扫描 `src` 目录并更新 `src/i18n/dict.ts`：

```bash
npx i18nt extract --input src/
```

## 增强型提取 (元数据)

i18nt 支持从源码注释中提取描述信息和上下文。这对于翻译人员理解词条背景非常有帮助，也能提升 AI 翻译的准确度。

### 使用描述标签 `@i18nt-desc`

您可以为任何翻译调用添加描述：

```ts
// @i18nt-desc: 登录页面的主要按钮
t.auth.login;

t('common.save', '保存'); // @i18nt-desc: 通用保存按钮
```

提取后，`dict.ts` 中会自动生成对应的注释：

```ts
export const TRANSLATIONS = {
  auth_login: ["登录", "Login"], // 登录页面的主要按钮
  common_save: ["保存", "Save"], // 通用保存按钮
};
```

### 使用元数据标签 `@i18nt-meta`

支持提取更复杂的键值对信息：

```ts
// @i18nt-meta: context="user_profile", priority="high"
t.user.nickname;
```

## 精准剪枝 (Pruning)

随着项目迭代，可能会遗留一些不再使用的翻译 Key。使用 `prune` 命令可以扫描源码并物理移除字典中从未被引用的 Key：

```bash
npx i18nt prune --input src/
```

> [!WARNING]
> `prune` 命令会直接修改您的字典文件，建议在执行前确保代码已提交到 Git。
