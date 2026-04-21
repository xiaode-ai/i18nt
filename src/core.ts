/**
 * i18nt — 核心翻译引擎
 * 零依赖 · Proxy 驱动 · Intl 标准化
 */

import type { I18nConfig, I18nInstance, TranslationDict, TranslationValue } from './types.js';
import { isRTLLocale, syncDocumentDirection } from './rtl.js';
import { parseICU, formatICU, formatICUChunks } from './icu.js';

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
    onLocaleChange,
    onMissingKey,
    formatters: customFormatters,
    loaders,
    otaLoader,
    fallbacks = {},
    plugins = [],
  } = config;

  const listeners = new Set<(locale: string) => void>();
  if (onLocaleChange) listeners.add(onLocaleChange);

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
    const fallbackLocales = fallbacks[locale] || [];
    const chain = [locale, ...(Array.isArray(fallbackLocales) ? fallbackLocales : [fallbackLocales])];
    const defaultLocale = langOrder[fallbackIndex] || langOrder[0];
    if (!chain.includes(defaultLocale)) chain.push(defaultLocale);

    function resolveNested(source: any, localeChain: string[]): any {
      const currentLoc = localeChain[0];
      
      // 动态计算当前语种在 langOrder 中的索引
      const currentArrayIdx = langOrder.indexOf(currentLoc);

      // 1. 尝试匹配额外字典（如果有）
      const relevantExtraDicts = extraLangs
        .map((l, i) => (l === currentLoc ? extraDicts[i] : null))
        .filter((d): d is TranslationDict => d !== null);

      function resolveWithExtras(src: any, extras: any[], loc: string, aIdx: number): any {
        const lead = src !== undefined ? src : extras.find((ex) => ex !== undefined);
        if (lead === undefined) return undefined;

        if (Array.isArray(lead)) {
          for (let i = extras.length - 1; i >= 0; i--) {
            const ex = extras[i];
            if (Array.isArray(ex)) return extractArrayValue(ex, loc, aIdx);
            if (ex !== undefined) {
              const { matched, content } = processExplicitValue(ex, loc);
              if (matched) return content;
            }
          }
          return Array.isArray(src) ? extractArrayValue(src, loc, aIdx) : src;
        }

        if (typeof lead === 'object' && lead !== null && !('other' in lead || 'one' in lead)) {
          const result: Record<string, any> = {};
          let hasValue = false;
          const allKeys = new Set(Object.keys(src || {}));
          for (const ex of extras) {
            if (typeof ex === 'object' && ex !== null) {
              for (const k in ex) allKeys.add(k);
            }
          }
          for (const key of allKeys) {
            const val = resolveWithExtras(src?.[key], extras.map(ex => ex?.[key]), loc, aIdx);
            if (val !== undefined) {
              result[key] = val;
              hasValue = true;
            }
          }
          return hasValue ? result : undefined;
        }

        for (let i = extras.length - 1; i >= 0; i--) {
          const ex = extras[i];
          if (ex !== undefined) {
            const { matched, content } = processExplicitValue(ex, loc);
            if (matched) return content;
          }
        }
        return src;
      }

      const currentResult = resolveWithExtras(source, relevantExtraDicts, currentLoc, currentArrayIdx);

      // 如果当前层级依然是 undefined 且链条还有后续，则继续回退
      if (currentResult === undefined && localeChain.length > 1) {
        return resolveNested(source, localeChain.slice(1));
      }

      // 如果是命名空间对象，由于对象合并的特殊性，需要深度回退合并
      if (typeof currentResult === 'object' && currentResult !== null && !Array.isArray(currentResult) && !('other' in currentResult || 'one' in currentResult)) {
          if (localeChain.length > 1) {
              const nextResult = resolveNested(source, localeChain.slice(1));
              if (typeof nextResult === 'object' && nextResult !== null) {
                  // 深度合并当前层级和回退层级
                  const merged = { ...nextResult };
                  deepMerge(merged, currentResult);
                  return merged;
              }
          }
      }

      return currentResult;
    }

    return resolveNested(translations, chain);
  }

  function deepMerge(target: any, source: any) {
    for (const key in source) {
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
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
      ...customFormatters,
    };

    // 核心翻译部件缓存
    const icuCache = new Map<string, any>();

    // 核心翻译函数
    const translate = (path: string, params?: Record<string, unknown>): any => {
      // 路径解析
      const keys = path.split('.');
      let content: any = dict;
      for (const k of keys) {
        content = content?.[k];
        if (content === undefined) {
          if (onMissingKey) onMissingKey(path, locale);
          plugins.forEach(p => p.onMissingKey?.(path, locale, instance));
          break;
        }
      }

      // Missing Key 警告
      if (content === undefined) {
        if (devWarnings && path) {
          console.warn(`[i18nt] Missing path: "${path}" in locale: "${locale}"`);
        }
        return path;
      }

      // 如果是字符串或已解析的 AST 数组，使用 ICU 格式化
      if (typeof content === 'string' || Array.isArray(content)) {
        let parts: any;
        if (Array.isArray(content)) {
          parts = content;
        } else {
          parts = icuCache.get(content);
          if (!parts) {
            parts = parseICU(content);
            icuCache.set(content, parts);
          }
        }

        // 判断是否需要返回片段数组 (如果参数包含函数，或者字符串包含标签语法)
        const hasFunction = params && Object.values(params).some(v => typeof v === 'function');
        const hasTags = content.includes('<') && content.includes('>');
        
        if (hasFunction || hasTags) {
            const chunks = formatICUChunks(parts, params || {}, locale, formatters);
            // 如果只有一个字符串片段且没有函数，回退到普通字符串
            if (chunks.length === 1 && typeof chunks[0] === 'string' && !hasFunction) return chunks[0];
            return chunks;
        }

        return formatICU(parts, params || {}, locale, formatters);
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
                    // 否则是叶子节点（字符串、数组、复数对象）或缺失节点，返回 translate 结果
                    return translate(currentPath);
                }

                // 缺失路径，调用 translate 以触发钩子并返回路径字符串
                return translate(currentPath);
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
    async setLocale(lang: string, options?: { extraDicts?: TranslationDict[]; extraLangs?: string[] }) {
      if (options?.extraDicts) {
        const targetLangs = options.extraLangs || new Array(options.extraDicts.length).fill(lang);
        for (let i = 0; i < options.extraDicts.length; i++) {
          const dict = options.extraDicts[i];
          const l = targetLangs[i];
          extraDicts.push(dict);
          extraLangs.push(l);
          if (!allLangs.includes(l)) allLangs.push(l);
        }
      }

      // 如果有 OTA 加载器，则加载远程字典
      if (otaLoader && !options?.extraDicts) {
        try {
          const remoteDict = await otaLoader(lang);
          instance.addTranslations(remoteDict, lang);
        } catch (e) {
          if (devWarnings) console.error(`[i18nt] OTA load failed for "${lang}":`, e);
        }
      }
      
      if (lang === currentLocale && !options) return;
      currentLocale = lang;
      translator = createTranslator(lang);
      syncDocumentDirection(lang);
      
      // 触发监听者
      listeners.forEach(fn => fn(lang));
      // 触发插件
      plugins.forEach(p => p.onLocaleChange?.(lang, instance));
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    addTranslations(dict, lang) {
      const targetLang = lang || currentLocale;
      if (targetLang === langOrder[0] || langOrder.includes(targetLang)) {
        // 合并到核心字典 (简单合并)
        deepMerge(translations, dict);
      } else {
        // 合并到额外字典
        const idx = extraLangs.indexOf(targetLang);
        if (idx !== -1) {
          deepMerge(extraDicts[idx], dict);
        } else {
          extraDicts.push(dict);
          extraLangs.push(targetLang);
          if (!allLangs.includes(targetLang)) allLangs.push(targetLang);
        }
      }
      // 重新生成 translator
      translator = createTranslator(currentLocale);
    },
    async loadNamespace(name) {
      if (!loaders?.[name]) {
          if (devWarnings) console.warn(`[i18nt] No loader found for namespace: "${name}"`);
          return;
      }
      try {
          const module = await loaders[name]();
          const dict = ('default' in module ? module.default : module) as TranslationDict;
          instance.addTranslations(dict);
      } catch (e: any) {
          if (devWarnings) console.error(`[i18nt] Failed to load namespace "${name}":`, e);
      }
    },
    unloadNamespace(name) {
      // 这里的卸载是基于 Key 的简单清理，由于 deepMerge 是合并，卸载需要特定逻辑
      // 实际上，对于极致精简，我们可以重置 translations 然后重新合并需要的块
      // 但对于 3KB 库，我们提供一个简单的 Key 移除机制
      if (translations[name]) {
          delete translations[name];
          translator = createTranslator(currentLocale);
      }
    }
  };

  // 初始化插件
  plugins.forEach(p => p.onInit?.(instance));

  // 初始化时同步 DOM 方向
  syncDocumentDirection(currentLocale);

  return instance;
}
