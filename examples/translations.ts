// examples/translations.ts

/**
 * i18nt 示例字典 - 展示嵌套命名空间与高级 ICU 语法
 */

export const LANG_ORDER = ['zh-CN', 'en-US'] as const;
export const MAIN_LANG = 'zh-CN';

export const TRANSLATIONS = {
  // 1. 基础嵌套命名空间 (Nested Namespaces)
  // 通过 Proxy 访问: t.common.login
  common: {
    login: ['登录', 'Log In'],
    logout: ['退出', 'Log Out'],
    save: ['保存', 'Save'],
    cancel: ['取消', 'Cancel'],
  },

  // 2. ICU MessageFormat - 复数与偏移 (Plural & Offset)
  // 通过: t("notifications", { count: 5 })
  notifications: [
    "{count, plural, offset:1 =0{没有通知} =1{只有 1 条通知} other{您有 # 条新通知以及另外的 1 条}}",
    "{count, plural, offset:1 =0{No notifications} =1{Just 1 notification} other{You have # new notifications and 1 other}}"
  ],

  // 3. ICU MessageFormat - 选择与嵌套 (Select & Nesting)
  // 通过: t("gender_greeting", { gender: 'male', name: 'Alice' })
  gender_greeting: [
    "{gender, select, male{他的名字是 {name}} female{她的名字是 {name}} other{他们的名字是 {name}}}",
    "{gender, select, male{His name is {name}} female{Her name is {name}} other{Their name is {name}}}"
  ],

  // 4. ICU MessageFormat - 序数 (Selectordinal)
  // 通过: t("rank", { n: 1 })
  rank: [
    "{n, selectordinal, other{第 # 名}}",
    "{n, selectordinal, one{#st} two{#nd} few{#rd} other{#th}} place"
  ],

  // 5. 传统 {{var}} 插值 (简单场景)
  welcome: ['欢迎回来，{{name}}', 'Welcome back, {{name}}'],

  // 6. 显式语言标记 (Explicit Tags)
  // 不受数组索引顺序限制
  legal: [
    'en-US: Privacy Policy',
    'zh-CN: 隐私政策'
  ],
};

/**
 * 使用示例 (Usage Guide):
 * 
 * const i18n = createI18n({ translations: TRANSLATIONS, langOrder: LANG_ORDER, locale: 'zh-CN' });
 * const { t } = i18n;
 * 
 * // 访问属性
 * console.log(t.common.login); 
 * 
 * // ICU 复数
 * console.log(t('notifications', { count: 0 })); // "没有通知"
 * console.log(t('notifications', { count: 3 })); // "您有 2 条新通知以及另外的 1 条"
 * 
 * // ICU 序数
 * i18n.setLocale('en-US');
 * console.log(t('rank', { n: 1 })); // "1st place"
 * console.log(t('rank', { n: 2 })); // "2nd place"
 * 
 * // 格式化助手
 * console.log(t.n(1234.56, { style: 'currency', currency: 'CNY' })); // "¥1,234.56"
 */
