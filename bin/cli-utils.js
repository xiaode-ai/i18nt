import fs from 'fs';
import path from 'path';
import { getGlobalI18n } from '../dist/core.js';

/**
 * 核心逻辑：从 TS 字典字符串解析为 AST 结构
 */
export function parseObject(str) {
  const entries = [];
  let i = 0;
  while (i < str.length) {
    const keyMatch = str.slice(i).match(/(\w+)(\s*:\s*|\s*[,}]|$)/);
    if (!keyMatch) break;
    const key = keyMatch[1];
    const isShorthand = !keyMatch[2].includes(':');
    i += keyMatch.index + keyMatch[0].length;

    if (isShorthand) {
      entries.push({ key, type: 'reference', valueStr: key });
      if (keyMatch[2].includes(',') || keyMatch[2].includes('}')) i -= 1;
      continue;
    }

    let startChar = str[i];
    let endChar = startChar === '[' ? ']' : '{';
    if (startChar !== '[' && startChar !== '{') {
      const valMatch = str.slice(i).match(/['"`][\s\S]*?['"`]|[^,}\s]+/);
      if (valMatch) {
        entries.push({ key, type: 'leaf', valueStr: valMatch[0] });
        i += valMatch.index + valMatch[0].length;
      }
    } else {
      if (startChar === '{') endChar = '}';
      let stack = 0;
      let j = i;
      for (; j < str.length; j++) {
        if (str[j] === startChar) stack++;
        if (str[j] === endChar) stack--;
        if (stack === 0) break;
      }
      const valueStr = str.slice(i, j + 1).trim();

      if (startChar === '{' && !valueStr.includes('one:') && !valueStr.includes('other:')) {
        entries.push({ key, type: 'namespace', children: parseObject(valueStr.slice(1, -1)) });
      } else {
        entries.push({ key, type: 'leaf', valueStr });
      }
      i = j + 1;
    }

    const lastEntry = entries[entries.length - 1];
    if (lastEntry && lastEntry.type === 'leaf') {
      const v = lastEntry.valueStr.trim();
      if (!v.startsWith('[') && !v.startsWith('{') && !v.startsWith("'") && !v.startsWith('"') && !v.startsWith('`')) {
        lastEntry.type = 'reference';
      }
    }

    const nextComma = str.slice(i).match(/\s*[,\}]?\s*/);
    if (nextComma) i += nextComma[0].length;
  }

  // 检测重复 Key (同一层级)
  const seenKeys = new Set();
  for (const entry of entries) {
    if (seenKeys.has(entry.key)) {
      entry.isDuplicate = true;
    }
    seenKeys.add(entry.key);
  }

  return entries;
}

// 为每个语言解析叶子节点值
export function resolveLeafValue(valueStr, lang, langOrder, fallbackLang) {
  const items = [];
  if (valueStr.startsWith('[')) {
    const inner = valueStr.slice(1, -1);
    const itemRegex = /(\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})|(['"`])([\s\S]*?)\2/g;
    let im;
    while ((im = itemRegex.exec(inner)) !== null) {
      if (im[1]) items.push(im[1].replace(/\s+/g, ' '));
      else if (im[3] !== undefined) items.push(im[3]);
    }
  } else {
    return valueStr;
  }

  const langIndex = langOrder.indexOf(lang);
  const fallbackIndex = Math.max(0, langOrder.indexOf(fallbackLang));

  for (const item of items) {
    if (typeof item === 'string') {
      const match = item.match(/^([a-zA-Z0-9-]+):\s*(.*)$/);
      if (match && match[1] === lang) return match[2];
    }
  }
  const targetIdx = langIndex === -1 ? fallbackIndex : langIndex;
  const val = items[targetIdx];
  if (val !== undefined) {
    const match = typeof val === 'string' ? val.match(/^([a-zA-Z0-9-]+):\s*(.*)$/) : null;
    return match && langOrder.includes(match[1]) ? match[2] : val;
  }
  return null;
}

export function buildOutputDict(entries, lang, langOrder, fallbackLang) {
  const result = {};
  for (const entry of entries) {
    if (entry.type === 'namespace') {
      const children = buildOutputDict(entry.children, lang, langOrder, fallbackLang);
      if (Object.keys(children).length > 0) result[entry.key] = children;
    } else {
      const val = resolveLeafValue(entry.valueStr, lang, langOrder, fallbackLang);
      if (val !== null) result[entry.key] = val;
    }
  }
  return result;
}

export function findTranslationsFiles(inputPath) {
  const inputPaths = inputPath
    ? inputPath.split(',').map(p => p.trim())
    : [
        'src/translations.ts',
        'src/i18n/translations.ts',
        'translations.ts',
        'examples/translations.ts',
      ];

  const files = [];

  function walk(dir, rootDir) {
    const list = fs.readdirSync(dir);
    for (const item of list) {
      const fullPath = path.join(dir, item);
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        walk(fullPath, rootDir);
      } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
        const relativePath = path.relative(rootDir, fullPath);
        const moduleName = relativePath.replace(/\.ts$/, '').replace(/[\\\/]/g, '.');
        files.push({ fullPath, moduleName });
      }
    }
  }

  for (const p of inputPaths) {
    const absPath = path.resolve(p);
    if (fs.existsSync(absPath)) {
      const stats = fs.statSync(absPath);
      if (stats.isDirectory()) {
        walk(absPath, absPath);
      } else {
        files.push({ fullPath: absPath, moduleName: path.basename(absPath, '.ts') });
      }
    }
  }
  return files.length > 0 ? files : null;
}

export function loadTranslationsData(inputPath) {
  const translationsFiles = findTranslationsFiles(inputPath);
  if (!translationsFiles) return null;

  const allTranslations = {};
  let globalLangOrder = [];
  let globalMainLang = '';
  const globalLangSet = new Set();
  const processedFiles = new Set();

  function processFile(translationsFile, moduleNamePrefix = '') {
    if (processedFiles.has(translationsFile)) return;
    
    const finalModuleName = moduleNamePrefix || path.basename(translationsFile, '.ts');
    const isNewModule = !allTranslations[finalModuleName];

    processedFiles.add(translationsFile);

    const content = fs.readFileSync(translationsFile, 'utf8');

    const importMap = {};
    const importRegex = /import\s+\{\s*(.*?)\s*\}\s*from\s*['"](.*?)['"]/g;
    let im;
    while ((im = importRegex.exec(content)) !== null) {
        const keys = im[1].split(',').map(s => s.trim().split(/\s+as\s+/).pop());
        const importPath = im[2];
        for (const k of keys) importMap[k] = importPath;
    }

    const langOrderMatch = content.match(/(?:export\s+)?const\s+LANG_ORDER\s*=\s*\[(.*?)\]/);
    const langOrder = langOrderMatch ? langOrderMatch[1]
      .split(',')
      .map((s) => s.trim().replace(/['"`]/g, ''))
      .filter(Boolean) : [];
    
    if (globalLangOrder.length === 0 && langOrder.length > 0) globalLangOrder = langOrder;

    const mainLangMatch = content.match(/(?:export\s+)?const\s+MAIN_LANG.*=\s*['"](.*?)['"]/);
    const mainLangInFile = mainLangMatch ? mainLangMatch[1] : (langOrder[0] || '');
    if (!globalMainLang && mainLangInFile) globalMainLang = mainLangInFile;

    const transMatch = content.match(/(?:export\s+)?const\s+TRANSLATIONS\s*=\s*(\{[\s\S]*?\});/);
    if (!transMatch) return;
    
    const rootEntries = parseObject(transMatch[1]);
    
    function resolveEntries(entries, currentFile) {
        for (const entry of entries) {
            entry.sourceFile = currentFile;
            if (entry.type === 'reference') {
                const varName = entry.valueStr.trim();
                const relativeImportPath = importMap[varName];
                if (relativeImportPath) {
                    let targetPath = path.resolve(path.dirname(currentFile), relativeImportPath);
                    if (!targetPath.endsWith('.ts')) targetPath += '.ts';
                    if (fs.existsSync(targetPath)) {
                        const subContent = fs.readFileSync(targetPath, 'utf8');
                        const subTransMatch = subContent.match(/(?:export\s+)?const\s+TRANSLATIONS\s*=\s*(\{[\s\S]*?\})(?:;|$)/);
                        if (subTransMatch) {
                            entry.type = 'namespace';
                            entry.children = parseObject(subTransMatch[1]);
                        }
                    }
                }
            } else if (entry.type === 'namespace') {
                resolveEntries(entry.children, currentFile);
            }
        }
    }

    resolveEntries(rootEntries, translationsFile);
    
    if (isNewModule) {
        allTranslations[finalModuleName] = {
            entries: rootEntries,
            langOrder: langOrder,
            mainLang: mainLangInFile,
            translationsStr: transMatch[1],
            path: translationsFile
        };
    } else {
        // 合并条目
        allTranslations[finalModuleName].entries.push(...rootEntries);
        // 记录多个来源路径
        if (!Array.isArray(allTranslations[finalModuleName].path)) {
            allTranslations[finalModuleName].path = [allTranslations[finalModuleName].path];
        }
        allTranslations[finalModuleName].path.push(translationsFile);
    }
    
    for (const l of langOrder) globalLangSet.add(l);
  }

  for (const { fullPath, moduleName } of translationsFiles) {
    processFile(fullPath, moduleName);
  }

  return { allTranslations, globalLangOrder, globalMainLang, globalLangSet: Array.from(globalLangSet) };
}

/**
 * 辅助：从 ICU 字符串提取变量名
 */
export function extractIcuVars(str, parseICU) {
    if (!str || typeof str !== 'string') return [];
    
    if (parseICU) {
        try {
            const parts = parseICU(str);
            const vars = new Set();
            const walk = (p) => {
                for (const part of p) {
                    if (typeof part === 'string') continue;
                    if (part.name && part.name !== '#') vars.add(part.name);
                    if (part.options) {
                        for (const opt of Object.values(part.options)) walk(opt);
                    }
                    if (part.children) walk(part.children);
                }
            };
            walk(parts);
            return Array.from(vars);
        } catch (e) {
            // fallback to regex if parse fails
        }
    }

    const vars = new Set();
    const regex = /\{(\w+)(?:,\s*\w+)?(?:,\s*(?:offset:\d+\s*)?((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*))?\}/g;
    let match;
    while ((match = regex.exec(str)) !== null) {
        const varName = match[1];
        if (varName !== '#') vars.add(varName);
        
        if (match[2]) {
            const innerVars = extractIcuVars(match[2], parseICU);
            innerVars.forEach(v => vars.add(v));
        }
    }
    return Array.from(vars);
}
