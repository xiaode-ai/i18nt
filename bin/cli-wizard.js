import readline from 'readline';
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
 * 字符宽度计算 (处理中文字符占位)
 */
function getDisplayWidth(str) {
    let width = 0;
    for (const char of str.replace(/\x1b\[[0-9;]*m/g, '')) { // 剔除 ANSI 颜色
        width += char.match(/[^\x00-\xff]/) ? 2 : 1;
    }
    return width;
}

/**
 * 居中字符串
 */
function centerText(text, totalWidth) {
    const textWidth = getDisplayWidth(text);
    const pad = Math.max(0, Math.floor((totalWidth - textWidth) / 2));
    return ' '.repeat(pad) + text;
}

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
 * TUI 菜单引擎
 */
async function invokeMenu(title, options, headerInfo = '', lang = 'zh-CN') {
    return new Promise((resolve) => {
        let currentIndex = 0;
        const totalWidth = 50;
        const isZh = lang === 'zh-CN';

        const render = () => {
            // 物理清屏并复位
            process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
            
            let output = '\n';
            const border = '='.repeat(totalWidth);
            output += `  ${border}\n`;
            output += `  ${centerText(`${c.bold}${c.cyan}${title}${c.reset}`, totalWidth)}\n`;
            output += `  ${border}\n`;

            if (headerInfo) {
                output += `  ${centerText(headerInfo, totalWidth)}\n`;
                output += `  ${' '.repeat(2)}${'-'.repeat(totalWidth - 4)}\n`;
            }

            options.forEach((opt, i) => {
                const prefix = i === currentIndex ? `${c.cyan} > ${c.reset}` : '   ';
                const label = opt.disabled ? `${c.dim}${opt.message}${c.reset}` : opt.message;
                output += `  ${prefix}${label}\n`;
            });

            output += `  ${border}\n`;
            output += `  ${c.dim}${isZh ? ' (↑/↓ 移动, Enter 选择, Esc 退出)' : ' (↑/↓ Move, Enter Select, Esc Exit)'}${c.reset}\n`;

            process.stdout.write(output);
        };

        // 设置按键监听
        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.isTTY) process.stdin.setRawMode(true);

        const onKeypress = (str, key) => {
            if (key.name === 'up') {
                do {
                    currentIndex = (currentIndex - 1 + options.length) % options.length;
                } while (options[currentIndex].disabled);
                render();
            } else if (key.name === 'down') {
                do {
                    currentIndex = (currentIndex + 1) % options.length;
                } while (options[currentIndex].disabled);
                render();
            } else if (key.name === 'return') {
                cleanup();
                resolve(options[currentIndex].name);
            } else if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
                cleanup();
                resolve('exit');
            }
        };

        const cleanup = () => {
            process.stdin.removeListener('keypress', onKeypress);
            if (process.stdin.isTTY) process.stdin.setRawMode(false);
        };

        process.stdin.on('keypress', onKeypress);
        render();
    });
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
            { name: 's2', message: isZh ? '── 翻译 ──' : '── Translation ──', disabled: true },
            { name: 'extract', message: isZh ? '🔍 提取翻译项' : '🔍 Extract Keys' },
            { name: 'translate', message: isZh ? '🤖 AI 自动翻译' : '🤖 AI Translate' },
            { name: 'check', message: isZh ? '🕵️  校验与修复' : '🕵️  Check & Fix' },
            { name: 'export', message: isZh ? '📦 导出语言包' : '📦 Export' },
            { name: 's3', message: isZh ? '── 工具 ──' : '── Tools ──', disabled: true },
            { name: 'ui', message: isZh ? '🌐 可视化界面' : '🌐 Management UI' },
            { name: 'prune', message: isZh ? '🧹清理无效字段' : '🧹Prune Invalid Fields' },
            { name: 's4', message: '────────────────────', disabled: true },
            { name: 'lang', message: isZh ? '🌐 Switch to English' : '🌐 切换至中文' },
            { name: 'exit', message: isZh ? '❌ 退出' : '❌ Exit' },
        ];

        const choice = await invokeMenu(
            isZh ? 'i18nt 国际化工具' : 'i18nt Toolkit',
            choices,
            getAIStatus(currentLang),
            currentLang
        );

        if (choice === 'exit') break;
        if (choice === 'lang') {
            currentLang = currentLang === 'zh-CN' ? 'en-US' : 'zh-CN';
            continue;
        }

        // 命令执行模式
        process.stdout.write('\n');

        switch (choice) {
            case 'setup': await runInteractiveConfig(currentLang); break;
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
                break;
        }

        process.stdout.write(`\n  ${c.dim}${isZh ? '操作完成。按任意键继续...' : 'Done. Press any key to continue...'}${c.reset}`);
        
        // 显式恢复 stdin 状态，防止被子命令（如 enquirer）暂停导致进程提前退出
        if (process.stdin.isPaused()) process.stdin.resume();
        
        await new Promise(resolve => {
            if (process.stdin.isTTY) process.stdin.setRawMode(true);
            process.stdin.once('data', (data) => {
                // 如果是 Ctrl+C 则直接退出
                if (data[0] === 3) process.exit();
                if (process.stdin.isTTY) process.stdin.setRawMode(false);
                resolve();
            });
        });
    }

    process.stdout.write(`\n  ${isZh ? '👋 再见！' : '👋 Bye!'}\n\n`);
}
