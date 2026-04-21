/**
 * ICU MessageFormat Parser & Formatter (Lightweight)
 * Zero dependencies, uses browser Intl APIs.
 */

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
  | { type: 'tag'; name: string; children: MessagePart[] };

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
      const pluralRules = new Intl.PluralRules(locale, {
        type: part.type === 'selectordinal' ? 'ordinal' : 'cardinal'
      });
      const rule = pluralRules.select(count);
      
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
          result += new Intl.NumberFormat(locale, options).format(value);
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
          result += new Intl.DateTimeFormat(locale, options).format(value);
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
          result += new Intl.RelativeTimeFormat(locale, options).format(value, unit);
      }
    } else if (part.type === 'list') {
      const value = Array.isArray(params[part.name]) ? params[part.name] : [params[part.name]];
      const options: Intl.ListFormatOptions = { 
          type: (part.style as any) || 'conjunction',
          ...params[`${part.name}Options`] 
      };
      result += new Intl.ListFormat(locale, options).format(value);
    } else if (part.type === 'unit') {
      const value = Number(params[part.name]) || 0;
      const options: Intl.NumberFormatOptions = { 
          style: 'unit',
          unit: (part.unit || params[`${part.name}Unit`] || 'meter').replace(/_/g, '-'),
          ...params[`${part.name}Options`] 
      };
      result += new Intl.NumberFormat(locale, options).format(value);
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
      const pluralRules = new Intl.PluralRules(locale, {
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
                if (nextChar === '{' || nextChar === '}' || nextChar === '#') {
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
        return { type: type as any, name, style: segments[2], isDouble };
    }
}

export function parseICU(message: string): MessagePart[] {
    return new Parser(message).parse();
}

/**
 * 轻量级 ICU 日期模式解析器
 */
function parseDatePattern(pattern: string): Intl.DateTimeFormatOptions {
    const options: Intl.DateTimeFormatOptions = {};
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
    
    // 1. 处理基础样式
    if (pattern === 'percent') { options.style = 'percent'; return options; }
    if (pattern === 'currency') { options.style = 'currency'; options.currency = 'USD'; return options; }

    // 2. 处理货币: currency/USD
    const currencyMatch = pattern.match(/currency\/([A-Z]{3})/);
    if (currencyMatch) {
        options.style = 'currency';
        options.currency = currencyMatch[1];
    }

    // 3. 处理缩写: compact-short/long
    if (pattern.includes('compact-short')) options.notation = 'compact';
    if (pattern.includes('compact-long')) { options.notation = 'compact'; options.compactDisplay = 'long'; }

    // 4. 处理符号: sign-always/never
    if (pattern.includes('sign-always')) options.signDisplay = 'always';
    if (pattern.includes('sign-except-zero')) options.signDisplay = 'exceptZero';

    // 5. 处理单位: unit/kilogram
    const unitMatch = pattern.match(/unit\/([a-z-]+)/);
    if (unitMatch) {
        options.style = 'unit';
        options.unit = unitMatch[1];
    }

    // 6. 处理精度: .00 (min 2), .## (max 2)
    const dotIndex = pattern.indexOf('.');
    if (dotIndex !== -1) {
        const fractionPart = pattern.substring(dotIndex + 1).split(' ')[0];
        const zeros = (fractionPart.match(/0/g) || []).length;
        const hashes = (fractionPart.match(/#/g) || []).length;
        options.minimumFractionDigits = zeros;
        options.maximumFractionDigits = zeros + hashes;
    }
    
    if (pattern.includes('%')) options.style = 'percent';
    if (pattern.includes(',')) options.useGrouping = true;
    
    return options;
}
