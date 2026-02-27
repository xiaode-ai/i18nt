/**
 * i18nt 全量功能覆盖测试 (32+ 项断言)
 */
import { createI18n, isRTLLocale } from './dist/index.js';

let passed = 0;
let failed = 0;

function assertEq(actual, expected, label) {
  if (actual === expected) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label} — 期望: "${expected}", 实际: "${actual}"`);
    failed++;
  }
}

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

// ─── 定义测试字典 ───
const TRANSLATIONS = {
  // 1. 基础与显式混合
  hello: ['你好', 'Hello'],
  login: ['en-US: Log In', 'zh-CN: 登录'], // 颠倒顺序
  mixed: ['zh-CN: 混合中文', 'Mixed English'], 
  outOfOrder: ['en-US: Second', 'zh-CN: First'],
  
  // 2. 插值
  greeting: ['你好，{{name}}！', 'Hello, {{name}}!'],
  farewell: ['再见，{{name}}，{{time}}见', 'Goodbye, {{name}}, see you at {{time}}'],
  
  // 3. 复数
  items: [
    { one: '{{count}} 个', other: '{{count}} 个' },
    { one: '{{count}} item', other: '{{count}} items' },
  ],

  // 4. 空值与特殊
  empty: ['', ''],
  onlyOne: ['Only one lang'],
};

const LANG_ORDER = ['zh-CN', 'en-US'];

//初始化实例
const i18n = createI18n({
  translations: TRANSLATIONS,
  langOrder: LANG_ORDER,
  locale: 'zh-CN',
  devWarnings: false,
});

console.log('\n--- i18nt Full Coverage Test Suite ---\n');

// 🧪 1: 基础翻译与语法解析 (6 项)
console.log('📦 基础翻译与语法解析');
assertEq(i18n.t.hello, '你好', '1.1 基础索引访问 (zh-CN)');
assertEq(i18n.t('hello'), '你好', '1.2 基础函数访问 (zh-CN)');
assertEq(i18n.t.login, '登录', '1.3 显式语法匹配 (zh-CN)');
assertEq(i18n.t.mixed, '混合中文', '1.4 混合语法匹配 (zh-CN)');
assertEq(i18n.t.outOfOrder, 'First', '1.5 顺序无关显式匹配');
assertEq(i18n.t.onlyOne, 'Only one lang', '1.6 单语言词条回退');

// 🧪 2: 变量插值 (3 项)
console.log('\n💬 变量插值');
assertEq(i18n.t('greeting', { name: 'Alice' }), '你好，Alice！', '2.1 单变量替换');
assertEq(i18n.t('farewell', { name: 'Bob', time: '明天' }), '再见，Bob，明天见', '2.2 多变量替换');
assertEq(i18n.t('greeting', { missing: 'prop' }), '你好，{{name}}！', '2.3 缺失变量保留占位符');

// 🧪 3: 复数支持 (4 项)
console.log('\n🔢 复数支持 (zh-CN/en-US)');
assertEq(i18n.t('items', { count: 1 }), '1 个', '3.1 zh-CN 复数 (count=1)');
assertEq(i18n.t('items', { count: 10 }), '10 个', '3.2 zh-CN 复数 (count=10)');
i18n.setLocale('en-US');
assertEq(i18n.t('items', { count: 1 }), '1 item', '3.3 en-US 复数 (count=1)');
assertEq(i18n.t('items', { count: 10 }), '10 items', '3.4 en-US 复数 (count=10)');
i18n.setLocale('zh-CN');

// 🧪 4: 语言切换与状态同步 (3 项)
console.log('\n🔄 语言切换');
assertEq(i18n.locale, 'zh-CN', '4.1 初始状态检测');
i18n.setLocale('en-US');
assertEq(i18n.locale, 'en-US', '4.2 setLocale 状态更新');
assertEq(i18n.t.hello, 'Hello', '4.3 切换语言后翻译同步');
i18n.setLocale('zh-CN');

// 🧪 5: Missing Key 与回退 (2 项)
console.log('\n🛡️  Missing Key 回退');
assertEq(i18n.t('missing_key'), 'missing_key', '5.1 缺失 key 返回本身');
assertEq(i18n.t.empty, '', '5.2 空字符串正常返回');

// 🧪 6: Intl 格式化助手 (7 项)
console.log('\n🛠️  Intl 格式化助手');
assert(typeof i18n.t.n === 'function', '6.1 t.n 可用');
assert(typeof i18n.t.d === 'function', '6.2 t.d 可用');
assert(typeof i18n.t.relative === 'function', '6.3 t.relative 可用');
assert(typeof i18n.t.formatNumber === 'function', '6.4 t.formatNumber 别名可用');
assert(i18n.t.n(12345).includes('12'), '6.5 数值格式化有效');
assert(i18n.t.d(new Date()).length > 5, '6.6 日期格式化有效');
assert(typeof i18n.t.formatRelative === 'function', '6.7 t.formatRelative 别名可用');

// 🧪 7: RTL 语种检测 (6 项)
console.log('\n🌍 RTL 检测');
assert(isRTLLocale('ar-SA'), '7.1 ar-SA 为 RTL');
assert(isRTLLocale('he-IL'), '7.2 he-IL 为 RTL');
assert(isRTLLocale('fa-IR'), '7.3 fa-IR 为 RTL');
assert(!isRTLLocale('zh-CN'), '7.4 zh-CN 非 RTL');
assert(!isRTLLocale('en-US'), '7.5 en-US 非 RTL');
assertEq(i18n.isRTL, false, '7.6 当前 zh-CN 的 isRTL 为 false');

// 🧪 8: 可用语言属性 (3 项)
console.log('\n📋 可用语言列表');
assert(Array.isArray(i18n.availableLocales), '8.1 availableLocales 是数组');
assert(i18n.availableLocales.includes('zh-CN'), '8.2 包含 zh-CN');
assert(i18n.availableLocales.includes('en-US'), '8.3 包含 en-US');

// 🧪 9: 动态语言与显式语法回退 (3 项)
console.log('\n🧩 动态词包与回退增强');
const i18nExtra = createI18n({
  translations: TRANSLATIONS,
  langOrder: LANG_ORDER,
  locale: 'ja-JP',
  extraLangs: ['ja-JP'],
  extraDicts: [{ hello: 'こんにちは', outOfOrder: 'ja-JP: 最初の' }],
  fallbackIndex: 0
});

assertEq(i18nExtra.t.hello, 'こんにちは', '9.1 动态包普通匹配');
assertEq(i18nExtra.t.outOfOrder, '最初の', '9.2 动态包显式匹配');
assertEq(i18nExtra.t.mixed, '混合中文', '9.3 动态语言缺失时回退到主语言标签');

// ─── 总结 ───
console.log('\n' + '═'.repeat(50));
console.log(`📊 测试结果: ${passed}/${passed + failed} ✅`);

if (failed === 0) {
  console.log('🎉 完美！全部 37 项功能测试通过。');
} else {
  console.log(`⚠️  发现 ${failed} 项测试失败。`);
  process.exit(1);
}
