/**
 * i18nt — 核心翻译引擎
 * 零依赖 · Proxy 驱动 · Intl 标准化
 */
import type { I18nConfig, I18nInstance, TranslationDict, I18nManager } from './types.js';
export declare const getGlobalI18n: <T extends TranslationDict = any>() => I18nInstance<T>;
export declare const setGlobalI18n: <T extends TranslationDict = any>(instance: I18nInstance<T>) => void;
/**
 * 创建一个 i18n 实例
 *
 * @example
 * ```ts
 * const i18n = createI18n({
 *   translations: { hello: ['你好', 'Hello'] },
 *   langOrder: ['zh-CN', 'en-US'],
 *   locale: 'zh-CN',
 * });
 * i18n.t.hello // → "你好"
 * ```
 */
export declare function preCompile(dict: any): void;
export declare function createI18n<T extends TranslationDict>(config: I18nConfig<T>): I18nInstance<T>;
/**
 * 创建一个 i18n 实例管理器（用于同步多个实例，如微前端场景）
 */
export declare function createI18nManager(initialLocale: string): I18nManager;
