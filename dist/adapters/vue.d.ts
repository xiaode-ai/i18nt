import type { Plugin } from 'vue';
import type { I18nInstance } from '../types';
/**
 * i18nt Vue 插件
 */
export declare function createI18nPlugin(instance: I18nInstance): Plugin;
/**
 * i18nt Vue 组合式 API
 * 返回响应式的语言状态
 */
export declare function useI18n<T extends I18nInstance = I18nInstance>(): {
    instance: T;
    locale: import("vue").Ref<string, string>;
    t: T["t"];
};
