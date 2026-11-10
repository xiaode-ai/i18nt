/**
 * i18nt — RTL 自动检测与 DOM 同步
 */
/**
 * 判断给定语言代码是否是 RTL（从右往左）语言
 */
export declare function isRTLLocale(locale: string): boolean;
/**
 * 同步文档方向到 HTML 标签
 */
export declare function syncDocumentDirection(locale: string): void;
