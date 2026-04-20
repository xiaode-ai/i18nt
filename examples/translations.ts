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

  // 7. RTL 支持示例 (RTL Support)
  // 当切换到 ar 时，i18nt 会自动同步 document.dir
  rtl_test: [
    'zh-CN: 从左到右',
    'en-US: Left to Right',
    'ar: من اليمين إلى اليسار'
  ]
};

/**
 * 完整功能演示 (Full Feature Showcase):
 * 
 * const i18n = createI18n({ 
 *   translations: TRANSLATIONS, 
 *   langOrder: ['zh-CN', 'en-US'], 
 *   extraLangs: ['ar'], // 额外支持阿语
 *   locale: 'zh-CN' 
 * });
 * const { t } = i18n;
 * 
 * // 1. 属性访问 (Proxy)
 * console.log(t.common.login); // "登录"
 * 
 * // 2. ICU 语法
 * console.log(t('notifications', { count: 3 })); // "您有 2 条新通知以及另外的 1 条"
 * console.log(t('gender_greeting', { gender: 'female', name: 'Sara' })); // "她的名字是 Sara"
 * 
 * // 3. 格式化助手 (Native Intl API)
 * // 数字
 * console.log(t.n(1234567.89, { style: 'currency', currency: 'USD' })); // "$1,234,567.89"
 * // 日期
 * console.log(t.d(new Date(), { dateStyle: 'full' })); // "2026年4月20日星期一"
 * // 相对时间
 * console.log(t.relative(-1, 'day')); // "1天前"
 * 
 * // 4. RTL 自动适配
 * i18n.setLocale('ar');
 * console.log(document.dir); // "rtl" (由 syncDocumentDirection 自动处理)
 * 
 * // 5. 跨文件分布式翻译 (Distributed)
 * // 方案 A: 目录扫描 -> npx i18nt export --input ./src/i18n/
 * // 方案 B: 聚合入口 -> npx i18nt export --input ./src/i18n/index.ts (支持 import 追踪)
 */
