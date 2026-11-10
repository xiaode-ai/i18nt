/**
 * i18nt — 语言探测器
 */
import type { LanguageDetector } from './types.js';
/**
 * 浏览器探测器：通过 navigator.languages 获取语言
 */
export declare const browserDetector: LanguageDetector;
/**
 * 路径探测器：从 URL 路径获取语言（例如 /en/home -> en）
 */
export declare const pathDetector: LanguageDetector;
/**
 * 查询参数探测器：从 URL 参数获取语言（例如 ?lng=zh）
 */
export declare const queryDetector: LanguageDetector;
/**
 * Cookie 探测器
 */
export declare const cookieDetector: LanguageDetector;
/**
 * LocalStorage 探测器
 */
export declare const localStorageDetector: LanguageDetector;
/**
 * 环境探测器：适用于 Node.js, Bun 等服务器端环境
 */
export declare const serverDetector: LanguageDetector;
export declare const BUILTIN_DETECTORS: LanguageDetector[];
