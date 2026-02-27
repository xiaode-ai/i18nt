#!/usr/bin/env node

/**
 * i18nt CLI — 从 TypeScript 翻译字典导出 JSON 语言模板
 *
 * Usage:
 *   npx i18nt export --input src/translations.ts --output src/locales --lang zh-CN
 *   npx i18nt export (使用默认配置)
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
      ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function exportMainLang(inputPath, outputDir, mainLangOverride) {
  const translationsFile = findTranslationsFile(inputPath);
  if (!translationsFile) {
    console.error('❌ 找不到翻译文件。请使用 --input 指定路径。');
    process.exit(1);
  }

  const content = fs.readFileSync(translationsFile, 'utf8');

  // 1. 提取 LANG_ORDER
  const langOrderMatch = content.match(/(?:export\s+)?const\s+LANG_ORDER\s*=\s*\[(.*?)\]/);
  if (!langOrderMatch) {
    console.error('❌ 未能识别 LANG_ORDER。请确保翻译文件包含 LANG_ORDER 数组。');
    process.exit(1);
  }
  const langOrder = langOrderMatch[1]
    .split(',')
    .map((s) => s.trim().replace(/['"]/g, ''))
    .filter(Boolean);

  // 2. 提取 MAIN_LANG
  let mainLang = mainLangOverride || langOrder[0];
  if (!mainLangOverride) {
    const mainLangMatch = content.match(/(?:export\s+)?const\s+MAIN_LANG.*=\s*['"](.*?)['"]/);
    if (mainLangMatch) {
      mainLang = mainLangMatch[1];
    }
  }

  console.log(`ℹ️  检测到主语言: ${mainLang}`);
  console.log(`ℹ️  语言顺序: [${langOrder.join(', ')}]`);

  // 3. 确定主语言在数组中的索引
  const mainLangIndex = langOrder.indexOf(mainLang);
  if (mainLangIndex === -1) {
    console.warn(`⚠️  MAIN_LANG "${mainLang}" 不在 LANG_ORDER 中，默认使用索引 0`);
  }
  const targetIndex = Math.max(0, mainLangIndex);

  // 4. 提取 TRANSLATIONS 对象内容
  const transMatch = content.match(/(?:export\s+)?const\s+TRANSLATIONS\s*=\s*(\{[\s\S]*?\});/);
  if (!transMatch) {
    console.error('❌ 未能识别 TRANSLATIONS 对象。');
    process.exit(1);
  }
  const translationsStr = transMatch[1];

  const entries = {};
  const entryRegex = /(\w+):\s*\[\s*([\s\S]*?)\s*\]/g;
  let m;
  while ((m = entryRegex.exec(translationsStr)) !== null) {
    const key = m[1];
    const itemsStr = m[2];

    // 解析出所有的元素值
    const items = [];
    // 匹配普通的字符串 或 大括号包裹的对象 (复数)
    // 对象匹配需避免因为内部存在 {{var}} 导致大括号过早闭合匹配失败：用非贪婪匹配到最后一个 }
    const itemRegex = /(['"`])([\s\S]*?)\1|(\{(?:[^{}]|\{(?:[^{}]+)\})*\})/g;
    let im;
    while ((im = itemRegex.exec(itemsStr)) !== null) {
      if (im[2] !== undefined) {
        items.push(im[2]); // 普通字符串
      } else if (im[3]) {
        items.push(im[3].replace(/\s+/g, ' ')); // 对象结构
      }
    }

    // 核心剥离逻辑：模仿核运行时 extractArrayValue 
    let finalValue = null;

    // 1. 优先尝试寻找当前主语言的显式语法 'zh-CN: 你好'
    for (const item of items) {
      if (typeof item === 'string') {
        const match = item.match(/^([a-zA-Z0-9-]+):\s*(.*)$/);
        if (match && match[1] === mainLang) {
          finalValue = match[2];
          break;
        }
      }
    }

    // 2. 回退到按索引位置提取
    if (!finalValue && items[targetIndex]) {
      const fallbackValue = items[targetIndex];
      // 如果按索引拿到的恰好是别的主语言前缀，智能剥离以防万一
      const match = typeof fallbackValue === 'string' ? fallbackValue.match(/^([a-zA-Z0-9-]+):\s*(.*)$/) : null;
      if (match && langOrder.includes(match[1])) {
        finalValue = match[2];
      } else {
        finalValue = fallbackValue;
      }
    }

    if (finalValue) {
      entries[key] = finalValue;
    }
  }

  // 5. 输出
  const resolvedOutputDir = outputDir ? path.resolve(outputDir) : path.resolve('src/locales');
  if (!fs.existsSync(resolvedOutputDir)) {
    fs.mkdirSync(resolvedOutputDir, { recursive: true });
  }

  const translationsJson = JSON.stringify(entries, null, 4);
  const output = `{\n  "language": "${mainLang}",\n  "translations":\n  ${translationsJson.replace(/\n/g, '\n  ')}\n}\n`;

  const outputPath = path.join(resolvedOutputDir, `${mainLang}.json`);
  fs.writeFileSync(outputPath, output, 'utf8');

  console.log(`✅ 已导出主语言模板: ${outputPath} (${Object.keys(entries).length} 条)`);
}

// 主程序
const args = parseArgs(process.argv);

if (args.command === 'export' || !args.command) {
  exportMainLang(args.input, args.output, args.lang);
} else if (args.help) {
  console.log(`
i18nt CLI — 国际化翻译模板导出工具

用法:
  i18nt export [选项]

选项:
  --input <path>    翻译文件路径 (默认: src/translations.ts)
  --output <dir>    输出目录 (默认: src/locales)
  --lang <code>     指定主语言代码 (默认: 自动检测)
  --help            显示帮助信息
`);
} else {
  console.error(`❌ 未知命令: ${args.command}。使用 --help 查看帮助。`);
  process.exit(1);
}
