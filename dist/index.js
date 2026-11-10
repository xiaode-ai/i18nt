/**
 * i18nt — 统一导出入口
 */
export { createI18n, preCompile } from './core.js';
export { isRTLLocale, syncDocumentDirection } from './rtl.js';
export { parseICU, compileICU, extractVariables } from './icu.js';
