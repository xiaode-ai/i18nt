import { jsx as _jsx } from "react/jsx-runtime";
/**
 * i18nt — React 适配层
 * I18nProvider + useI18n Hook
 */
import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { createI18n } from './core.js';
const I18nContext = createContext(null);
/**
 * I18n 上下文提供者
 */
export function I18nProvider({ config, instance: externalInstance, children, }) {
    // 创建一个稳定的 i18n 实例
    const [i18n] = useState(() => {
        if (externalInstance)
            return externalInstance;
        if (config)
            return createI18n(config);
        throw new Error('[i18nt] I18nProvider requires either "config" or "instance" prop');
    });
    const [tick, setTick] = useState(0);
    // 订阅变更，触发重新渲染
    useEffect(() => {
        return i18n.onChange(() => {
            setTick((t) => t + 1);
        });
    }, [i18n]);
    const contextValue = useMemo(() => ({
        t: i18n.t,
        locale: i18n.locale,
        setLocale: i18n.setLocale.bind(i18n),
        availableLocales: i18n.availableLocales,
        isRTL: i18n.isRTL,
        loadNamespace: i18n.loadNamespace.bind(i18n),
        addTranslations: i18n.addTranslations.bind(i18n),
    }), 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i18n, tick]);
    return _jsx(I18nContext.Provider, { value: contextValue, children: children });
}
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
export function useI18n() {
    const ctx = useContext(I18nContext);
    if (!ctx) {
        throw new Error('[i18nt] useI18n must be used within an <I18nProvider>');
    }
    return ctx;
}
