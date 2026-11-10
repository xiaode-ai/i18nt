/**
 * i18nt — React Native 适配层
 * 适配移动端 RTL 与原生状态同步
 */
import type { ReactNode } from 'react';
import type { I18nConfig, TranslationDict } from './types.js';
import { useI18n as useReactI18n } from './react.js';
/**
 * React Native 专用 Provider
 * 自动处理 I18nManager 的 RTL 同步
 */
export declare function I18nNativeProvider<T extends TranslationDict>({ config, children, }: {
    config: I18nConfig<T>;
    children: ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export { useReactI18n as useI18n };
