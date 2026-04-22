---
title: AI Translation
description: Leverage LLMs to complete multi-language translations in one click
---

# AI Automated Translation

i18nt deeply integrates with mainstream AI models to free you from tedious manual translation.

## 1. Configure AI Provider

Set your API key in your environment variables or `.i18ntrc`:

```bash
# .env
I18NT_AI_PROVIDER=openai
I18NT_AI_API_KEY=sk-xxxx
```

Supported providers include: `openai`, `gemini`, `deepseek`.

## 2. Translate Missing Keys

Run the following command, and the CLI will automatically scan your dictionary, identify missing entries across languages, and call the AI to fill them:

```bash
npx i18nt translate
```

## 3. Why Use i18nt AI Translation?

- **Context Awareness**: The CLI sends extracted descriptions (`@i18nt-desc`) as prompts to the AI, ensuring accurate translations.
- **ICU Syntax Safety**: The AI preserves ICU syntax structures (e.g., `{count, plural, ...}`) and only translates the internal text.
- **Batch Processing**: Handle translations for all languages at once, significantly saving development time.
