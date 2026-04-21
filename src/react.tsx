/**
 * i18nt — React 适配层
 * I18nProvider + useI18n Hook
 */

import { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { createI18n } from './core.js';
import type { I18nConfig, I18nInstance, TranslationDict } from './types.js';
import { syncDocumentDirection } from './rtl.js';

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

const I18nContext = createContext<I18nContextValue | null>(null);

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
export function I18nProvider<T extends TranslationDict>({
  config,
  instance: externalInstance,
  children,
}: I18nProviderProps<T>) {
  // 创建一个稳定的 i18n 实例
  const [i18n] = useState(() => {
    if (externalInstance) return externalInstance;
    if (config) return createI18n(config);
    throw new Error('[i18nt] I18nProvider requires either "config" or "instance" prop');
  });
  const [tick, setTick] = useState(0);

  // 订阅变更，触发重新渲染
  useEffect(() => {
    return i18n.onChange(() => {
      setTick((t) => t + 1);
    });
  }, [i18n]);

  const contextValue = useMemo<I18nContextValue>(
    () => ({
      t: i18n.t as I18nContextValue['t'],
      locale: i18n.locale,
      setLocale: i18n.setLocale.bind(i18n),
      availableLocales: i18n.availableLocales,
      isRTL: i18n.isRTL,
      loadNamespace: i18n.loadNamespace.bind(i18n),
      addTranslations: i18n.addTranslations.bind(i18n),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i18n, tick],
  );

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
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
export function useI18n<T extends TranslationDict = TranslationDict>(): I18nContextValue<T> {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('[i18nt] useI18n must be used within an <I18nProvider>');
  }
  return ctx as I18nContextValue<T>;
}
