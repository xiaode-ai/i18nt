import fs from 'fs';
import path from 'path';
import readline from 'readline';

const CONFIG_FILE = '.i18ntrc';

/**
 * 交互式配置向导
 */
export async function runInteractiveConfig() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const question = (query) => new Promise((resolve) => rl.question(query, resolve));

    console.log('\n🚀 Welcome to i18nt AI Setup Wizard\n');

    // 1. 选择服务商
    console.log('Please select your AI Provider:');
    console.log('1. OpenAI');
    console.log('2. Gemini');
    console.log('3. DeepSeek');
    console.log('4. Claude');
    console.log('5. OpenRouter');
    console.log('6. Custom');
    const choice = await question('Enter number [1-6]: ');

    let provider = 'openai';
    let host = '';
    let path = '';
    let model = '';

    switch (choice) {
        case '1': provider = 'openai'; host = 'api.openai.com'; path = '/v1/chat/completions'; break;
        case '2': provider = 'gemini'; host = 'generativelanguage.googleapis.com'; path = ''; break;
        case '3': provider = 'deepseek'; host = 'api.deepseek.com'; path = '/v1/chat/completions'; break;
        case '4': provider = 'claude'; host = 'api.anthropic.com'; path = '/v1/messages'; break;
        case '5': provider = 'openrouter'; host = 'openrouter.ai'; path = '/api/v1/chat/completions'; break;
        case '6': 
            provider = 'custom';
            host = await question('Enter API Host (e.g., api.proxy.com): ');
            path = await question('Enter API Path (default: /v1/chat/completions): ') || '/v1/chat/completions';
            break;
    }

    if (provider !== 'custom') {
        model = await question(`Enter Model for ${provider} (e.g., gpt-4o, deepseek-chat): `);
        if (!model) {
            console.error('❌ Model is required!');
            rl.close();
            return;
        }
    }

    if (provider === 'gemini' && !path) {
        path = `/v1beta/models/${model}:generateContent`;
    }

    // 2. 输入 Key
    const key = await question(`Enter your API Key for ${provider}: `);
    if (!key) {
        console.error('❌ API Key is required!');
        rl.close();
        return;
    }

    // 3. 保存配置
    setConfig('ai_provider', provider);
    setConfig('ai_api_key', key);
    if (host) setConfig('ai_api_host', host);
    if (path) setConfig('ai_api_path', path);
    if (model) setConfig('ai_model', model);

    console.log('\n✨ Configuration saved to .i18ntrc successfully!\n');
    console.log('You can now run "npx i18nt translate" to start translating.\n');

    rl.close();
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
    console.log(`✅ Config set: ${key} = ${key.includes('key') ? '********' : value}`);
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
        runInteractiveConfig();
    } else if (subCommand === 'set') {
        const key = args.key || args._?.[1];
        const value = args.value || args._?.[2];
        if (!key || !value) {
            console.error('Usage: i18nt config set <key> <value>');
            return;
        }
        setConfig(key, value);
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
            console.log('No configuration found. Use "i18nt config set <key> <value>" to add one.');
        } else {
            console.log('--- Current Configuration ---');
            for (const [k, v] of Object.entries(config)) {
                console.log(`${k}: ${k.includes('key') ? '********' : v}`);
            }
        }
    }
}
