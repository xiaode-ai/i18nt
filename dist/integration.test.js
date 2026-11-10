import { describe, it, expect } from 'vitest';
import { createI18n } from '../src/core.js';
describe('i18nt Integration - ICU Support', () => {
    const translations = {
        greeting: ['你好，{name}！', 'Hello, {name}!'],
        items: [
            '{count, plural, =0{没有项目} one{1个项目} other{#个项目}}',
            '{count, plural, =0{no items} one{1 item} other{# items}}'
        ],
        legacy: ['欢迎，{{user}}', 'Welcome, {{user}}'],
        mixed: [
            '{gender, select, male{他} female{她} other{他们}}买了 {count, plural, one{1个} other{#个}} 苹果。',
            '{gender, select, male{He} female{She} other{They}} bought {count, plural, one{one} other{#}} apples.'
        ]
    };
    const i18n = createI18n({
        translations,
        langOrder: ['zh-CN', 'en-US'],
        locale: 'zh-CN',
    });
    it('should handle ICU interpolation', () => {
        expect(i18n.t('greeting', { name: '张三' })).toBe('你好，张三！');
        i18n.setLocale('en-US');
        expect(i18n.t('greeting', { name: 'John' })).toBe('Hello, John!');
    });
    it('should handle ICU plurals', () => {
        i18n.setLocale('zh-CN');
        expect(i18n.t('items', { count: 0 })).toBe('没有项目');
        expect(i18n.t('items', { count: 1 })).toBe('1个项目');
        expect(i18n.t('items', { count: 5 })).toBe('5个项目');
        i18n.setLocale('en-US');
        expect(i18n.t('items', { count: 0 })).toBe('no items');
        expect(i18n.t('items', { count: 1 })).toBe('1 item');
        expect(i18n.t('items', { count: 5 })).toBe('5 items');
    });
    it('should support legacy {{var}} syntax', () => {
        i18n.setLocale('zh-CN');
        expect(i18n.t('legacy', { user: 'Admin' })).toBe('欢迎，Admin');
        i18n.setLocale('en-US');
        expect(i18n.t('legacy', { user: 'Admin' })).toBe('Welcome, Admin');
    });
    it('should handle complex mixed ICU tags', () => {
        i18n.setLocale('zh-CN');
        expect(i18n.t('mixed', { gender: 'female', count: 3 })).toBe('她买了 3个 苹果。');
        i18n.setLocale('en-US');
        expect(i18n.t('mixed', { gender: 'male', count: 1 })).toBe('He bought one apples.'); // 'apples' is fixed in string
    });
});
