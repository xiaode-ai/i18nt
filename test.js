/**
 * i18nt 核心功能测试脚本
 */
import { createI18n, isRTLLocale } from './dist/index.js';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

function assertEq(actual, expected, label) {
  if (actual === expected) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label} — 期望: "${expected}", 实际: "${actual}"`);
    failed++;
  }
}

// ─── 定义测试字典 ───
const TRANSLATIONS = {
  hello: ['你好', 'Hello'],
  greeting: ['你好，{{name}}！', 'Hello, {{name}}!'],
  farewell: ['再见，{{name}}，{{time}}见', 'Goodbye, {{name}}, see you at {{time}}'],
  items: [
    { one: '{{count}} 个物品', other: '{{count}} 个物品' },
    { one: '{{count}} item', other: '{{count}} items' },
  ],
  empty: ['', ''],
};

const LANG_ORDER = ['zh-CN', 'en-US'];

// ─── 测试 1: 基础翻译 ───
console.log('\n🧪 测试 1: 基础翻译');
const i18n = createI18n({
  translations: TRANSLATIONS,
  langOrder: LANG_ORDER,
  locale: 'zh-CN',
  devWarnings: false,
});

assertEq(i18n.t.hello, '你好', 't.hello 属性访问');
assertEq(i18n.t('hello'), '你好', "t('hello') 函数调用");
assertEq(i18n.locale, 'zh-CN', '当前语言为 zh-CN');

// ─── 测试 2: 变量插值 ───
console.log('\n🧪 测试 2: 变量插值');
assertEq(i18n.t('greeting', { name: 'Alice' }), '你好，Alice！', '单变量插值');
assertEq(
  i18n.t('farewell', { name: 'Bob', time: '明天' }),
  '再见，Bob，明天见',
  '多变量插值'
);

// ─── 测试 3: 复数支持 ───
console.log('\n🧪 测试 3: 复数支持');
assertEq(i18n.t('items', { count: 1 }), '1 个物品', '复数 (zh-CN count=1)');
assertEq(i18n.t('items', { count: 5 }), '5 个物品', '复数 (zh-CN count=5)');

// ─── 测试 4: 语言切换 ───
console.log('\n🧪 测试 4: 语言切换');
i18n.setLocale('en-US');
assertEq(i18n.t.hello, 'Hello', '切换到 en-US 后 t.hello');
assertEq(i18n.t('greeting', { name: 'Alice' }), 'Hello, Alice!', '切换后变量插值');
assertEq(i18n.locale, 'en-US', '当前语言变为 en-US');
assertEq(i18n.t('items', { count: 1 }), '1 item', '复数 (en-US count=1)');
assertEq(i18n.t('items', { count: 5 }), '5 items', '复数 (en-US count=5)');

// ─── 测试 5: Missing Key ───
console.log('\n🧪 测试 5: Missing Key 回退');
assertEq(i18n.t('nonExistentKey'), 'nonExistentKey', '缺失 key 返回 key 本身');

// ─── 测试 6: 格式化助手 ───
console.log('\n🧪 测试 6: Intl 格式化助手');
assert(typeof i18n.t.n === 'function', 't.n 是函数');
assert(typeof i18n.t.d === 'function', 't.d 是函数');
assert(typeof i18n.t.relative === 'function', 't.relative 是函数');
assert(typeof i18n.t.formatNumber === 'function', 't.formatNumber 是函数');
assert(typeof i18n.t.formatDate === 'function', 't.formatDate 是函数');
assert(typeof i18n.t.formatRelative === 'function', 't.formatRelative 是函数');

const formatted = i18n.t.n(1234567);
assert(formatted.includes('1') && formatted.includes('234'), `t.n(1234567) = "${formatted}"`);

// ─── 测试 7: RTL 检测 ───
console.log('\n🧪 测试 7: RTL 检测');
assert(isRTLLocale('ar-SA') === true, 'ar-SA 是 RTL');
assert(isRTLLocale('he-IL') === true, 'he-IL 是 RTL');
assert(isRTLLocale('fa-IR') === true, 'fa-IR 是 RTL');
assert(isRTLLocale('zh-CN') === false, 'zh-CN 不是 RTL');
assert(isRTLLocale('en-US') === false, 'en-US 不是 RTL');
assertEq(i18n.isRTL, false, 'en-US 的 isRTL 为 false');

// ─── 测试 8: availableLocales ───
console.log('\n🧪 测试 8: 可用语言列表');
assert(Array.isArray(i18n.availableLocales), 'availableLocales 是数组');
assert(i18n.availableLocales.includes('zh-CN'), '包含 zh-CN');
assert(i18n.availableLocales.includes('en-US'), '包含 en-US');

// ─── 测试 9: extraDicts 动态语言包 ───
console.log('\n🧪 测试 9: 动态语言包 (extraDicts)');
const i18nWithExtra = createI18n({
  translations: TRANSLATIONS,
  langOrder: LANG_ORDER,
  locale: 'ja-JP',
  extraDicts: [{ hello: 'こんにちは', greeting: 'こんにちは、{{name}}！' }],
  extraLangs: ['ja-JP'],
  devWarnings: false,
});
assertEq(i18nWithExtra.t.hello, 'こんにちは', '动态语言包 t.hello');
assertEq(
  i18nWithExtra.t('greeting', { name: 'Alice' }),
  'こんにちは、Alice！',
  '动态语言包变量插值'
);

// ─── 测试 10: 回退到 fallbackIndex ───
console.log('\n🧪 测试 10: 动态语言缺失 key 回退');
assertEq(
  i18nWithExtra.t('farewell', { name: 'Bob', time: '明日' }),
  '再见，Bob，明日见',
  '动态语言中缺失的 key 回退到 fallbackIndex=0 (zh-CN)'
);

// ─── 总结 ───
console.log('\n' + '═'.repeat(50));
console.log(`📊 测试结果: ${passed} 通过, ${failed} 失败, 共 ${passed + failed} 项`);
if (failed === 0) {
  console.log('🎉 全部通过！');
} else {
  console.log('⚠️  存在失败项，请检查。');
  process.exit(1);
}
