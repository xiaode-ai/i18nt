import fs from 'fs';
import path from 'path';

/**
 * 从源码中提取翻译 Key 及其默认值
 */
export function extractKeys(inputDir) {
  const results = {}; // { key: defaultValue }
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue'];

  function walk(dir) {
    const list = fs.readdirSync(dir);
    for (const item of list) {
      if (['node_modules', '.git', 'dist', '.i18nt'].includes(item)) continue;
      const fullPath = path.join(dir, item);
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        walk(fullPath);
      } else if (extensions.includes(path.extname(item))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        
        // 1. 匹配 t('path.to.key', 'default text') - 支持多行和单双引号
        // 这里的正则能够捕获 key 和可选的第二个参数（默认值）
        const fnRegex = /t\s*\(\s*['"]([a-zA-Z0-9_.]+)['"](?:\s*,\s*(['"])([\s\S]*?)\2)?\s*[),]/g;
        let m;
        while ((m = fnRegex.exec(content)) !== null) {
          const key = m[1];
          const defaultValue = m[3] || '';
          if (!results[key] || (defaultValue && !results[key])) {
            results[key] = defaultValue;
          }
        }

        // 2. 匹配 t.path.to.key (排除一些常用 JS 属性)
        const proxyRegex = /t\.([a-zA-Z0-9_.]+)/g;
        const reserved = ['apply', 'call', 'bind', 'n', 'd', 'relative', 'formatNumber', 'formatDate', 'formatRelative', 'locale', 'setLocale', 'isRTL', 'onChange', 'loadNamespace', 'addTranslations', 'missingKeys', 'availableLocales', 'exportState', 'importState', 'validate', 'prune', 'isDouble', 'toString', 'valueOf', 'toJSON'];
        while ((m = proxyRegex.exec(content)) !== null) {
          const keyPath = m[1];
          const firstPart = keyPath.split('.')[0];
          if (!reserved.includes(firstPart)) {
            if (!results[keyPath]) results[keyPath] = '';
          }
        }
      }
    }
  }

  const absPath = path.resolve(inputDir);
  if (fs.existsSync(absPath)) walk(absPath);
  return results;
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
