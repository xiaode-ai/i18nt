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
/** 语言探测器接口 */
export interface LanguageDetector {
    name: string;
    lookup: (options?: any) => string | string[] | undefined | null;
    cacheUserLanguage?: (lng: string, options?: any) => void;
}
/** 语言探测配置 */
export interface DetectionOptions {
    /** 探测顺序，例如 ['querystring', 'cookie', 'localStorage', 'navigator'] */
    order?: string[];
    /** 查找语言的参数名（如 URL 参数名、Cookie 名等） */
    lookupQuerystring?: string;
    lookupCookie?: string;
    lookupLocalStorage?: string;
    /** 是否缓存探测结果 */
    caches?: string[];
    /** Cookie 配置 */
    cookieOptions?: {
        path?: string;
        domain?: string;
        sameSite?: 'strict' | 'lax' | 'none';
        secure?: boolean;
    };
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
    /** 字典增加钩子 */
    onTranslationsAdded?: (dict: TranslationDict, locale: string, instance: I18nInstance<T>) => void;
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
    /** 语言探测配置 */
    detection?: DetectionOptions;
    /** 自定义探测器列表 */
    customDetectors?: LanguageDetector[];
    /** 是否在开发模式下打印 Missing Key 警告（默认 true） */
    devWarnings?: boolean;
    /** 语言切换时的初始回调 */
    onLocaleChange?: (locale: string) => void;
    /** 缺失 Key 时的回调 */
    onMissingKey?: (path: string, locale: string) => void;
    /** 自定义格式化器（用于覆盖原生 Intl API，解决环境兼容性） */
    formatters?: Partial<Formatters>;
    /** 动态加载器映射（用于按需加载命名空间） */
    loaders?: Record<string, () => Promise<TranslationDict | {
        default: TranslationDict;
    }>>;
    /** OTA 远程字典加载器 */
    otaLoader?: (locale: string) => Promise<TranslationDict>;
    /** 语言回退映射（树状回退），例如 {'zh-HK': ['zh-TW', 'zh-CN']} */
    fallbacks?: Record<string, string | string[]>;
    /** 命名空间回退映射，当在 A 命名空间找不到 Key 时，尝试从 B 查找 */
    fallbackNamespaces?: string | string[];
    /** 插件列表 */
    plugins?: I18nPlugin<T>[];
    /** 是否自动转义插值变量以防止 XSS（默认 true） */
    escapeValue?: boolean;
    /** 自定义转义函数（如果 escapeValue 为 true） */
    escape?: (str: string) => string;
    /** 是否在初始化时预解析所有 ICU 字符串（大幅提升运行时性能） */
    preParse?: boolean;
    /** 是否开启调试模式（视觉高亮缺失 Key） */
    debug?: boolean;
    /** 后处理器队列（翻译完成后执行） */
    postProcessors?: ((val: any, key?: string) => any)[];
    /** 全局数字格式化默认选项 */
    numberFormatOptions?: Intl.NumberFormatOptions;
    /** 全局日期格式化默认选项 */
    dateFormatOptions?: Intl.DateTimeFormatOptions;
    /** 全局相对时间格式化默认选项 */
    relativeTimeFormatOptions?: Intl.RelativeTimeFormatOptions;
    /** 全局列表格式化默认选项 */
    listFormatOptions?: Intl.ListFormatOptions;
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
    relative: (val: number, unit: Intl.RelativeTimeFormatUnit, options?: Intl.RelativeTimeFormatOptions) => string;
    formatRelative: (val: number, unit: Intl.RelativeTimeFormatUnit, options?: Intl.RelativeTimeFormatOptions) => string;
    /** 列表格式化 */
    formatList: (val: any[], options?: Intl.ListFormatOptions) => string;
}
/** 辅助类型：推断变量类型 */
type InferVarType<T extends string> = T extends 'plural' | 'selectordinal' | 'number' ? number : T extends 'date' | 'time' ? Date | number : T extends 'select' ? string : T extends 'list' ? any[] : T extends 'relative' ? number : T extends 'unit' ? number : T extends 'range' ? number[] | number : T extends 'dateRange' ? (Date | number)[] | (Date | number) : any;
/** 辅助类型：从 ICU 字符串中提取变量名及其类型对象 */
export type ExtractVarsObj<S extends string> = ExtractVarsOnly<S> & ExtractTagsOnly<S>;
type ExtractVarsOnly<S extends string> = S extends `${string}{${infer Var}}${infer Rest}` ? (Var extends `${infer Name},${infer Type},${string}` ? (FilterVar<Trim<Name>> extends never ? {} : {
    [K in FilterVar<Trim<Name>>]: InferVarType<Trim<Type>>;
}) : Var extends `${infer Name},${infer Type}` ? (FilterVar<Trim<Name>> extends never ? {} : {
    [K in FilterVar<Trim<Name>>]: InferVarType<Trim<Type>>;
}) : (FilterVar<Trim<Var>> extends never ? {} : {
    [K in FilterVar<Trim<Var>>]: any;
})) & ExtractVarsOnly<Rest> : {};
type ExtractTagsOnly<S extends string> = S extends `${string}<${infer Tag}>${infer Rest}` ? (Tag extends `/${string}` ? ExtractTagsOnly<Rest> : {
    [K in Trim<Tag>]: (content: any) => any;
} & ExtractTagsOnly<Rest>) : {};
type Trim<S extends string> = S extends ` ${infer T}` ? Trim<T> : S extends `${infer T} ` ? Trim<T> : S;
/** 过滤非变量 Token（如 ICU 的 #、带空格的内容、或者是选项值） */
type FilterVar<S extends string> = S extends `#${string}` ? never : S extends `=${string}` ? never : S extends `${string} ${string}` ? never : S extends 'other' | 'one' | 'two' | 'few' | 'many' | 'zero' ? never : S;
/** 根据变量名生成参数类型（元组形式用于 rest params） */
export type ParamsType<S extends string> = keyof ExtractVarsObj<S> extends never ? [{
    context?: string;
}?] : [ExtractVarsObj<S> & {
    context?: string;
}];
/** 递归映射字典类型，使叶子节点支持函数式调用并具备变量提示 */
export type TypedT<T> = {
    [K in keyof T]: T[K] extends string ? ((...params: ParamsType<T[K]>) => any) & string : T[K] extends (infer U)[] ? ((...params: ParamsType<U extends string ? U : string>) => any) & string : T[K] extends object ? TypedT<T[K]> : T[K];
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
    setLocale: (lang: string, options?: {
        extraDicts?: TranslationDict[];
        extraLangs?: string[];
    }) => Promise<void>;
    /** 所有可用语言列表 */
    availableLocales: string[];
    /** 当前语言是否为 RTL */
    isRTL: boolean;
    /** 订阅语言切换事件 */
    onChange: (fn: LocaleChangeListener) => () => void;
    /** 加载命名空间 */
    loadNamespace: (name: string) => Promise<void>;
    /** 卸载命名空间（释放内存） */
    unloadNamespace: (name: string) => void;
    /** 手动添加翻译包 */
    addTranslations: (dict: TranslationDict, lang?: string) => void;
    /** 缺失 Key 的集合（用于调试诊断） */
    missingKeys: Set<string>;
    /** 字典剪枝：仅保留指定的 Key，释放多余内存 */
    prune: (usedKeys: string[]) => void;
    /** 导出当前实例的状态（用于 SSR 脱水） */
    exportState: () => any;
    /** 还原实例状态（用于客户端补水） */
    importState: (state: any) => void;
    /** 校验字典完整性，返回各语言缺失的 Key 及变量不一致报告 */
    validate: () => Record<string, {
        missing?: string[];
        mismatchedVars?: Record<string, {
            expected: string[];
            actual: string[];
        }>;
    }>;
}
/** i18n 实例管理器（用于微前端等场景下同步多个实例） */
export interface I18nManager {
    /** 注册一个实例到管理器 */
    register: (instance: I18nInstance) => void;
    /** 注销一个实例 */
    unregister: (instance: I18nInstance) => void;
    /** 全局切换所有实例的语言 */
    setLocale: (locale: string) => Promise<void>;
    /** 当前全局语言 */
    locale: string;
}
export {};
