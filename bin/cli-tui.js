import readline from 'readline';

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
export function getDisplayWidth(str) {
    let width = 0;
    for (const char of str.replace(/\x1b\[[0-9;]*m/g, '')) { // 剔除 ANSI 颜色
        width += char.match(/[^\x00-\xff]/) ? 2 : 1;
    }
    return width;
}

/**
 * 居中字符串
 */
export function centerText(text, totalWidth) {
    const textWidth = getDisplayWidth(text);
    const pad = Math.max(0, Math.floor((totalWidth - textWidth) / 2));
    return ' '.repeat(pad) + text;
}

/**
 * TUI 菜单引擎
 */
export async function invokeMenu(title, options, headerInfo = '', lang = 'zh-CN') {
    return new Promise((resolve) => {
        let currentIndex = options.findIndex(opt => !opt.disabled);
        if (currentIndex === -1) currentIndex = 0;
        const totalWidth = 50;
        const isZh = lang === 'zh-CN';

        const render = () => {
            // 物理清屏并复位
            process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
            
            const border = '='.repeat(totalWidth);
            console.log(`\n  ${border}`);
            console.log(`  ${centerText(`${c.bold}${c.cyan}${title}${c.reset}`, totalWidth)}`);
            console.log(`  ${border}`);

            if (headerInfo) {
                console.log(`  ${centerText(headerInfo, totalWidth)}`);
                console.log(`  ${' '.repeat(2)}${'-'.repeat(totalWidth - 4)}`);
            }

            let output = '';
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
                let count = 0;
                do {
                    currentIndex = (currentIndex - 1 + options.length) % options.length;
                    count++;
                } while (options[currentIndex].disabled && count < options.length);
                render();
            } else if (key.name === 'down') {
                let count = 0;
                do {
                    currentIndex = (currentIndex + 1) % options.length;
                    count++;
                } while (options[currentIndex].disabled && count < options.length);
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
 * 等待用户按任意键继续
 */
export async function waitForKey(message, isZh = true) {
    return new Promise(resolve => {
        process.stdout.write(`\n  ${message || (isZh ? '操作完成。按任意键继续...' : 'Done. Press any key to continue...')}`);
        
        if (process.stdin.isPaused()) process.stdin.resume();
        
        if (process.stdin.isTTY) process.stdin.setRawMode(true);
        process.stdin.once('data', (data) => {
            // 如果是 Ctrl+C 则直接退出
            if (data[0] === 3) process.exit();
            if (process.stdin.isTTY) process.stdin.setRawMode(false);
            resolve();
        });
    });
}
