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
    console.error('ℹ️ 尝试在以下默认路径寻找失败: src/translations.ts, translations.ts, examples/translations.ts');
    console.error('💡 请使用 --input 参数主动指定路径。例如: npx i18nt export --input ./my-dict.ts');
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

  // 3. 确定主语言在数组中的索引
  const mainLangIndex = langOrder.indexOf(mainLang);
  if (mainLangIndex === -1) {
    console.warn(`⚠️  待提取的语言 "${mainLang}" 不在 LANG_ORDER 数组中，将降级尝试以索引 0 回退`);
  }
  const targetIndex = Math.max(0, mainLangIndex);

  // 4. 提取 TRANSLATIONS 对象内容
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
    // 匹配普通的字符串 或 大括号包裹的对象 (复数)
    // 对象匹配需避免因为内部存在 {{var}} 导致大括号过早闭合匹配失败
    const itemRegex = /(['"`])([\s\S]*?)\1|(\{(?:[^{}]|\{(?:[^{}]+)\})*\})/g;
    let im;
    while ((im = itemRegex.exec(itemsStr)) !== null) {
      if (im[2] !== undefined) {
        items.push(im[2]);
      } else if (im[3]) {
        items.push(im[3].replace(/\s+/g, ' '));
      }
    }

    let finalValue = null;

    // 1. 尝试显式语法
    for (const item of items) {
      if (typeof item === 'string') {
        const match = item.match(/^([a-zA-Z0-9-]+):\s*(.*)$/);
        if (match && match[1] === mainLang) {
          finalValue = match[2];
          break;
        }
      }
    }

    // 2. 回退索引
    if (!finalValue && items[targetIndex]) {
      const fallbackValue = items[targetIndex];
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
  // 缺省目录改为执行命令所在的相对路径 ./locales 下，防呆设计，因为用户未必有 src 文件夹
  const resolvedOutputDir = outputDir ? path.resolve(outputDir) : path.resolve(process.cwd(), 'locales');
  
  if (!fs.existsSync(resolvedOutputDir)) {
    console.log(`ℹ️  自动创建输出目录: ${resolvedOutputDir}`);
    fs.mkdirSync(resolvedOutputDir, { recursive: true });
  }

  const translationsJson = JSON.stringify(entries, null, 4);
  const output = `{\n  "language": "${mainLang}",\n  "translations":\n  ${translationsJson.replace(/\n/g, '\n  ')}\n}\n`;

  const outputPath = path.join(resolvedOutputDir, `${mainLang}.json`);
  fs.writeFileSync(outputPath, output, 'utf8');

  console.log(`✅ 已成功导出模板: ${outputPath} (解析出 ${Object.keys(entries).length} 条记录)`);
}

// 主程序
const args = parseArgs(process.argv);

if (args.command === 'export' || !args.command) {
  exportMainLang(args.input, args.output, args.lang);
} else if (args.help) {
  console.log(`
🚀 i18nt CLI — 国际化翻译模板导出工具

用法:
  i18nt export [选项]

选项:
  --input <path>    指定翻译字典 (.ts) 的文件路径
  --output <dir>    指定生成的 JSON 文件存放目录 (默认: 当前终端路径下的 ./locales/)
  --lang <code>     指定需要提取的目标语言代码 (默认为字典配置中的核心主语言)
  --help            显示帮助信息

🌟 示例场景:

  1. 默认快速导出 (自动扫描项目 src/ 中字典，输出主语言到当前终端下 locales/)
     $ npx i18nt export

  2. 手动指定你的字典文件路径与输出目录
     $ npx i18nt export --input my-i18n-folder/dict.ts --output docs/lang 

  3. 导出指定语言发给翻译团队协作
     $ npx i18nt export --input src/translations.ts --lang en-US

  4. 无视默认顺序，强制提取繁体中文（只要数组或者对象里有对应的数据）
     $ npx i18nt export --lang zh-TW
`);
} else {
  console.error(`❌ 未知命令: ${args.command}。请运行 npx i18nt --help 查看帮助。`);
  process.exit(1);
}
