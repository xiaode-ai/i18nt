/**
 * ICU MessageFormat Parser & Formatter (Lightweight)
 * Zero dependencies, uses browser Intl APIs.
 */

// LRU-like cache for Intl instances to boost performance
const INTL_CACHE = {
    number: new Map<string, Intl.NumberFormat>(),
    date: new Map<string, Intl.DateTimeFormat>(),
    plural: new Map<string, Intl.PluralRules>(),
    relative: new Map<string, Intl.RelativeTimeFormat>(),
    list: new Map<string, Intl.ListFormat>(),
};

/**
 * 辅助函数：安全获取 Intl 实例，增加环境检测
 */
export function getIntl<T extends keyof typeof INTL_CACHE>(
    type: T,
    locale: string,
    options: any
): any {
    const intlNameMap: Record<string, string> = {
        number: 'NumberFormat',
        date: 'DateTimeFormat',
        plural: 'PluralRules',
        relative: 'RelativeTimeFormat',
        list: 'ListFormat'
    };
    const intlName = intlNameMap[type];
    if (typeof Intl === 'undefined' || !(Intl as any)[intlName]) {
        console.error(`[i18nt] Environment does not support Intl.${type} (${intlName}). Please add polyfills.`);
        // 返回一个简单的模拟对象以防崩溃
        return { format: (v: any) => String(v), select: () => 'other', formatRange: (s: any, e: any) => `${s}-${e}` };
    }

    // 优化缓存键生成：对于空配置直接返回 locale，减少 JSON.stringify 开销
    const key = (!options || Object.keys(options).length === 0) ? locale : `${locale}:${JSON.stringify(options)}`;
    const cache = INTL_CACHE[type];
    if (!cache.has(key)) {
        try {
            if (type === 'number') cache.set(key, new Intl.NumberFormat(locale, options) as any);
            else if (type === 'date') cache.set(key, new Intl.DateTimeFormat(locale, options) as any);
            else if (type === 'plural') cache.set(key, new Intl.PluralRules(locale, options) as any);
            else if (type === 'relative') cache.set(key, new Intl.RelativeTimeFormat(locale, options) as any);
            else if (type === 'list') cache.set(key, new Intl.ListFormat(locale, options) as any);
        } catch (e) {
            console.error(`[i18nt] Failed to create Intl.${type} for locale "${locale}":`, e);
            return { format: (v: any) => String(v), select: () => 'other', formatRange: (s: any, e: any) => `${s}-${e}` };
        }
        
        // Simple cache eviction (limit to 100 entries per type)
        if (cache.size > 100) {
            const firstKey = cache.keys().next().value;
            if (firstKey !== undefined) cache.delete(firstKey);
        }
    }
    return cache.get(key);
}


/**
 * 常用语言的复数规则回退方案（当 Intl.PluralRules 不可用时使用）
 */
const PLURAL_RULES_FALLBACK: Record<string, (n: number) => Intl.LDMLPluralRule> = {
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
        if (v === 0 && i % 10 === 1 && i % 100 !== 11) return 'one';
        if (v === 0 && i % 10 >= 2 && i % 10 <= 4 && (i % 100 < 10 || i % 100 >= 20)) return 'few';
        return 'other';
    },
    'pl': (n) => {
        const i = Math.floor(Math.abs(n)), v = n.toString().replace(/^[^.]*\.?/, '').length;
        if (v === 0 && i === 1) return 'one';
        if (v === 0 && i % 10 >= 2 && i % 10 <= 4 && (i % 100 < 10 || i % 100 >= 20)) return 'few';
        return 'other';
    },
    'default': (n) => (n === 1 ? 'one' : 'other')
};

type MessagePart =
  | string
  | { type: 'var'; name: string; isDouble?: boolean }
  | { type: 'plural'; name: string; offset: number; options: Record<string, MessagePart[]>; isDouble?: boolean }
  | { type: 'selectordinal'; name: string; offset: number; options: Record<string, MessagePart[]>; isDouble?: boolean }
  | { type: 'select'; name: string; options: Record<string, MessagePart[]>; isDouble?: boolean }
  | { type: 'number'; name: string; style?: string; isDouble?: boolean }
  | { type: 'date'; name: string; style?: string; isDouble?: boolean }
  | { type: 'time'; name: string; style?: string; isDouble?: boolean }
  | { type: 'relative'; name: string; unit?: string; isDouble?: boolean }
  | { type: 'list'; name: string; style?: string; isDouble?: boolean }
  | { type: 'unit'; name: string; unit?: string; isDouble?: boolean }
  | { type: 'range'; name: string; style?: string; isDouble?: boolean }
  | { type: 'dateRange'; name: string; style?: string; isDouble?: boolean }
  | { type: 'custom'; name: string; formatter: string; arg?: string; isDouble?: boolean } // [NEW] 支持自定义格式化器
  | { type: 'tag'; name: string; children: MessagePart[] };

export type Renderer = (params: Record<string, any>, locale: string, formatters?: any) => string;
export type ChunkRenderer = (params: Record<string, any>, locale: string, formatters?: any) => any[];

/**
 * 辅助函数：转义 HTML 字符
 */
export function escapeHtml(str: string): string {
    if (typeof str !== 'string') return str;
    const map: Record<string, string> = {
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
export function formatICU(
  parts: MessagePart[],
  params: Record<string, any>,
  locale: string,
  formatters?: Record<string, any>
): string {
  let result = '';
  const escapeFn = formatters?.escape || ((s: string) => s);
  const shouldEscape = !!formatters?.escapeValue;

  for (const part of parts) {
    if (typeof part === 'string') {
      result += part;
    } else if (part.type === 'var') {
      const val = params[part.name] ?? (part.isDouble ? `{{${part.name}}}` : `{${part.name}}`);
      // 如果是双花括号 {{var}}，通常表示不转义（参考 i18next）
      // 或者如果显式禁用了转义
      if (part.isDouble || !shouldEscape || typeof val !== 'string') {
        result += val;
      } else {
        result += escapeFn(val);
      }
    } else if (part.type === 'plural' || part.type === 'selectordinal') {
      const value = Number(params[part.name]) || 0;
      const count = value - part.offset;
      let rule: Intl.LDMLPluralRule;
      try {
          const pluralRules = getIntl('plural', locale, {
            type: part.type === 'selectordinal' ? 'ordinal' : 'cardinal'
          });
          rule = pluralRules.select(count);
      } catch (e) {
          const lang = locale.split('-')[0];
          rule = (PLURAL_RULES_FALLBACK[lang] || PLURAL_RULES_FALLBACK.default)(count);
      }
      
      const option = part.options[`=${value}`] || part.options[rule] || part.options.other;
      if (option) {
        result += formatICU(option, { ...params, '#': count }, locale, formatters);
      }
    } else if (part.type === 'select') {
      const value = String(params[part.name]);
      const option = part.options[value] || part.options.other;
      if (option) {
        result += formatICU(option, params, locale, formatters);
      }
    } else if (part.type === 'number') {
      const value = Number(params[part.name]) || 0;
      let options: Intl.NumberFormatOptions = { ...params[`${part.name}Options`] };
      
      const style = part.style;
      if (style === 'currency') {
          options.style = 'currency';
          options.currency = options.currency || params.currency || 'USD';
      } else if (style === 'percent') {
          options.style = 'percent';
      } else if (style === 'integer') {
          options.maximumFractionDigits = 0;
      } else if (style === 'decimal') {
          options.style = 'decimal';
      } else if (style) {
          // 处理 ICU Skeleton (:: 开头) 或普通模式
          const pattern = style.startsWith('::') ? style.substring(2) : style;
          options = { ...options, ...parseNumberPattern(pattern) };
      }
      
      if (formatters?.formatNumber) {
          result += formatters.formatNumber(value, options);
      } else {
          result += getIntl('number', locale, options).format(value);
      }
    } else if (part.type === 'date' || part.type === 'time') {
      const value = params[part.name] instanceof Date ? params[part.name] : new Date(params[part.name]);
      let options: Intl.DateTimeFormatOptions = { ...params[`${part.name}Options`] };
      
      const style = part.style as string;
      const isStandardStyle = ['short', 'medium', 'long', 'full'].includes(style);
      
      if (isStandardStyle) {
          if (part.type === 'date') options.dateStyle = style as any;
          else options.timeStyle = style as any;
      } else if (style) {
          // 处理 ICU Skeleton (:: 开头) 或普通模式
          const pattern = style.startsWith('::') ? style.substring(2) : style;
          options = { ...options, ...parseDatePattern(pattern) };
      } else {
          if (part.type === 'date') options.dateStyle = options.dateStyle || 'medium';
          else options.timeStyle = options.timeStyle || 'medium';
      }
      
      if (part.type === 'date' && formatters?.formatDate) {
          result += formatters.formatDate(value, options);
      } else if (part.type === 'time' && formatters?.formatDate) {
          result += formatters.formatDate(value, options);
      } else {
          result += getIntl('date', locale, options).format(value);
      }
    } else if (part.type === 'relative') {
      const value = Number(params[part.name]) || 0;
      const unit = (part.unit || params[`${part.name}Unit`] || 'day') as Intl.RelativeTimeFormatUnit;
      const options: Intl.RelativeTimeFormatOptions = { 
          numeric: 'auto',
          ...params[`${part.name}Options`] 
      };
      
      if (formatters?.formatRelative) {
          result += formatters.formatRelative(value, unit, options);
      } else {
          result += getIntl('relative', locale, options).format(value, unit);
      }
    } else if (part.type === 'list') {
      const value = Array.isArray(params[part.name]) ? params[part.name] : [params[part.name]];
      const style = (part.style || params[`${part.name}Style`] || 'conjunction') as Intl.ListFormatType;
      const options: Intl.ListFormatOptions = { 
          type: style,
          style: (params[`${part.name}Width`] as any) || 'long',
          ...params[`${part.name}Options`] 
      };
      result += getIntl('list', locale, options).format(value);
    } else if (part.type === 'unit') {
      const value = Number(params[part.name]) || 0;
      const options: Intl.NumberFormatOptions = { 
          style: 'unit',
          unit: (part.unit || params[`${part.name}Unit`] || 'meter').replace(/_/g, '-'),
          ...params[`${part.name}Options`] 
      };
      result += getIntl('number', locale, options).format(value);
    } else if (part.type === 'range') {
        const val = params[part.name];
        const [start, end] = Array.isArray(val) ? val : [val, params[`${part.name}End`]];
        const options = { ...(part.style?.startsWith('::') ? parseNumberPattern(part.style.substring(2)) : {}), ...params[`${part.name}Options`] };
        result += (getIntl('number', locale, options) as any).formatRange(Number(start) || 0, Number(end) || 0);
    } else if (part.type === 'dateRange') {
        const val = params[part.name];
        const [start, end] = Array.isArray(val) ? val : [val, params[`${part.name}End`]];
        const options = { ...(part.style?.startsWith('::') ? parseDatePattern(part.style.substring(2)) : { dateStyle: 'medium' }), ...params[`${part.name}Options`] };
        const s = start instanceof Date ? start : new Date(start);
        const e = end instanceof Date ? end : new Date(end);
        result += (getIntl('date', locale, options) as any).formatRange(s, e);
    } else if (part.type === 'custom') {
        const value = params[part.name];
        const formatter = formatters?.[part.formatter];
        if (typeof formatter === 'function') {
            result += formatter(value, part.arg, locale, params);
        } else {
            result += String(value);
        }
    }
  }
  return result;
}

/**
 * 将解析出的 AST 格式化为片段数组（支持富文本组件）
 */
export function formatICUChunks(
  parts: MessagePart[],
  params: Record<string, any>,
  locale: string,
  formatters?: Record<string, any>
): any[] {
  const result: any[] = [];
  const escapeFn = formatters?.escape || ((s: string) => s);
  const shouldEscape = !!formatters?.escapeValue;

  for (const part of parts) {
    if (typeof part === 'string') {
      result.push(part);
    } else if (part.type === 'tag') {
      const children = formatICUChunks(part.children, params, locale, formatters);
      const render = params[part.name];
      if (typeof render === 'function') {
        const content = children.length === 1 && typeof children[0] === 'string' ? children[0] : children;
        result.push(render(content));
      } else {
        result.push(`<${part.name}>`);
        result.push(...children);
        result.push(`</${part.name}>`);
      }
    } else if (part.type === 'var') {
      const val = params[part.name] ?? (part.isDouble ? `{{${part.name}}}` : `{${part.name}}`);
      if (part.isDouble || !shouldEscape || typeof val !== 'string') {
        result.push(val);
      } else {
        result.push(escapeFn(val));
      }
    } else if (part.type === 'plural' || part.type === 'selectordinal') {
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
    } else if (part.type === 'select') {
      const value = String(params[part.name]);
      const option = part.options[value] || part.options.other;
      if (option) {
        result.push(...formatICUChunks(option, params, locale, formatters));
      }
    } else {
      result.push(formatICU([part], params, locale, formatters));
    }
  }
  return result;
}


class Parser {
    constructor(private message: string, private i = 0) {}
    parse(nested = false): MessagePart[] {
        const currentParts: MessagePart[] = [];
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
                    if (this.message[this.i] === "'") this.i++; // 跳过结尾的 '
                    continue;
                }
            }

            if (char === '{') {
                if (text) currentParts.push(text), text = '';
                // 处理 {{var}}
                const isDouble = nextChar === '{';
                this.i += isDouble ? 2 : 1;
                const tag = this.parseTag(isDouble);
                currentParts.push(tag);
            } else if (char === '}' && nested) {
                // 如果是嵌套模式，遇到 } 则返回
                if (text) currentParts.push(text);
                return currentParts;
            } else if (char === '#' && nested) {
                if (text) currentParts.push(text), text = '';
                currentParts.push({ type: 'var', name: '#' });
                this.i++;
            } else if (char === '<') {
                if (text) currentParts.push(text), text = '';
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
                } else {
                    text += char;
                    this.i++;
                }
            } else {
                text += char;
                this.i++;
            }
        }
        if (text) currentParts.push(text);
        return currentParts;
    }

    private parseTag(isDouble = false): MessagePart {
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
            } else if (!isDouble && char === '}') {
                braceDepth--;
                if (braceDepth === 0) {
                    this.i++;
                    break;
                }
            }

            if (char === '{') braceDepth++;
            
            tagContent += char;
            this.i++;
        }

        const segments: string[] = [];
        let currentSegment = '';
        let depth = 0;
        for (let j = 0; j < tagContent.length; j++) {
            const char = tagContent[j];
            if (char === '{') depth++;
            else if (char === '}') depth--;
            // Only split on the first two commas (name and type)
            // Subsequent commas are part of the style/pattern
            if (char === ',' && depth === 0 && segments.length < 2) {
                segments.push(currentSegment.trim());
                currentSegment = '';
            } else {
                currentSegment += char;
            }
        }
        segments.push(currentSegment.trim());

        const name = segments[0];
        const type = segments[1];
        if (!type) return { type: 'var', name, isDouble };

        if (type === 'plural' || type === 'selectordinal' || type === 'select') {
            const options: Record<string, MessagePart[]> = {};
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
                    if (optionsString[optIdx] === '{') bDepth++;
                    if (optionsString[optIdx] === '}') bDepth--;
                    if (bDepth > 0) optContent += optionsString[optIdx];
                    optIdx++;
                }
                
                options[key] = new Parser(optContent).parse(true);
            }
            if (type === 'select') {
                return { type: 'select', name, options, isDouble };
            }
            return { type: type as 'plural' | 'selectordinal', name, offset, options, isDouble };
        }
        if (type === 'relative') {
            return { type: 'relative', name, unit: segments[2], isDouble };
        }
        if (type === 'list') {
            return { type: 'list', name, style: segments[2], isDouble };
        }
        if (type === 'unit') {
            return { type: 'unit', name, unit: segments[2], isDouble };
        }
        const builtInTypes = ['plural', 'selectordinal', 'select', 'number', 'date', 'time', 'relative', 'list', 'unit', 'range', 'dateRange'];
        if (!builtInTypes.includes(type)) {
            return { type: 'custom', name, formatter: type, arg: segments[2], isDouble };
        }
        return { type: type as any, name, style: segments[2], isDouble };
    }
}

/**
 * JIT 编译器：将 AST 编译为极致优化的渲染函数
 */
export function compileICU(parts: MessagePart[]): Renderer {
    const renderers: ((params: Record<string, any>, locale: string, formatters?: any) => string)[] = [];

    for (const part of parts) {
        if (typeof part === 'string') {
            renderers.push(() => part);
        } else if (part.type === 'var') {
            const name = part.name;
            const isDouble = part.isDouble;
            renderers.push((params, _, formatters) => {
                const val = params[name] ?? (isDouble ? `{{${name}}}` : `{${name}}`);
                if (isDouble || !formatters?.escapeValue || typeof val !== 'string') return val;
                return (formatters.escape || escapeHtml)(val);
            });
        } else if (part.type === 'plural' || part.type === 'selectordinal') {
            const { name, offset, options: optParts, type } = part;
            const isOrdinal = type === 'selectordinal';
            const compiledOptions: Record<string, Renderer> = {};
            for (const key in optParts) compiledOptions[key] = compileICU(optParts[key]);
            
            renderers.push((params, locale, formatters) => {
                const value = Number(params[name]) || 0;
                const count = value - (offset || 0);
                let rule: Intl.LDMLPluralRule;
                try {
                    rule = getIntl('plural', locale, { type: isOrdinal ? 'ordinal' : 'cardinal' }).select(count);
                } catch (e) {
                    const lang = locale.split('-')[0];
                    rule = (PLURAL_RULES_FALLBACK[lang] || PLURAL_RULES_FALLBACK.default)(count);
                }
                const renderer = compiledOptions[`=${value}`] || compiledOptions[rule] || compiledOptions.other;
                // 将计算后的 count 注入 params，供子渲染器里的 '#' 使用
                const subParams = { ...params, '#': count.toString() };
                return renderer ? renderer(subParams, locale, formatters) : '';
            });
        } else if (part.type === 'select') {
            const { name, options: optParts } = part;
            const compiledOptions: Record<string, Renderer> = {};
            for (const key in optParts) compiledOptions[key] = compileICU(optParts[key]);

            renderers.push((params, locale, formatters) => {
                const value = String(params[name]);
                const renderer = compiledOptions[value] || compiledOptions.other;
                return renderer ? renderer(params, locale, formatters) : '';
            });
        } else if (part.type === 'number') {
            const { name, style } = part;
            const pattern = style?.startsWith('::') ? style.substring(2) : style;
            const staticOptions = style ? (style.startsWith('::') ? parseNumberPattern(pattern!) : {}) : {};
            
            renderers.push((params, locale, formatters) => {
                let value = Number(params[name]) || 0;
                const options = { ...staticOptions, ...params[`${name}Options`] };
                
                // 处理 Scaling (ICU Skeleton scale/xxx)
                if ((staticOptions as any).scale) value *= (staticOptions as any).scale;

                if (style === 'currency') {
                    options.style = 'currency';
                    options.currency = options.currency || params.currency || 'USD';
                } else if (style === 'percent') options.style = 'percent';
                else if (style === 'integer') options.maximumFractionDigits = 0;
                
                return formatters?.formatNumber 
                    ? formatters.formatNumber(value, options)
                    : getIntl('number', locale, options).format(value);
            });
        } else if (part.type === 'date' || part.type === 'time') {
            const { name, style, type } = part;
            const isDate = type === 'date';
            const isStandard = ['short', 'medium', 'long', 'full'].includes(style || '');
            const staticOptions: any = {};
            if (isStandard) {
                if (isDate) staticOptions.dateStyle = style;
                else staticOptions.timeStyle = style;
            } else if (style) {
                const pattern = style.startsWith('::') ? style.substring(2) : style;
                Object.assign(staticOptions, parseDatePattern(pattern));
            } else {
                if (isDate) staticOptions.dateStyle = 'medium';
                else staticOptions.timeStyle = 'medium';
            }

            renderers.push((params, locale, formatters) => {
                const val = params[name];
                const value = val instanceof Date ? val : new Date(val);
                const options = { ...staticOptions, ...params[`${name}Options`] };
                return formatters?.formatDate
                    ? formatters.formatDate(value, options)
                    : getIntl('date', locale, options).format(value);
            });
        } else if (part.type === 'relative') {
            const { name, unit: staticUnit } = part;
            renderers.push((params, locale, formatters) => {
                const value = Number(params[name]) || 0;
                const unit = (staticUnit || params[`${name}Unit`] || 'day') as any;
                const options = { numeric: 'auto', ...params[`${name}Options`] };
                return formatters?.formatRelative
                    ? formatters.formatRelative(value, unit, options)
                    : getIntl('relative', locale, options).format(value, unit);
            });
        } else if (part.type === 'list') {
            const { name, style } = part;
            renderers.push((params, locale) => {
                const value = (Array.isArray(params[name]) ? params[name] : [params[name]]).filter((v: any) => v !== undefined);
                const options = { type: (style as any) || 'conjunction', ...params[`${name}Options`] };
                return getIntl('list', locale, options).format(value);
            });
        } else if (part.type === 'range') {
            const { name, style } = part;
            const pattern = style?.startsWith('::') ? style.substring(2) : style;
            const staticOptions = style ? (style.startsWith('::') ? parseNumberPattern(pattern!) : {}) : {};
            renderers.push((params, locale) => {
                const val = params[name];
                const [start, end] = Array.isArray(val) ? val : [val, params[`${name}End`]];
                const options = { ...staticOptions, ...params[`${name}Options`] };
                return (getIntl('number', locale, options) as any).formatRange(Number(start) || 0, Number(end) || 0);
            });
        } else if (part.type === 'dateRange') {
            const { name, style } = part;
            const pattern = style?.startsWith('::') ? style.substring(2) : style;
            const staticOptions = style ? (style.startsWith('::') ? parseDatePattern(pattern!) : {}) : { dateStyle: 'medium' };
            renderers.push((params, locale) => {
                const val = params[name];
                const [start, end] = Array.isArray(val) ? val : [val, params[`${name}End`]];
                const options = { ...staticOptions, ...params[`${name}Options`] };
                const s = start instanceof Date ? start : new Date(start);
                const e = end instanceof Date ? end : new Date(end);
                return (getIntl('date', locale, options) as any).formatRange(s, e);
            });
        } else if (part.type === 'unit') {
            const { name, unit: staticUnit } = part;
            renderers.push((params, locale) => {
                const value = Number(params[name]) || 0;
                const unit = (staticUnit || params[`${name}Unit`] || 'meter').replace(/_/g, '-');
                const options = { style: 'unit', unit, ...params[`${name}Options`] };
                return getIntl('number', locale, options).format(value);
            });
        } else if (part.type === 'custom') {
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

export function compileICUChunks(parts: MessagePart[]): ChunkRenderer {
    const renderers: ((params: Record<string, any>, locale: string, formatters?: any) => any)[] = [];

    for (const part of parts) {
        if (typeof part === 'string') {
            renderers.push(() => part);
        } else if (part.type === 'tag') {
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
        } else if (part.type === 'plural' || part.type === 'selectordinal' || part.type === 'select') {
            const renderer = compileICU([part]);
            renderers.push(renderer);
        } else if (part.type === 'var') {
            const name = part.name;
            const isDouble = part.isDouble;
            renderers.push((params, _, formatters) => {
                const val = params[name] ?? (isDouble ? `{{${name}}}` : `{${name}}`);
                if (isDouble || !formatters?.escapeValue || typeof val !== 'string') return val;
                return (formatters.escape || escapeHtml)(val);
            });
        } else {
            const renderer = compileICU([part]);
            renderers.push(renderer);
        }
    }

    return (params, locale, formatters) => {
        const result: any[] = [];
        for (let i = 0; i < renderers.length; i++) {
            const val = renderers[i](params, locale, formatters);
            if (Array.isArray(val)) result.push(...val);
            else result.push(val);
        }
        return result;
    };
}

export function parseICU(message: string): MessagePart[] {
    return new Parser(message).parse();
}

/**
 * 从 ICU 部件列表中提取所有变量名（用于校验）
 */
export function extractVariables(parts: MessagePart[]): string[] {
    const vars = new Set<string>();
    const walk = (p: MessagePart[]) => {
        for (const part of p) {
            if (typeof part === 'string') continue;
            if (part.name && part.name !== '#') vars.add(part.name);
            
            if (part.type === 'plural' || part.type === 'selectordinal' || part.type === 'select') {
                for (const key in part.options) walk(part.options[key]);
            } else if (part.type === 'tag') {
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
function parseDatePattern(pattern: string): Intl.DateTimeFormatOptions {
    const options: Intl.DateTimeFormatOptions = {};
    
    // 1. 处理预定义的 Skeleton (:: 开头)
    if (pattern.startsWith('::')) {
        const skeleton = pattern.substring(2);
        // Era
        if (skeleton.includes('G')) options.era = skeleton.match(/GGGG/) ? 'long' : (skeleton.match(/GGGGG/) ? 'narrow' : 'short');
        // Year
        if (skeleton.includes('y')) options.year = skeleton.match(/yyyy/) ? 'numeric' : (skeleton.match(/yy/) ? '2-digit' : 'numeric');
        // Month
        if (skeleton.includes('M') || skeleton.includes('L')) {
            const mMatch = skeleton.match(/[ML]+/);
            const mCount = mMatch ? mMatch[0].length : 0;
            if (mCount >= 5) options.month = 'narrow';
            else if (mCount === 4) options.month = 'long';
            else if (mCount === 3) options.month = 'short';
            else if (mCount === 2) options.month = '2-digit';
            else options.month = 'numeric';
        }
        // Day
        if (skeleton.includes('d')) options.day = skeleton.match(/dd/) ? '2-digit' : 'numeric';
        // Weekday
        if (skeleton.includes('E') || skeleton.includes('e') || skeleton.includes('c')) {
            const eMatch = skeleton.match(/[Eec]+/);
            const eCount = eMatch ? eMatch[0].length : 0;
            if (eCount >= 5) options.weekday = 'narrow';
            else if (eCount === 4) options.weekday = 'long';
            else options.weekday = 'short';
        }
        // Hour
        if (skeleton.includes('H')) { options.hour = (skeleton.match(/HH/) ? '2-digit' : 'numeric'); options.hour12 = false; }
        if (skeleton.includes('h') || skeleton.includes('K')) { options.hour = (skeleton.match(/[hK]{2}/) ? '2-digit' : 'numeric'); options.hour12 = true; }
        // Minute
        if (skeleton.includes('m')) options.minute = (skeleton.match(/mm/) ? '2-digit' : 'numeric');
        // Second
        if (skeleton.includes('s')) options.second = (skeleton.match(/ss/) ? '2-digit' : 'numeric');
        // TimeZone
        if (skeleton.includes('z') || skeleton.includes('v') || skeleton.includes('V') || skeleton.includes('O')) {
            options.timeZoneName = (skeleton.match(/[zvVO]{4,}/) ? 'long' : 'short');
        }
        // DayPeriod
        if (skeleton.includes('a') || skeleton.includes('b') || skeleton.includes('B')) options.dayPeriod = 'short';
        
        return options;
    }

    // 2. 处理普通模式 (兼容性转换)
    if (/y{4,}/i.test(pattern)) options.year = 'numeric';
    else if (/y{2}/i.test(pattern)) options.year = '2-digit';
    else if (/y/i.test(pattern)) options.year = 'numeric';

    if (/M{4,}/.test(pattern)) options.month = 'long';
    else if (/M{3}/.test(pattern)) options.month = 'short';
    else if (/M{2}/.test(pattern)) options.month = '2-digit';
    else if (/M{1}/.test(pattern)) options.month = 'numeric';

    if (/d{2,}/.test(pattern)) options.day = '2-digit';
    else if (/d{1}/.test(pattern)) options.day = 'numeric';

    if (/H{2,}/.test(pattern)) { options.hour = '2-digit'; options.hour12 = false; }
    else if (/H{1}/.test(pattern)) { options.hour = 'numeric'; options.hour12 = false; }
    else if (/h{2,}/.test(pattern)) { options.hour = '2-digit'; options.hour12 = true; }
    else if (/h{1}/.test(pattern)) { options.hour = 'numeric'; options.hour12 = true; }

    if (/m{2,}/.test(pattern)) options.minute = '2-digit';
    else if (/m{1}/.test(pattern)) options.minute = 'numeric';

    if (/s{2,}/.test(pattern)) options.second = '2-digit';
    else if (/s{1}/.test(pattern)) options.second = 'numeric';

    if (/E{4,}/.test(pattern)) options.weekday = 'long';
    else if (/E{1,3}/.test(pattern)) options.weekday = 'short';

    if (pattern.includes('z')) options.timeZoneName = 'short';
    if (pattern.includes('G')) options.era = 'short';

    return options;
}

/**
 * 轻量级 ICU 数字模式解析器
 */
function parseNumberPattern(pattern: string): Intl.NumberFormatOptions {
    const options: Intl.NumberFormatOptions = {};
    
    // 0. 处理 :: 开头的 Skeleton
    const cleanPattern = pattern.startsWith('::') ? pattern.substring(2) : pattern;

    // 1. 处理基础样式
    if (cleanPattern.includes('percent')) options.style = 'percent';
    if (cleanPattern.includes('currency')) {
        options.style = 'currency';
        const m = cleanPattern.match(/currency\/([A-Z]{3})/);
        options.currency = m ? m[1] : 'USD';
    }

    // 2. 处理缩写与紧凑模式
    if (cleanPattern.includes('compact-short')) options.notation = 'compact';
    if (cleanPattern.includes('compact-long')) { options.notation = 'compact'; options.compactDisplay = 'long'; }
    if (cleanPattern.includes('scientific')) options.notation = 'scientific';
    if (cleanPattern.includes('engineering')) options.notation = 'engineering';

    // 3. 处理符号与分组
    if (cleanPattern.includes('sign-always')) options.signDisplay = 'always';
    else if (cleanPattern.includes('sign-except-zero')) options.signDisplay = 'exceptZero';
    else if (cleanPattern.includes('sign-accounting')) options.currencySign = 'accounting';
    else if (cleanPattern.includes('sign-never')) options.signDisplay = 'never';
    
    if (cleanPattern.includes('group-off')) options.useGrouping = false;
    else if (cleanPattern.includes('group-min2')) options.useGrouping = true; 
    else if (cleanPattern.includes('group-auto')) options.useGrouping = true;

    // 4. 处理单位
    const unitMatch = cleanPattern.match(/unit\/([a-z-]+)/);
    if (unitMatch) {
        options.style = 'unit';
        options.unit = unitMatch[1];
        if (cleanPattern.includes('unit-narrow')) options.unitDisplay = 'narrow';
        else if (cleanPattern.includes('unit-short')) options.unitDisplay = 'short';
        else if (cleanPattern.includes('unit-long')) options.unitDisplay = 'long';
    }

    // 4.1 处理货币显示
    if (options.style === 'currency') {
        if (cleanPattern.includes('currency-symbol')) options.currencyDisplay = 'symbol';
        else if (cleanPattern.includes('currency-code')) options.currencyDisplay = 'code';
        else if (cleanPattern.includes('currency-name')) options.currencyDisplay = 'name';
        else if (cleanPattern.includes('currency-narrow')) options.currencyDisplay = 'narrowSymbol';
    }

    // 4.2 处理编号系统
    const nuMatch = cleanPattern.match(/numbering-system\/([a-z]+)/);
    if (nuMatch) options.numberingSystem = nuMatch[1];

    // 5. 处理精度: .00 (min 2), .## (max 2), .00## (min 2, max 4)
    const precisionMatch = cleanPattern.match(/\.([0#]+)/);
    if (precisionMatch) {
        const fractionPart = precisionMatch[1];
        const zeros = (fractionPart.match(/0/g) || []).length;
        const hashes = (fractionPart.match(/#/g) || []).length;
        options.minimumFractionDigits = zeros;
        options.maximumFractionDigits = zeros + hashes;
    }
    
    // 5.1 处理显著位数 (Significant Digits): @@ (min 2), @### (max 4)
    const sigMatch = cleanPattern.match(/(@+)(#*)/);
    if (sigMatch) {
        options.minimumSignificantDigits = sigMatch[1].length;
        options.maximumSignificantDigits = sigMatch[1].length + sigMatch[2].length;
    }

    // 6. 处理整数最小位数: 000
    const integerMatch = cleanPattern.match(/(^|[^.])(0{2,})/);
    if (integerMatch) {
        options.minimumIntegerDigits = integerMatch[2].length;
    }
    
    // 7. 舍入模式 (Rounding Mode)
    if (cleanPattern.includes('round-up')) (options as any).roundingMode = 'ceil';
    else if (cleanPattern.includes('round-down')) (options as any).roundingMode = 'floor';
    else if (cleanPattern.includes('round-half-up')) (options as any).roundingMode = 'halfExpand';
    else if (cleanPattern.includes('round-half-even')) (options as any).roundingMode = 'halfEven';

    // 8. 缩放 (Scaling) - 存入 options 供编译器使用
    const scaleMatch = cleanPattern.match(/scale\/(\d+)/);
    if (scaleMatch) (options as any).scale = parseFloat(scaleMatch[1]);

    if (cleanPattern.includes('%')) options.style = 'percent';
    if (cleanPattern.includes(',') && options.useGrouping === undefined) options.useGrouping = true;
    
    return options;
}
