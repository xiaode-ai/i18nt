/**
 * i18nt 常用后处理器
 * 可通过 I18nConfig.postProcessors 引入
 */
/** 转换为全大写 */
export declare const upper: (val: any) => any;
/** 转换为全小写 */
export declare const lower: (val: any) => any;
/** 首字母大写 */
export declare const capitalize: (val: any) => any;
/** 去除首尾空格 */
export declare const trim: (val: any) => any;
/** 简单的 Markdown 加粗/斜体支持 (*text* -> <em>, **text** -> <strong>) */
export declare const miniMarkdown: (val: any) => any;
