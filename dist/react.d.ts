/**
 * i18nt — React 适配层
 * I18nProvider + useI18n Hook
 */
import type { ReactNode } from 'react';
import type { I18nConfig, I18nInstance, TranslationDict } from './types.js';
/** Context 类型 */
interface I18nContextValue<T extends TranslationDict = TranslationDict> {
    t: I18nInstance<T>['t'];
    locale: string;
    setLocale: I18nInstance<T>['setLocale'];
    availableLocales: string[];
    isRTL: boolean;
    loadNamespace: I18nInstance<T>['loadNamespace'];
    addTranslations: I18nInstance<T>['addTranslations'];
}
/** Provider Props */
export interface I18nProviderProps<T extends TranslationDict = TranslationDict> {
    /** 配置对象（将创建新实例）或已存在的 i18n 实例 */
    config?: I18nConfig<T>;
    instance?: I18nInstance<T>;
    children: ReactNode;
}
/**
 * I18n 上下文提供者
 */
export declare function I18nProvider<T extends TranslationDict>({ config, instance: externalInstance, children, }: I18nProviderProps<T>): import("react/jsx-runtime").JSX.Element;
/**
 * 在 React 组件中获取 i18n 实例
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { t, locale, setLocale } = useI18n();
 *   return <h1>{t.hello}</h1>;
 * }
 * ```
 */
export declare function useI18n<T extends TranslationDict = TranslationDict>(): I18nContextValue<T>;
export {};
