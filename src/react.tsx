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
  setLocale: (lang: string) => void;
  availableLocales: string[];
  isRTL: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/** Provider Props */
export interface I18nProviderProps<T extends TranslationDict = TranslationDict> {
  config: I18nConfig<T>;
  children: ReactNode;
}

/**
 * I18n 上下文提供者
 *
 * @example
 * ```tsx
 * <I18nProvider config={{ translations, langOrder, locale: 'zh-CN' }}>
 *   <App />
 * </I18nProvider>
 * ```
 */
export function I18nProvider<T extends TranslationDict>({
  config,
  children,
}: I18nProviderProps<T>) {
  const [locale, setLocaleState] = useState(config.locale);

  const i18n = useMemo(
    () => createI18n({ ...config, locale }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, config.translations, config.langOrder],
  );

  const setLocale = useCallback((lang: string) => {
    setLocaleState(lang);
  }, []);

  // 同步 DOM 方向
  useEffect(() => {
    syncDocumentDirection(locale);
  }, [locale]);

  const contextValue = useMemo<I18nContextValue>(
    () => ({
      t: i18n.t as I18nContextValue['t'],
      locale,
      setLocale,
      availableLocales: i18n.availableLocales,
      isRTL: i18n.isRTL,
    }),
    [i18n, locale, setLocale],
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
