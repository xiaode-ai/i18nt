import { describe, it, expect } from 'vitest';
import { createI18n, isRTLLocale } from './dist/index.js';

// ─── 定义测试字典 ───
const TRANSLATIONS = {
  hello: ['你好', 'Hello'],
  login: ['en-US: Log In', 'zh-CN: 登录'],
  mixed: ['zh-CN: 混合中文', 'Mixed English'],
  outOfOrder: ['en-US: Second', 'zh-CN: First'],
  greeting: ['你好，{{name}}！', 'Hello, {{name}}!'],
  farewell: ['再见，{{name}}，{{time}}见', 'Goodbye, {{name}}, see you at {{time}}'],
  items: [
    { one: '{{count}} 个', other: '{{count}} 个' },
    { one: '{{count}} item', other: '{{count}} items' },
  ],
  empty: ['', ''],
  onlyOne: ['Only one lang'],
};

const LANG_ORDER = ['zh-CN', 'en-US'];

describe('i18nt 核心功能全量测试集', () => {
  const i18n = createI18n({
    translations: TRANSLATIONS,
    langOrder: LANG_ORDER,
    locale: 'zh-CN',
    devWarnings: false,
  });

  describe('📦 基础翻译与语法解析', () => {
    it('1.1 支持基础索引访问 (zh-CN)', () => expect(i18n.t.hello).toBe('你好'));
    it('1.2 支持基础函数访问 (zh-CN)', () => expect(i18n.t('hello')).toBe('你好'));
    it('1.3 支持显式语法匹配 (zh-CN)', () => expect(i18n.t.login).toBe('登录'));
    it('1.4 支持混合语法匹配 (zh-CN)', () => expect(i18n.t.mixed).toBe('混合中文'));
    it('1.5 支持顺序无关显式匹配', () => expect(i18n.t.outOfOrder).toBe('First'));
    it('1.6 支持单语言词条回退', () => expect(i18n.t.onlyOne).toBe('Only one lang'));
  });

  describe('💬 变量插值', () => {
    it('2.1 支持单变量替换', () => expect(i18n.t('greeting', { name: 'Alice' })).toBe('你好，Alice！'));
    it('2.2 支持多变量替换', () => expect(i18n.t('farewell', { name: 'Bob', time: '明天' })).toBe('再见，Bob，明天见'));
    it('2.3 缺失变量时保留占位符', () => expect(i18n.t('greeting', { missing: 'prop' })).toBe('你好，{{name}}！'));
  });

  describe('🔢 复数支持', () => {
    it('3.1 zh-CN 复数处理 (count=1)', () => expect(i18n.t('items', { count: 1 })).toBe('1 个'));
    it('3.2 zh-CN 复数处理 (count=10)', () => expect(i18n.t('items', { count: 10 })).toBe('10 个'));
    it('3.3 en-US 复数处理 (count=1)', () => {
      i18n.setLocale('en-US');
      expect(i18n.t('items', { count: 1 })).toBe('1 item');
    });
    it('3.4 en-US 复数处理 (count=10)', () => {
      expect(i18n.t('items', { count: 10 })).toBe('10 items');
      i18n.setLocale('zh-CN');
    });
  });

  describe('🔄 语言切换与状态同步', () => {
    it('4.1 初始状态检测', () => expect(i18n.locale).toBe('zh-CN'));
    it('4.2 setLocale 状态更新', () => {
      i18n.setLocale('en-US');
      expect(i18n.locale).toBe('en-US');
    });
    it('4.3 切换语言后翻译同步', () => {
      expect(i18n.t.hello).toBe('Hello');
      i18n.setLocale('zh-CN');
    });
  });

  describe('🛡️ 异常与回退策略', () => {
    it('5.1 缺失 key 返回其名称', () => expect(i18n.t('missing_key')).toBe('missing_key'));
    it('5.2 空字符串正确返回', () => expect(i18n.t.empty).toBe(''));
  });

  describe('🛠️ Intl 格式化助手', () => {
    it('6.1 t.n 函数已挂载', () => expect(typeof i18n.t.n).toBe('function'));
    it('6.2 t.d 函数已挂载', () => expect(typeof i18n.t.d).toBe('function'));
    it('6.3 t.relative 函数已挂载', () => expect(typeof i18n.t.relative).toBe('function'));
    it('6.4 数值格式化有效性', () => expect(i18n.t.n(12345)).toContain('12'));
    it('6.5 日期格式化有效性', () => expect(i18n.t.d(new Date()).length).toBeGreaterThan(5));
    it('6.6 t.formatNumber 别名可用', () => expect(typeof i18n.t.formatNumber).toBe('function'));
    it('6.7 t.formatRelative 别名可用', () => expect(typeof i18n.t.formatRelative).toBe('function'));
  });

  describe('🌍 RTL 检测', () => {
    it('7.1 识别 ar-SA 为 RTL', () => expect(isRTLLocale('ar-SA')).toBe(true));
    it('7.2 识别 he-IL 为 RTL', () => expect(isRTLLocale('he-IL')).toBe(true));
    it('7.3 识别 fa-IR 为 RTL', () => expect(isRTLLocale('fa-IR')).toBe(true));
    it('7.4 识别 zh-CN 非 RTL', () => expect(isRTLLocale('zh-CN')).toBe(false));
    it('7.5 识别 en-US 非 RTL', () => expect(isRTLLocale('en-US')).toBe(false));
    it('7.6 实例 isRTL 状态同步', () => expect(i18n.isRTL).toBe(false));
  });

  describe('📋 可用语言属性', () => {
    it('8.1 导出为数组类型', () => expect(Array.isArray(i18n.availableLocales)).toBe(true));
    it('8.2 包含核心语种 zh-CN', () => expect(i18n.availableLocales).toContain('zh-CN'));
    it('8.3 包含核心语种 en-US', () => expect(i18n.availableLocales).toContain('en-US'));
  });

  describe('🧩 动态词包回退逻辑', () => {
    it('9.1 动态词包普通匹配', () => {
      const i18nExtra = createI18n({
        translations: TRANSLATIONS,
        langOrder: LANG_ORDER,
        locale: 'ja-JP',
        extraLangs: ['ja-JP'],
        extraDicts: [{ hello: 'こんにちは', outOfOrder: 'ja-JP: 最初の' }],
        fallbackIndex: 0
      });
      expect(i18nExtra.t.hello).toBe('こんにちは');
    });
    it('9.2 动态词包显式匹配', () => {
      const i18nExtra = createI18n({
        translations: TRANSLATIONS,
        langOrder: LANG_ORDER,
        locale: 'ja-JP',
        extraLangs: ['ja-JP'],
        extraDicts: [{ hello: 'こんにちは', outOfOrder: 'ja-JP: 最初の' }],
        fallbackIndex: 0
      });
      expect(i18nExtra.t.outOfOrder).toBe('最初の');
    });
    it('9.3 动态语言缺失时回退到主语言标签', () => {
      const i18nExtra = createI18n({
        translations: TRANSLATIONS,
        langOrder: LANG_ORDER,
        locale: 'ja-JP',
        extraLangs: ['ja-JP'],
        extraDicts: [{ hello: 'こんにちは', outOfOrder: 'ja-JP: 最初の' }],
        fallbackIndex: 0
      });
      expect(i18nExtra.t.mixed).toBe('混合中文');
    });
  });
});
