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

describe('i18nt 核心功能测试集', () => {
  const i18n = createI18n({
    translations: TRANSLATIONS,
    langOrder: LANG_ORDER,
    locale: 'zh-CN',
    devWarnings: false,
  });

  describe('📦 基础翻译与语法解析', () => {
    it('支持基础索引访问 (zh-CN)', () => {
      expect(i18n.t.hello).toBe('你好');
    });

    it('支持基础函数访问 (zh-CN)', () => {
      expect(i18n.t('hello')).toBe('你好');
    });

    it('支持显式语法匹配 (zh-CN)', () => {
      expect(i18n.t.login).toBe('登录');
    });

    it('支持混合语法匹配 (zh-CN)', () => {
      expect(i18n.t.mixed).toBe('混合中文');
    });

    it('支持顺序无关显式匹配', () => {
      expect(i18n.t.outOfOrder).toBe('First');
    });

    it('支持单语言词条回退', () => {
      expect(i18n.t.onlyOne).toBe('Only one lang');
    });
  });

  describe('💬 变量插值', () => {
    it('支持单变量替换', () => {
      expect(i18n.t('greeting', { name: 'Alice' })).toBe('你好，Alice！');
    });

    it('支持多变量替换', () => {
      expect(i18n.t('farewell', { name: 'Bob', time: '明天' })).toBe('再见，Bob，明天见');
    });

    it('缺失变量时保留占位符', () => {
      expect(i18n.t('greeting', { missing: 'prop' })).toBe('你好，{{name}}！');
    });
  });

  describe('🔢 复数支持', () => {
    it('zh-CN 复数处理 (count=1/10)', () => {
      expect(i18n.t('items', { count: 1 })).toBe('1 个');
      expect(i18n.t('items', { count: 10 })).toBe('10 个');
    });

    it('en-US 复数处理 (count=1/10)', () => {
      i18n.setLocale('en-US');
      expect(i18n.t('items', { count: 1 })).toBe('1 item');
      expect(i18n.t('items', { count: 10 })).toBe('10 items');
      i18n.setLocale('zh-CN');
    });
  });

  describe('🔄 语言切换与状态同步', () => {
    it('初始状态检测', () => {
      expect(i18n.locale).toBe('zh-CN');
    });

    it('setLocale 状态更新与翻译同步', () => {
      i18n.setLocale('en-US');
      expect(i18n.locale).toBe('en-US');
      expect(i18n.t.hello).toBe('Hello');
      i18n.setLocale('zh-CN');
    });
  });

  describe('🛡️ 异常与回退策略', () => {
    it('缺失 key 返回其名称', () => {
      expect(i18n.t('missing_key')).toBe('missing_key');
    });

    it('空字符串正确返回', () => {
      expect(i18n.t.empty).toBe('');
    });
  });

  describe('🛠️ Intl 格式化助手', () => {
    it('所有助手函数已挂载', () => {
      expect(typeof i18n.t.n).toBe('function');
      expect(typeof i18n.t.d).toBe('function');
      expect(typeof i18n.t.relative).toBe('function');
    });

    it('数值与日期格式化有效', () => {
      expect(i18n.t.n(12345)).toContain('12');
      expect(i18n.t.d(new Date()).length).toBeGreaterThan(5);
    });
  });

  describe('🌍 RTL 检测', () => {
    it('识别 RTL 语种 (ar/he/fa)', () => {
      expect(isRTLLocale('ar-SA')).toBe(true);
      expect(isRTLLocale('he-IL')).toBe(true);
      expect(isRTLLocale('fa-IR')).toBe(true);
    });

    it('识别非 RTL 语种', () => {
      expect(isRTLLocale('zh-CN')).toBe(false);
      expect(i18n.isRTL).toBe(false);
    });
  });

  describe('📋 可用语言属性', () => {
    it('返回正确列表', () => {
      expect(Array.isArray(i18n.availableLocales)).toBe(true);
      expect(i18n.availableLocales).toContain('zh-CN');
      expect(i18n.availableLocales).toContain('en-US');
    });
  });

  describe('🧩 动态词包回退逻辑', () => {
    it('动态词包匹配与回退主语言标签', () => {
      const i18nExtra = createI18n({
        translations: TRANSLATIONS,
        langOrder: LANG_ORDER,
        locale: 'ja-JP',
        extraLangs: ['ja-JP'],
        extraDicts: [{ hello: 'こんにちは', outOfOrder: 'ja-JP: 最初の' }],
        fallbackIndex: 0
      });
      expect(i18nExtra.t.hello).toBe('こんにちは');
      expect(i18nExtra.t.outOfOrder).toBe('最初の');
      expect(i18nExtra.t.mixed).toBe('混合中文');
    });
  });
});
