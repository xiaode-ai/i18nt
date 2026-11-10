import { describe, it, expect, vi } from 'vitest';
import { createI18n } from './core.js';
describe('i18nt Events & Dynamic Loading', () => {
    const translations = {
        hello: ['你好', 'Hello'],
    };
    it('should trigger onLocaleChange in config', () => {
        const onLocaleChange = vi.fn();
        const i18n = createI18n({
            translations,
            langOrder: ['zh-CN', 'en-US'],
            locale: 'zh-CN',
            onLocaleChange,
        });
        i18n.setLocale('en-US');
        expect(onLocaleChange).toHaveBeenCalledWith('en-US');
    });
    it('should support onChange subscription', () => {
        const i18n = createI18n({
            translations,
            langOrder: ['zh-CN', 'en-US'],
            locale: 'zh-CN',
        });
        const listener = vi.fn();
        const unsubscribe = i18n.onChange(listener);
        i18n.setLocale('en-US');
        expect(listener).toHaveBeenCalledWith('en-US');
        unsubscribe();
        i18n.setLocale('zh-CN');
        expect(listener).toHaveBeenCalledTimes(1); // Should not be called again
    });
    it('should support multiple listeners', () => {
        const i18n = createI18n({
            translations,
            langOrder: ['zh-CN', 'en-US'],
            locale: 'zh-CN',
        });
        const l1 = vi.fn();
        const l2 = vi.fn();
        i18n.onChange(l1);
        i18n.onChange(l2);
        i18n.setLocale('en-US');
        expect(l1).toHaveBeenCalledWith('en-US');
        expect(l2).toHaveBeenCalledWith('en-US');
    });
    it('should support lazy loading pattern via extraDicts', () => {
        const i18n = createI18n({
            translations,
            langOrder: ['zh-CN', 'en-US'],
            locale: 'zh-CN',
        });
        // 1. 模拟为 en-US 加载动态字典
        i18n.setLocale('en-US', { extraDicts: [{ dynamic: 'Dynamic' }] });
        // @ts-ignore
        expect(i18n.t.dynamic).toBe('Dynamic');
        // 2. 模拟为 zh-CN 加载动态字典
        i18n.setLocale('zh-CN', { extraDicts: [{ dynamic: '动态' }] });
        // @ts-ignore
        expect(i18n.t.dynamic).toBe('动态');
        // 3. 验证切换回 en-US 后依然有效
        i18n.setLocale('en-US');
        // @ts-ignore
        expect(i18n.t.dynamic).toBe('Dynamic');
    });
});
