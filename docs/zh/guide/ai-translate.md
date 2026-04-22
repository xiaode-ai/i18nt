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

支持的提供商包括：`openai`, `gemini`, `deepseek`, `claude`, `openrouter`, `custom`。

### 配置持久化 (推荐)

最简单的方式是使用交互式配置向导：

```bash
npx i18nt config init
```

或者手动保存特定配置：

```bash
# 设置服务商
npx i18nt config set ai_provider deepseek
```

> 配置将保存在项目根目录的 `.i18ntrc` 文件中。

### 常见供应商配置示例

| 供应商 | `I18NT_AI_PROVIDER` | `I18NT_AI_API_HOST` |
| :--- | :--- | :--- |
| **OpenAI** | `openai` | `api.openai.com` |
| **DeepSeek** | `deepseek` | `api.deepseek.com` |
| **Gemini** | `gemini` | `generativelanguage.googleapis.com` |
| **Claude** | `claude` | `api.anthropic.com` |
| **OpenRouter** | `openrouter` | `openrouter.ai` |
| **Custom** | `custom` | `(您的自定义域名)` |

> [!NOTE]
> `I18NT_AI_MODEL` 是可选的。如果未设置，CLI 会根据供应商自动选择当前最主流的默认模型（如 `gpt-4o-mini`, `deepseek-chat` 等）。你也可以根据需要通过该变量指定任何特定模型。

> [!TIP]
> **使用自定义模型 (Local LLM)**：如果你想使用本地部署的模型（如 Ollama），可以将 `I18NT_AI_PROVIDER` 设为 `custom`，并设置 `I18NT_AI_API_HOST` 为 `localhost:11434`。
> 对于 DeepSeek 或其他兼容 OpenAI 接口的服务商，通常需要将 `I18NT_AI_API_PATH` 设置为 `/v1/chat/completions`。

## 2. 自动翻译缺失 Key

运行以下命令，CLI 会自动扫描字典，识别各语言间的缺失项，并调用 AI 进行翻译填充：

```bash
npx i18nt translate
```

## 3. 故障排查与调试

如果你发现翻译没有按预期执行，可以开启调试模式查看 AI 的原始响应：

```bash
# Windows PowerShell
$env:I18NT_DEBUG="true"
npx i18nt translate
```

## 4. 为什么使用 i18nt 的 AI 翻译？

- **上下文感知**：CLI 会尝试将代码中的注释描述作为上下文提供给 AI，确保翻译准确。
- **ICU 语法安全**：AI 会严格保留 ICU 语法结构（如 `{count, plural, ...}`），仅翻译内部文本。
- **批量处理**：一次性处理全语种翻译，极大地节省了开发时间。
