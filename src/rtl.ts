/**
 * i18nt — RTL 自动检测与 DOM 同步
 */

/** 常见的 RTL 语言前缀 */
const RTL_PREFIXES = ['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi', 'ku'];

/**
 * 判断给定语言代码是否是 RTL（从右往左）语言
 */
export function isRTLLocale(locale: string): boolean {
  return RTL_PREFIXES.some((prefix) => locale.startsWith(prefix));
}

/**
 * 将 HTML 根节点的 dir 和 lang 属性与当前语言同步
 * 仅在浏览器环境下生效
 */
export function syncDocumentDirection(locale: string): void {
  if (typeof document === 'undefined') return;
  const rtl = isRTLLocale(locale);
  document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  document.documentElement.lang = locale;
}
