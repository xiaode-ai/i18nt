// src/translations.ts

// 1. 定义支持的语言顺序（作为开发默认的最简语法基准）
export const LANG_ORDER = ['zh-CN', 'en-US'] as const;

// 2. 核心翻译字典定义
export const TRANSLATIONS = {
  // ------------------------------------------------------------------------
  // A. 基础文本 (通过索引映射 —— 'zh-CN', 'en-US')
  // ------------------------------------------------------------------------
  hello: ['你好', 'Hello'],
  login: ['登录', 'Log In'],
  logout: ['退出账号', 'Log Out'],
  submit: ['提交表单', 'Submit Form'],
  
  // 插值支持 (使用 {{var}} 语法)
  greeting: ['欢迎回来，{{name}}！', 'Welcome back, {{name}}!'],
  error_code: ['请求失败 (错误码: {{code}})', 'Request failed (Code: {{code}})'],

  // ------------------------------------------------------------------------
  // B. 复杂格式与显式声明 (通过 `lang: value` 显式覆盖)
  // 当你不确定数组顺序，或觉得通过 key 更直观时，可以使用显式声明
  // ------------------------------------------------------------------------
  save_success: [
    'zh-CN: 设置已成功保存到云端', 
    'en-US: Settings saved successfully to the cloud'
  ],
  
  // 混合编写模式 (部分按索引、部分强制声明。强制声明优先)
  delete_warn: [
    '确定要永久删除此项吗？', // 索引 0 -> zh-CN
    'en-US: Are you sure you want to permanently delete this item?' // 强制绑定 en-US
  ],

  // ------------------------------------------------------------------------
  // C. 复杂结构：复数 (Pluralization) 
  // 根据 Intl.PluralRules 自动分配 one / other，对象结构支持多语言扩展
  // ------------------------------------------------------------------------
  items_count: [
    // [0] 中文环境的复数规则
    { 
      one: '共 {{count}} 个项目', // 中文严格来说没有复数，通常 one 与 other 一致
      other: '共 {{count}} 个项目' 
    },
    // [1] 英文环境的复数规则
    { 
      one: '{{count}} item left', 
      other: '{{count}} items left' 
    }
  ],

  // 带有占位符的嵌套对象复数
  selected_users: [
    {
      one: '您已选中 {{count}} 名用户',
      other: '您已选中 {{count}} 名用户'
    },
    {
      one: 'You have selected {{count}} user',
      other: 'You have selected {{count}} users'
    }
  ],

  // ------------------------------------------------------------------------
  // D. 配合 Intl 格式化的占位文本
  // ------------------------------------------------------------------------
  last_updated: ['最后更新于 {{date}}', 'Last updated on {{date}}'],
  balance_info: ['您的当前余额为 {{amount}}', 'Your current balance is {{amount}}'],
};

// ========================================================================
// 示例使用方式（你可以将其用于独立的测试或组件中）:
// ========================================================================
/*
import { createI18n } from 'i18nt';

const i18n = createI18n({
  translations: TRANSLATIONS,
  langOrder: LANG_ORDER,
  locale: 'zh-CN',
});

// 测试基础文本
console.log(i18n.t.login); // "登录"

// 测试变量插值
console.log(i18n.t('greeting', { name: 'Admin' })); // "欢迎回来，Admin！"

// 测试显式声明
console.log(i18n.t.save_success); // "设置已成功保存到云端"

// 测试复数应用
console.log(i18n.t('items_count', { count: 1 })); // "共 1 个项目"
console.log(i18n.t('items_count', { count: 5 })); // "共 5 个项目"

i18n.setLocale('en-US');
console.log(i18n.t('items_count', { count: 1 })); // "1 item left"
console.log(i18n.t('items_count', { count: 5 })); // "5 items left"

// 测试结合 Intl API 的动态占位
const moneyStr = i18n.t.n(2999.5, { style: 'currency', currency: 'USD' });
console.log(i18n.t('balance_info', { amount: moneyStr })); // "Your current balance is $2,999.50"
*/
