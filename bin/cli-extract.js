import fs from 'fs';
import path from 'path';

import { extractFromDirectory } from './extract-engine.js';

/**
 * 从源码中提取翻译 Key 及其默认值
 */
export function extractKeys(inputDir) {
  return extractFromDirectory(inputDir);
}

/**
 * 将提取到的 Key 同步到翻译文件
 */
export function syncKeysToTranslations(tsFilePath, extractedMap) {
  if (!fs.existsSync(tsFilePath)) return { added: 0 };

  let content = fs.readFileSync(tsFilePath, 'utf8');
  const transMatch = content.match(/(?:export\s+)?const\s+TRANSLATIONS\s*=\s*(\{[\s\S]*?\});/);
  if (!transMatch) return { added: 0 };

  const langOrderMatch = content.match(/(?:export\s+)?const\s+LANG_ORDER\s*=\s*\[(.*?)\]/);
  const langOrder = langOrderMatch ? langOrderMatch[1].split(',').map(s => s.trim().replace(/['"`]/g, '')).filter(Boolean) : ['zh-CN', 'en-US'];

  let addedCount = 0;
  let transStr = transMatch[1];

  for (const keyPath in extractedMap) {
    const defaultValue = extractedMap[keyPath];
    // 检查 Key 是否已存在
    const keyName = keyPath.includes('.') ? keyPath.split('.').pop() : keyPath;
    if (new RegExp(`${keyName}\\s*:`).test(transStr)) continue;

    // 注入逻辑：如果提取到了默认值，则填入所有语言（或第一种语言）
    const values = langOrder.map((_, i) => (i === 0 && defaultValue) ? `'${defaultValue}'` : "''").join(', ');
    const newEntry = `\n  ${keyPath.replace(/\./g, '_')}: [${values}], // Auto-extracted`;
    
    const lastBraceIdx = transStr.lastIndexOf('}');
    if (lastBraceIdx !== -1) {
        transStr = transStr.substring(0, lastBraceIdx) + newEntry + '\n' + transStr.substring(lastBraceIdx);
        addedCount++;
    }
  }

  if (addedCount > 0) {
    const newContent = content.replace(transMatch[1], transStr);
    fs.writeFileSync(tsFilePath, newContent, 'utf8');
  }

  return { added: addedCount };
}
