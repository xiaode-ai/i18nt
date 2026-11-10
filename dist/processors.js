/**
 * i18nt 常用后处理器
 * 可通过 I18nConfig.postProcessors 引入
 */
/** 转换为全大写 */
export const upper = (val) => (typeof val === 'string' ? val.toUpperCase() : val);
/** 转换为全小写 */
export const lower = (val) => (typeof val === 'string' ? val.toLowerCase() : val);
/** 首字母大写 */
export const capitalize = (val) => typeof val === 'string' && val.length > 0
    ? val.charAt(0).toUpperCase() + val.slice(1)
    : val;
/** 去除首尾空格 */
export const trim = (val) => (typeof val === 'string' ? val.trim() : val);
/** 简单的 Markdown 加粗/斜体支持 (*text* -> <em>, **text** -> <strong>) */
export const miniMarkdown = (val) => {
    if (typeof val !== 'string')
        return val;
    return val
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
};
