/**
 * i18nt — RTL 自动检测与 DOM 同步
 */
/** 常见的 RTL 语言前缀 */
const RTL_PREFIXES = ['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi', 'ku'];
/**
 * 判断给定语言代码是否是 RTL（从右往左）语言
 */
export function isRTLLocale(locale) {
    if (!locale)
        return false;
    const lang = locale.toLowerCase().split('-')[0];
    return RTL_PREFIXES.includes(lang);
}
/**
 * 同步文档方向到 HTML 标签
 */
export function syncDocumentDirection(locale) {
    if (typeof document === 'undefined')
        return;
    const rtl = isRTLLocale(locale);
    if (document?.documentElement) {
        document.documentElement.dir = rtl ? 'rtl' : 'ltr';
        document.documentElement.lang = locale;
    }
}
