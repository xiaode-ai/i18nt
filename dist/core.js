/**
 * i18nt — 核心翻译引擎
 * 零依赖 · Proxy 驱动 · Intl 标准化
 */
import { isRTLLocale, syncDocumentDirection } from './rtl.js';
import { parseICU, compileICU, compileICUChunks, escapeHtml, getIntl, extractVariables } from './icu.js';
import { BUILTIN_DETECTORS } from './detectors.js';
let globalInstance = null;
export const getGlobalI18n = () => globalInstance;
export const setGlobalI18n = (instance) => {
    globalInstance = instance;
};
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
export function preCompile(dict) {
    if (typeof dict !== 'object' || dict === null)
        return;
    for (const key in dict) {
        const val = dict[key];
        if (typeof val === 'string') {
            if (val.includes('{') || val.includes('<')) {
                dict[key] = parseICU(val);
            }
        }
        else if (Array.isArray(val)) {
            const isAST = val.some(i => typeof i === 'object' && i !== null && 'type' in i);
            if (!isAST) {
                for (let i = 0; i < val.length; i++) {
                    if (typeof val[i] === 'string' && (val[i].includes('{') || val[i].includes('<'))) {
                        val[i] = parseICU(val[i]);
                    }
                    else if (typeof val[i] === 'object' && val[i] !== null) {
                        preCompile(val[i]);
                    }
                }
            }
        }
        else if (typeof val === 'object') {
            // 排除复数规则对象
            if (!('other' in val || 'one' in val)) {
                preCompile(val);
            }
        }
    }
}
export function createI18n(config) {
    const { translations, langOrder, locale: initialLocale, fallbackIndex = 0, extraDicts = [], extraLangs = [], devWarnings = true, onLocaleChange, onMissingKey, formatters: customFormatters, loaders, otaLoader, plugins = [], escapeValue = true, escape = escapeHtml, preParse = false, fallbacks = {}, fallbackNamespaces = [], debug = false, postProcessors = [], numberFormatOptions = {}, dateFormatOptions = {}, relativeTimeFormatOptions = {}, listFormatOptions = {}, detection, customDetectors = [], } = config;
    const listeners = new Set();
    if (onLocaleChange)
        listeners.add(onLocaleChange);
    const missingKeys = new Set();
    const namespaceAccessOrder = [];
    const MAX_NAMESPACES = 50; // 默认最大命名空间数
    // 合并所有可用语言
    const allLangs = [...langOrder, ...extraLangs];
    // --- 语言探测逻辑 ---
    let detectedLocale = initialLocale;
    if (!detectedLocale && detection) {
        const order = detection.order || ['querystring', 'cookie', 'localStorage', 'navigator'];
        const detectors = [...customDetectors, ...BUILTIN_DETECTORS];
        for (const name of order) {
            const detector = detectors.find(d => d.name === name);
            if (detector) {
                const result = detector.lookup(detection);
                if (result) {
                    const lng = Array.isArray(result) ? result[0] : result;
                    // 简单验证语言是否在 allLangs 中，或者至少是个合法的语言代码
                    if (lng) {
                        detectedLocale = lng;
                        break;
                    }
                }
            }
        }
    }
    // 如果还是没有探测到，使用默认语言
    if (!detectedLocale)
        detectedLocale = langOrder[0];
    // 内部状态
    let currentLocale = detectedLocale;
    let translator;
    let instance;
    // 缓存初始语言（如果配置了缓存）
    if (detection?.caches && currentLocale) {
        const detectors = [...customDetectors, ...BUILTIN_DETECTORS];
        detection.caches.forEach(name => {
            const detector = detectors.find(d => d.name === name);
            detector?.cacheUserLanguage?.(currentLocale, detection);
        });
    }
    // --- 工具函数 ---
    function deepMerge(target, source) {
        for (const key in source) {
            if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                if (!target[key])
                    target[key] = {};
                deepMerge(target[key], source[key]);
            }
            else {
                target[key] = source[key];
            }
        }
    }
    const resolvePath = (p, d) => {
        if (!p)
            return d;
        const keys = p.split('.');
        let val = d;
        for (const k of keys) {
            val = val?.[k];
            if (val === undefined)
                return undefined;
        }
        return val;
    };
    function processExplicitValue(value, targetLocale) {
        if (typeof value === 'string') {
            const match = value.match(/^([a-zA-Z0-9-]+):\s*(.*)$/);
            if (match) {
                if (match[1] === targetLocale) {
                    return { matched: true, content: match[2] };
                }
                if (allLangs.includes(match[1])) {
                    return { matched: false, content: undefined };
                }
            }
        }
        return { matched: true, content: value };
    }
    function extractArrayValue(entry, targetLocale, idx) {
        for (const item of entry) {
            const { matched, content } = processExplicitValue(item, targetLocale);
            if (matched && content !== item)
                return content;
        }
        const fallbackLocale = allLangs[idx];
        if (fallbackLocale && fallbackLocale !== targetLocale) {
            for (const item of entry) {
                const { matched, content } = processExplicitValue(item, fallbackLocale);
                if (matched && content !== item)
                    return content;
            }
        }
        const fallbackValue = entry[idx];
        const { matched, content } = processExplicitValue(fallbackValue, targetLocale);
        if (matched)
            return content;
        if (typeof fallbackValue === 'string') {
            const match = fallbackValue.match(/^([a-zA-Z0-9-]+):\s*(.*)$/);
            if (match)
                return match[2];
        }
        return fallbackValue;
    }
    function buildDict(locale) {
        const chain = [locale];
        function flattenFallbacks(loc) {
            const fbs = fallbacks[loc];
            if (!fbs)
                return;
            const list = Array.isArray(fbs) ? fbs : [fbs];
            for (const f of list) {
                if (!chain.includes(f)) {
                    chain.push(f);
                    flattenFallbacks(f);
                }
            }
        }
        flattenFallbacks(locale);
        const defaultLocale = langOrder[fallbackIndex] || langOrder[0];
        if (defaultLocale && !chain.includes(defaultLocale))
            chain.push(defaultLocale);
        function resolveNested(source, localeChain) {
            const currentLoc = localeChain[0];
            const currentArrayIdx = langOrder.indexOf(currentLoc);
            const relevantExtraDicts = extraLangs
                .map((l, i) => (l === currentLoc ? extraDicts[i] : null))
                .filter((d) => d !== null);
            function resolveWithExtras(src, extras, loc, aIdx) {
                const lead = src !== undefined ? src : extras.find((ex) => ex !== undefined);
                if (lead === undefined)
                    return undefined;
                const isAST = (v) => Array.isArray(v) && v.some(i => typeof i === 'object' && i !== null && 'type' in i);
                if (Array.isArray(lead) && !isAST(lead)) {
                    for (let i = extras.length - 1; i >= 0; i--) {
                        const ex = extras[i];
                        if (Array.isArray(ex) && !isAST(ex))
                            return extractArrayValue(ex, loc, aIdx);
                        if (ex !== undefined) {
                            const { matched, content } = processExplicitValue(ex, loc);
                            if (matched)
                                return content;
                        }
                    }
                    return Array.isArray(src) ? extractArrayValue(src, loc, aIdx) : src;
                }
                if (isAST(lead))
                    return lead;
                if (typeof lead === 'object' && lead !== null && !('other' in lead || 'one' in lead)) {
                    const result = {};
                    let hasValue = false;
                    const allKeys = new Set(Object.keys(src || {}));
                    for (const ex of extras) {
                        if (typeof ex === 'object' && ex !== null) {
                            for (const k in ex)
                                allKeys.add(k);
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
                        if (matched)
                            return content;
                    }
                }
                return src;
            }
            const currentResult = resolveWithExtras(source, relevantExtraDicts, currentLoc, currentArrayIdx);
            if (currentResult === undefined && localeChain.length > 1) {
                return resolveNested(source, localeChain.slice(1));
            }
            if (typeof currentResult === 'object' && currentResult !== null && !Array.isArray(currentResult) && !('other' in currentResult || 'one' in currentResult)) {
                if (localeChain.length > 1) {
                    const nextResult = resolveNested(source, localeChain.slice(1));
                    if (typeof nextResult === 'object' && nextResult !== null) {
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
    function createTranslator(locale) {
        const dict = buildDict(locale);
        const pluralRules = new Intl.PluralRules(locale);
        const formatters = {
            n: (val, options) => getIntl('number', locale, { ...numberFormatOptions, ...options }).format(val),
            formatNumber: (val, options) => getIntl('number', locale, { ...numberFormatOptions, ...options }).format(val),
            d: (val, options) => getIntl('date', locale, { ...dateFormatOptions, ...options }).format(val),
            formatDate: (val, options) => getIntl('date', locale, { ...dateFormatOptions, ...options }).format(val),
            relative: (val, unit, options) => getIntl('relative', locale, { numeric: 'auto', ...relativeTimeFormatOptions, ...options }).format(val, unit),
            formatRelative: (val, unit, options) => getIntl('relative', locale, { numeric: 'auto', ...relativeTimeFormatOptions, ...options }).format(val, unit),
            formatList: (val, options) => getIntl('list', locale, { ...listFormatOptions, ...options }).format(val),
            escapeValue,
            escape,
            ...customFormatters,
        };
        const jitCache = new Map();
        const chunkJitCache = new Map();
        const translate = (path, params) => {
            let targetPath = path;
            if (params?.context) {
                const contextPath = `${path}_${params.context}`;
                if (resolvePath(contextPath, dict) !== undefined)
                    targetPath = contextPath;
            }
            let content = resolvePath(targetPath, dict);
            if (content === undefined && fallbackNamespaces) {
                const fbNS = Array.isArray(fallbackNamespaces) ? fallbackNamespaces : [fallbackNamespaces];
                for (const ns of fbNS) {
                    if (targetPath.startsWith(`${ns}.`))
                        continue;
                    const fallbackPath = `${ns}.${targetPath}`;
                    const fbVal = resolvePath(fallbackPath, dict);
                    if (fbVal !== undefined) {
                        content = fbVal;
                        targetPath = fallbackPath;
                        break;
                    }
                }
            }
            if (content === undefined) {
                missingKeys.add(`${locale}:${targetPath}`);
                if (onMissingKey)
                    onMissingKey(targetPath, locale);
                plugins.forEach(p => p.onMissingKey?.(targetPath, locale, instance));
                if (devWarnings && targetPath) {
                    console.warn(`[i18nt] Missing path: "${targetPath}" in locale: "${locale}"`);
                }
                return instance.debug ? `⚠️[${targetPath}]` : targetPath;
            }
            let result;
            if (typeof content === 'string' || Array.isArray(content)) {
                const isAST = Array.isArray(content);
                const hasFunction = params && Object.values(params).some(v => typeof v === 'function');
                const hasTags = isAST
                    ? content.some((p) => p.type === 'tag')
                    : (typeof content === 'string' && content.includes('<') && content.includes('>'));
                if (hasFunction || hasTags) {
                    let renderer = chunkJitCache.get(content);
                    if (!renderer) {
                        const parts = isAST ? content : parseICU(content);
                        renderer = compileICUChunks(parts);
                        chunkJitCache.set(content, renderer);
                    }
                    const chunks = renderer(params || {}, locale, formatters);
                    if (chunks.every((c) => typeof c === 'string'))
                        result = chunks.join('');
                    else
                        result = chunks;
                }
                else {
                    let renderer = jitCache.get(content);
                    if (!renderer) {
                        const parts = isAST ? content : parseICU(content);
                        renderer = compileICU(parts);
                        jitCache.set(content, renderer);
                    }
                    result = renderer(params || {}, locale, formatters);
                }
            }
            else if (typeof content === 'object' && content !== null && !Array.isArray(content)) {
                if ('other' in content || 'one' in content) {
                    const count = params?.count ?? 0;
                    const rule = pluralRules.select(count);
                    const resolved = content[rule] || content.other || '';
                    let renderer = jitCache.get(resolved);
                    if (!renderer) {
                        const parts = typeof resolved === 'string' ? parseICU(resolved) : resolved;
                        renderer = compileICU(parts);
                        jitCache.set(resolved, renderer);
                    }
                    result = renderer({ ...params, count }, locale, formatters);
                }
                else {
                    result = path;
                }
            }
            else {
                result = String(content);
            }
            for (const processor of postProcessors) {
                result = processor(result, targetPath);
            }
            return instance.debug ? `✅[${result}]` : result;
        };
        const supportsProxy = typeof Proxy !== 'undefined';
        function createRecursiveProxy(targetPath = '') {
            const fn = (pathOrParams, params) => {
                if (typeof pathOrParams === 'string') {
                    const currentPath = targetPath ? `${targetPath}.${pathOrParams}` : pathOrParams;
                    return translate(currentPath, params);
                }
                return translate(targetPath, pathOrParams);
            };
            // 如果不支持 Proxy，直接返回 fn（降级为仅支持函数式调用 t('a.b.c')）
            if (!supportsProxy) {
                fn.isFallback = true;
                return fn;
            }
            Object.assign(fn, {
                toString: () => translate(targetPath),
                toJSON: () => translate(targetPath),
                [Symbol.toPrimitive]: () => translate(targetPath)
            });
            return new Proxy(fn, {
                get: (target, prop) => {
                    if (typeof prop !== 'string')
                        return target[prop];
                    if (prop in formatters)
                        return formatters[prop];
                    if (prop === '$$typeof' || prop === 'then' || prop === 'toJSON' || prop === 'toString' || prop === 'valueOf') {
                        return target[prop];
                    }
                    const currentPath = targetPath ? `${targetPath}.${prop}` : prop;
                    // 自动加载命名空间检测
                    if (!targetPath && loaders?.[prop] && !translations[prop]) {
                        instance.loadNamespace(prop);
                    }
                    const val = resolvePath(currentPath, dict);
                    if (val !== undefined) {
                        // 如果是叶子节点且不是复数对象，且不包含 ICU 变量，直接返回翻译结果以提升兼容性
                        if (typeof val === 'string' && !val.includes('{')) {
                            return translate(currentPath);
                        }
                        // 其它情况（命名空间、复数、带变量的 ICU）返回递归 Proxy
                        return createRecursiveProxy(currentPath);
                    }
                    return createRecursiveProxy(currentPath);
                }
            });
        }
        return createRecursiveProxy();
    }
    // --- 实例对象 ---
    instance = {
        get t() {
            return translator;
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
        async setLocale(lang, options) {
            if (options?.extraDicts) {
                const targetLangs = options.extraLangs || new Array(options.extraDicts.length).fill(lang);
                for (let i = 0; i < options.extraDicts.length; i++) {
                    const d = options.extraDicts[i];
                    const l = targetLangs[i];
                    extraDicts.push(d);
                    extraLangs.push(l);
                    if (!allLangs.includes(l))
                        allLangs.push(l);
                }
            }
            if (otaLoader && !options?.extraDicts) {
                try {
                    const remoteDict = await otaLoader(lang);
                    instance.addTranslations(remoteDict, lang);
                }
                catch (e) {
                    if (devWarnings)
                        console.error(`[i18nt] OTA load failed for "${lang}":`, e);
                }
            }
            if (lang === currentLocale && !options)
                return;
            currentLocale = lang;
            translator = createTranslator(lang);
            syncDocumentDirection(lang);
            listeners.forEach(fn => fn(lang));
            plugins.forEach(p => p.onLocaleChange?.(lang, instance));
        },
        onChange(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        addTranslations(dict, lang) {
            const targetLang = lang || currentLocale;
            if (preParse)
                preCompile(dict);
            if (targetLang === langOrder[0] || langOrder.includes(targetLang)) {
                deepMerge(translations, dict);
            }
            else {
                const idx = extraLangs.indexOf(targetLang);
                if (idx !== -1) {
                    deepMerge(extraDicts[idx], dict);
                }
                else {
                    extraDicts.push(dict);
                    extraLangs.push(targetLang);
                    if (!allLangs.includes(targetLang))
                        allLangs.push(targetLang);
                }
            }
            translator = createTranslator(currentLocale);
            plugins.forEach(p => p.onTranslationsAdded?.(dict, targetLang, instance));
        },
        async loadNamespace(name) {
            if (!loaders?.[name]) {
                if (devWarnings)
                    console.warn(`[i18nt] No loader found for namespace: "${name}"`);
                return;
            }
            // LRU 管理
            const idx = namespaceAccessOrder.indexOf(name);
            if (idx !== -1)
                namespaceAccessOrder.splice(idx, 1);
            namespaceAccessOrder.push(name);
            if (namespaceAccessOrder.length > MAX_NAMESPACES) {
                const toRemove = namespaceAccessOrder.shift();
                if (toRemove)
                    instance.unloadNamespace(toRemove);
            }
            if (translations[name])
                return; // 已加载
            try {
                const module = await loaders[name]();
                const dict = ('default' in module ? module.default : module);
                if (!translations[name])
                    translations[name] = {};
                deepMerge(translations[name], dict);
                translator = createTranslator(currentLocale);
            }
            catch (e) {
                if (devWarnings)
                    console.error(`[i18nt] Failed to load namespace "${name}":`, e);
            }
        },
        unloadNamespace(name) {
            if (translations[name]) {
                delete translations[name];
                translator = createTranslator(currentLocale);
            }
        },
        missingKeys,
        prune(usedKeys) {
            const set = new Set(usedKeys);
            function walk(obj, currentPath) {
                for (const key in obj) {
                    const path = currentPath ? `${currentPath}.${key}` : key;
                    const isUsed = set.has(path) || Array.from(allLangs).some(lang => set.has(`${lang}:${path}`));
                    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key]) && !('other' in obj[key] || 'one' in obj[key])) {
                        walk(obj[key], path);
                        if (Object.keys(obj[key]).length === 0 && !isUsed)
                            delete obj[key];
                    }
                    else {
                        if (!isUsed)
                            delete obj[key];
                    }
                }
            }
            walk(translations, '');
            translator = createTranslator(currentLocale);
        },
        exportState() {
            return { locale: currentLocale, translations, extraDicts, extraLangs, allLangs };
        },
        importState(state) {
            if (state.locale)
                currentLocale = state.locale;
            if (state.translations) {
                for (const key in translations)
                    delete translations[key];
                Object.assign(translations, state.translations);
            }
            if (state.extraDicts)
                extraDicts.splice(0, extraDicts.length, ...state.extraDicts);
            if (state.extraLangs)
                extraLangs.splice(0, extraLangs.length, ...state.extraLangs);
            if (state.allLangs) {
                allLangs.splice(0, allLangs.length);
                state.allLangs.forEach((l) => allLangs.push(l));
            }
            translator = createTranslator(currentLocale);
            syncDocumentDirection(currentLocale);
            listeners.forEach(fn => fn(currentLocale));
        },
        validate() {
            const report = {};
            const baseLocale = langOrder[0];
            const baseDict = buildDict(baseLocale);
            function getAllKeys(obj, prefix = '') {
                let keys = [];
                for (const k in obj) {
                    const path = prefix ? `${prefix}.${k}` : k;
                    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k]) && !('other' in obj[k] || 'one' in obj[k])) {
                        keys = keys.concat(getAllKeys(obj[k], path));
                    }
                    else {
                        keys.push(path);
                    }
                }
                return keys;
            }
            const allKeys = getAllKeys(baseDict);
            for (const loc of allLangs) {
                if (loc === baseLocale)
                    continue;
                const missing = [];
                const mismatchedVars = {};
                const currentIdx = langOrder.indexOf(loc);
                for (const key of allKeys) {
                    const baseVal = resolvePath(key, baseDict);
                    const baseVars = extractVariables(Array.isArray(baseVal) ? baseVal : parseICU(String(baseVal)));
                    const parts = key.split('.');
                    let val = translations;
                    for (const p of parts)
                        val = val?.[p];
                    let hasValue = false;
                    let currentVal;
                    if (Array.isArray(val)) {
                        if (currentIdx !== -1 && val[currentIdx] !== undefined) {
                            hasValue = true;
                            currentVal = val[currentIdx];
                        }
                        if (!hasValue) {
                            for (const item of val) {
                                if (typeof item === 'string' && item.startsWith(`${loc}:`)) {
                                    hasValue = true;
                                    currentVal = item.substring(loc.length + 1).trim();
                                    break;
                                }
                            }
                        }
                    }
                    else if (val !== undefined) {
                        hasValue = true;
                        currentVal = val;
                    }
                    if (!hasValue) {
                        const extraIdx = extraLangs.indexOf(loc);
                        if (extraIdx !== -1) {
                            let exVal = resolvePath(key, extraDicts[extraIdx]);
                            if (exVal !== undefined) {
                                hasValue = true;
                                currentVal = exVal;
                            }
                        }
                    }
                    if (!hasValue) {
                        missing.push(key);
                    }
                    else if (currentVal) {
                        const currentVars = extractVariables(Array.isArray(currentVal) ? currentVal : parseICU(String(currentVal)));
                        const missingInCurrent = baseVars.filter(v => !currentVars.includes(v));
                        if (missingInCurrent.length > 0)
                            mismatchedVars[key] = { expected: baseVars, actual: currentVars };
                    }
                }
                if (missing.length > 0 || Object.keys(mismatchedVars).length > 0) {
                    report[loc] = {};
                    if (missing.length > 0)
                        report[loc].missing = missing;
                    if (Object.keys(mismatchedVars).length > 0)
                        report[loc].mismatchedVars = mismatchedVars;
                }
            }
            return report;
        }
    };
    // --- 初始化 ---
    translator = createTranslator(currentLocale);
    instance.debug = debug;
    if (preParse)
        preCompile(translations);
    plugins.forEach(p => p.onInit?.(instance));
    syncDocumentDirection(currentLocale);
    return instance;
}
/**
 * 创建一个 i18n 实例管理器（用于同步多个实例，如微前端场景）
 */
export function createI18nManager(initialLocale) {
    const instances = new Set();
    let currentLocale = initialLocale;
    return {
        register(instance) {
            instances.add(instance);
            if (instance.locale !== currentLocale) {
                instance.setLocale(currentLocale);
            }
        },
        unregister(instance) {
            instances.delete(instance);
        },
        async setLocale(locale) {
            currentLocale = locale;
            await Promise.all(Array.from(instances).map(i => i.setLocale(locale)));
        },
        get locale() {
            return currentLocale;
        }
    };
}
