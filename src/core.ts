/**
 * i18nt — 核心翻译引擎
 * 零依赖 · Proxy 驱动 · Intl 标准化
 */

import type { I18nConfig, I18nInstance, TranslationDict, TranslationValue } from './types.js';
import { isRTLLocale, syncDocumentDirection } from './rtl.js';
import { parseICU, formatICU } from './icu.js';

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

  function processExplicitValue(value: unknown, targetLocale: string): { matched: boolean; content: unknown } {
    if (typeof value === 'string') {
      const match = value.match(/^([a-zA-Z0-9-]+):\s*(.*)$/);
      if (match) {
        if (match[1] === targetLocale) {
          return { matched: true, content: match[2] };
        }
        // 如果标签是本项目已知的其他语言，则视为不匹配
        if (allLangs.includes(match[1])) {
          return { matched: false, content: undefined };
        }
      }
    }
    return { matched: true, content: value };
  }

  function extractArrayValue(entry: unknown[], targetLocale: string, idx: number): unknown {
    // 1. 尝试匹配目标语言的显式语法 `lang: value`
    const targetMatch = processExplicitValue(null, targetLocale); // 获取空的 matched 逻辑
    for (const item of entry) {
      const { matched, content } = processExplicitValue(item, targetLocale);
      if (matched && content !== item) return content;
    }

    // 2. 尝试匹配回退语言的显式语法 (顺序无关)
    const fallbackLocale = allLangs[idx];
    if (fallbackLocale && fallbackLocale !== targetLocale) {
      for (const item of entry) {
        const { matched, content } = processExplicitValue(item, fallbackLocale);
        if (matched && content !== item) return content;
      }
    }

    // 3. 彻底回退到按索引取值
    const fallbackValue = entry[idx];
    const { matched, content } = processExplicitValue(fallbackValue, targetLocale);
    if (matched) return content;

    // 4. 最后的最后：如果索引处是其它语言的显式语法，提取其内容作为最后兜底
    if (typeof fallbackValue === 'string') {
      const match = fallbackValue.match(/^([a-zA-Z0-9-]+):\s*(.*)$/);
      if (match) return match[2];
    }
    return fallbackValue;
  }

  /** 根据当前语言构建嵌套字典 */
  function buildDict(locale: string): Record<string, any> {
    const langIndex = allLangs.indexOf(locale);
    const isCoreLang = langIndex !== -1 && langIndex < langOrder.length;
    const arrayIdx = isCoreLang ? langIndex : fallbackIndex;

    // 获取动态字典（如果有）
    const extraIndex = langIndex - langOrder.length;
    const sourceDict = (extraIndex >= 0 ? extraDicts[extraIndex] : {}) as Record<string, unknown>;

    function resolveNested(source: any, extraSource?: any): any {
      if (Array.isArray(source)) {
        // 核心翻译数组：首先尝试匹配显式标识，然后回退
        // 这里的逻辑与之前的类似，但需要处理额外字典的覆盖
        if (extraSource !== undefined) {
          const { matched, content } = processExplicitValue(extraSource, locale);
          if (matched) return content;
        }
        return extractArrayValue(source, locale, arrayIdx);
      }

      if (typeof source === 'object' && source !== null) {
        // 如果是复数对象，直接返回（translate 处理）
        if ('other' in source || 'one' in source) {
          return source;
        }
        // 处理嵌套命名空间
        const result: Record<string, any> = {};
        for (const key in source) {
          result[key] = resolveNested(source[key], extraSource?.[key]);
        }
        return result;
      }

      return source;
    }

    return resolveNested(translations, sourceDict);
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

    // 核心翻译部件缓存
    const icuCache = new Map<string, any>();

    // 核心翻译函数
    const translate = (path: string, params?: Record<string, unknown>): string => {
      // 路径解析
      const keys = path.split('.');
      let content: any = dict;
      for (const k of keys) {
        content = content?.[k];
        if (content === undefined) break;
      }

      // Missing Key 警告
      if (content === undefined) {
        if (devWarnings && path) {
          console.warn(`[i18nt] Missing path: "${path}" in locale: "${locale}"`);
        }
        return path;
      }

      // 如果是纯字符串，使用 ICU 格式化
      if (typeof content === 'string') {
        let parts = icuCache.get(content);
        if (!parts) {
          parts = parseICU(content);
          icuCache.set(content, parts);
        }
        return formatICU(parts, params || {}, locale);
      }

      // 复数逻辑：如果 content 是对象且包含 plural 关键字（旧版复数）
      if (typeof content === 'object' && content !== null && !Array.isArray(content)) {
        if ('other' in content || 'one' in content) {
          const count = (params?.count as number) ?? 0;
          const rule = pluralRules.select(count);
          const resolved = (content as any)[rule] || (content as any).other || '';
          // 如果解析出的依然是字符串，则进行 ICU 格式化
          let parts = icuCache.get(resolved);
          if (!parts) {
            parts = parseICU(resolved);
            icuCache.set(resolved, parts);
          }
          return formatICU(parts, { ...params, count }, locale);
        }
        // 如果是纯命名空间对象，返回路径
        return path;
      }

      return String(content);
    };

    // 创建递归代理
    function createRecursiveProxy(targetPath: string = ''): any {
        const fn = (pathOrParams?: string | Record<string, unknown>, params?: Record<string, unknown>) => {
            if (typeof pathOrParams === 'string') {
                const currentPath = targetPath ? `${targetPath}.${pathOrParams}` : pathOrParams;
                return translate(currentPath, params);
            }
            return translate(targetPath, pathOrParams as Record<string, unknown>);
        };
        
        return new Proxy(fn, {
            get: (_target, prop) => {
                if (typeof prop !== 'string') return undefined;
                if (prop in formatters) return (formatters as any)[prop];

                // 常用属性忽略，避免某些框架误判
                if (prop === '$$typeof' || prop === 'then' || prop === 'toJSON') return undefined;

                const currentPath = targetPath ? `${targetPath}.${prop}` : prop;
                
                // 探测路径对应的内容
                const keys = currentPath.split('.');
                let val: any = dict;
                for (const k of keys) {
                    val = val?.[k];
                    if (val === undefined) break;
                }

                if (val !== undefined) {
                    // 如果是对象且不是数组，则是命名空间
                    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                        // 如果是复数对象，则它是一个叶子节点
                        if (!('other' in val || 'one' in val)) {
                            return createRecursiveProxy(currentPath);
                        }
                    }
                    // 否则是叶子节点（字符串、数组、复数对象），返回 translate 结果（字符串）
                    return translate(currentPath);
                }

                return undefined;
            }
        });
    }

    return createRecursiveProxy();
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
