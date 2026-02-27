/**
 * i18nt — 核心翻译引擎
 * 零依赖 · Proxy 驱动 · Intl 标准化
 */

import type { I18nConfig, I18nInstance, TranslationDict } from './types.js';
import { isRTLLocale, syncDocumentDirection } from './rtl.js';

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
export function createI18n<T extends TranslationDict>(
  config: I18nConfig<T>,
): I18nInstance<T> {
  const {
    translations,
    langOrder,
    locale: initialLocale,
    fallbackIndex = 0,
    extraDicts = [],
    extraLangs = [],
    devWarnings = true,
  } = config;

  // 合并所有可用语言
  const allLangs: string[] = [...langOrder, ...extraLangs];

  // 内部状态
  let currentLocale = initialLocale;

  function extractArrayValue(entry: unknown[], targetLocale: string, idx: number): unknown {
    // 1. 尝试匹配显式语法 `lang: value`
    for (const item of entry) {
      if (typeof item === 'string') {
        const match = item.match(/^([a-zA-Z0-9-]+):\s*(.*)$/);
        if (match && match[1] === targetLocale) {
          return match[2];
        }
      }
    }

    // 2. 回退到按索引取值 (默认最简语法)
    const fallbackValue = entry[idx];
    if (typeof fallbackValue === 'string') {
      const match = fallbackValue.match(/^([a-zA-Z0-9-]+):\s*(.*)$/);
      if (match && allLangs.includes(match[1])) {
        // 如果按索引取到的恰好是本项目其他语言的显式语法形式，只提取值
        return match[2];
      }
    }

    return fallbackValue;
  }

  /** 根据当前语言构建扁平字典 */
  function buildDict(locale: string): Record<string, unknown> {
    const langIndex = allLangs.indexOf(locale);
    const dict: Record<string, unknown> = {};

    if (langIndex !== -1 && langIndex < langOrder.length) {
      // 核心语言：从数组中按索引取值或匹配显式语言标识
      for (const key in translations) {
        const entry = translations[key];
        if (Array.isArray(entry)) {
          dict[key] = extractArrayValue(entry, locale, langIndex);
        }
      }
    } else {
      // 动态语言：从 extraDicts 取值，缺失回退
      const extraIndex = langIndex - langOrder.length;
      const sourceDict = extraIndex >= 0 ? extraDicts[extraIndex] : {};
      for (const key in translations) {
        const entry = translations[key];
        if (Array.isArray(entry)) {
          dict[key] = (sourceDict as Record<string, unknown>)?.[key] ?? extractArrayValue(entry, locale, fallbackIndex);
        }
      }
    }

    return dict;
  }

  /** 创建增强版 translate 函数 */
  function createTranslator(locale: string) {
    const dict = buildDict(locale);
    const pluralRules = new Intl.PluralRules(locale);

    // Intl 格式化助手
    const formatters = {
      n: (val: number, options?: Intl.NumberFormatOptions) =>
        new Intl.NumberFormat(locale, options).format(val),
      formatNumber: (val: number, options?: Intl.NumberFormatOptions) =>
        new Intl.NumberFormat(locale, options).format(val),
      d: (val: Date | number, options?: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat(locale, options).format(val),
      formatDate: (val: Date | number, options?: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat(locale, options).format(val),
      relative: (val: number, unit: Intl.RelativeTimeFormatUnit) =>
        new Intl.RelativeTimeFormat(locale).format(val, unit),
      formatRelative: (val: number, unit: Intl.RelativeTimeFormatUnit) =>
        new Intl.RelativeTimeFormat(locale).format(val, unit),
    };

    // 核心翻译函数
    const translate = (key: string, params?: Record<string, unknown>): string => {
      let content = dict[key];

      // Missing Key 警告
      if (content === undefined) {
        if (devWarnings) {
          console.warn(`[i18nt] Missing key: "${key}" in locale: "${locale}"`);
        }
        return key;
      }
      if (!content) return key;

      // 复数处理
      if (params && typeof content === 'object' && !Array.isArray(content)) {
        const count = (params.count as number) ?? 0;
        const rule = pluralRules.select(count);
        content = (content as Record<string, string>)[rule] || (content as Record<string, string>).other || '';
      }

      if (typeof content !== 'string') return key;

      // 变量插值 {{var}}
      if (params) {
        for (const p of Object.keys(params)) {
          content = (content as string).replace(
            new RegExp(`\\{\\{${p}\\}\\}`, 'g'),
            String(params[p]),
          );
        }
      }

      return content as string;
    };

    // Proxy：支持 t.key 属性访问 + t.n() 等助手
    return new Proxy(translate, {
      get: (_target, prop) => {
        // 格式化助手
        if (prop in formatters) return formatters[prop as keyof typeof formatters];

        // 字典属性访问
        if (typeof prop === 'string' && prop in dict) {
          return translate(prop);
        }

        return undefined;
      },
    });
  }

  // 初始化
  let translator = createTranslator(currentLocale);

  const instance: I18nInstance<T> = {
    get t() {
      return translator as I18nInstance<T>['t'];
    },
    get locale() {
      return currentLocale;
    },
    get isRTL() {
      return isRTLLocale(currentLocale);
    },
    get availableLocales() {
      return [...allLangs];
    },
    setLocale(lang: string) {
      if (lang === currentLocale) return;
      currentLocale = lang;
      translator = createTranslator(lang);
      syncDocumentDirection(lang);
    },
  };

  // 初始化时同步 DOM 方向
  syncDocumentDirection(currentLocale);

  return instance;
}
