/**
 * i18nt — Vue 3 适配层
 * 提供 Composition API 支持
 */
import { type App } from 'vue';
import type { I18nConfig, I18nInstance, TranslationDict } from './types.js';
/** Vue 适配器返回的对象 */
export interface VueI18n<T extends TranslationDict = TranslationDict> {
    /** 翻译代理对象 */
    t: I18nInstance<T>['t'];
    /** 当前语言 */
    locale: string;
    /** 切换语言 */
    setLocale: I18nInstance<T>['setLocale'];
    /** 所有可用语言 */
    availableLocales: string[];
    /** 是否为 RTL */
    isRTL: boolean;
    loadNamespace: I18nInstance<T>['loadNamespace'];
    addTranslations: I18nInstance<T>['addTranslations'];
}
/**
 * 创建 Vue 插件
 * @param input 可以是配置对象，也可以是已存在的 i18n 实例
 */
export declare function createI18nPlugin<T extends TranslationDict>(input: I18nConfig<T> | I18nInstance<T>): {
    install(app: App): void;
};
/**
 * 在组件中使用 i18n
 */
export declare function useI18n<T extends TranslationDict = TranslationDict>(): VueI18n<T>;
