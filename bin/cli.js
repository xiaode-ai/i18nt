#!/usr/bin/env node

/**
 * i18nt CLI — 从 TypeScript 翻译字典导出/导入 JSON 语言包
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 解析命令行参数
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = argv[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        args[key] = nextArg;
        i++;
      } else {
        args[key] = true;
      }
    } else if (arg === 'export') {
      args.command = 'export';
    } else if (arg === 'import') {
      args.command = 'import';
    }
  }
  return args;
}

function findTranslationsFile(inputPath) {
  const candidates = inputPath
    ? [path.resolve(inputPath)]
    : [
        path.resolve('src/translations.ts'),
        path.resolve('src/i18n/translations.ts'),
        path.resolve('translations.ts'),
        path.resolve('examples/translations.ts'),
      ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * 核心逻辑：从 TS 导出 JSON
 * 支持导出单个、多个或全部语言
 */
function exportLanguages(inputPath, outputDir, langFilter, silent = false) {
  const translationsFile = findTranslationsFile(inputPath);
  if (!translationsFile) {
    if (!silent) console.error('❌ 找不到翻译字典文件。');
    return null;
  }

  const content = fs.readFileSync(translationsFile, 'utf8');

  // 1. 提取 LANG_ORDER
  const langOrderMatch = content.match(/(?:export\s+)?const\s+LANG_ORDER\s*=\s*\[(.*?)\]/);
  if (!langOrderMatch) {
    if (!silent) console.error('❌ 未能识别 LANG_ORDER。');
    return null;
  }
  const langOrder = langOrderMatch[1]
    .split(',')
    .map((s) => s.trim().replace(/['"`]/g, ''))
    .filter(Boolean);

  // 2. 提取文件内定义的 MAIN_LANG 作为默认参考
  let mainLangInFile = langOrder[0];
  const mainLangMatch = content.match(/(?:export\s+)?const\s+MAIN_LANG.*=\s*['"](.*?)['"]/);
  if (mainLangMatch) {
    mainLangInFile = mainLangMatch[1];
  }

  // 3. 确定需要导出的语言列表
  let targetLangs = [];
  if (langFilter === 'all') {
    targetLangs = [...langOrder];
  } else if (typeof langFilter === 'string' && langFilter.includes(',')) {
    targetLangs = langFilter.split(',').map(s => s.trim()).filter(Boolean);
  } else if (langFilter && langFilter !== true) {
    targetLangs = [langFilter];
  } else {
    // 默认行为：仅导出主语言
    targetLangs = [mainLangInFile];
  }

  // 4. 读取所有 Entry (递归解析嵌套对象)
  const transMatch = content.match(/(?:export\s+)?const\s+TRANSLATIONS\s*=\s*(\{[\s\S]*?\});/);
  if (!transMatch) {
    if (!silent) console.error('❌ 未能识别 TRANSLATIONS 对象。');
    return null;
  }
  const translationsStr = transMatch[1];

  function parseObject(str) {
      const entries = [];
      let i = 0;
      while (i < str.length) {
          // 查找 key:
          const keyMatch = str.slice(i).match(/(\w+):\s*/);
          if (!keyMatch) break;
          const key = keyMatch[1];
          i += keyMatch.index + keyMatch[0].length;

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
          
          // 跳过逗号和空白
          const nextComma = str.slice(i).match(/\s*[,\}]?\s*/);
          if (nextComma) i += nextComma[0].length;
      }
      return entries;
  }

  const rootEntries = parseObject(translationsStr);

  if (!silent) {
    console.log(`ℹ️  字典语言顺序: [${langOrder.join(', ')}]`);
    console.log(`ℹ️  本次导出语言: [${targetLangs.join(', ')}]`);
  }

  const resolvedOutputDir = outputDir ? path.resolve(outputDir) : path.resolve(process.cwd(), 'locales');
  if (!fs.existsSync(resolvedOutputDir)) fs.mkdirSync(resolvedOutputDir, { recursive: true });

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
    const entriesDict = buildOutputDict(rootEntries, lang, langOrder, mainLangInFile);
    const translationsJson = JSON.stringify(entriesDict, null, 4);
    const output = `{\n  "language": "${lang}",\n  "translations":\n  ${translationsJson.replace(/\n/g, '\n  ')}\n}\n`;
    const outputPath = path.join(resolvedOutputDir, `${lang}.json`);
    fs.writeFileSync(outputPath, output, 'utf8');
    if (!silent) console.log(`✅ 已导出: ${lang}.json (${Object.keys(entriesDict).length} 根级/命名空间)`);
  }

  return true;
}

/**
 * 将单个 JSON 同步回 TS
 */
/**
 * 将单个 JSON 同步回 TS (支持嵌套)
 */
function syncSingleJson(tsFilePath, jsonPath) {
  if (!fs.existsSync(jsonPath)) return null;
  try {
    const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const targetLang = jsonContent.language;
    const newTranslations = jsonContent.translations;

    if (!targetLang || !newTranslations) return null;

    let tsContent = fs.readFileSync(tsFilePath, 'utf8');
    const langOrderMatch = tsContent.match(/(?:export\s+)?const\s+LANG_ORDER\s*=\s*\[(.*?)\]/);
    if (!langOrderMatch) return null;
    
    const langOrder = langOrderMatch[1].split(',').map(s => s.trim().replace(/['"`]/g, '')).filter(Boolean);
    const langIndex = langOrder.indexOf(targetLang);
    if (langIndex === -1) {
      console.warn(`⚠️  跳过 ${path.basename(jsonPath)}: 目标 TS 中 LANG_ORDER 未包含 "${targetLang}"`);
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
    console.error(`❌ 解析 ${path.basename(jsonPath)} 失败: ${e.message}`);
    return null;
  }
}

function importLang(inputPath, jsonPath) {
  const translationsFile = findTranslationsFile(inputPath);
  if (!translationsFile) {
    console.error('❌ 找不到翻译字典文件。');
    process.exit(1);
  }

  if (!jsonPath) {
    console.error('❌ 请使用 --json 参数指定 JSON 文件或目录路径。');
    process.exit(1);
  }

  const absoluteJsonPath = path.resolve(jsonPath);
  if (!fs.existsSync(absoluteJsonPath)) {
    console.error(`❌ 路径不存在: ${absoluteJsonPath}`);
    process.exit(1);
  }

  const stats = fs.statSync(absoluteJsonPath);
  if (stats.isDirectory()) {
    console.log(`ℹ️  正在从目录导入: ${absoluteJsonPath}`);
    const files = fs.readdirSync(absoluteJsonPath).filter(f => f.endsWith('.json'));
    if (files.length === 0) {
      console.log('ℹ️  目录下没有发现 .json 文件。');
      return;
    }

    for (const file of files) {
      const result = syncSingleJson(translationsFile, path.join(absoluteJsonPath, file));
      if (result) {
        console.log(`✅ [${result.lang}] 同步完成: ${result.updatedCount} 更新, ${result.addedCount} 新增加`);
      }
    }
  } else {
    const result = syncSingleJson(translationsFile, absoluteJsonPath);
    if (result) {
      console.log(`✅ [${result.lang}] 同步完成: ${result.updatedCount} 更新, ${result.addedCount} 新增`);
    }
  }
}

/**
 * 启动文件监听
 */
function startWatch(inputPath, outputDir, lang) {
  const translationsFile = findTranslationsFile(inputPath);
  if (!translationsFile) {
    console.error('❌ 找不到翻译字典文件，无法启动监听。');
    process.exit(1);
  }

  const absPath = path.resolve(translationsFile);
  const dirPath = path.dirname(absPath);
  const fileName = path.basename(absPath);

  console.log(`👀 正在监听: ${absPath}`);
  console.log('💡 提示：修改并保存 TS 文件后，关联的 JSON 将自动更新。按 Ctrl+C 停止。');

  let debounceTimer;
  const doSync = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      console.log(`⚡ 检测到变更，已完成同步 ${new Date().toLocaleTimeString()}`);
      exportLanguages(inputPath, outputDir, lang, true);
    }, 100);
  };

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

// 主程序
const args = parseArgs(process.argv);

if (args.help) {
  console.log(`
🚀 i18nt CLI — 国际化翻译模板导出/导入工具

用法:
  i18nt export [选项]
  i18nt import [选项]

选项:
  --input <path>    指定翻译字典 (.ts) 的文件路径
  --output <dir>    [Export] 指定生成的 JSON 文件存放目录 (默认: ./locales/)
  --json <path>      [Import] 指定需要导入的 JSON 文件路径或目录
  --lang <code>     [Export] 指定语言。支持: <code>, <code>,<code> 或 "all"
  --watch           [Export] 开启监听模式，TS 变化时自动更新 JSON
  --help            显示帮助信息

🌟 示例场景:

  1. 导出主语言包
     $ npx i18nt export

  2. 同步导出所有语言并开启监听
     $ npx i18nt export --lang all --watch

  3. 导出指定多个语言
     $ npx i18nt export --lang zh-CN,en-US
`);
} else if (args.command === 'import') {
  importLang(args.input, args.json);
} else if (args.command === 'export' || !args.command) {
  if (args.watch) {
    exportLanguages(args.input, args.output, args.lang);
    startWatch(args.input, args.output, args.lang);
  } else {
    exportLanguages(args.input, args.output, args.lang);
  }
} else {
  console.error(`❌ 未知命令: ${args.command}。请运行 npx i18nt --help 查看帮助。`);
  process.exit(1);
}
