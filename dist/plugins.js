import { serverDetector as serverDetectorInternal } from './detectors.js';
/**
 * 浏览器语言自动探测插件
 */
export const browserDetector = () => ({
    name: 'browser-detector',
    onInit(i18n) {
        const lang = navigator.language;
        if (i18n.availableLocales.includes(lang)) {
            i18n.setLocale(lang);
        }
        else {
            const shortLang = lang.split('-')[0];
            const match = i18n.availableLocales.find(l => l.startsWith(shortLang));
            if (match)
                i18n.setLocale(match);
        }
    }
});
/**
 * 语言状态本地持久化插件
 */
export const languageCache = (key = 'i18nt-locale') => ({
    name: 'language-cache',
    onInit(i18n) {
        const cached = localStorage.getItem(key);
        if (cached && i18n.availableLocales.includes(cached)) {
            i18n.setLocale(cached);
        }
    },
    onLocaleChange(locale) {
        localStorage.setItem(key, locale);
    }
});
/**
 * 跨标签页状态同步插件
 */
export const syncPlugin = (key = 'i18nt-locale') => ({
    name: 'sync-plugin',
    onInit(i18n) {
        window.addEventListener('storage', (e) => {
            if (e.key === key && e.newValue && e.newValue !== i18n.locale) {
                i18n.setLocale(e.newValue);
            }
        });
    }
});
/**
 * [NEW] 多级缓存插件 (Memory -> LocalStorage -> Remote)
 * 显著提升远程字典加载的性能与离线可用性
 */
export const chainedCachePlugin = (options = {}) => {
    const { keyPrefix = 'i18nt-cache:', ttl = 24 * 60 * 60 * 1000 } = options;
    return {
        name: 'chained-cache',
        async onInit(i18n) {
            // 在初始化时，尝试从本地缓存恢复已有的所有翻译
            i18n.availableLocales.forEach(loc => {
                const cached = localStorage.getItem(`${keyPrefix}${loc}`);
                if (cached) {
                    try {
                        const { data, timestamp } = JSON.parse(cached);
                        if (Date.now() - timestamp < ttl) {
                            i18n.addTranslations(data, loc);
                        }
                    }
                    catch (e) {
                        localStorage.removeItem(`${keyPrefix}${loc}`);
                    }
                }
            });
        },
        onLocaleChange(locale, i18n) {
            // 当语言切换且远程字典加载成功后（通过 addTranslations 触发），持久化到本地
        },
        onTranslationsAdded(dict, locale) {
            // 只有当有实际内容时才缓存
            if (Object.keys(dict).length > 0) {
                localStorage.setItem(`${keyPrefix}${locale}`, JSON.stringify({
                    data: dict,
                    timestamp: Date.now()
                }));
            }
        }
    };
};
/**
 * [NEW] 可重试加载插件
 * 针对不稳定网络环境，提供自动重试机制
 */
export const retryableLoaderPlugin = (options = {}) => {
    const { maxRetries = 3, delay = 1000 } = options;
    return {
        name: 'retryable-loader',
        onInit(i18n) {
            const originalLoad = i18n.loadNamespace.bind(i18n);
            i18n.loadNamespace = async (name) => {
                let lastError;
                for (let i = 0; i < maxRetries; i++) {
                    try {
                        return await originalLoad(name);
                    }
                    catch (e) {
                        lastError = e;
                        console.warn(`[i18nt] Load namespace "${name}" failed, retrying (${i + 1}/${maxRetries})...`);
                        await new Promise(r => setTimeout(r, delay * Math.pow(2, i))); // 指数退避
                    }
                }
                throw lastError;
            };
        }
    };
};
/**
 * 远程字典加载插件 (基础版)
 */
export const remoteBackend = (config) => ({
    name: 'remote-backend',
    async onLocaleChange(locale, i18n) {
        try {
            const response = await fetch(config.loadUrl(locale));
            const data = await response.json();
            const dict = config.parse ? config.parse(data) : data;
            i18n.addTranslations(dict, locale);
        }
        catch (e) {
            console.error(`[i18nt] Failed to load remote dictionary for ${locale}:`, e);
        }
    }
});
/**
 * 缺失 Key 自动上报插件
 */
export const reportMissingKey = (config) => ({
    name: 'report-missing-key',
    onMissingKey(key, locale) {
        fetch(config.endpoint, {
            method: config.method || 'POST',
            headers: { 'Content-Type': 'application/json', ...config.headers },
            body: JSON.stringify({ key, locale, url: window.location.href, timestamp: Date.now() })
        }).catch(err => console.error('[i18nt] Failed to report missing key:', err));
    }
});
/**
 * HTTP Header 语言探测插件 (服务端常用)
 */
export const headerDetector = (headers) => ({
    name: 'header-detector',
    onInit(i18n) {
        const acceptLang = typeof headers.get === 'function'
            ? headers.get('accept-language')
            : headers['accept-language'];
        if (acceptLang) {
            const langs = acceptLang.split(',').map((l) => l.split(';')[0].trim());
            for (const lang of langs) {
                if (i18n.availableLocales.includes(lang)) {
                    i18n.setLocale(lang);
                    return;
                }
                const short = lang.split('-')[0];
                const match = i18n.availableLocales.find((l) => l.startsWith(short));
                if (match) {
                    i18n.setLocale(match);
                    return;
                }
            }
        }
    }
});
/**
 * 服务器端/Bun 语言探测插件
 */
export const serverDetector = () => ({
    name: 'server-detector',
    onInit(i18n) {
        const lang = serverDetectorInternal.lookup();
        if (lang) {
            const lng = Array.isArray(lang) ? lang[0] : lang;
            if (i18n.availableLocales.includes(lng)) {
                i18n.setLocale(lng);
            }
            else {
                const shortLang = lng.split('-')[0];
                const match = i18n.availableLocales.find(l => l.startsWith(shortLang));
                if (match)
                    i18n.setLocale(match);
            }
        }
    }
});
/**
 * Bun 专用语言探测插件 (serverDetector 的别名)
 */
export const bunDetector = serverDetector;
