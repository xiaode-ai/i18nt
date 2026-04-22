import https from 'https';

/**
 * AI 翻译助手：支持多供应商（Provider）及自定义 API
 */
export async function translateWithAI(texts, targetLangs, sourceLang = 'zh-CN') {
  const provider = process.env.I18NT_AI_PROVIDER || 'openai';
  const apiKey = process.env.I18NT_AI_API_KEY;
  const apiHost = process.env.I18NT_AI_API_HOST || (provider === 'openai' ? 'api.openai.com' : provider === 'claude' ? 'api.anthropic.com' : provider === 'openrouter' ? 'openrouter.ai' : '');
  const apiPath = process.env.I18NT_AI_API_PATH || (provider === 'openai' ? '/v1/chat/completions' : provider === 'claude' ? '/v1/messages' : provider === 'openrouter' ? '/api/v1/chat/completions' : '');
  const model = process.env.I18NT_AI_MODEL;
  if (!model && provider !== 'custom') {
    console.warn('\x1b[33m⚠️ Warning: No AI model configured. The request might fail. Please set it via "i18nt config init".\x1b[0m');
  }

  if (!apiKey) {
    throw new Error('Missing I18NT_AI_API_KEY. Please set it in your environment variables.');
  }
  if (!apiHost || !apiPath) {
    throw new Error('Missing I18NT_AI_API_HOST or I18NT_AI_API_PATH for the current provider.');
  }

  const prompt = `You are a professional translator. Translate the following JSON values from ${sourceLang} to these languages: ${targetLangs.join(', ')}. 
Keep ICU MessageFormat tags like {name}, {count, plural, ...} and # unchanged. 
Return ONLY a raw JSON object where keys are language codes and values are objects containing the translated strings.

Input:
${JSON.stringify(texts, null, 2)}`;

  let payload = {};
  
  // 根据 Provider 构造不同的请求体
  if (provider === 'openai' || provider === 'custom' || provider === 'deepseek' || provider === 'openrouter') {
    payload = {
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    };
  } else if (provider === 'gemini') {
    // 简单的 Gemini API 支持 (需要 I18NT_AI_API_PATH 包含 v1beta/models/...:generateContent)
    payload = {
      contents: [{ parts: [{ text: prompt }] }]
    };
  } else if (provider === 'claude') {
    payload = {
      model: model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
    };
  }

  const data = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: apiHost,
      path: apiPath + (provider === 'gemini' ? `?key=${apiKey}` : ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    if (provider !== 'gemini' && provider !== 'claude') {
        options.headers['Authorization'] = `Bearer ${apiKey}`;
    }

    if (provider === 'claude') {
        options.headers['x-api-key'] = apiKey;
        options.headers['anthropic-version'] = '2023-06-01';
    }

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`AI API Error (${res.statusCode}): ${body}`));
          return;
        }

        try {
          const json = JSON.parse(body);

          let content = '';
          if (provider === 'openai' || provider === 'custom' || provider === 'deepseek' || provider === 'openrouter') {
            content = json.choices[0].message.content;
          } else if (provider === 'gemini') {
            content = json.candidates[0].content.parts[0].text;
          } else if (provider === 'claude') {
            content = json.content[0].text;
          }

          // [Debug Log] 打印原始返回内容以便排查
          if (process.env.I18NT_DEBUG) {
            console.log('\n--- [AI RAW RESPONSE] ---');
            console.log(content);
            console.log('-------------------------\n');
          }

          // 优化正则：尝试匹配最外层的 JSON 对象
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            resolve(JSON.parse(jsonMatch[0]));
          } else {
            reject(new Error('AI response did not contain a valid JSON object.'));
          }
        } catch (e) {
          reject(new Error(`Failed to parse AI response: ${e.message}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(data);
    req.end();
  });
}
