import type { I18nPlugin, TranslationDict } from './types.js';

/**
 * 语言探测插件：自动从 Cookie, LocalStorage, Navigator 探测语言
 */
export function browserDetector<T extends TranslationDict>(options: {
    cookieKey?: string;
    storageKey?: string;
    order?: ('cookie' | 'storage' | 'navigator')[];
} = {}): I18nPlugin<T> {
    const { 
        cookieKey = 'i18next_lng', 
        storageKey = 'i18next_lng', 
        order = ['storage', 'cookie', 'navigator'] 
    } = options;

    return {
        name: 'browserDetector',
        onInit(instance) {
            if (typeof window === 'undefined') return;
            let found: string | undefined;
            for (const method of order) {
                if (method === 'storage' && typeof localStorage !== 'undefined') {
                    found = localStorage.getItem(storageKey) || undefined;
                } else if (method === 'cookie') {
                    const match = document.cookie.match(new RegExp('(^| )' + cookieKey + '=([^;]+)'));
                    found = match ? match[2] : undefined;
                } else if (method === 'navigator' && typeof navigator !== 'undefined') {
                    found = (navigator.languages && navigator.languages[0]) || navigator.language;
                }
                if (found && instance.availableLocales.includes(found)) break;
            }
            if (found && found !== instance.locale) {
                instance.setLocale(found);
            }
        }
    };
}

/**
 * 跨标签页同步插件：利用 Storage 事件同步语言状态
 */
export function syncPlugin<T extends TranslationDict>(options: {
    storageKey?: string;
} = {}): I18nPlugin<T> {
    const { storageKey = 'i18next_lng' } = options;
    return {
        name: 'syncPlugin',
        onInit(instance) {
            if (typeof window === 'undefined') return;
            window.addEventListener('storage', (e) => {
                if (e.key === storageKey && e.newValue && e.newValue !== instance.locale) {
                    if (instance.availableLocales.includes(e.newValue)) {
                        instance.setLocale(e.newValue);
                    }
                }
            });
        }
    };
}

/**
 * 语言持久化插件：切换语言时自动同步到 Storage
 */
export function languageCache<T extends TranslationDict>(options: {
    storageKey?: string;
} = {}): I18nPlugin<T> {
    const { storageKey = 'i18next_lng' } = options;
    return {
        name: 'languageCache',
        onLocaleChange(locale) {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(storageKey, locale);
            }
        }
    };
}

/**
 * 开发调试增强插件：在控制台打印翻译缺失警告
 */
export function devLogger<T extends TranslationDict>(): I18nPlugin<T> {
    return {
        name: 'devLogger',
        onMissingKey(path, locale) {
            console.warn(`[i18nt] ⚠️ Missing Key: "${path}" in locale: "${locale}"`);
        },
        onLocaleChange(locale) {
            console.log(`[i18nt] 🌐 Locale changed to: ${locale}`);
        }
    };
}

/**
 * SSR 语言探测插件：从 Request Header (Accept-Language) 探测语言
 * 适用于 Node.js / Next.js / Cloudflare Workers 等环境
 */
export function headerDetector<T extends TranslationDict>(
    headers: Record<string, string | string[] | undefined> | { get: (name: string) => string | null }
): I18nPlugin<T> {
    return {
        name: 'headerDetector',
        onInit(instance) {
            const acceptLang = typeof (headers as any).get === 'function' 
                ? (headers as any).get('accept-language')
                : (headers as any)['accept-language'];
                
            if (typeof acceptLang === 'string') {
                const found = acceptLang.split(',')[0].split(';')[0].trim();
                if (instance.availableLocales.includes(found)) {
                    instance.setLocale(found);
                } else {
                    // 尝试匹配前缀，如 zh-CN 匹配 zh
                    const short = found.split('-')[0];
                    const matched = instance.availableLocales.find(l => l.startsWith(short));
                    if (matched) instance.setLocale(matched);
                }
            }
        }
    };
}
