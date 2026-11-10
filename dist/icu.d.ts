/**
 * ICU MessageFormat Parser & Formatter (Lightweight)
 * Zero dependencies, uses browser Intl APIs.
 */
declare const INTL_CACHE: {
    number: Map<string, Intl.NumberFormat>;
    date: Map<string, Intl.DateTimeFormat>;
    plural: Map<string, Intl.PluralRules>;
    relative: Map<string, Intl.RelativeTimeFormat>;
    list: Map<string, Intl.ListFormat>;
};
/**
 * 辅助函数：安全获取 Intl 实例，增加环境检测
 */
export declare function getIntl<T extends keyof typeof INTL_CACHE>(type: T, locale: string, options: any): any;
type MessagePart = string | {
    type: 'var';
    name: string;
    isDouble?: boolean;
} | {
    type: 'plural';
    name: string;
    offset: number;
    options: Record<string, MessagePart[]>;
    isDouble?: boolean;
} | {
    type: 'selectordinal';
    name: string;
    offset: number;
    options: Record<string, MessagePart[]>;
    isDouble?: boolean;
} | {
    type: 'select';
    name: string;
    options: Record<string, MessagePart[]>;
    isDouble?: boolean;
} | {
    type: 'number';
    name: string;
    style?: string;
    isDouble?: boolean;
} | {
    type: 'date';
    name: string;
    style?: string;
    isDouble?: boolean;
} | {
    type: 'time';
    name: string;
    style?: string;
    isDouble?: boolean;
} | {
    type: 'relative';
    name: string;
    unit?: string;
    style?: string;
    isDouble?: boolean;
} | {
    type: 'list';
    name: string;
    style?: string;
    width?: string;
    isDouble?: boolean;
} | {
    type: 'unit';
    name: string;
    unit?: string;
    style?: string;
    isDouble?: boolean;
} | {
    type: 'range';
    name: string;
    style?: string;
    isDouble?: boolean;
} | {
    type: 'dateRange';
    name: string;
    style?: string;
    isDouble?: boolean;
} | {
    type: 'custom';
    name: string;
    formatter: string;
    arg?: string;
    isDouble?: boolean;
} | {
    type: 'tag';
    name: string;
    children: MessagePart[];
};
export type Renderer = (params: Record<string, any>, locale: string, formatters?: any) => string;
export type ChunkRenderer = (params: Record<string, any>, locale: string, formatters?: any) => any[];
/**
 * 辅助函数：转义 HTML 字符
 */
export declare function escapeHtml(str: string): string;
/**
 * 将解析出的 AST 格式化为字符串
 */
export declare function formatICU(parts: MessagePart[], params: Record<string, any>, locale: string, formatters?: Record<string, any>): string;
/**
 * 将解析出的 AST 格式化为片段数组（支持富文本组件）
 */
export declare function formatICUChunks(parts: MessagePart[], params: Record<string, any>, locale: string, formatters?: Record<string, any>): any[];
/**
 * JIT 编译器：将 AST 编译为极致优化的渲染函数
 */
export declare function compileICU(parts: MessagePart[]): Renderer;
export declare function compileICUChunks(parts: MessagePart[]): ChunkRenderer;
export declare function parseICU(message: string): MessagePart[];
/**
 * 从 ICU 部件列表中提取所有变量名（用于校验）
 */
export declare function extractVariables(parts: MessagePart[]): string[];
export {};
