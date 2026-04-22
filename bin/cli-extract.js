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
export function syncKeysToTranslations(filePath, extractedMap) {
  if (!fs.existsSync(filePath)) return { added: 0 };
  const ext = path.extname(filePath);

  if (ext === '.json') {
    let json;
    try {
        json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.error(`Error parsing JSON file ${filePath}: ${e.message}`);
        return { added: 0 };
    }
    
    let isWrapped = !!json.translations;
    let trans = json.translations || json;
    let addedCount = 0;

    for (const keyPath in extractedMap) {
        const { defaultValue } = extractedMap[keyPath];
        const parts = keyPath.split('.');
        let curr = trans;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!curr[parts[i]]) curr[parts[i]] = {};
            curr = curr[parts[i]];
        }
        const lastKey = parts[parts.length - 1];
        if (curr[lastKey] === undefined) {
            curr[lastKey] = defaultValue || "";
            addedCount++;
        }
    }

    if (addedCount > 0) {
        fs.writeFileSync(filePath, JSON.stringify(json, null, 4), 'utf8');
    }
    return { added: addedCount };
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const transMatch = content.match(/(?:export\s+)?const\s+TRANSLATIONS\s*=\s*(\{[\s\S]*?\});/);
  if (!transMatch) return { added: 0 };

  const langOrderMatch = content.match(/(?:export\s+)?const\s+LANG_ORDER\s*=\s*\[(.*?)\]/);
  const langOrder = langOrderMatch ? langOrderMatch[1].split(',').map(s => s.trim().replace(/['"`]/g, '')).filter(Boolean) : ['zh-CN', 'en-US'];

  let addedCount = 0;
  let transStr = transMatch[1];

  for (const keyPath in extractedMap) {
    const { defaultValue, meta } = extractedMap[keyPath];
    // 检查 Key 是否已存在
    const keyName = keyPath.includes('.') ? keyPath.split('.').pop() : keyPath;
    const flatKey = keyPath.replace(/\./g, '_');
    if (new RegExp(`(?:^|\\s)${flatKey}\\s*:`).test(transStr)) continue;

    // 注入逻辑：如果提取到了默认值，则填入所有语言（或第一种语言）
    const values = langOrder.map((_, i) => (i === 0 && defaultValue) ? `'${defaultValue}'` : "''").join(', ');
    
    let comment = ' // Auto-extracted';
    if (meta.desc) comment = ` // ${meta.desc}`;
    else if (meta.context) comment = ` // Context: ${meta.context}`;

    const newEntry = `\n  ${flatKey}: [${values}],${comment}`;
    
    const lastBraceIdx = transStr.lastIndexOf('}');
    if (lastBraceIdx !== -1) {
        const prefix = transStr.substring(0, lastBraceIdx);
        const suffix = transStr.substring(lastBraceIdx);
        
        // 如果前一个项后面没逗号，且不是对象开始，则补齐逗号
        let connector = '';
        const lastChar = prefix.trim().slice(-1);
        if (lastChar && lastChar !== '{' && lastChar !== ',') {
            connector = ',';
        }

        transStr = prefix + connector + newEntry + '\n' + suffix;
        addedCount++;
    }
  }

  if (addedCount > 0) {
    const newContent = content.replace(transMatch[1], transStr);
    fs.writeFileSync(filePath, newContent, 'utf8');
  }

  return { added: addedCount };
}
