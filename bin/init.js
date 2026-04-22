#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

/**
 * i18nt 自动初始化脚本
 * 当用户安装此包后，自动在项目根目录创建 .i18nt 文件夹
 */

function init() {
    // INIT_CWD 是 npm/bun 在安装时设置的环境变量，指向运行安装命令的目录
    const projectRoot = process.env.INIT_CWD || process.cwd();
    
    // 防止在库开发阶段或者误操作下在 node_modules 内部创建
    if (projectRoot.includes('node_modules')) return;

    const i18nDir = path.join(projectRoot, '.i18nt');
    const localesDir = path.join(i18nDir, 'locales');

    try {
        if (!fs.existsSync(i18nDir)) {
            fs.mkdirSync(i18nDir, { recursive: true });
        }
        if (!fs.existsSync(localesDir)) {
            fs.mkdirSync(localesDir, { recursive: true });
        }
        
        // 可选：创建一个简单的 .gitignore 防止用户误将 locales 提交（如果他们希望的话）
        // 或者创建一个简单的说明文件
        const readmePath = path.join(i18nDir, 'README.md');
        if (!fs.existsSync(readmePath)) {
            fs.writeFileSync(readmePath, '# i18nt Managed Directory\n\nThis directory is managed by @xiaode-ai/i18nt.\n- `locales/`: Contains exported translation files.\n', 'utf8');
        }

    } catch (err) {
        // 静默失败，不干扰安装
    }
}

init();
