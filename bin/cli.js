#!/usr/bin/env node

/**
 * i18nt CLI — 从 TypeScript 翻译字典导出/导入 JSON 语言包
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createI18n } from '../dist/index.js';
import { TRANSLATIONS, LANG_ORDER, MAIN_LANG } from './cli-translations.js';
import { extractKeys, syncKeysToTranslations } from './cli-extract.js';
import { translateWithAI } from './cli-ai.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 初始化 i18n
const locale = Intl.DateTimeFormat().resolvedOptions().locale;
const i18n = createI18n({
  translations: TRANSLATIONS,
  langOrder: LANG_ORDER,
  locale: locale.startsWith('zh') ? 'zh-CN' : 'en-US',
  devWarnings: false,
});
const { t } = i18n;
const ct = i18n.t.cli; // 简化路径

// 解析命令行参数
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === 'export') {
      args.command = 'export';
    } else if (arg === 'import') {
      args.command = 'import';
    } else if (arg === 'check') {
      args.command = 'check';
    } else if (arg === 'fix') {
      args.command = 'fix';
    } else if (arg === 'extract') {
      args.command = 'extract';
    } else if (arg === 'translate') {
      args.command = 'translate';
    } else if (arg === '--format' || arg === '-f') {
      args.format = argv[++i];
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = argv[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        args[key] = nextArg;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function findTranslationsFiles(inputPath) {
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
        // 计算相对于 rootDir 的相对路径作为模块标识
        const relativePath = path.relative(rootDir, fullPath);
        // 去掉扩展名，并将路径分隔符转换为 . (用于命名空间)
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

/**
 * 核心逻辑：从 TS 导出 JSON
 * 支持导出单个、多个或全部语言
 */
  function parseObject(str) {
      const entries = [];
      let i = 0;
      while (i < str.length) {
          // 查找 key: (支持 key: value 或 key,)
          const keyMatch = str.slice(i).match(/(\w+)(\s*:\s*|\s*[,}]|$)/);
          if (!keyMatch) break;
          const key = keyMatch[1];
          const isShorthand = !keyMatch[2].includes(':');
          i += keyMatch.index + keyMatch[0].length;

          if (isShorthand) {
              entries.push({ key, type: 'reference', valueStr: key });
              // 回退一点，因为逗号/花括号可能属于下一个或结束
              if (keyMatch[2].includes(',') || keyMatch[2].includes('}')) i -= 1;
              continue;
          }

          // 查找连带的内容 (平衡括号)
          let startChar = str[i];
          let endChar = startChar === '[' ? ']' : '{';
          if (startChar !== '[' && startChar !== '{') {
              // 处理可能的引号字符串或其它简单值 (虽然翻译字典通常是 [] 或 {})
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
          
          // 如果 value 看起来像一个变量名 (不是以 [ 或 { 或 引号开头)
          const lastEntry = entries[entries.length - 1];
          if (lastEntry && lastEntry.type === 'leaf') {
              const v = lastEntry.valueStr.trim();
              if (!v.startsWith('[') && !v.startsWith('{') && !v.startsWith("'") && !v.startsWith('"') && !v.startsWith('`')) {
                  lastEntry.type = 'reference';
              }
          }
          
          // 跳过逗号和空白
          const nextComma = str.slice(i).match(/\s*[,\}]?\s*/);
          if (nextComma) i += nextComma[0].length;
      }
      return entries;
  }

const formatters = {
  json: (dict, lang) => JSON.stringify({ language: lang, translations: dict }, null, 4),
  
  py: (dict, lang) => {
    const toPy = (obj, indent = 0) => {
      const space = ' '.repeat(indent);
      if (typeof obj === 'string') return `"${obj.replace(/"/g, '\\"')}"`;
      let res = '{\n';
      for (const [k, v] of Object.entries(obj)) {
        res += `${space}    "${k}": ${toPy(v, indent + 4)},\n`;
      }
      return res + space + '}';
    };
    return `# i18nt generated for ${lang}\nTRANSLATIONS = ${toPy(dict)}`;
  },

  php: (dict, lang) => {
    const toPhp = (obj, indent = 0) => {
      const space = ' '.repeat(indent);
      if (typeof obj === 'string') return `"${obj.replace(/"/g, '\\"')}"`;
      let res = '[\n';
      for (const [k, v] of Object.entries(obj)) {
        res += `${space}    "${k}" => ${toPhp(v, indent + 4)},\n`;
      }
      return res + space + ']';
    };
    return `<?php\n// i18nt generated for ${lang}\nreturn ${toPhp(dict)};`;
  },

  go: (dict, lang) => {
    const toCamel = (s) => s.split(/[._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    const structs = new Set();
    const toGo = (obj, name = "Translations", indent = 0) => {
      const space = ' '.repeat(indent);
      const typeName = toCamel(name) + "Struct";
      if (typeof obj === 'string') return { type: 'string', value: `"${obj.replace(/"/g, '\\"')}"` };
      
      let structFields = `type ${typeName} struct {\n`;
      let instanceFields = `${typeName}{\n`;
      
      for (const [k, v] of Object.entries(obj)) {
        const fieldName = toCamel(k);
        const child = toGo(v, k, indent + 4);
        structFields += `    ${fieldName} ${child.type}\n`;
        instanceFields += `${space}    ${fieldName}: ${child.value},\n`;
      }
      structs.add(structFields + "}\n");
      return { type: typeName, value: instanceFields + space + "}" };
    };
    const root = toGo(dict, "Translations", 0);
    return `package i18n\n\n// i18nt generated for ${lang}\n\n${Array.from(structs).join("\n")}\nvar T = ${root.value}`;
  },

  rust: (dict, lang) => {
    const toRust = (obj, indent = 0) => {
      const space = ' '.repeat(indent);
      let res = '';
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'object') {
          res += `${space}pub mod ${k.toLowerCase()} {\n${toRust(v, indent + 4)}${space}}\n`;
        } else {
          const key = k.toUpperCase();
          res += `${space}pub const ${key}: &str = "${v.replace(/"/g, '\\"')}";\n`;
        }
      }
      return res;
    };
    return `// i18nt generated for ${lang}\npub mod translations {\n${toRust(dict, 4)}}`;
  },

  kt: (dict, lang) => {
    // Kotlin Object for Static Access
    const toCamel = (s) => s.split(/[._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    const toKt = (obj, name = "Translations", indent = 0) => {
      const space = ' '.repeat(indent);
      if (typeof obj === 'string') return `${space}val ${name}: String = "${obj.replace(/"/g, '\\"')}"`;
      
      const className = toCamel(name);
      let res = `${space}object ${className} {\n`;
      for (const [k, v] of Object.entries(obj)) {
        res += toKt(v, k, indent + 4) + "\n";
      }
      return res + space + "}";
    };
    return `package i18n\n\n/** i18nt generated for ${lang} */\n${toKt(dict)}`;
  },

  java: (dict, lang) => {
    // Java Map for Helper Class
    const toJava = (obj, indent = 0) => {
      const space = ' '.repeat(indent);
      if (typeof obj === 'string') return `"${obj.replace(/"/g, '\\"')}"`;
      
      let res = 'new HashMap<String, Object>() {{\n';
      for (const [k, v] of Object.entries(obj)) {
        res += `${space}    put("${k}", ${toJava(v, indent + 4)});\n`;
      }
      return res + space + "}}";
    };
    return `package i18n;\n\nimport java.util.HashMap;\nimport java.util.Map;\n\n/** i18nt generated for ${lang} */\npublic class Translations {\n    public static final Map<String, Object> DATA = ${toJava(dict, 4)};\n}`;
  },

  cs: (dict, lang) => {
    // C# Nested Static Classes for Autocomplete
    const toCamel = (s) => s.split(/[._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    const toCs = (obj, name = "Translations", indent = 0) => {
      const space = ' '.repeat(indent);
      const className = toCamel(name);
      if (typeof obj === 'string') return `${space}public const string ${className} = "${obj.replace(/"/g, '\\"')}";`;
      
      let res = `${space}public static class ${className} {\n`;
      for (const [k, v] of Object.entries(obj)) {
        res += toCs(v, k, indent + 4) + "\n";
      }
      return res + space + "}";
    };
    return `namespace I18n {\n    /** i18nt generated for ${lang} */\n${toCs(dict, "T", 4)}\n}`;
  },

  cpp: (dict, lang) => {
    // C++ Nested Namespaces
    const toCpp = (obj, indent = 0) => {
      const space = ' '.repeat(indent);
      let res = '';
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'object') {
          res += `${space}namespace ${k} {\n${toCpp(v, indent + 4)}${space}}\n`;
        } else {
          res += `${space}inline constexpr const char* ${k} = "${v.replace(/"/g, '\\"')}";\n`;
        }
      }
      return res;
    };
    return `// i18nt generated for ${lang}\n#pragma once\n\nnamespace i18n {\n${toCpp(dict, 4)}}`;
  },

  rb: (dict, lang) => {
    // Ruby Nested Hash
    const toRb = (obj, indent = 0) => {
      const space = ' '.repeat(indent);
      if (typeof obj === 'string') return `"${obj.replace(/"/g, '\\"')}"`;
      
      let res = "{\n";
      for (const [k, v] of Object.entries(obj)) {
        res += `${space}  :${k} => ${toRb(v, indent + 2)},\n`;
      }
      return res + space.slice(0, -2) + "}";
    };
    return `# i18nt generated for ${lang}\nTRANSLATIONS = ${toRb(dict, 2)}`;
  },

  lua: (dict, lang) => {
    // Lua Nested Table
    const toLua = (obj, indent = 0) => {
      const space = ' '.repeat(indent);
      if (typeof obj === 'string') return `"${obj.replace(/"/g, '\\"')}"`;
      
      let res = "{\n";
      for (const [k, v] of Object.entries(obj)) {
        res += `${space}  ${k} = ${toLua(v, indent + 2)},\n`;
      }
      return res + space.slice(0, -2) + "}";
    };
    return `-- i18nt generated for ${lang}\nreturn ${toLua(dict, 2)}`;
  },

  c: (dict, lang) => {
    // Pure C Header with Flattened Keys
    const flatten = (obj, prefix = '') => {
      let res = '';
      for (const [k, v] of Object.entries(obj)) {
        const key = (prefix ? `${prefix}_${k}` : k).toUpperCase();
        if (typeof v === 'object') res += flatten(v, key);
        else res += `#define I18N_${key} "${v.replace(/"/g, '\\"')}"\n`;
      }
      return res;
    };
    return `/* i18nt generated for ${lang} */\n#ifndef I18N_${lang.toUpperCase()}_H\n#define I18N_${lang.toUpperCase()}_H\n\n${flatten(dict)}\n\n#endif`;
  },

  scala: (dict, lang) => {
    // Scala Nested Objects
    const toCamel = (s) => s.split(/[._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    const toScala = (obj, name = "Translations", indent = 0) => {
      const space = ' '.repeat(indent);
      const className = toCamel(name);
      if (typeof obj === 'string') return `${space}val ${name}: String = "${obj.replace(/"/g, '\\"')}"`;
      
      let res = `${space}object ${className} {\n`;
      for (const [k, v] of Object.entries(obj)) {
        res += toScala(v, k, indent + 4) + "\n";
      }
      return res + space + "}";
    };
    return `package i18n\n\n/** i18nt generated for ${lang} */\n${toScala(dict)}`;
  },

  js: (dict, lang) => {
    // Vanilla JS Global for HTML
    return `/** i18nt generated for ${lang} */\nwindow.I18N_DATA = ${JSON.stringify(dict, null, 2)};`;
  },

  ex: (dict, lang) => {
    // Elixir Nested Map
    const toEx = (obj, indent = 0) => {
      const space = ' '.repeat(indent);
      if (typeof obj === 'string') return `"${obj.replace(/"/g, '\\"')}"`;
      
      let res = "%{\n";
      for (const [k, v] of Object.entries(obj)) {
        res += `${space}  "${k}" => ${toEx(v, indent + 2)},\n`;
      }
      return res + space.slice(0, -2) + "}";
    };
    return `# i18nt generated for ${lang}\ndefmodule I18nData do\n  def translations, do: ${toEx(dict, 4)}\nend`;
  },

  pl: (dict, lang) => {
    // Perl Nested Hash
    const toPl = (obj, indent = 0) => {
      const space = ' '.repeat(indent);
      if (typeof obj === 'string') return `"${obj.replace(/"/g, '\\"')}"`;
      
      let res = "{\n";
      for (const [k, v] of Object.entries(obj)) {
        res += `${space}  '${k}' => ${toPl(v, indent + 2)},\n`;
      }
      return res + space.slice(0, -2) + "}";
    };
    return `# i18nt generated for ${lang}\nour %TRANSLATIONS = %{ ${toPl(dict, 2)} };\n1;`;
  },

  m: (dict, lang) => {
    // Objective-C NSDictionary
    const toObjc = (obj, indent = 0) => {
      const space = ' '.repeat(indent);
      if (typeof obj === 'string') return `@"${obj.replace(/"/g, '\\"')}"`;
      
      let res = "@{\n";
      for (const [k, v] of Object.entries(obj)) {
        res += `${space}  @"${k}": ${toObjc(v, indent + 2)},\n`;
      }
      return res + space.slice(0, -2) + "}";
    };
    return `/* i18nt generated for ${lang} */\n#import <Foundation/Foundation.h>\n\nNSDictionary *get_translations() {\n  return ${toObjc(dict, 2)};\n}`;
  },

  hs: (dict, lang) => {
    // Haskell Nested Map
    const toHs = (obj, indent = 0) => {
      const space = ' '.repeat(indent);
      if (typeof obj === 'string') return `"${obj.replace(/"/g, '\\"')}"`;
      
      let res = "fromList [\n";
      const entries = Object.entries(obj).map(([k, v]) => `${space}  ("${k}", ${toHs(v, indent + 2)})`);
      return res + entries.join(",\n") + "\n" + space.slice(0, -2) + "]";
    };
    return `-- i18nt generated for ${lang}\nmodule I18nData where\nimport Data.Map (fromList, Map)\n\ntranslations :: Map String Any\ntranslations = ${toHs(dict, 2)}`;
  },

  xml: (dict, lang) => {
    const toXml = (obj, prefix = '') => {
      let res = '';
      for (const [k, v] of Object.entries(obj)) {
        const name = prefix ? `${prefix}_${k}` : k;
        if (typeof v === 'object') res += toXml(v, name);
        else {
            const escaped = v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, "\\'").replace(/"/g, '\\"');
            res += `    <string name="${name}">${escaped}</string>\n`;
        }
      }
      return res;
    };
    return `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${toXml(dict)}</resources>`;
  },

  strings: (dict, lang) => {
    const toStrings = (obj, prefix = '') => {
      let res = '';
      for (const [k, v] of Object.entries(obj)) {
        const name = prefix ? `${prefix}.${k}` : k;
        if (typeof v === 'object') res += toStrings(v, name);
        else res += `"${name}" = "${v.replace(/"/g, '\\"')}";\n`;
      }
      return res;
    };
    return `/* i18nt generated for ${lang} */\n${toStrings(dict)}`;
  }
};

function exportLanguages(inputPath, outputDir, langFilter, silent = false, format = 'json') {
  const translationsFiles = findTranslationsFiles(inputPath);
  if (!translationsFiles) {
    if (!silent) console.error(ct.errors.no_file);
    return null;
  }

  const allTranslations = {};
  let globalLangOrder = [];
  let globalMainLang = '';

  const globalLangSet = new Set();
  const processedFiles = new Set();

  function processFile(translationsFile, moduleNamePrefix = '') {
    if (processedFiles.has(translationsFile)) return;
    processedFiles.add(translationsFile);

    const content = fs.readFileSync(translationsFile, 'utf8');

    // 提取 imports
    const importMap = {};
    const importRegex = /import\s+\{\s*(.*?)\s*\}\s*from\s*['"](.*?)['"]/g;
    let im;
    while ((im = importRegex.exec(content)) !== null) {
        const keys = im[1].split(',').map(s => s.trim().split(/\s+as\s+/).pop()); // 处理 as
        const importPath = im[2];
        for (const k of keys) importMap[k] = importPath;
    }

    // 1. 提取 LANG_ORDER
    const langOrderMatch = content.match(/(?:export\s+)?const\s+LANG_ORDER\s*=\s*\[(.*?)\]/);
    const langOrder = langOrderMatch ? langOrderMatch[1]
      .split(',')
      .map((s) => s.trim().replace(/['"`]/g, ''))
      .filter(Boolean) : [];
    
    if (globalLangOrder.length === 0 && langOrder.length > 0) globalLangOrder = langOrder;

    // 2. 提取 MAIN_LANG
    const mainLangMatch = content.match(/(?:export\s+)?const\s+MAIN_LANG.*=\s*['"](.*?)['"]/);
    const mainLangInFile = mainLangMatch ? mainLangMatch[1] : (langOrder[0] || '');
    if (!globalMainLang && mainLangInFile) globalMainLang = mainLangInFile;

    // 4. 读取 TRANSLATIONS
    const transMatch = content.match(/(?:export\s+)?const\s+TRANSLATIONS\s*=\s*(\{[\s\S]*?\});/);
    if (!transMatch) return;
    
    const rootEntries = parseObject(transMatch[1]);
    
    // 解析 references
    function resolveEntries(entries, currentFile) {
        for (const entry of entries) {
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
    
    const finalModuleName = moduleNamePrefix || path.basename(translationsFile, '.ts');
    allTranslations[finalModuleName] = {
        entries: rootEntries,
        langOrder: langOrder,
        mainLang: mainLangInFile
    };
    
    // 将所有发现的语言加入全局 Set
    for (const l of langOrder) globalLangSet.add(l);
  }

  for (const { fullPath, moduleName } of translationsFiles) {
    processFile(fullPath, moduleName);
  }

  if (Object.keys(allTranslations).length === 0) {
      if (!silent) console.error(ct.errors('no_translations'));
      return null;
  }

  const globalLangOrderFromSet = Array.from(globalLangSet);
  globalLangOrder = globalLangOrderFromSet;


  // 3. 确定需要导出的语言列表
  let targetLangs = [];
  if (langFilter === 'all') {
    targetLangs = [...globalLangOrder];
  } else if (typeof langFilter === 'string' && langFilter.includes(',')) {
    targetLangs = langFilter.split(',').map(s => s.trim()).filter(Boolean);
  } else if (langFilter && langFilter !== true) {
    targetLangs = [langFilter];
  } else {
    // 默认行为：仅导出主语言
    targetLangs = [globalMainLang];
  }

  if (!silent) {
    console.log(ct.info('dict_order', { langs: globalLangOrder.join(', ') }));
    console.log(ct.info('export_lang', { langs: targetLangs.join(', ') }));
  }

  const resolvedOutputDir = outputDir ? path.resolve(outputDir) : path.resolve(process.cwd(), '.i18nt/locales');
  if (!fs.existsSync(resolvedOutputDir)) fs.mkdirSync(resolvedOutputDir, { recursive: true });

  // 自动初始化 .i18nt 结构
  if (resolvedOutputDir.includes('.i18nt')) {
    const i18ntRoot = path.resolve(process.cwd(), '.i18nt');
    const gitignorePath = path.join(i18ntRoot, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, 'temp/\n', 'utf8');
    }
    const tempDir = path.join(i18ntRoot, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  }

  // 5. 为每个语言解析叶子节点值
  function resolveLeafValue(valueStr, lang, langOrder, fallbackLang) {
      const items = [];
      // 提取数组项或复数对象
      if (valueStr.startsWith('[')) {
          const inner = valueStr.slice(1, -1);
          const itemRegex = /(\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})|(['"`])([\s\S]*?)\2/g;
          let im;
          while ((im = itemRegex.exec(inner)) !== null) {
            if (im[1]) items.push(im[1].replace(/\s+/g, ' '));
            else if (im[3] !== undefined) items.push(im[3]);
          }
      } else {
          // 纯对象形式（通常是动态加载或单语种覆盖场景）
          return valueStr;
      }

      const langIndex = langOrder.indexOf(lang);
      const fallbackIndex = Math.max(0, langOrder.indexOf(fallbackLang));
      
      let finalValue = null;
      // 1. 显式语法匹配
      for (const item of items) {
          if (typeof item === 'string') {
              const match = item.match(/^([a-zA-Z0-9-]+):\s*(.*)$/);
              if (match && match[1] === lang) return match[2];
          }
      }
      // 2. 索引匹配
      const targetIdx = langIndex === -1 ? fallbackIndex : langIndex;
      const val = items[targetIdx];
      if (val !== undefined) {
          const match = typeof val === 'string' ? val.match(/^([a-zA-Z0-9-]+):\s*(.*)$/) : null;
          return match && langOrder.includes(match[1]) ? match[2] : val;
      }
      return null;
  }

  function buildOutputDict(entries, lang, langOrder, fallbackLang) {
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

  // 生成文件
  for (const lang of targetLangs) {
    const fullDict = {};
    for (const [moduleName, moduleData] of Object.entries(allTranslations)) {
        const moduleDict = buildOutputDict(moduleData.entries, lang, moduleData.langOrder, moduleData.mainLang);
        if (Object.keys(moduleDict).length > 0) {
            // 如果只有单个主文件且名为 translations，则保持原有结构，不添加命名空间
            if (Object.keys(allTranslations).length === 1 && (moduleName === 'translations' || moduleName === 'index')) {
                Object.assign(fullDict, moduleDict);
            } else {
                // 处理嵌套命名空间 (如 a.b.c)
                const parts = moduleName.split('.');
                let current = fullDict;
                for (let i = 0; i < parts.length - 1; i++) {
                    const p = parts[i];
                    if (!current[p]) current[p] = {};
                    current = current[p];
                }
                current[parts[parts.length - 1]] = moduleDict;
            }
        }
    }

    const formatter = formatters[format] || formatters.json;
    const output = formatter(fullDict, lang);
    const ext = format === 'json' ? 'json' : (format === 'strings' ? 'strings' : (format === 'xml' ? 'xml' : format));
    const outputPath = path.join(resolvedOutputDir, `${lang}.${ext}`);
    fs.writeFileSync(outputPath, output, 'utf8');
    if (!silent) console.log(ct.info('exported', { file: `${lang}.${ext}`, count: Object.keys(fullDict).length }));
  }

  return true;
}

/**
 * 将单个 JSON 同步回 TS
 */
/**
 * 将单个 JSON 同步回 TS (支持嵌套)
 */
function syncSingleJsonFromObj(tsFilePath, jsonContent) {
  try {
    const targetLang = jsonContent.language;
    const newTranslations = jsonContent.translations;

    if (!targetLang || !newTranslations) return null;

    let tsContent = fs.readFileSync(tsFilePath, 'utf8');
    const langOrderMatch = tsContent.match(/(?:export\s+)?const\s+LANG_ORDER\s*=\s*\[(.*?)\]/);
    if (!langOrderMatch) return null;
    
    const langOrder = langOrderMatch[1].split(',').map(s => s.trim().replace(/['"`]/g, '')).filter(Boolean);
    const langIndex = langOrder.indexOf(targetLang);
    if (langIndex === -1) {
      console.warn(ct.errors('skip_lang', { file: path.basename(jsonPath), lang: targetLang }));
      return null;
    }

    let updatedCount = 0;
    let addedCount = 0;

    // 将嵌套 JSON 拍平为 . 路径，方便查找
    function flatten(obj, prefix = '') {
      let res = {};
      for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !('one' in obj[key]) && !('other' in obj[key])) {
          Object.assign(res, flatten(obj[key], fullKey));
        } else {
          res[fullKey] = obj[key];
        }
      }
      return res;
    }

    const flatTranslations = flatten(newTranslations);

    function updateTsContent(content, pathArr, value) {
        const key = pathArr[pathArr.length - 1];
        const containerPath = pathArr.slice(0, -1);
        
        // 简单正则：查找该路径对应的 key 入口
        // 注意：这在复杂嵌套且同名 key 较多时可能存在局限，但对于常规翻译文件有效
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const keyRegex = new RegExp(`(${escapedKey}:\\s*\\[\\s*)([\\s\\S]*?)(\\s*\\],?)`, 'm');
        
        // 如果是顶层或简单嵌套，直接 replace
        // 在更复杂的场景下，理想做法是使用 AST 解析，但为了保持 CLI 轻量，我们使用加强版匹配
        const match = content.match(keyRegex);
        if (match) {
            const prefix = match[1];
            const itemsStr = match[2];
            const suffix = match[3];

            const rawMatches = [];
            const itemRegex = /(\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})|(['"`])([\s\S]*?)\2/g;
            let im;
            while ((im = itemRegex.exec(itemsStr)) !== null) {
              rawMatches.push({ matchStr: im[0], start: im.index, end: im.index + im[0].length });
            }

            if (rawMatches[langIndex]) {
              let newValue = typeof value === 'object' ? JSON.stringify(value).replace(/"/g, "'") : value;
              const itemRaw = rawMatches[langIndex].matchStr;
              const matchLang = itemRaw.match(/^(['"`])([a-zA-Z0-9-]+):\s*/);
              if (matchLang && matchLang[2] === targetLang) newValue = `${targetLang}: ${value}`;
              
              const finalValStr = typeof value === 'object' ? newValue : `'${newValue.replace(/'/g, "\\'")}'`;
              const { start, end } = rawMatches[langIndex];
              const newItemsStr = itemsStr.substring(0, start) + finalValStr + itemsStr.substring(end);
              return content.replace(match[0], `${prefix}${newItemsStr}${suffix}`);
            } else if (langIndex < langOrder.length) {
              // 自动扩充数组：如果当前数组长度不足，则追加到末尾
              let newValue = typeof value === 'object' ? JSON.stringify(value).replace(/"/g, "'") : value;
              const finalValStr = typeof value === 'object' ? newValue : `'${newValue.replace(/'/g, "\\'")}'`;
              
              // 检查 itemsStr 是否为空或以逗号结尾
              let newItemsStr = itemsStr.trim();
              if (newItemsStr && !newItemsStr.endsWith(',')) newItemsStr += ', ';
              newItemsStr += finalValStr;
              
              return content.replace(match[0], `${prefix}${newItemsStr}${suffix}`);
            }
        }
        return content;
    }

    for (const [pathKey, val] of Object.entries(flatTranslations)) {
      const keys = pathKey.split('.');
      const newTs = updateTsContent(tsContent, keys, val);
      if (newTs !== tsContent) {
          tsContent = newTs;
          updatedCount++;
      }
    }

    fs.writeFileSync(tsFilePath, tsContent, 'utf8');
    return { updatedCount, addedCount, lang: targetLang };
  } catch (e) {
    console.error(ct.errors('parse_fail', { file: path.basename(jsonPath), message: e.message }));
    return null;
  }
}

function importLang(inputPath, jsonPath) {
  const translationsFiles = findTranslationsFiles(inputPath);
  if (!translationsFiles) {
    console.error(ct.errors('no_file'));
    process.exit(1);
  }

  if (!jsonPath) {
    console.error(ct.errors('no_json_param'));
    process.exit(1);
  }

  const absoluteJsonPath = path.resolve(jsonPath);
  if (!fs.existsSync(absoluteJsonPath)) {
    console.error(ct.errors('path_not_exist', { path: absoluteJsonPath }));
    process.exit(1);
  }

  const stats = fs.statSync(absoluteJsonPath);
  if (stats.isDirectory()) {
    console.log(ct.info('import_dir', { path: absoluteJsonPath }));
    const files = fs.readdirSync(absoluteJsonPath).filter(f => f.endsWith('.json'));
    if (files.length === 0) {
      console.log(ct.info('no_json_files'));
      return;
    }

    for (const file of files) {
      const jsonPathFull = path.join(absoluteJsonPath, file);
      const jsonContent = JSON.parse(fs.readFileSync(jsonPathFull, 'utf8'));
      const translations = jsonContent.translations;
      
      for (const { fullPath: translationsFile, moduleName } of translationsFiles) {
          // 根据 moduleName 路径在 JSON 中查找对应的翻译内容
          const parts = moduleName.split('.');
          let targetTranslations = translations;
          for (const p of parts) {
              targetTranslations = targetTranslations?.[p];
          }

          // 兜底逻辑：如果是单文件模式且没有命名空间
          if (!targetTranslations && translationsFiles.length === 1 && (moduleName === 'translations' || moduleName === 'index')) {
              targetTranslations = translations;
          }
          
          if (targetTranslations) {
              const result = syncSingleJsonFromObj(translationsFile, { language: jsonContent.language, translations: targetTranslations });
              if (result) {
                console.log(ct.info('sync_done', { lang: result.lang, updated: result.updatedCount, added: result.addedCount }));
              }
          }
      }
    }
  } else {
    const jsonContent = JSON.parse(fs.readFileSync(absoluteJsonPath, 'utf8'));
    const translations = jsonContent.translations;
    for (const { fullPath: translationsFile, moduleName } of translationsFiles) {
        const parts = moduleName.split('.');
        let targetTranslations = translations;
        for (const p of parts) {
            targetTranslations = targetTranslations?.[p];
        }

        if (!targetTranslations && translationsFiles.length === 1 && (moduleName === 'translations' || moduleName === 'index')) {
            targetTranslations = translations;
        }
        if (targetTranslations) {
            const result = syncSingleJsonFromObj(translationsFile, { language: jsonContent.language, translations: targetTranslations });
            if (result) {
                console.log(ct.info('sync_done', { lang: result.lang, updated: result.updatedCount, added: result.addedCount }));
            }
        }
    }
  }
}

/**
 * 启动文件监听
 */
function startWatch(inputPath, outputDir, lang, format) {
  const translationsFiles = findTranslationsFiles(inputPath);
  if (!translationsFiles) {
    console.error(ct.errors.no_file_watch);
    process.exit(1);
  }

  console.log(ct.info('watching', { path: inputPath || 'default paths' }));
  console.log(ct.info.watch_tip);

  let debounceTimer;
  const doSync = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      console.log(ct.info('change_detected', { time: new Date().toLocaleTimeString() }));
      exportLanguages(inputPath, outputDir, lang, true, format);
    }, 100);
  };

  for (const { fullPath: absPath } of translationsFiles) {
    const dirPath = path.dirname(absPath);
    const fileName = path.basename(absPath);

    // 1. 监听目录 (解决原子替换问题)
    fs.watch(dirPath, (eventType, filename) => {
      if (filename === fileName) {
        doSync();
      }
    });

    // 2. 轮询备份 (针对某些特殊的磁盘环境)
    fs.watchFile(absPath, { interval: 1007 }, (curr, prev) => {
      if (curr.mtime !== prev.mtime) {
        doSync();
      }
    });
  }
}

/**
 * 校验翻译字典格式
 */
function checkTranslations(inputPath) {
  const translationsFiles = findTranslationsFiles(inputPath);
  if (!translationsFiles) {
    console.error(ct.errors('no_file'));
    return false;
  }

  let hasError = false;

  for (const { fullPath, moduleName } of translationsFiles) {
    console.log(`\n🔍 ${ct.info('checking', { file: moduleName })} (${path.relative(process.cwd(), fullPath)})`);
    const content = fs.readFileSync(fullPath, 'utf8');

    // 1. 检查 LANG_ORDER
    const langOrderMatch = content.match(/(?:export\s+)?const\s+LANG_ORDER\s*=\s*\[(.*?)\]/);
    if (!langOrderMatch) {
      console.error(`  ❌ ${ct.errors('no_lang_order')}`);
      hasError = true;
      continue;
    }
    const langOrder = langOrderMatch[1]
      .split(',')
      .map((s) => s.trim().replace(/['"`]/g, ''))
      .filter(Boolean);

    // 2. 检查 MAIN_LANG
    const mainLangMatch = content.match(/(?:export\s+)?const\s+MAIN_LANG.*=\s*['"](.*?)['"]/);
    if (!mainLangMatch) {
      console.warn(`  ⚠️  ${ct.info('no_main_lang_check')} (Default: ${langOrder[0]})`);
    }

    // 3. 检查 TRANSLATIONS
    const transMatch = content.match(/(?:export\s+)?const\s+TRANSLATIONS\s*=\s*(\{[\s\S]*?\});/);
    if (!transMatch) {
      console.error(`  ❌ ${ct.errors('no_translations')}`);
      hasError = true;
      continue;
    }

    const rootEntries = parseObject(transMatch[1]);
    
    function validateEntries(entries, path = '') {
      for (const entry of entries) {
        const currentPath = path ? `${path}.${entry.key}` : entry.key;
        if (entry.type === 'namespace') {
          validateEntries(entry.children, currentPath);
        } else if (entry.type === 'leaf') {
           // 检查数组长度或显式标签
           const valueStr = entry.valueStr.trim();
           if (valueStr.startsWith('[')) {
              const inner = valueStr.slice(1, -1);
              const items = [];
              const itemRegex = /(\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})|(['"`])([\s\S]*?)\2/g;
              let im;
              while ((im = itemRegex.exec(inner)) !== null) {
                if (im[1]) items.push(im[1]);
                else if (im[3] !== undefined) items.push(im[3]);
              }

              // 检查是否有缺失语言
              const foundLangs = new Set();
              let hasIndexedOnly = false;
              items.forEach((item, idx) => {
                 if (typeof item === 'string') {
                    const match = item.match(/^([a-zA-Z0-9-]+):\s*(.*)$/);
                    if (match && langOrder.includes(match[1])) {
                      foundLangs.add(match[1]);
                    } else {
                      hasIndexedOnly = true;
                    }
                 }
              });

              if (hasIndexedOnly) {
                if (items.length < langOrder.length) {
                   console.warn(`  ⚠️  [${currentPath}] ${ct.info('missing_langs', { count: langOrder.length - items.length })}`);
                }
              } else {
                const missing = langOrder.filter(l => !foundLangs.has(l));
                if (missing.length > 0) {
                   console.warn(`  ⚠️  [${currentPath}] ${ct.info('missing_tags', { langs: missing.join(', ') })}`);
                }
              }
           }
        }
      }
    }

    validateEntries(rootEntries);
    console.log(`  ✅ ${ct.info('check_ok')}`);
  }

  return !hasError;
}

function doExtract(inputPath) {
    const scanDir = inputPath || 'src';
    console.log(ct.info('extract_start', { path: scanDir }));
    const keys = extractKeys(scanDir);
    console.log(ct.info('extract_done', { count: keys.length }));
    
    // 找到字典文件进行同步
    const transFiles = findTranslationsFiles(inputPath);
    if (!transFiles) {
        console.error(ct.errors('no_file'));
        return;
    }

    for (const f of transFiles) {
        const result = syncKeysToTranslations(f.fullPath, keys);
        if (result.added > 0) {
            console.log(ct.info('extract_sync', { file: f.moduleName, count: result.added }));
        }
    }
}



/**
 * 自动修复翻译字典
 */
function fixTranslations(inputPath) {
  const translationsFiles = findTranslationsFiles(inputPath);
  if (!translationsFiles) {
    console.error(ct.errors('no_file'));
    return false;
  }

  for (const { fullPath, moduleName } of translationsFiles) {
    console.log(`\n🔧 ${ct.info('fixing', { file: moduleName })} (${path.relative(process.cwd(), fullPath)})`);
    let content = fs.readFileSync(fullPath, 'utf8');

    // 1. 获取 LANG_ORDER 和 MAIN_LANG
    const langOrderMatch = content.match(/(?:export\s+)?const\s+LANG_ORDER\s*=\s*\[(.*?)\]/);
    if (!langOrderMatch) continue;
    const langOrder = langOrderMatch[1].split(',').map(s => s.trim().replace(/['"`]/g, '')).filter(Boolean);

    const mainLangMatch = content.match(/(?:export\s+)?const\s+MAIN_LANG.*=\s*['"](.*?)['"]/);
    const mainLang = mainLangMatch ? mainLangMatch[1] : langOrder[0];

    const transMatch = content.match(/(?:export\s+)?const\s+TRANSLATIONS\s*=\s*(\{[\s\S]*?\});/);
    if (!transMatch) continue;

    const rootEntries = parseObject(transMatch[1]);
    let fixedCount = 0;

    function doFixEntries(entries, path = '') {
      for (const entry of entries) {
        const currentPath = path ? `${path}.${entry.key}` : entry.key;
        if (entry.type === 'namespace') {
          doFixEntries(entry.children, currentPath);
        } else if (entry.type === 'leaf') {
           const valueStr = entry.valueStr.trim();
           if (valueStr.startsWith('[')) {
              const inner = valueStr.slice(1, -1);
              const items = [];
              const itemRegex = /(\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})|(['"`])([\s\S]*?)\2/g;
              let im;
              while ((im = itemRegex.exec(inner)) !== null) {
                if (im[1]) items.push(im[1]);
                else if (im[0]) items.push(im[0]);
              }

              const foundLangs = new Set();
              let hasIndexedOnly = false;
              let mainLangValue = '';

              items.forEach((item, idx) => {
                 const m = item.match(/^(['"`])([a-zA-Z0-9-]+):\s*(.*)\1$/);
                 if (m && langOrder.includes(m[2])) {
                   foundLangs.add(m[2]);
                   if (m[2] === mainLang) mainLangValue = m[3];
                 } else {
                   hasIndexedOnly = true;
                   if (langOrder[idx] === mainLang) {
                      const vMatch = item.match(/^(['"`])(.*)\1$/);
                      mainLangValue = vMatch ? vMatch[2] : item;
                   }
                 }
              });

              let needsFix = false;
              let newItems = [...items];

              if (hasIndexedOnly) {
                if (items.length < langOrder.length) {
                   needsFix = true;
                   for (let i = items.length; i < langOrder.length; i++) {
                      newItems.push(`'${mainLangValue || ''}'`);
                   }
                }
              } else {
                const missing = langOrder.filter(l => !foundLangs.has(l));
                if (missing.length > 0) {
                   needsFix = true;
                   for (const l of missing) {
                      newItems.push(`'${l}: ${mainLangValue || ''}'`);
                   }
                }
              }

              if (needsFix) {
                 const escapedKey = entry.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                 const keyRegex = new RegExp(`(${escapedKey}:\\s*\\[\\s*)([\\s\\S]*?)(\\s*\\],?)`, 'm');
                 const match = content.match(keyRegex);
                 if (match) {
                    content = content.replace(match[0], `${match[1].trim()}\n      ${newItems.join(',\n      ')}\n    ${match[3].trim()}`);
                    fixedCount++;
                 }
              }
           }
        }
      }
    }

    doFixEntries(rootEntries);
    if (fixedCount > 0) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`  ${ct.info('fixed_count', { count: fixedCount })}`);
    } else {
      console.log(`  ${ct.info('no_fix_needed')}`);
    }
  }
  return true;
}

/**
 * 调用 AI 翻译并同步回 TS
 */
async function doTranslate(inputPath) {
    const translationsFiles = findTranslationsFiles(inputPath);
    if (!translationsFiles) return;

    for (const { fullPath, moduleName } of translationsFiles) {
        console.log(`\n🤖 ${ct.info('checking', { file: moduleName })}...`);
        const content = fs.readFileSync(fullPath, 'utf8');
        
        // 解析内容并提取缺失项 (类似 fix 逻辑)
        const transMatch = content.match(/(?:export\s+)?const\s+TRANSLATIONS\s*=\s*(\{[\s\S]*?\});/);
        if (!transMatch) continue;

        const langOrderMatch = content.match(/(?:export\s+)?const\s+LANG_ORDER\s*=\s*\[(.*?)\]/);
        const langOrder = langOrderMatch ? langOrderMatch[1].split(',').map(s => s.trim().replace(/['"`]/g, '')).filter(Boolean) : ['zh-CN', 'en-US'];
        
        const mainLangMatch = content.match(/(?:export\s+)?const\s+MAIN_LANG.*=\s*['"](.*?)['"]/);
        const mainLang = mainLangMatch ? mainLangMatch[1] : langOrder[0];

        const rootEntries = parseObject(transMatch[1]);
        const missingMap = {}; // { lang: { key: value } }

        function collectMissing(entries, path = '') {
            for (const entry of entries) {
                const currentPath = path ? `${path}.${entry.key}` : entry.key;
                if (entry.type === 'namespace') {
                    collectMissing(entry.children, currentPath);
                } else if (entry.type === 'leaf') {
                    const valueStr = entry.valueStr.trim();
                    if (valueStr.startsWith('[')) {
                        const inner = valueStr.slice(1, -1);
                        const items = [];
                        const itemRegex = /(\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})|(['"`])([\s\S]*?)\2/g;
                        let im;
                        while ((im = itemRegex.exec(inner)) !== null) {
                          if (im[1]) items.push(im[1]);
                          else if (im[0]) items.push(im[0]);
                        }

                        const foundLangs = new Set();
                        let mainValue = '';
                        items.forEach((item, idx) => {
                            const m = item.match(/^(['"`])([a-zA-Z0-9-]+):\s*(.*)\1$/);
                            if (m && langOrder.includes(m[2])) {
                                foundLangs.add(m[2]);
                                if (m[2] === mainLang) mainValue = m[3];
                            } else if (langOrder[idx] === mainLang) {
                                mainValue = item.replace(/['"`]/g, '');
                            }
                        });

                        const missing = langOrder.filter(l => !foundLangs.has(l) && l !== mainLang);
                        for (const l of missing) {
                            if (!missingMap[l]) missingMap[l] = {};
                            missingMap[l][currentPath] = mainValue;
                        }
                    }
                }
            }
        }

        collectMissing(rootEntries);

        const totalMissing = Object.values(missingMap).reduce((acc, obj) => acc + Object.keys(obj).length, 0);
        if (totalMissing === 0) {
            console.log(`  ${ct.info('no_fix_needed')}`);
            continue;
        }

        console.log(`  ${ct.info('ai_translating', { count: totalMissing })}`);
        
        try {
            for (const lang in missingMap) {
                const translated = await translateWithAI(missingMap[lang], [lang], mainLang);
                if (translated[lang]) {
                    // 同步回文件
                    for (const [keyPath, value] of Object.entries(translated[lang])) {
                        syncSingleJsonFromObj(fullPath, { language: lang, translations: { [keyPath]: value } });
                    }
                }
            }
            console.log(`  ${ct.info('ai_done')}`);
        } catch (e) {
            console.error(`  ${ct.errors('ai_error', { message: e.message })}`);
        }
    }
}

// 主程序
const args = parseArgs(process.argv);

if (args.help) {
  console.log(`
${ct.title}

${ct.usage}
  i18nt export [--format <type>] [options]
  i18nt import [options]
  i18nt check  [--input <path>]
  i18nt fix    [--input <path>]
  i18nt extract [--input <dir>]

${ct.options}
  --input <path>    ${ct.help.input}
  --output <dir>    ${ct.help.output}
  --format <type>   Export format: py, php, go, rust, kt, java, cs, cpp, rb, lua, c, scala, js, ex, pl, m, hs, xml, strings, json (default)
  --json <path>      ${ct.help.json}
  --lang <code>     ${ct.help.lang}
  --watch           ${ct.help.watch}
  --help            ${ct.help.help_opt}

${ct.examples}

  1. ${ct.help.export} (${MAIN_LANG})
     $ npx i18nt export

  2. ${i18n.locale === 'zh-CN' ? '导出为 Python 字典' : 'Export to Python dictionary'}
     $ npx i18nt export --format py

  3. ${i18n.locale === 'zh-CN' ? '同步导出所有语言并开启监听' : 'Sync all languages and watch'}
     $ npx i18nt export --lang all --watch
`);
} else if (args.command === 'import') {
  importLang(args.input, args.json);
} else if (args.command === 'check') {
  const ok = checkTranslations(args.input);
  process.exit(ok ? 0 : 1);
} else if (args.command === 'fix') {
  fixTranslations(args.input);
} else if (args.command === 'extract') {
  doExtract(args.input);
} else if (args.command === 'translate') {
  doTranslate(args.input);
} else if (args.command === 'export' || !args.command) {
  if (args.watch) {
    exportLanguages(args.input, args.output, args.lang, false, args.format);
    startWatch(args.input, args.output, args.lang, args.format);
  } else {
    exportLanguages(args.input, args.output, args.lang, false, args.format);
  }
} else {
  console.error(ct.errors('unknown_cmd', { command: args.command }));
  process.exit(1);
}
