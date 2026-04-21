import https from 'https';

/**
 * AI 翻译助手：支持多供应商（Provider）及自定义 API
 */
export async function translateWithAI(texts, targetLangs, sourceLang = 'zh-CN') {
  const provider = process.env.I18NT_AI_PROVIDER || 'openai';
  const apiKey = process.env.I18NT_AI_API_KEY;
  const apiHost = process.env.I18NT_AI_API_HOST || (provider === 'openai' ? 'api.openai.com' : '');
  const apiPath = process.env.I18NT_AI_API_PATH || (provider === 'openai' ? '/v1/chat/completions' : '');
  const model = process.env.I18NT_AI_MODEL || (provider === 'openai' ? 'gpt-3.5-turbo' : '');

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
  if (provider === 'openai' || provider === 'custom') {
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
  }

  const data = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: apiHost,
      path: apiPath + (provider === 'gemini' ? `?key=${apiKey}` : ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    if (provider !== 'gemini') {
        options.headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          
          if (res.statusCode >= 400) {
            reject(new Error(`AI API Error (${res.statusCode}): ${body}`));
            return;
          }

          let content = '';
          if (provider === 'openai' || provider === 'custom') {
            content = json.choices[0].message.content;
          } else if (provider === 'gemini') {
            content = json.candidates[0].content.parts[0].text;
          }

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
