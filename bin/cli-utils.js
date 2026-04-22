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
    const itemRegex = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})/g;
    let im;
    while ((im = itemRegex.exec(inner)) !== null) {
      if (im[2]) items.push(im[2].replace(/\s+/g, ' '));
      else if (im[1] !== undefined) items.push(im[1].slice(1, -1));
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
      let val = null;
      if (entry.values) {
        val = entry.values[lang] || entry.values[fallbackLang] || Object.values(entry.values)[0];
        if (val && val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1).replace(/\\'/g, "'");
        else if (val) { try { val = JSON.parse(val); } catch(e) {} }
      } else {
        val = resolveLeafValue(entry.valueStr, lang, langOrder, fallbackLang);
      }
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
        'src/i18n/index.ts',
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
      } else if (item.endsWith('.json')) {
        // 仅包含 i18n 相关目录或文件名的 JSON
        const isI18nFile = fullPath.toLowerCase().includes('i18n') || 
                           fullPath.toLowerCase().includes('locale') || 
                           fullPath.toLowerCase().includes('translation');
        const isExcluded = ['package.json', 'package-lock.json', 'tsconfig.json', 'config.json'].includes(item.toLowerCase());
        
        if (isI18nFile && !isExcluded) {
            const relativePath = path.relative(rootDir, fullPath);
            const moduleName = relativePath.replace(/\.json$/, '').replace(/[\\\/]/g, '.');
            files.push({ fullPath, moduleName });
        }
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
        const ext = path.extname(absPath);
        files.push({ fullPath: absPath, moduleName: path.basename(absPath, ext) });
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
    
    const ext = path.extname(translationsFile);
    const finalModuleName = moduleNamePrefix || path.basename(translationsFile, ext);
    const isNewModule = !allTranslations[finalModuleName];

    processedFiles.add(translationsFile);

    if (ext === '.json') {
        let raw = fs.readFileSync(translationsFile, 'utf8');
        if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1); // Strip BOM
        const json = JSON.parse(raw);
        const lang = json.language || path.basename(translationsFile, '.json');
        const trans = json.translations || json;
        
        if (!globalLangOrder.includes(lang)) globalLangOrder.push(lang);
        if (!globalMainLang) globalMainLang = lang;
        globalLangSet.add(lang);

        const mapToEntries = (obj) => {
            const result = [];
            for (const [k, v] of Object.entries(obj)) {
                if (typeof v === 'object' && v !== null && !v.hasOwnProperty('one') && !v.hasOwnProperty('other')) {
                    result.push({ key: k, type: 'namespace', children: mapToEntries(v) });
                } else {
                    const val = typeof v === 'string' ? `'${v.replace(/'/g, "\\'")}'` : JSON.stringify(v);
                    result.push({ key: k, type: 'leaf', valueStr: val });
                }
            }
            return result;
        };

        const rootEntries = mapToEntries(trans);
        if (isNewModule) {
            allTranslations[finalModuleName] = {
                entries: rootEntries,
                langOrder: [lang],
                mainLang: lang,
                path: translationsFile,
                isJson: true
            };
        } else {
            // Merge entries for the same module but different language
            const existing = allTranslations[finalModuleName];
            if (!existing.langOrder.includes(lang)) existing.langOrder.push(lang);
            
            const merge = (targetEntries, sourceEntries) => {
                for (const s of sourceEntries) {
                    const t = targetEntries.find(e => e.key === s.key);
                    if (t) {
                        if (t.type === 'namespace' && s.type === 'namespace') merge(t.children, s.children);
                        else if (t.type === 'leaf' && s.type === 'leaf') {
                            // Convert single string to multi-lang array format for internal AST
                            // But wait, our AST uses valueStr which represents the TS [zh, en] array.
                            // For JSON, we need to handle this differently.
                            // Let's store individual values and merge them into an array when needed.
                            if (!t.values) t.values = {};
                            t.values[lang] = s.valueStr;
                        }
                    } else {
                        if (s.type === 'leaf') s.values = { [lang]: s.valueStr };
                        targetEntries.push(s);
                    }
                }
            };
            merge(existing.entries, rootEntries);
            if (!Array.isArray(existing.path)) existing.path = [existing.path];
            existing.path.push(translationsFile);
        }
        return;
    }

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

    const transStartMatch = content.match(/(?:export\s+)?const\s+TRANSLATIONS\s*=\s*\{/);
    if (!transStartMatch) return;
    
    let transStr = '';
    let stack = 0;
    let started = false;
    const startIndex = transStartMatch.index + transStartMatch[0].length - 1;
    for (let i = startIndex; i < content.length; i++) {
        if (content[i] === '{') {
            stack++;
            started = true;
        } else if (content[i] === '}') {
            stack--;
        }
        if (started) transStr += content[i];
        if (started && stack === 0) break;
    }
    
    if (!transStr) return;
    const rootEntries = parseObject(transStr);
    
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
                        const subTransStartMatch = subContent.match(/(?:export\s+)?const\s+TRANSLATIONS\s*=\s*\{/);
                        if (subTransStartMatch) {
                            let subTransStr = '';
                            let subStack = 0;
                            let subStarted = false;
                            const subStartIndex = subTransStartMatch.index + subTransStartMatch[0].length - 1;
                            for (let k = subStartIndex; k < subContent.length; k++) {
                                if (subContent[k] === '{') {
                                    subStack++;
                                    subStarted = true;
                                } else if (subContent[k] === '}') {
                                    subStack--;
                                }
                                if (subStarted) subTransStr += subContent[k];
                                if (subStarted && subStack === 0) break;
                            }
                            if (subTransStr) {
                                entry.type = 'namespace';
                                entry.children = parseObject(subTransStr);
                            }
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
            translationsStr: transStr,
            path: translationsFile,
            isJson: false
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
