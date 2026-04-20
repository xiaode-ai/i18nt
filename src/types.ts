/**
 * i18nt — 极致轻量的国际化框架
 * 公共类型定义
 */

/** 翻译值：可以是字符串（ICU 语法）、数组（多语言）、对象（复数或嵌套命名空间） */
export type TranslationValue = string | string[] | Record<string, any> | any[];

/** 翻译字典 */
export interface TranslationDict {
  [key: string]: TranslationValue | TranslationDict;
}

/** 复数规则对象，key 为 Intl.PluralRules 返回的类别 */
export type PluralEntry = Record<string, string>;

/** 框架配置 */
export interface I18nConfig<T extends TranslationDict = TranslationDict> {
  /** 翻译字典（Source of Truth） */
  translations: T;
  /** 语言代码顺序，与字典数组索引一一对应 */
  langOrder: readonly string[];
  /** 当前激活的语言代码 */
  locale: string;
  /** 翻译缺失时的回退语言索引（默认 0） */
  fallbackIndex?: number;
  /** 额外的扁平字典（运行时动态加载的 JSON 语言包） */
  extraDicts?: Record<string, string>[];
  /** 额外语言的代码列表（与 extraDicts 一一对应） */
  extraLangs?: string[];
  /** 是否在开发模式下打印 Missing Key 警告（默认 true） */
  devWarnings?: boolean;
}

/** 格式化助手接口 */
export interface Formatters {
  /** 数字本地化 */
  n: (val: number, options?: Intl.NumberFormatOptions) => string;
  formatNumber: (val: number, options?: Intl.NumberFormatOptions) => string;
  /** 日期本地化 */
  d: (val: Date | number, options?: Intl.DateTimeFormatOptions) => string;
  formatDate: (val: Date | number, options?: Intl.DateTimeFormatOptions) => string;
  /** 相对时间 */
  relative: (val: number, unit: Intl.RelativeTimeFormatUnit) => string;
  formatRelative: (val: number, unit: Intl.RelativeTimeFormatUnit) => string;
}

/** translate 函数签名 */
export type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

/** createI18n 返回的实例 */
export interface I18nInstance<T extends TranslationDict = TranslationDict> {
  /** 翻译函数 + Proxy 属性访问 + 格式化助手 */
  t: TranslateFn & T & Formatters;
  /** 当前语言代码 */
  locale: string;
  /** 切换语言或更新动态字典 */
  setLocale: (lang: string, options?: { extraDicts?: Record<string, any>[]; extraLangs?: string[] }) => void;
  /** 所有可用语言列表 */
  availableLocales: string[];
  /** 当前语言是否为 RTL */
  isRTL: boolean;
}
