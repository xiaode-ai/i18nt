import * as React from 'react';
import type { I18nInstance } from '../types';
/**
 * i18nt React 提供者
 */
export declare function I18nProvider({ instance, children }: {
    instance: I18nInstance;
    children: any;
}): React.FunctionComponentElement<React.ProviderProps<I18nInstance<import("..").TranslationDict> | null>>;
/**
 * i18nt React 钩子
 * 自动订阅语言切换并触发组件重绘
 */
export declare function useI18n<T extends I18nInstance = I18nInstance>(): T;
