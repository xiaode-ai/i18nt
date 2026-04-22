---
title: AI 自动翻译
description: 利用大模型能力一键完成多语言翻译
---

# AI 自动化翻译

i18nt 深度集成了主流 AI 模型，帮助您从枯燥的手动翻译中解脱出来。

## 1. 配置 AI 提供商

在环境变量或 `.i18ntrc` 中设置您的 API 密钥：

```bash
# .env
I18NT_AI_PROVIDER=openai
I18NT_AI_API_KEY=sk-xxxx
```

支持的提供商包括：`openai`, `gemini`, `deepseek`。

## 2. 自动翻译缺失 Key

运行以下命令，CLI 会自动扫描字典，识别各语言间的缺失项，并调用 AI 进行翻译填充：

```bash
npx i18nt translate
```

## 3. 为什么使用 i18nt 的 AI 翻译？

- **上下文感知**：CLI 会将提取到的描述（`@i18nt-desc`）作为 Prompt 发送给 AI，确保翻译准确。
- **ICU 语法安全**：AI 会保留 ICU 语法结构（如 `{count, plural, ...}`），仅翻译内部文本。
- **批量处理**：一次性处理全语种翻译，极大地节省了开发时间。
