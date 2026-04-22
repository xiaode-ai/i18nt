#!/usr/bin/env node

/**
 * i18nt CLI — 从 TypeScript 翻译字典导出/导入 JSON 语言包
 */

import { fileURLToPath } from 'url';
import path from 'path';
import { createI18n } from '../dist/index.js';
import { TRANSLATIONS, LANG_ORDER, MAIN_LANG } from './cli-translations.js';
import { runDoctor } from './cli-doctor.js';
import { runCodegen } from './cli-codegen.js';
import { startUI } from './cli-ui.js';
import { 
    exportLanguages, 
    importLang, 
    startWatch, 
    checkTranslations, 
    fixTranslations, 
    doExtractKeys, 
    doTranslate,
    doTMSSync,
    doPruneTranslations,
    doInit
} from './cli-commands.js';
import { runConfigCommand, loadConfig } from './cli-config.js';
import { runMainWizard } from './cli-wizard.js';

// 自动加载配置到 process.env (仅当环境变量未设置时)
const userConfig = loadConfig();
for (const [k, v] of Object.entries(userConfig)) {
    const envKey = k.toUpperCase().startsWith('I18NT_') ? k.toUpperCase() : `I18NT_${k.toUpperCase()}`;
    if (!process.env[envKey]) {
        process.env[envKey] = v;
    }
}

const __filename = fileURLToPath(import.meta.url);
const locale = Intl.DateTimeFormat().resolvedOptions().locale;
const i18n = createI18n({
  translations: TRANSLATIONS,
  langOrder: LANG_ORDER,
  locale: locale.startsWith('zh') ? 'zh-CN' : 'en-US',
  devWarnings: false,
  preParse: true,
});
const { t } = i18n;
const ct = i18n.t.cli;

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (['export', 'import', 'check', 'fix', 'extract', 'translate', 'doctor', 'ui', 'codegen', 'sync', 'prune', 'config', 'wizard', 'init'].includes(arg)) args.command = arg;
    else if (arg === '--format' || arg === '-f') args.format = argv[++i];
    else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = argv[i + 1];
      if (nextArg && !nextArg.startsWith('--')) { args[key] = nextArg; i++; }
      else args[key] = true;
    }
  }
  return args;
}

const args = parseArgs(process.argv);

// 优先级：命令行参数 > 配置文件 (.i18ntrc)
args.input = args.input || process.env.I18NT_INPUT;
args.output = args.output || process.env.I18NT_OUTPUT;
args.lang = args.lang || process.env.I18NT_LANGS;

if (args.help) {
  console.log(`
${ct.title}

${ct.usage}
  i18nt export [--format <type>] [options]
  i18nt import [options]
  i18nt check  [--input <path>]
  i18nt fix    [--input <path>]
  i18nt extract [--input <dir>]
  i18nt codegen [--output <path>] [--target <lang>]
  i18nt sync    [--provider <lokalise|crowdin>] [--projectId <id>]
  i18nt prune   [--input <path>]
  i18nt init    (Initialize project with standard format)
  i18nt config  [set|get|list|init] [key] [value]
  i18nt wizard  (Interactive UI for all features)

${ct.options}
  --input <path>    ${ct.help.input}
  --output <dir>    ${ct.help.output}
  --format <type>   Export format: py, php, go, rust, kt, java, cs, cpp, rb, lua, c, scala, js, ex, pl, m, hs, xml, strings, json (default)
  --json <path>      ${ct.help.json}
  --lang <code>     ${ct.help.lang}
  --watch           ${ct.help.watch}
  --help            ${ct.help.help_opt}
`);
} else {
    switch (args.command) {
        case 'import': importLang(args.input, args.json, i18n); break;
        case 'check': process.exit(checkTranslations(args.input, i18n) ? 0 : 1); break;
        case 'fix': fixTranslations(args.input, i18n); break;
        case 'extract': doExtractKeys(args.input, i18n); break;
        case 'translate': doTranslate(args.input, i18n); break;
        case 'doctor': runDoctor(args.input, i18n).then(ok => process.exit(ok ? 0 : 1)); break;
        case 'ui': startUI(args.port || 1818, i18n); break;
        case 'codegen': runCodegen(args.input, args.output || 'i18n_keys.py', args.target || 'python'); break;
        case 'sync': doTMSSync(args.input, args, i18n); break;
        case 'prune': doPruneTranslations(args.input, i18n); break;
        case 'init': await doInit(i18n); break;
        case 'config': 
            // 简单的 argv 处理，将剩余参数传给 config 命令
            args._ = process.argv.slice(process.argv.indexOf('config') + 1);
            runConfigCommand(args); 
            break;
        case 'wizard':
            await runMainWizard(args, { 
                doExtract: doExtractKeys, 
                doTranslate, 
                doCheck: checkTranslations, 
                doFix: fixTranslations, 
                runUI: startUI, 
                doTMSSync, 
                doPruneTranslations,
                doInit 
            }, i18n);
            break;
        case 'export':
        default:
            if (!args.command) {
                // 如果没有输入任何命令，启动向导
                await runMainWizard(args, { 
                    doExtract: doExtractKeys, 
                    doTranslate, 
                    doCheck: checkTranslations, 
                    doFix: fixTranslations, 
                    runUI: startUI, 
                    doTMSSync, 
                    doPruneTranslations,
                    doInit 
                }, i18n);
                break;
            }
            if (args.command && args.command !== 'export') {
                console.error(ct.errors('unknown_cmd', { command: args.command }));
                process.exit(1);
            }
            if (args.watch) {
                exportLanguages(args.input, args.output, args.lang, false, args.format, i18n, args);
                startWatch(args.input, args.output, args.lang, args.format, i18n);
            } else {
                exportLanguages(args.input, args.output, args.lang, false, args.format, i18n, args);
            }
    }
}
