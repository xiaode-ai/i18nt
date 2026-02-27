/**
 * ICU MessageFormat Parser & Formatter (Lightweight)
 * Zero dependencies, uses browser Intl APIs.
 */

type MessagePart =
  | string
  | { type: 'var'; name: string }
  | { type: 'plural'; name: string; offset: number; options: Record<string, MessagePart[]> }
  | { type: 'selectordinal'; name: string; offset: number; options: Record<string, MessagePart[]> }
  | { type: 'select'; name: string; options: Record<string, MessagePart[]> }
  | { type: 'number'; name: string; style?: string }
  | { type: 'date'; name: string; style?: string }
  | { type: 'time'; name: string; style?: string };

/**
 * 将解析出的 AST 格式化为字符串
 */
export function formatICU(
  parts: MessagePart[],
  params: Record<string, any>,
  locale: string
): string {
  let result = '';
  for (const part of parts) {
    if (typeof part === 'string') {
      result += part;
    } else if (part.type === 'var') {
      result += params[part.name] ?? `{${part.name}}`;
    } else if (part.type === 'plural' || part.type === 'selectordinal') {
      const value = Number(params[part.name]) || 0;
      const count = value - part.offset;
      const pluralRules = new Intl.PluralRules(locale, {
        type: part.type === 'selectordinal' ? 'ordinal' : 'cardinal'
      });
      const rule = pluralRules.select(count);
      
      const option = part.options[`=${value}`] || part.options[rule] || part.options.other;
      if (option) {
        result += formatICU(option, { ...params, '#': count }, locale);
      }
    } else if (part.type === 'select') {
      const value = String(params[part.name]);
      const option = part.options[value] || part.options.other;
      if (option) {
        result += formatICU(option, params, locale);
      }
    } else if (part.type === 'number') {
      const value = Number(params[part.name]);
      const options: Intl.NumberFormatOptions = {};
      if (part.style === 'currency') options.style = 'currency', options.currency = params.currency || 'USD';
      if (part.style === 'percent') options.style = 'percent';
      result += new Intl.NumberFormat(locale, options).format(value);
    } else if (part.type === 'date' || part.type === 'time') {
      const value = new Date(params[part.name]);
      const options: Intl.DateTimeFormatOptions = {};
      if (part.style === 'short') options.dateStyle = 'short', options.timeStyle = 'short';
      if (part.style === 'medium') options.dateStyle = 'medium', options.timeStyle = 'medium';
      if (part.style === 'long') options.dateStyle = 'long', options.timeStyle = 'long';
      if (part.style === 'full') options.dateStyle = 'full', options.timeStyle = 'full';
      
      const formatter = new Intl.DateTimeFormat(locale, part.type === 'date' ? { dateStyle: options.dateStyle || 'medium' } : { timeStyle: options.timeStyle || 'medium' });
      result += formatter.format(value);
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
            if (char === ',' && depth === 0) {
                segments.push(currentSegment.trim());
                currentSegment = '';
            } else {
                currentSegment += char;
            }
        }
        segments.push(currentSegment.trim());

        const name = segments[0];
        const type = segments[1];
        if (!type) return { type: 'var', name };

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
                return { type: 'select', name, options };
            }
            return { type: type as 'plural' | 'selectordinal', name, offset, options };
        }
        return { type: type as any, name, style: segments[2] };
    }
}

export function parseICU(message: string): MessagePart[] {
    return new Parser(message).parse();
}
