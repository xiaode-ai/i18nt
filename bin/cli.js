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
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      args[key] = argv[i + 1] || true;
      i++;
    } else if (argv[i] === 'export') {
      args.command = 'export';
    } else if (argv[i] === 'import') {
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

function exportMainLang(inputPath, outputDir, mainLangOverride) {
  const translationsFile = findTranslationsFile(inputPath);
  if (!translationsFile) {
    console.error('❌ 找不到翻译字典文件。');
    process.exit(1);
  }

  const content = fs.readFileSync(translationsFile, 'utf8');

  // 1. 提取 LANG_ORDER
  const langOrderMatch = content.match(/(?:export\s+)?const\s+LANG_ORDER\s*=\s*\[(.*?)\]/);
  if (!langOrderMatch) {
    console.error('❌ 未能识别 LANG_ORDER。请确保字典包含导出数组: export const LANG_ORDER = [...]');
    process.exit(1);
  }
  const langOrder = langOrderMatch[1]
    .split(',')
    .map((s) => s.trim().replace(/['"`]/g, ''))
    .filter(Boolean);

  // 2. 提取 MAIN_LANG
  let mainLang = mainLangOverride || langOrder[0];
  if (!mainLangOverride) {
    const mainLangMatch = content.match(/(?:export\s+)?const\s+MAIN_LANG.*=\s*['"](.*?)['"]/);
    if (mainLangMatch) {
      mainLang = mainLangMatch[1];
    }
  }

  console.log(`ℹ️  解析目标语言: ${mainLang}`);
  console.log(`ℹ️  字典语言顺序: [${langOrder.join(', ')}]`);

  const mainLangIndex = langOrder.indexOf(mainLang);
  const targetIndex = Math.max(0, mainLangIndex);

  const transMatch = content.match(/(?:export\s+)?const\s+TRANSLATIONS\s*=\s*(\{[\s\S]*?\});/);
  if (!transMatch) {
    console.error('❌ 未能识别 TRANSLATIONS 对象。请检查语法。');
    process.exit(1);
  }
  const translationsStr = transMatch[1];

  const entries = {};
  const entryRegex = /(\w+):\s*\[\s*([\s\S]*?)\s*\]/g;
  let m;
  while ((m = entryRegex.exec(translationsStr)) !== null) {
    const key = m[1];
    const itemsStr = m[2];

    const items = [];
    // 优先级调整：先抓取整体对象 {} 以兼容复数结构，再抓取普通字符串
    const itemRegex = /(\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})|(['"`])([\s\S]*?)\2/g;
    let im;
    while ((im = itemRegex.exec(itemsStr)) !== null) {
      if (im[1]) items.push(im[1].replace(/\s+/g, ' '));
      else if (im[3] !== undefined) items.push(im[3]);
    }

    let finalValue = null;
    for (const item of items) {
      if (typeof item === 'string') {
        const match = item.match(/^([a-zA-Z0-9-]+):\s*(.*)$/);
        if (match && match[1] === mainLang) {
          finalValue = match[2];
          break;
        }
      }
    }

    if (!finalValue && items[targetIndex]) {
      const fallbackValue = items[targetIndex];
      const match = typeof fallbackValue === 'string' ? fallbackValue.match(/^([a-zA-Z0-9-]+):\s*(.*)$/) : null;
      if (match && langOrder.includes(match[1])) {
        finalValue = match[2];
      } else {
        finalValue = fallbackValue;
      }
    }

    if (finalValue) entries[key] = finalValue;
  }

  const resolvedOutputDir = outputDir ? path.resolve(outputDir) : path.resolve(process.cwd(), 'locales');
  if (!fs.existsSync(resolvedOutputDir)) fs.mkdirSync(resolvedOutputDir, { recursive: true });

  const translationsJson = JSON.stringify(entries, null, 4);
  const output = `{\n  "language": "${mainLang}",\n  "translations":\n  ${translationsJson.replace(/\n/g, '\n  ')}\n}\n`;

  const outputPath = path.join(resolvedOutputDir, `${mainLang}.json`);
  fs.writeFileSync(outputPath, output, 'utf8');
  console.log(`✅ 已成功导出模板: ${outputPath} (共 ${Object.keys(entries).length} 条)`);
}

/**
 * 核心逻辑：将单个 JSON 同步到 TS 文件中
 */
function syncSingleJson(tsFilePath, jsonPath) {
  if (!fs.existsSync(jsonPath)) return null;
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

  for (const [key, val] of Object.entries(newTranslations)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const keyRegex = new RegExp(`(${escapedKey}:\\s*\\[\\s*)([\\s\\S]*?)(\\s*\\],?)`, 'm');
    const match = tsContent.match(keyRegex);

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
        let newValue = typeof val === 'object' ? JSON.stringify(val).replace(/"/g, "'") : val;
        const itemRaw = rawMatches[langIndex].matchStr;
        const matchLang = itemRaw.match(/^(['"`])([a-zA-Z0-9-]+):\s*/);
        if (matchLang && matchLang[2] === targetLang) newValue = `${targetLang}: ${val}`;
        
        const finalValStr = typeof val === 'object' ? newValue : `'${newValue}'`;
        const { start, end } = rawMatches[langIndex];
        const newItemsStr = itemsStr.substring(0, start) + finalValStr + itemsStr.substring(end);
        tsContent = tsContent.replace(match[0], `${prefix}${newItemsStr}${suffix}`);
        updatedCount++;
      }
    } else {
      const transObjMatch = tsContent.match(/(const\s+TRANSLATIONS\s*=\s*\{)([\s\S]*?)(\};)/);
      if (transObjMatch) {
         const emptyArray = new Array(langOrder.length).fill("''");
         emptyArray[langIndex] = typeof val === 'object' ? JSON.stringify(val).replace(/"/g, "'") : `'${val}'`;
         const newEntry = `  ${key}: [${emptyArray.join(', ')}],\n`;
         tsContent = tsContent.replace(transObjMatch[1], `${transObjMatch[1]}\n${newEntry}`);
         addedCount++;
      }
    }
  }

  fs.writeFileSync(tsFilePath, tsContent, 'utf8');
  return { updatedCount, addedCount, lang: targetLang };
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
        console.log(`✅ [${result.lang}] 同步完成: ${result.updatedCount} 更新, ${result.addedCount} 新增`);
      }
    }
  } else {
    const result = syncSingleJson(translationsFile, absoluteJsonPath);
    if (result) {
      console.log(`✅ [${result.lang}] 同bs完成: ${result.updatedCount} 更新, ${result.addedCount} 新增`);
    } else {
      console.error('❌ 导入失败，请检查文件格式。');
    }
  }
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
  --lang <code>     [Export] 指定提取的语言 (默认为核心主语言)
  --help            显示帮助信息

🌟 示例场景:

  1. 导出主语言包
     $ npx i18nt export

  2. 导入单个语种（同步回字典）
     $ npx i18nt import --json ./locales/en-US.json

  3. 批量导入目录下所有语种
     $ npx i18nt import --json ./locales/
`);
} else if (args.command === 'import') {
  importLang(args.input, args.json);
} else if (args.command === 'export' || !args.command) {
  exportMainLang(args.input, args.output, args.lang);
} else {
  console.error(`❌ 未知命令: ${args.command}。请运行 npx i18nt --help 查看帮助。`);
  process.exit(1);
}
