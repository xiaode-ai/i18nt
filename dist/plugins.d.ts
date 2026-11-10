import type { I18nPlugin, TranslationDict } from './types.js';
/**
 * 浏览器语言自动探测插件
 */
export declare const browserDetector: () => I18nPlugin;
/**
 * 语言状态本地持久化插件
 */
export declare const languageCache: (key?: string) => I18nPlugin;
/**
 * 跨标签页状态同步插件
 */
export declare const syncPlugin: (key?: string) => I18nPlugin;
/**
 * [NEW] 多级缓存插件 (Memory -> LocalStorage -> Remote)
 * 显著提升远程字典加载的性能与离线可用性
 */
export declare const chainedCachePlugin: (options?: {
    keyPrefix?: string;
    ttl?: number;
}) => I18nPlugin;
/**
 * [NEW] 可重试加载插件
 * 针对不稳定网络环境，提供自动重试机制
 */
export declare const retryableLoaderPlugin: (options?: {
    maxRetries?: number;
    delay?: number;
}) => I18nPlugin;
/**
 * 远程字典加载插件 (基础版)
 */
export declare const remoteBackend: (config: {
    loadUrl: (locale: string) => string;
    parse?: (data: any) => TranslationDict;
}) => I18nPlugin;
/**
 * 缺失 Key 自动上报插件
 */
export declare const reportMissingKey: (config: {
    endpoint: string;
    method?: string;
    headers?: Record<string, string>;
}) => I18nPlugin;
/**
 * HTTP Header 语言探测插件 (服务端常用)
 */
export declare const headerDetector: (headers: Record<string, string | null> | {
    get: (n: string) => string | null;
}) => any;
/**
 * 服务器端/Bun 语言探测插件
 */
export declare const serverDetector: () => I18nPlugin;
/**
 * Bun 专用语言探测插件 (serverDetector 的别名)
 */
export declare const bunDetector: () => I18nPlugin;
