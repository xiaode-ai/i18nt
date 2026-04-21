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

/** 插件接口定义 */
export interface I18nPlugin<T extends TranslationDict = any> {
  name: string;
  /** 初始化钩子 */
  onInit?: (instance: I18nInstance<T>) => void;
  /** 语言切换钩子 */
  onLocaleChange?: (locale: string, instance: I18nInstance<T>) => void;
  /** 缺失 Key 钩子 */
  onMissingKey?: (path: string, locale: string, instance: I18nInstance<T>) => void;
}

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
  extraDicts?: TranslationDict[];
  /** 额外语言的代码列表（与 extraDicts 一一对应） */
  extraLangs?: string[];
  /** 是否在开发模式下打印 Missing Key 警告（默认 true） */
  devWarnings?: boolean;
  /** 语言切换时的初始回调 */
  onLocaleChange?: (locale: string) => void;
  /** 缺失 Key 时的回调 */
  onMissingKey?: (path: string, locale: string) => void;
  /** 自定义格式化器（用于覆盖原生 Intl API，解决环境兼容性） */
  formatters?: Partial<Formatters>;
  /** 动态加载器映射（用于按需加载命名空间） */
  loaders?: Record<string, () => Promise<TranslationDict | { default: TranslationDict }>>;
  /** OTA 远程字典加载器 */
  otaLoader?: (locale: string) => Promise<TranslationDict>;
  /** 插件列表 */
  plugins?: I18nPlugin<T>[];
}

/** 语言切换监听器 */
export type LocaleChangeListener = (locale: string) => void;

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

/** 辅助类型：从 ICU 字符串中提取变量名 */
export type ExtractVars<S extends string> =
  S extends `${string}{${infer Var}}${infer Rest}`
    ? (Var extends `${infer Name},${string}` ? FilterVar<Trim<Name>> : FilterVar<Trim<Var>>) | ExtractVars<Rest>
    : never;

type Trim<S extends string> = S extends ` ${infer T}` ? Trim<T> : S extends `${infer T} ` ? Trim<T> : S;

/** 过滤非变量 Token（如 ICU 的 #、带空格的内容、或者是选项值） */
type FilterVar<S extends string> = 
  S extends `#${string}` ? never : 
  S extends `=${string}` ? never :
  S extends `${string} ${string}` ? never : // 变量通常不含空格
  S extends 'other' | 'one' | 'two' | 'few' | 'many' | 'zero' ? never : // 排除复数关键字
  S;

/** 根据变量名生成参数类型 */
export type ParamsType<S extends string> = [ExtractVars<S>] extends [never]
  ? Record<string, any>
  : Record<ExtractVars<S>, any>;

/** 递归映射字典类型，使叶子节点支持函数式调用 */
export type TypedT<T> = {
  [K in keyof T]: T[K] extends string
    ? ((params: ParamsType<T[K]>) => any) & string
    : T[K] extends string[]
    ? ((params: ParamsType<T[K][number]>) => any) & string
    : T[K] extends object
    ? TypedT<T[K]>
    : T[K];
};

/** translate 函数签名 */
export type TranslateFn = (path: string, params?: Record<string, any>) => any;

/** createI18n 返回的实例 */
export interface I18nInstance<T extends TranslationDict = TranslationDict> {
  /** 翻译函数 + Proxy 属性访问 + 格式化助手 */
  t: TranslateFn & TypedT<T> & Formatters;
  /** 当前语言代码 */
  locale: string;
  /** 切换语言 */
  setLocale: (lang: string, options?: { extraDicts?: TranslationDict[]; extraLangs?: string[] }) => Promise<void>;
  /** 所有可用语言列表 */
  availableLocales: string[];
  /** 当前语言是否为 RTL */
  isRTL: boolean;
  /** 订阅语言切换事件 */
  onChange: (fn: LocaleChangeListener) => () => void;
  /** 加载命名空间 */
  loadNamespace: (name: string) => Promise<void>;
  /** 手动添加翻译包 */
  addTranslations: (dict: TranslationDict, lang?: string) => void;
}
