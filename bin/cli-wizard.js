import readline from 'readline';
import { runInteractiveConfig } from './cli-config.js';

const translations = {
    'en-US': {
        welcome: '🌟 Welcome to i18nt - The Intelligent I18n Framework',
        question: 'What would you like to do today?',
        setup: '⚙️  Setup AI         - Configure API key and provider',
        extract: '🔍 Extract Keys     - Scan source code for new t() calls',
        translate: '🤖 AI Translate     - Automatically fill missing translations',
        check: '🕵️  Check & Fix      - Validate and repair dictionary format',
        ui: '🌐 Launch Web UI    - Manage translations in your browser',
        prune: '🧹 Prune Unused     - Remove keys that are no longer used',
        sync: '🚀 TMS Sync         - Sync with Lokalise or Crowdin',
        exit: '0. ❌ Exit',
        lang: 'L. 🌐 Switch Language (切换语言)',
        input: '\nEnter number or letter: ',
        bye: 'Bye!',
        invalid: 'Invalid choice.'
    },
    'zh-CN': {
        welcome: '🌟 欢迎使用 i18nt - 智能国际化框架',
        question: '您今天想要做什么？',
        setup: '1. ⚙️  配置 AI 服务     - 设置 API Key 和供应商',
        extract: '2. 🔍 提取翻译项      - 扫描源码中的 t() 调用',
        translate: '3. 🤖 AI 自动翻译     - 自动填充缺失的翻译内容',
        check: '4. 🕵️  校验与修复      - 验证并修复字典文件格式',
        ui: '5. 🌐 启动可视化界面  - 在浏览器中管理翻译',
        prune: '6. 🧹 清理无用项      - 移除代码中不再使用的翻译 Key',
        sync: '7. 🚀 同步云端        - 与 Lokalise 或 Crowdin 同步',
        exit: '0. ❌ 退出',
        lang: 'L. 🌐 Switch Language (切换语言)',
        input: '\n请输入数字或字母: ',
        bye: '再见！',
        invalid: '无效的选择。'
    }
};

export async function runMainWizard(args, commands, i18n) {
    // 自动检测系统语言
    const sysLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    let currentLang = sysLocale.startsWith('zh') ? 'zh-CN' : 'en-US';

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const question = (query) => new Promise((resolve) => rl.question(query, resolve));

    while (true) {
        const t = translations[currentLang];
        console.log(`\n${t.welcome}\n`);
        console.log(t.question);
        
        if (currentLang === 'zh-CN') {
            console.log(t.setup);
            console.log(t.extract);
            console.log(t.translate);
            console.log(t.check);
            console.log(t.ui);
            console.log(t.prune);
            console.log(t.sync);
        } else {
            console.log(`1. ${t.setup}`);
            console.log(`2. ${t.extract}`);
            console.log(`3. ${t.translate}`);
            console.log(`4. ${t.check}`);
            console.log(`5. ${t.ui}`);
            console.log(`6. ${t.prune}`);
            console.log(`7. ${t.sync}`);
        }
        console.log(t.lang);
        console.log(t.exit);

        const choice = await question(t.input);
        const cmd = choice.toLowerCase();

        if (cmd === '0') {
            console.log(t.bye);
            rl.close();
            break;
        }

        if (cmd === 'l') {
            currentLang = currentLang === 'zh-CN' ? 'en-US' : 'zh-CN';
            console.clear();
            continue;
        }

        rl.close(); // 其他命令需要退出 readline 以便子命令运行

        switch (cmd) {
            case '1': await runInteractiveConfig(); break;
            case '2': commands.doExtract(args.input, i18n); break;
            case '3': await commands.doTranslate(args.input, i18n); break;
            case '4': commands.doCheck(args.input, i18n); break;
            case '5': commands.runUI(args.port || 1818); break;
            case '6': commands.doPruneTranslations(args.input, i18n); break;
            case '7': commands.doTMSSync(args.input, args, i18n); break;
            default: console.log(t.invalid);
        }
        break; // 执行完命令后退出
    }
}
