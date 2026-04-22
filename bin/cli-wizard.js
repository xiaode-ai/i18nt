import { invokeMenu, waitForKey } from './cli-tui.js';
import { runInteractiveConfig, loadConfig } from './cli-config.js';

const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    magenta: '\x1b[35m',
};

/**
 * 获取 AI 状态文本
 */
function getAIStatus(lang) {
    const config = loadConfig();
    const p = config.ai_provider || 'None';
    const m = config.ai_model || 'None';
    const hasKey = !!config.ai_api_key;
    const isZh = lang === 'zh-CN';
    
    if (hasKey) {
        return `${c.green}${isZh ? '✅ AI 已配置' : '✅ AI Configured'}${c.reset} ${c.dim}(${p}/${m})${c.reset}`;
    }
    return `${c.yellow}${isZh ? '⚠️  AI 未配置' : '⚠️  AI Not Configured'}${c.reset} ${c.dim}(${isZh ? '请运行设置' : 'Please run setup'})${c.reset}`;
}

/**
 * 主向导逻辑
 */
export async function runMainWizard(args, commands, i18n) {
    const sysLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    let currentLang = sysLocale.startsWith('zh') ? 'zh-CN' : 'en-US';

    while (true) {
        const isZh = currentLang === 'zh-CN';
        const choices = [
            { name: 's1', message: isZh ? '── 配置 ──' : '── Config ──', disabled: true },
            { name: 'setup', message: isZh ? '⚙️  配置 AI 服务' : '⚙️  Setup AI Provider' },
            { name: 'init', message: isZh ? '🏗️  初始化项目' : '🏗️  Initialize Project' },
            { name: 's2', message: isZh ? '── 翻译 ──' : '── Translation ──', disabled: true },
            { name: 'extract', message: isZh ? '🔍 提取翻译项' : '🔍 Extract Keys' },
            { name: 'translate', message: isZh ? '🤖 AI 自动翻译' : '🤖 AI Translate' },
            { name: 'check', message: isZh ? '🕵️  校验与修复' : '🕵️  Check & Fix' },
            { name: 'export', message: isZh ? '📦 导出语言包' : '📦 Export' },
            { name: 's3', message: isZh ? '── 工具 ──' : '── Tools ──', disabled: true },
            { name: 'ui', message: isZh ? '🌐 可视化界面' : '🌐 Management UI' },
            { name: 'prune', message: isZh ? '🧹清理无效字段' : '🧹Prune Invalid Fields' },
            { name: 'sync', message: isZh ? '🔄 同步 TMS' : '🔄 Sync TMS' },
            { name: 's4', message: '────────────────────', disabled: true },
            { name: 'lang', message: isZh ? '🌐 Switch to English' : '🌐 切换至中文' },
            { name: 'exit', message: isZh ? '❌ 退出' : '❌ Exit' },
        ];

        let choice;
        try {
            choice = await invokeMenu(
                isZh ? 'i18nt 国际化工具' : 'i18nt Toolkit',
                choices,
                getAIStatus(currentLang),
                currentLang
            );
        } catch (e) {
            break; // Ctrl+C or other cancellation
        }

        if (choice === 'exit') break;
        if (choice === 'lang') {
            currentLang = currentLang === 'zh-CN' ? 'en-US' : 'zh-CN';
            continue;
        }

        // 命令执行模式
        process.stdout.write('\n');

        switch (choice) {
            case 'setup': await runInteractiveConfig(currentLang); break;
            case 'init': await commands.doInit(i18n); break;
            case 'extract': commands.doExtract(args.input, i18n); break;
            case 'translate': await commands.doTranslate(args.input, i18n); break;
            case 'check': 
                commands.doCheck(args.input, i18n); 
                commands.doFix(args.input, i18n); 
                break;
            case 'export':
                const { exportLanguages } = await import('./cli-commands.js');
                exportLanguages(args.input, args.output, args.lang || 'all', false, args.format || 'json', i18n, args);
                break;
            case 'ui': commands.runUI(args.port || 1818, i18n); return;
            case 'prune': 
                // 这里暂时简单处理，因为 Confirm 依然用 enquirer 可能有冲突，
                // 但因为我们执行完命令会物理清屏，所以影响较小
                const { default: enquirer } = await import('enquirer');
                const ok = await new enquirer.Confirm({ message: isZh ? '确认清理无效字段？' : 'Confirm prune invalid fields?' }).run().catch(() => false);
                if (ok) await commands.doPruneTranslations(args.input, i18n);
                else console.log(isZh ? '已取消' : 'Cancelled');
                break;
            case 'sync':
                await commands.doTMSSync(args.input, args, i18n);
                break;
        }

        const isZhFinal = currentLang === 'zh-CN';
        await waitForKey(null, isZhFinal);
    }

    const isZhAtEnd = currentLang === 'zh-CN';
    console.log(`\n  ${isZhAtEnd ? '👋 再见！' : '👋 Bye!'}\n\n`);
}
