/**
 * ICU MessageFormat Parser & Formatter (Lightweight)
 * Zero dependencies, uses browser Intl APIs.
 */
// LRU-like cache for Intl instances to boost performance
const INTL_CACHE = {
    number: new Map(),
    date: new Map(),
    plural: new Map(),
    relative: new Map(),
    list: new Map(),
};
/**
 * 辅助函数：安全获取 Intl 实例，增加环境检测
 */
export function getIntl(type, locale, options) {
    const intlNameMap = {
        number: 'NumberFormat',
        date: 'DateTimeFormat',
        plural: 'PluralRules',
        relative: 'RelativeTimeFormat',
        list: 'ListFormat'
    };
    const intlName = intlNameMap[type];
    if (typeof Intl === 'undefined' || !Intl[intlName]) {
        console.error(`[i18nt] Environment does not support Intl.${type} (${intlName}). Please add polyfills.`);
        // 返回一个简单的模拟对象以防崩溃
        return { format: (v) => String(v), select: () => 'other', formatRange: (s, e) => `${s}-${e}` };
    }
    // 优化缓存键生成：对于空配置直接返回 locale，减少 JSON.stringify 开销
    const key = (!options || Object.keys(options).length === 0) ? locale : `${locale}:${JSON.stringify(options)}`;
    const cache = INTL_CACHE[type];
    if (!cache.has(key)) {
        try {
            if (type === 'number')
                cache.set(key, new Intl.NumberFormat(locale, options));
            else if (type === 'date')
                cache.set(key, new Intl.DateTimeFormat(locale, options));
            else if (type === 'plural')
                cache.set(key, new Intl.PluralRules(locale, options));
            else if (type === 'relative')
                cache.set(key, new Intl.RelativeTimeFormat(locale, options));
            else if (type === 'list')
                cache.set(key, new Intl.ListFormat(locale, options));
        }
        catch (e) {
            console.error(`[i18nt] Failed to create Intl.${type} for locale "${locale}":`, e);
            return { format: (v) => String(v), select: () => 'other', formatRange: (s, e) => `${s}-${e}` };
        }
        // Simple cache eviction (limit to 100 entries per type)
        if (cache.size > 100) {
            const firstKey = cache.keys().next().value;
            if (firstKey !== undefined)
                cache.delete(firstKey);
        }
    }
    return cache.get(key);
}
/**
 * 常用语言的复数规则回退方案（当 Intl.PluralRules 不可用时使用）
 */
const PLURAL_RULES_FALLBACK = {
    'zh': () => 'other',
    'ja': () => 'other',
    'ko': () => 'other',
    'en': (n) => (n === 1 ? 'one' : 'other'),
    'de': (n) => (n === 1 ? 'one' : 'other'),
    'es': (n) => (n === 1 ? 'one' : 'other'),
    'it': (n) => (n === 1 ? 'one' : 'other'),
    'pt': (n) => (n === 1 ? 'one' : 'other'),
    'fr': (n) => (n >= 0 && n < 2 ? 'one' : 'other'),
    'ru': (n) => {
        const i = Math.floor(Math.abs(n)), v = n.toString().replace(/^[^.]*\.?/, '').length;
        if (v === 0 && i % 10 === 1 && i % 100 !== 11)
            return 'one';
        if (v === 0 && i % 10 >= 2 && i % 10 <= 4 && (i % 100 < 10 || i % 100 >= 20))
            return 'few';
        return 'other';
    },
    'pl': (n) => {
        const i = Math.floor(Math.abs(n)), v = n.toString().replace(/^[^.]*\.?/, '').length;
        if (v === 0 && i === 1)
            return 'one';
        if (v === 0 && i % 10 >= 2 && i % 10 <= 4 && (i % 100 < 10 || i % 100 >= 20))
            return 'few';
        return 'other';
    },
    'default': (n) => (n === 1 ? 'one' : 'other')
};
/**
 * 辅助函数：转义 HTML 字符
 */
export function escapeHtml(str) {
    if (typeof str !== 'string')
        return str;
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return str.replace(/[&<>"']/g, (m) => map[m] || m);
}
/**
 * 将解析出的 AST 格式化为字符串
 */
export function formatICU(parts, params, locale, formatters) {
    let result = '';
    const escapeFn = formatters?.escape || ((s) => s);
    const shouldEscape = !!formatters?.escapeValue;
    for (const part of parts) {
        if (typeof part === 'string') {
            result += part;
        }
        else if (part.type === 'var') {
            const val = params[part.name] ?? (part.isDouble ? `{{${part.name}}}` : `{${part.name}}`);
            // 如果是双花括号 {{var}}，通常表示不转义（参考 i18next）
            // 或者如果显式禁用了转义
            if (part.isDouble || !shouldEscape || typeof val !== 'string') {
                result += val;
            }
            else {
                result += escapeFn(val);
            }
        }
        else if (part.type === 'plural' || part.type === 'selectordinal') {
            const value = Number(params[part.name]) || 0;
            const count = value - part.offset;
            let rule;
            try {
                const pluralRules = getIntl('plural', locale, {
                    type: part.type === 'selectordinal' ? 'ordinal' : 'cardinal'
                });
                rule = pluralRules.select(count);
            }
            catch (e) {
                const lang = locale.split('-')[0];
                rule = (PLURAL_RULES_FALLBACK[lang] || PLURAL_RULES_FALLBACK.default)(count);
            }
            const option = part.options[`=${value}`] || part.options[rule] || part.options.other;
            if (option) {
                result += formatICU(option, { ...params, '#': count }, locale, formatters);
            }
        }
        else if (part.type === 'select') {
            const value = String(params[part.name]);
            const option = part.options[value] || part.options.other;
            if (option) {
                result += formatICU(option, params, locale, formatters);
            }
        }
        else if (part.type === 'number') {
            let value = Number(params[part.name]) || 0;
            let options = { ...params[`${part.name}Options`] };
            const style = part.style;
            if (style === 'currency') {
                options.style = 'currency';
                options.currency = options.currency || params.currency || 'USD';
            }
            else if (style === 'percent') {
                options.style = 'percent';
            }
            else if (style === 'integer') {
                options.maximumFractionDigits = 0;
            }
            else if (style === 'decimal') {
                options.style = 'decimal';
            }
            else if (style) {
                options = { ...options, ...parseNumberPattern(style) };
            }
            if (options.scale)
                value *= options.scale;
            if (formatters?.formatNumber) {
                result += formatters.formatNumber(value, options);
            }
            else {
                result += getIntl('number', locale, options).format(value);
            }
        }
        else if (part.type === 'date' || part.type === 'time') {
            const value = params[part.name] instanceof Date ? params[part.name] : new Date(params[part.name]);
            let options = { ...params[`${part.name}Options`] };
            const style = part.style;
            const isStandardStyle = ['short', 'medium', 'long', 'full'].includes(style);
            if (isStandardStyle) {
                if (part.type === 'date')
                    options.dateStyle = style;
                else
                    options.timeStyle = style;
            }
            else if (style) {
                // 处理 ICU Skeleton (:: 开头) 或普通模式
                const pattern = style.startsWith('::') ? style.substring(2) : style;
                options = { ...options, ...parseDatePattern(pattern) };
            }
            else {
                if (part.type === 'date')
                    options.dateStyle = options.dateStyle || 'medium';
                else
                    options.timeStyle = options.timeStyle || 'medium';
            }
            if (part.type === 'date' && formatters?.formatDate) {
                result += formatters.formatDate(value, options);
            }
            else if (part.type === 'time' && formatters?.formatDate) {
                result += formatters.formatDate(value, options);
            }
            else {
                result += getIntl('date', locale, options).format(value);
            }
        }
        else if (part.type === 'relative') {
            const value = Number(params[part.name]) || 0;
            const unit = (part.unit || params[`${part.name}Unit`] || 'day');
            const options = {
                numeric: (part.style === 'always' || part.style === 'auto' || params[`${part.name}Numeric`]) ? (part.style === 'always' ? 'always' : 'auto') : 'auto',
                style: (['long', 'short', 'narrow'].includes(part.style || '') ? part.style : 'long'),
                ...params[`${part.name}Options`]
            };
            if (formatters?.formatRelative) {
                result += formatters.formatRelative(value, unit, options);
            }
            else {
                result += getIntl('relative', locale, options).format(value, unit);
            }
        }
        else if (part.type === 'list') {
            const value = Array.isArray(params[part.name]) ? params[part.name] : [params[part.name]];
            const type = (part.style || params[`${part.name}Type`] || 'conjunction');
            const options = {
                type,
                style: (part.width || params[`${part.name}Width`] || 'long'),
                ...params[`${part.name}Options`]
            };
            result += getIntl('list', locale, options).format(value);
        }
        else if (part.type === 'unit') {
            const value = Number(params[part.name]) || 0;
            const options = {
                style: 'unit',
                unit: (part.unit || params[`${part.name}Unit`] || 'meter').replace(/_/g, '-'),
                unitDisplay: part.style || 'long',
                ...params[`${part.name}Options`]
            };
            result += getIntl('number', locale, options).format(value);
        }
        else if (part.type === 'range') {
            const val = params[part.name];
            const [start, end] = Array.isArray(val) ? val : [val, params[`${part.name}End`]];
            const options = { ...(part.style?.startsWith('::') ? parseNumberPattern(part.style.substring(2)) : {}), ...params[`${part.name}Options`] };
            result += getIntl('number', locale, options).formatRange(Number(start) || 0, Number(end) || 0);
        }
        else if (part.type === 'dateRange') {
            const val = params[part.name];
            const [start, end] = Array.isArray(val) ? val : [val, params[`${part.name}End`]];
            const options = { ...(part.style?.startsWith('::') ? parseDatePattern(part.style.substring(2)) : { dateStyle: 'medium' }), ...params[`${part.name}Options`] };
            const s = start instanceof Date ? start : new Date(start);
            const e = end instanceof Date ? end : new Date(end);
            result += getIntl('date', locale, options).formatRange(s, e);
        }
        else if (part.type === 'custom') {
            const value = params[part.name];
            const formatter = formatters?.[part.formatter];
            if (typeof formatter === 'function') {
                result += formatter(value, part.arg, locale, params);
            }
            else {
                result += String(value);
            }
        }
    }
    return result;
}
/**
 * 将解析出的 AST 格式化为片段数组（支持富文本组件）
 */
export function formatICUChunks(parts, params, locale, formatters) {
    const result = [];
    const escapeFn = formatters?.escape || ((s) => s);
    const shouldEscape = !!formatters?.escapeValue;
    for (const part of parts) {
        if (typeof part === 'string') {
            result.push(part);
        }
        else if (part.type === 'tag') {
            const children = formatICUChunks(part.children, params, locale, formatters);
            const render = params[part.name];
            if (typeof render === 'function') {
                const content = children.length === 1 && typeof children[0] === 'string' ? children[0] : children;
                result.push(render(content));
            }
            else {
                result.push(`<${part.name}>`);
                result.push(...children);
                result.push(`</${part.name}>`);
            }
        }
        else if (part.type === 'var') {
            const val = params[part.name] ?? (part.isDouble ? `{{${part.name}}}` : `{${part.name}}`);
            if (part.isDouble || !shouldEscape || typeof val !== 'string') {
                result.push(val);
            }
            else {
                result.push(escapeFn(val));
            }
        }
        else if (part.type === 'plural' || part.type === 'selectordinal') {
            const value = Number(params[part.name]) || 0;
            const count = value - part.offset;
            const pluralRules = getIntl('plural', locale, {
                type: part.type === 'selectordinal' ? 'ordinal' : 'cardinal'
            });
            const rule = pluralRules.select(count);
            const option = part.options[`=${value}`] || part.options[rule] || part.options.other;
            if (option) {
                result.push(...formatICUChunks(option, { ...params, '#': count }, locale, formatters));
            }
        }
        else if (part.type === 'select') {
            const value = String(params[part.name]);
            const option = part.options[value] || part.options.other;
            if (option) {
                result.push(...formatICUChunks(option, params, locale, formatters));
            }
        }
        else {
            result.push(formatICU([part], params, locale, formatters));
        }
    }
    return result;
}
class Parser {
    constructor(message, i = 0) {
        this.message = message;
        this.i = i;
    }
    parse(nested = false) {
        const currentParts = [];
        let text = '';
        while (this.i < this.message.length) {
            const char = this.message[this.i];
            const nextChar = this.message[this.i + 1];
            // 处理转义: '' -> ', '{' -> {
            if (char === "'") {
                if (nextChar === "'") {
                    text += "'";
                    this.i += 2;
                    continue;
                }
                // ICU 规范：单引号后跟 { } # < 触发转义模式
                if (nextChar === '{' || nextChar === '}' || nextChar === '#' || nextChar === '<') {
                    this.i++; // 跳过开头的 '
                    while (this.i < this.message.length && this.message[this.i] !== "'") {
                        text += this.message[this.i++];
                    }
                    if (this.message[this.i] === "'")
                        this.i++; // 跳过结尾的 '
                    continue;
                }
            }
            if (char === '{') {
                if (text)
                    currentParts.push(text), text = '';
                // 处理 {{var}}
                const isDouble = nextChar === '{';
                this.i += isDouble ? 2 : 1;
                const tag = this.parseTag(isDouble);
                currentParts.push(tag);
            }
            else if (char === '}' && nested) {
                // 如果是嵌套模式，遇到 } 则返回
                if (text)
                    currentParts.push(text);
                return currentParts;
            }
            else if (char === '#' && nested) {
                if (text)
                    currentParts.push(text), text = '';
                currentParts.push({ type: 'var', name: '#' });
                this.i++;
            }
            else if (char === '<') {
                if (text)
                    currentParts.push(text), text = '';
                const tagMatch = this.message.substring(this.i).match(/^<([a-zA-Z0-9]+)>([\s\S]*?)<\/\1>/);
                if (tagMatch) {
                    const tagName = tagMatch[1];
                    const tagContent = tagMatch[2];
                    currentParts.push({
                        type: 'tag',
                        name: tagName,
                        children: new Parser(tagContent).parse(true)
                    });
                    this.i += tagMatch[0].length;
                    continue;
                }
                else {
                    text += char;
                    this.i++;
                }
            }
            else {
                text += char;
                this.i++;
            }
        }
        if (text)
            currentParts.push(text);
        return currentParts;
    }
    parseTag(isDouble = false) {
        let tagContent = '';
        let braceDepth = 1;
        while (this.i < this.message.length && braceDepth > 0) {
            const char = this.message[this.i];
            const nextChar = this.message[this.i + 1];
            if (isDouble && char === '}' && nextChar === '}') {
                braceDepth--;
                if (braceDepth === 0) {
                    this.i += 2;
                    break;
                }
            }
            else if (!isDouble && char === '}') {
                braceDepth--;
                if (braceDepth === 0) {
                    this.i++;
                    break;
                }
            }
            if (char === '{')
                braceDepth++;
            tagContent += char;
            this.i++;
        }
        const segments = [];
        let currentSegment = '';
        let depth = 0;
        for (let j = 0; j < tagContent.length; j++) {
            const char = tagContent[j];
            if (char === '{')
                depth++;
            else if (char === '}')
                depth--;
            // Only split on the first two commas (name and type)
            // Subsequent commas are part of the style/pattern
            if (char === ',' && depth === 0 && segments.length < 2) {
                segments.push(currentSegment.trim());
                currentSegment = '';
            }
            else {
                currentSegment += char;
            }
        }
        segments.push(currentSegment.trim());
        const name = segments[0];
        const type = segments[1];
        if (!type)
            return { type: 'var', name, isDouble };
        if (type === 'plural' || type === 'selectordinal' || type === 'select') {
            const options = {};
            const optionsString = segments.slice(2).join(',');
            let offset = 0;
            const offsetMatch = optionsString.match(/^\s*offset\s*:\s*(\d+)/);
            if (offsetMatch) {
                offset = parseInt(offsetMatch[1], 10);
            }
            let optIdx = 0;
            while (optIdx < optionsString.length) {
                // 更精确的 Key 匹配：不包含 { } 和空格，支持 =数字
                const keyMatch = optionsString.substring(optIdx).match(/^\s*([^\s{]+)\s*\{/);
                if (!keyMatch) {
                    optIdx++;
                    continue;
                }
                const key = keyMatch[1].trim();
                // 如果 key 是 offset，跳过它（已经处理过）
                if (key.startsWith('offset:')) {
                    optIdx += keyMatch[0].length - 1; // 重新处理后续
                    continue;
                }
                optIdx += keyMatch[0].length;
                let bDepth = 1;
                let optContent = '';
                while (optIdx < optionsString.length && bDepth > 0) {
                    if (optionsString[optIdx] === '{')
                        bDepth++;
                    if (optionsString[optIdx] === '}')
                        bDepth--;
                    if (bDepth > 0)
                        optContent += optionsString[optIdx];
                    optIdx++;
                }
                options[key] = new Parser(optContent).parse(true);
            }
            if (type === 'select') {
                return { type: 'select', name, options, isDouble };
            }
            return { type: type, name, offset, options, isDouble };
        }
        if (type === 'relative') {
            const parts = (segments[2] || '').split(/\s+/);
            return { type: 'relative', name, unit: parts[0], style: parts[1], isDouble };
        }
        if (type === 'list') {
            const parts = (segments[2] || '').split(/\s+/);
            return { type: 'list', name, style: parts[0], width: parts[1], isDouble };
        }
        if (type === 'unit') {
            const parts = (segments[2] || '').split(/\s+/);
            return { type: 'unit', name, unit: parts[0], style: parts[1], isDouble };
        }
        const builtInTypes = ['plural', 'selectordinal', 'select', 'number', 'date', 'time', 'relative', 'list', 'unit', 'range', 'dateRange'];
        if (!builtInTypes.includes(type)) {
            return { type: 'custom', name, formatter: type, arg: segments[2], isDouble };
        }
        return { type: type, name, style: segments[2], isDouble };
    }
}
/**
 * JIT 编译器：将 AST 编译为极致优化的渲染函数
 */
export function compileICU(parts) {
    const renderers = [];
    for (const part of parts) {
        if (typeof part === 'string') {
            renderers.push(() => part);
        }
        else if (part.type === 'var') {
            const name = part.name;
            const isDouble = part.isDouble;
            renderers.push((params, _, formatters) => {
                const val = params[name] ?? (isDouble ? `{{${name}}}` : `{${name}}`);
                if (isDouble || !formatters?.escapeValue || typeof val !== 'string')
                    return val;
                return (formatters.escape || escapeHtml)(val);
            });
        }
        else if (part.type === 'plural' || part.type === 'selectordinal') {
            const { name, offset, options: optParts, type } = part;
            const isOrdinal = type === 'selectordinal';
            const compiledOptions = {};
            for (const key in optParts)
                compiledOptions[key] = compileICU(optParts[key]);
            renderers.push((params, locale, formatters) => {
                const value = Number(params[name]) || 0;
                const count = value - (offset || 0);
                let rule;
                try {
                    rule = getIntl('plural', locale, { type: isOrdinal ? 'ordinal' : 'cardinal' }).select(count);
                }
                catch (e) {
                    const lang = locale.split('-')[0];
                    rule = (PLURAL_RULES_FALLBACK[lang] || PLURAL_RULES_FALLBACK.default)(count);
                }
                const renderer = compiledOptions[`=${value}`] || compiledOptions[rule] || compiledOptions.other;
                // 将计算后的 count 注入 params，供子渲染器里的 '#' 使用
                const subParams = { ...params, '#': count.toString() };
                return renderer ? renderer(subParams, locale, formatters) : '';
            });
        }
        else if (part.type === 'select') {
            const { name, options: optParts } = part;
            const compiledOptions = {};
            for (const key in optParts)
                compiledOptions[key] = compileICU(optParts[key]);
            renderers.push((params, locale, formatters) => {
                const value = String(params[name]);
                const renderer = compiledOptions[value] || compiledOptions.other;
                return renderer ? renderer(params, locale, formatters) : '';
            });
        }
        else if (part.type === 'number') {
            const { name, style } = part;
            const staticOptions = style ? parseNumberPattern(style) : {};
            renderers.push((params, locale, formatters) => {
                let value = Number(params[name]) || 0;
                const options = { ...staticOptions, ...params[`${name}Options`] };
                if (options.scale)
                    value *= options.scale;
                if (style === 'currency') {
                    options.style = 'currency';
                    options.currency = options.currency || params.currency || 'USD';
                }
                else if (style === 'percent')
                    options.style = 'percent';
                else if (style === 'integer')
                    options.maximumFractionDigits = 0;
                return formatters?.formatNumber
                    ? formatters.formatNumber(value, options)
                    : getIntl('number', locale, options).format(value);
            });
        }
        else if (part.type === 'date' || part.type === 'time') {
            const { name, style, type } = part;
            const isDate = type === 'date';
            const isStandard = ['short', 'medium', 'long', 'full'].includes(style || '');
            const staticOptions = {};
            if (isStandard) {
                if (isDate)
                    staticOptions.dateStyle = style;
                else
                    staticOptions.timeStyle = style;
            }
            else if (style) {
                const pattern = style.startsWith('::') ? style.substring(2) : style;
                Object.assign(staticOptions, parseDatePattern(pattern));
            }
            else {
                if (isDate)
                    staticOptions.dateStyle = 'medium';
                else
                    staticOptions.timeStyle = 'medium';
            }
            renderers.push((params, locale, formatters) => {
                const val = params[name];
                const value = val instanceof Date ? val : new Date(val);
                const options = { ...staticOptions, ...params[`${name}Options`] };
                return formatters?.formatDate
                    ? formatters.formatDate(value, options)
                    : getIntl('date', locale, options).format(value);
            });
        }
        else if (part.type === 'relative') {
            const { name, unit: staticUnit, style: staticStyle } = part;
            renderers.push((params, locale, formatters) => {
                const value = Number(params[name]) || 0;
                const unit = (staticUnit || params[`${name}Unit`] || 'day');
                const options = {
                    numeric: (staticStyle === 'always' || staticStyle === 'auto' || params[`${name}Numeric`]) ? (staticStyle === 'always' ? 'always' : 'auto') : 'auto',
                    style: (['long', 'short', 'narrow'].includes(staticStyle || '') ? staticStyle : 'long'),
                    ...params[`${name}Options`]
                };
                return formatters?.formatRelative
                    ? formatters.formatRelative(value, unit, options)
                    : getIntl('relative', locale, options).format(value, unit);
            });
        }
        else if (part.type === 'list') {
            const { name, style: staticType, width: staticStyle } = part;
            renderers.push((params, locale) => {
                const value = (Array.isArray(params[name]) ? params[name] : [params[name]]).filter((v) => v !== undefined);
                const options = {
                    type: staticType || 'conjunction',
                    style: staticStyle || 'long',
                    ...params[`${name}Options`]
                };
                return getIntl('list', locale, options).format(value);
            });
        }
        else if (part.type === 'range') {
            const { name, style } = part;
            const pattern = style?.startsWith('::') ? style.substring(2) : style;
            const staticOptions = style ? (style.startsWith('::') ? parseNumberPattern(pattern) : {}) : {};
            renderers.push((params, locale) => {
                const val = params[name];
                const [start, end] = Array.isArray(val) ? val : [val, params[`${name}End`]];
                const options = { ...staticOptions, ...params[`${name}Options`] };
                return getIntl('number', locale, options).formatRange(Number(start) || 0, Number(end) || 0);
            });
        }
        else if (part.type === 'dateRange') {
            const { name, style } = part;
            const pattern = style?.startsWith('::') ? style.substring(2) : style;
            const staticOptions = style ? (style.startsWith('::') ? parseDatePattern(pattern) : {}) : { dateStyle: 'medium' };
            renderers.push((params, locale) => {
                const val = params[name];
                const [start, end] = Array.isArray(val) ? val : [val, params[`${name}End`]];
                const options = { ...staticOptions, ...params[`${name}Options`] };
                const s = start instanceof Date ? start : new Date(start);
                const e = end instanceof Date ? end : new Date(end);
                return getIntl('date', locale, options).formatRange(s, e);
            });
        }
        else if (part.type === 'unit') {
            const { name, unit: staticUnit, style: staticStyle } = part;
            renderers.push((params, locale) => {
                const value = Number(params[name]) || 0;
                const unit = (staticUnit || params[`${name}Unit`] || 'meter').replace(/_/g, '-');
                const options = { style: 'unit', unit, unitDisplay: staticStyle || 'long', ...params[`${name}Options`] };
                return getIntl('number', locale, options).format(value);
            });
        }
        else if (part.type === 'custom') {
            const { name, formatter: formatterName, arg } = part;
            renderers.push((params, locale, formatters) => {
                const value = params[name];
                const formatter = formatters?.[formatterName];
                return typeof formatter === 'function' ? formatter(value, arg, locale, params) : String(value);
            });
        }
    }
    return (params, locale, formatters) => {
        let result = '';
        for (let i = 0; i < renderers.length; i++) {
            result += renderers[i](params, locale, formatters);
        }
        return result;
    };
}
export function compileICUChunks(parts) {
    const renderers = [];
    for (const part of parts) {
        if (typeof part === 'string') {
            renderers.push(() => part);
        }
        else if (part.type === 'tag') {
            const name = part.name;
            const childRenderer = compileICUChunks(part.children);
            renderers.push((params, locale, formatters) => {
                const children = childRenderer(params, locale, formatters);
                const render = params[name];
                if (typeof render === 'function') {
                    const content = children.length === 1 && typeof children[0] === 'string' ? children[0] : children;
                    return render(content);
                }
                return [`<${name}>`, ...children, `</${name}>`];
            });
        }
        else if (part.type === 'plural' || part.type === 'selectordinal' || part.type === 'select') {
            const renderer = compileICU([part]);
            renderers.push(renderer);
        }
        else if (part.type === 'var') {
            const name = part.name;
            const isDouble = part.isDouble;
            renderers.push((params, _, formatters) => {
                const val = params[name] ?? (isDouble ? `{{${name}}}` : `{${name}}`);
                if (isDouble || !formatters?.escapeValue || typeof val !== 'string')
                    return val;
                return (formatters.escape || escapeHtml)(val);
            });
        }
        else {
            const renderer = compileICU([part]);
            renderers.push(renderer);
        }
    }
    return (params, locale, formatters) => {
        const result = [];
        for (let i = 0; i < renderers.length; i++) {
            const val = renderers[i](params, locale, formatters);
            if (Array.isArray(val))
                result.push(...val);
            else
                result.push(val);
        }
        return result;
    };
}
export function parseICU(message) {
    try {
        return new Parser(message).parse();
    }
    catch (e) {
        console.error(`[i18nt] ICU Parse Error: ${e?.message || e} in "${message}"`);
        return [message]; // 回退到原样输出
    }
}
/**
 * 从 ICU 部件列表中提取所有变量名（用于校验）
 */
export function extractVariables(parts) {
    const vars = new Set();
    const walk = (p) => {
        for (const part of p) {
            if (typeof part === 'string')
                continue;
            if (part.name && part.name !== '#')
                vars.add(part.name);
            if (part.type === 'plural' || part.type === 'selectordinal' || part.type === 'select') {
                for (const key in part.options)
                    walk(part.options[key]);
            }
            else if (part.type === 'tag') {
                walk(part.children);
            }
        }
    };
    walk(parts);
    return Array.from(vars);
}
/**
 * 轻量级 ICU 日期模式解析器
 */
function parseDatePattern(pattern) {
    const options = {};
    if (!pattern)
        return options;
    // 1. 处理预定义的 Skeleton (:: 开头)
    if (pattern.startsWith('::')) {
        const skeleton = pattern.substring(2);
        // 按空格拆分或按字符组处理
        // 实际上 Date Skeleton 通常是连写的，如 yMMMd
        // 这里我们按字符组匹配
        if (skeleton.includes('G'))
            options.era = skeleton.match(/GGGG/) ? 'long' : (skeleton.match(/GGGGG/) ? 'narrow' : 'short');
        if (skeleton.includes('y'))
            options.year = skeleton.match(/yyyy/) ? 'numeric' : (skeleton.match(/yy/) ? '2-digit' : 'numeric');
        if (skeleton.includes('M') || skeleton.includes('L')) {
            const mCount = (skeleton.match(/[ML]/g) || []).length;
            if (mCount >= 5)
                options.month = 'narrow';
            else if (mCount === 4)
                options.month = 'long';
            else if (mCount === 3)
                options.month = 'short';
            else if (mCount === 2)
                options.month = '2-digit';
            else
                options.month = 'numeric';
        }
        if (skeleton.includes('d'))
            options.day = skeleton.match(/dd/) ? '2-digit' : 'numeric';
        if (skeleton.includes('E') || skeleton.includes('e') || skeleton.includes('c')) {
            const eCount = (skeleton.match(/[Eec]/g) || []).length;
            if (eCount >= 5)
                options.weekday = 'narrow';
            else if (eCount === 4)
                options.weekday = 'long';
            else
                options.weekday = 'short';
        }
        if (skeleton.includes('H')) {
            options.hour = (skeleton.match(/HH/) ? '2-digit' : 'numeric');
            options.hour12 = false;
        }
        if (skeleton.includes('h') || skeleton.includes('K')) {
            options.hour = (skeleton.match(/[hK]{2}/) ? '2-digit' : 'numeric');
            options.hour12 = true;
        }
        if (skeleton.includes('m'))
            options.minute = (skeleton.match(/mm/) ? '2-digit' : 'numeric');
        if (skeleton.includes('s'))
            options.second = (skeleton.match(/ss/) ? '2-digit' : 'numeric');
        if (skeleton.includes('z') || skeleton.includes('v') || skeleton.includes('V') || skeleton.includes('O')) {
            options.timeZoneName = (skeleton.match(/[zvVO]{4,}/) ? 'long' : 'short');
        }
        return options;
    }
    // 2. 处理普通模式
    if (/y{4,}/i.test(pattern))
        options.year = 'numeric';
    else if (/y{2}/i.test(pattern))
        options.year = '2-digit';
    if (/M{4,}/.test(pattern))
        options.month = 'long';
    else if (/M{3}/.test(pattern))
        options.month = 'short';
    else if (/M{2}/.test(pattern))
        options.month = '2-digit';
    else if (/M{1}/.test(pattern))
        options.month = 'numeric';
    if (/d{2,}/.test(pattern))
        options.day = '2-digit';
    else if (/d{1}/.test(pattern))
        options.day = 'numeric';
    return options;
}
/**
 * 工业级 ICU 数字模式解析器 (Token-based)
 */
function parseNumberPattern(pattern) {
    const options = {};
    if (!pattern)
        return options;
    const cleanPattern = pattern.startsWith('::') ? pattern.substring(2) : pattern;
    const tokens = cleanPattern.split(/\s+/);
    for (const token of tokens) {
        if (!token)
            continue;
        // 1. Style & Currency
        if (token === 'percent' || token === '%')
            options.style = 'percent';
        else if (token.startsWith('currency/')) {
            options.style = 'currency';
            options.currency = token.substring(9);
        }
        else if (token === 'currency')
            options.style = 'currency';
        // 2. Notation
        if (token.startsWith('compact-')) {
            options.notation = 'compact';
            options.compactDisplay = token.endsWith('-long') ? 'long' : 'short';
        }
        else if (token === 'scientific')
            options.notation = 'scientific';
        else if (token === 'engineering')
            options.notation = 'engineering';
        // 3. Precision
        if (token === 'precision-integer') {
            options.maximumFractionDigits = 0;
            options.minimumFractionDigits = 0;
        }
        else if (token.startsWith('precision-fraction/')) {
            const range = token.substring(19).split('-');
            options.minimumFractionDigits = parseInt(range[0], 10);
            options.maximumFractionDigits = parseInt(range[1] || range[0], 10);
        }
        else if (token.startsWith('precision-increment/')) {
            options.roundingIncrement = parseFloat(token.substring(20));
        }
        // 4. Sign Display
        if (token === 'sign-always')
            options.signDisplay = 'always';
        else if (token === 'sign-except-zero')
            options.signDisplay = 'exceptZero';
        else if (token === 'sign-accounting')
            options.currencySign = 'accounting';
        else if (token === 'sign-never')
            options.signDisplay = 'never';
        // 5. Grouping
        if (token === 'group-off')
            options.useGrouping = false;
        else if (token.startsWith('group-'))
            options.useGrouping = true;
        // 6. Unit
        if (token.startsWith('unit/')) {
            options.style = 'unit';
            options.unit = token.substring(5);
        }
        else if (token.startsWith('unit-width-')) {
            options.unitDisplay = token.substring(11);
        }
        // 7. Scale
        if (token.startsWith('scale/'))
            options.scale = parseFloat(token.substring(6));
        // 8. Legacy Regex Fallback (handle .00, .##, etc.)
        if (token.startsWith('.')) {
            const zeros = (token.match(/0/g) || []).length;
            const hashes = (token.match(/#/g) || []).length;
            options.minimumFractionDigits = zeros;
            options.maximumFractionDigits = zeros + hashes;
        }
    }
    if (cleanPattern.includes('%'))
        options.style = 'percent';
    if (cleanPattern.includes(',') && options.useGrouping === undefined)
        options.useGrouping = true;
    return options;
}
