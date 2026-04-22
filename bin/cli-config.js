import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Select, Input, Password, Confirm } = require('enquirer');
import https from 'https';

const CONFIG_FILE = '.i18ntrc';

// ANSI 颜色辅助
const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    magenta: '\x1b[35m',
    gray: '\x1b[90m',
};

/**
 * AI 供应商配置映射
 */
const PROVIDERS = {
    openai:     { label: 'OpenAI',     host: 'api.openai.com',                      path: '/v1/chat/completions' },
    deepseek:   { label: 'DeepSeek',   host: 'api.deepseek.com',                    path: '/v1/chat/completions' },
    gemini:     { label: 'Gemini',     host: 'generativelanguage.googleapis.com',    path: '' },  // path 在获取 model 后动态生成
    claude:     { label: 'Claude',     host: 'api.anthropic.com',                    path: '/v1/messages' },
    openrouter: { label: 'OpenRouter', host: 'openrouter.ai',                       path: '/api/v1/chat/completions' },
    custom:     { label: 'Custom',     host: '',                                    path: '' },
};

/**
 * 交互式配置向导 — 使用 enquirer 实现
 * @param {string} lang - 当前语言 ('zh-CN' | 'en-US')
 */
export async function runInteractiveConfig(lang = 'en-US') {
    const isZh = lang === 'zh-CN';

    console.log(`  ${c.bold}${c.cyan}${isZh ? '🚀 AI 服务配置向导' : '🚀 AI Setup Wizard'}${c.reset}\n`);

    // 检测已有配置
    const existingConfig = loadConfig();
    const hasExisting = existingConfig.ai_provider && existingConfig.ai_api_key;

    if (hasExisting) {
        console.log(`  ${c.yellow}${isZh ? '检测到已有配置:' : 'Existing configuration found:'}${c.reset}`);
        printConfigTable(existingConfig, isZh);
        console.log('');

        let overwrite = false;
        try {
            const confirmPrompt = new Confirm({
                name: 'overwrite',
                message: isZh ? '是否要覆盖现有配置？' : 'Do you want to overwrite the existing configuration?',
                initial: false,
            });
            overwrite = await confirmPrompt.run();
        } catch { return; }

        if (!overwrite) {
            console.log(`  ${c.dim}${isZh ? '保留现有配置。' : 'Keeping existing configuration.'}${c.reset}`);
            return;
        }
        console.log('');
    }

    // 1. 选择 AI 供应商
    let provider;
    try {
        const providerPrompt = new Select({
            name: 'provider',
            message: isZh ? '请选择 AI 供应商' : 'Select your AI Provider',
            choices: Object.entries(PROVIDERS).map(([key, val]) => ({
                name: key,
                message: val.label,
                hint: key === 'custom' ? (isZh ? '自定义 API 端点' : 'Custom API endpoint') : val.host,
            })),
        });
        provider = await providerPrompt.run();
    } catch { return; }

    const providerConfig = PROVIDERS[provider];
    let host = providerConfig.host;
    let apiPath = providerConfig.path;
    let model = '';

    // 2. 自定义供应商需要额外输入
    if (provider === 'custom') {
        try {
            const hostPrompt = new Input({
                name: 'host',
                message: isZh ? '请输入 API Host' : 'Enter API Host',
                hint: isZh ? '例如: api.proxy.com' : 'e.g., api.proxy.com',
                validate: (val) => val.trim() ? true : (isZh ? 'Host 不能为空' : 'Host is required'),
            });
            host = await hostPrompt.run();
        } catch { return; }

        try {
            const pathPrompt = new Input({
                name: 'path',
                message: isZh ? '请输入 API Path' : 'Enter API Path',
                initial: '/v1/chat/completions',
            });
            apiPath = await pathPrompt.run();
        } catch { return; }
    }

    // 3. 输入模型名称
    if (provider !== 'custom') {
        const hints = {
            openai: 'gpt-4o, gpt-4o-mini, o3-mini',
            deepseek: 'deepseek-chat, deepseek-reasoner',
            gemini: 'gemini-2.5-flash, gemini-2.5-pro',
            claude: 'claude-sonnet-4-20250514',
            openrouter: 'openai/gpt-4o, anthropic/claude-sonnet-4-20250514',
        };

        try {
            const modelPrompt = new Input({
                name: 'model',
                message: isZh ? '请输入模型名称' : 'Enter Model Name',
                hint: hints[provider] || '',
                validate: (val) => val.trim() ? true : (isZh ? '模型名称不能为空' : 'Model name is required'),
            });
            model = await modelPrompt.run();
        } catch { return; }
    }

    // Gemini 特殊处理: path 包含 model 名称
    if (provider === 'gemini' && !apiPath) {
        apiPath = `/v1beta/models/${model}:generateContent`;
    }

    // 4. 输入 API Key（密码模式）
    let key;
    try {
        const keyPrompt = new Password({
            name: 'key',
            message: isZh ? '请输入 API Key' : 'Enter API Key',
            validate: (val) => val.trim() ? true : (isZh ? 'API Key 不能为空' : 'API Key is required'),
        });
        key = await keyPrompt.run();
    } catch { return; }

    // 5. 配置预览 & 确认
    console.log('');
    console.log(`  ${c.bold}${isZh ? '📋 配置预览:' : '📋 Configuration Preview:'}${c.reset}`);
    const previewConfig = {
        ai_provider: provider,
        ai_api_host: host,
        ai_api_path: apiPath,
        ...(model && { ai_model: model }),
        ai_api_key: key,
    };
    printConfigTable(previewConfig, isZh);
    console.log('');

    let confirmed = false;
    try {
        const confirmPrompt = new Confirm({
            name: 'save',
            message: isZh ? '确认保存此配置？' : 'Confirm and save this configuration?',
            initial: true,
        });
        confirmed = await confirmPrompt.run();
    } catch { return; }

    if (!confirmed) {
        console.log(`  ${c.red}${isZh ? '❌ 配置已取消。' : '❌ Configuration cancelled.'}${c.reset}`);
        return;
    }

    // 6. 保存配置
    setConfig('ai_provider', provider);
    setConfig('ai_api_key', key);
    if (host) setConfig('ai_api_host', host);
    if (apiPath) setConfig('ai_api_path', apiPath);
    if (model) setConfig('ai_model', model);

    console.log('');
    console.log(`  ${c.green}${isZh ? '✨ 配置已保存到 .i18ntrc！' : '✨ Configuration saved to .i18ntrc!'}${c.reset}`);
    console.log(`  ${c.dim}${isZh ? '现在可以运行 "i18nt translate" 来开始翻译。' : 'You can now run "i18nt translate" to start translating.'}${c.reset}`);
    console.log('');

    // 7. 可选：连接测试
    let testConnection = false;
    try {
        const testPrompt = new Confirm({
            name: 'test',
            message: isZh ? '是否要测试 API 连接？' : 'Would you like to test the API connection?',
            initial: true,
        });
        testConnection = await testPrompt.run();
    } catch { return; }

    if (testConnection) {
        console.log(`  ${c.cyan}${isZh ? '🔄 正在测试连接...' : '🔄 Testing connection...'}${c.reset}`);
        try {
            await testApiConnection(provider, host, apiPath, key, model);
            console.log(`  ${c.green}${isZh ? '✅ 连接成功！API 响应正常。' : '✅ Connection successful! API responding normally.'}${c.reset}`);
        } catch (err) {
            console.log(`  ${c.red}${isZh ? `❌ 连接失败: ${err.message}` : `❌ Connection failed: ${err.message}`}${c.reset}`);
        }
    } else {
        console.log(`  ${c.dim}${isZh ? '跳过连接测试。' : 'Skipping connection test.'}${c.reset}`);
    }
}

/**
 * 以表格形式打印配置项
 */
function printConfigTable(config, isZh) {
    const labels = {
        ai_provider: isZh ? '供应商' : 'Provider',
        ai_api_host: 'API Host',
        ai_api_path: 'API Path',
        ai_model: isZh ? '模型' : 'Model',
        ai_api_key: 'API Key',
    };
    const displayOrder = ['ai_provider', 'ai_api_host', 'ai_api_path', 'ai_model', 'ai_api_key'];

    for (const key of displayOrder) {
        if (config[key] === undefined) continue;
        const label = labels[key] || key;
        const value = key === 'ai_api_key'
            ? maskKey(config[key])
            : config[key];
        console.log(`  ${c.dim}│${c.reset} ${c.cyan}${label.padEnd(12)}${c.reset} ${value}`);
    }
}

/**
 * 遮罩 API Key，仅显示首尾各 4 个字符
 */
function maskKey(key) {
    if (!key || key.length <= 8) return '********';
    return key.slice(0, 4) + '****' + key.slice(-4);
}

/**
 * 测试 API 连接
 */
function testApiConnection(provider, host, apiPath, key, model) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout (10s)')), 10000);

        let payload = {};
        if (provider === 'gemini') {
            payload = { contents: [{ parts: [{ text: 'Hello' }] }] };
        } else if (provider === 'claude') {
            payload = { model, messages: [{ role: 'user', content: 'Hello' }], max_tokens: 10 };
        } else {
            payload = { model, messages: [{ role: 'user', content: 'Hello' }], max_tokens: 10 };
        }

        const data = JSON.stringify(payload);
        const options = {
            hostname: host,
            path: apiPath + (provider === 'gemini' ? `?key=${key}` : ''),
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
            timeout: 10000,
        };

        if (provider !== 'gemini' && provider !== 'claude') {
            options.headers['Authorization'] = `Bearer ${key}`;
        }
        if (provider === 'claude') {
            options.headers['x-api-key'] = key;
            options.headers['anthropic-version'] = '2023-06-01';
        }

        const req = https.request(options, (res) => {
            clearTimeout(timeout);
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 500) {
                    // 2xx-4xx 均视为 "连通"（4xx 说明认证问题但网络通）
                    if (res.statusCode >= 400) {
                        try {
                            const json = JSON.parse(body);
                            const msg = json.error?.message || json.message || `HTTP ${res.statusCode}`;
                            reject(new Error(msg));
                        } catch {
                            reject(new Error(`HTTP ${res.statusCode}`));
                        }
                    } else {
                        resolve(true);
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        });

        req.on('error', (e) => { clearTimeout(timeout); reject(e); });
        req.on('timeout', () => { req.destroy(); reject(new Error('Connection timeout')); });
        req.write(data);
        req.end();
    });
}

/**
 * 加载配置文件
 */
export function loadConfig() {
    const configPath = path.resolve(process.cwd(), CONFIG_FILE);
    if (fs.existsSync(configPath)) {
        try {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (e) {
            console.error(`[Error] Failed to parse ${CONFIG_FILE}: ${e.message}`);
        }
    }
    return {};
}

/**
 * 保存配置项
 */
export function setConfig(key, value) {
    const config = loadConfig();
    config[key] = value;
    const configPath = path.resolve(process.cwd(), CONFIG_FILE);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

/**
 * 获取配置项
 */
export function getConfig(key) {
    const config = loadConfig();
    return config[key];
}

/**
 * 运行 config 命令逻辑
 */
export function runConfigCommand(args) {
    const subCommand = args._?.[0] || (args.set ? 'set' : args.get ? 'get' : 'list');

    if (subCommand === 'init') {
        // 检测系统语言
        const sysLocale = Intl.DateTimeFormat().resolvedOptions().locale;
        const lang = sysLocale.startsWith('zh') ? 'zh-CN' : 'en-US';
        runInteractiveConfig(lang);
    } else if (subCommand === 'set') {
        const key = args.key || args._?.[1];
        const value = args.value || args._?.[2];
        if (!key || !value) {
            console.error('Usage: i18nt config set <key> <value>');
            return;
        }
        setConfig(key, value);
        console.log(`✅ Config set: ${key} = ${key.includes('key') ? '********' : value}`);
    } else if (subCommand === 'get') {
        const key = args.key || args._?.[1];
        if (!key) {
            console.error('Usage: i18nt config get <key>');
            return;
        }
        const val = getConfig(key);
        console.log(val !== undefined ? val : '(Not set)');
    } else {
        const config = loadConfig();
        if (Object.keys(config).length === 0) {
            console.log('No configuration found. Use "i18nt config init" to set up.');
        } else {
            console.log('');
            console.log(`  ${c.bold}--- Current Configuration ---${c.reset}`);
            const sysLocale = Intl.DateTimeFormat().resolvedOptions().locale;
            printConfigTable(config, sysLocale.startsWith('zh'));
            console.log('');
        }
    }
}
