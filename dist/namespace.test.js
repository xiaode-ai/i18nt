import { describe, it, expect, vi } from 'vitest';
import { createI18n } from './core';
describe('Multi-level Namespaces', () => {
    it('should resolve nested keys via dot notation', () => {
        const i18n = createI18n({
            translations: {
                auth: {
                    login: {
                        title: ['登录', 'Login']
                    }
                }
            },
            langOrder: ['zh-CN', 'en-US'],
            locale: 'zh-CN'
        });
        expect(i18n.t('auth.login.title')).toBe('登录');
        i18n.setLocale('en-US');
        expect(i18n.t('auth.login.title')).toBe('Login');
    });
    it('should support property access via Proxy', () => {
        const i18n = createI18n({
            translations: {
                auth: {
                    login: {
                        submit: ['提交', 'Submit']
                    }
                }
            },
            langOrder: ['zh-CN', 'en-US'],
            locale: 'zh-CN'
        });
        // @ts-ignore - Proxy support
        expect(i18n.t.auth.login.submit).toBe('提交');
    });
    it('should support mixed flat and nested keys', () => {
        const i18n = createI18n({
            translations: {
                hello: ['你好', 'Hello'],
                auth: {
                    logout: ['退出', 'Logout']
                }
            },
            langOrder: ['zh-CN', 'en-US'],
            locale: 'zh-CN'
        });
        expect(i18n.t.hello).toBe('你好');
        // @ts-ignore
        expect(i18n.t.auth.logout).toBe('退出');
    });
    it('should handle ICU interpolation in nested namespaces', () => {
        const i18n = createI18n({
            translations: {
                user: {
                    welcome: ['欢迎回来，{name}！', 'Welcome back, {name}!']
                }
            },
            langOrder: ['zh-CN', 'en-US'],
            locale: 'zh-CN'
        });
        expect(i18n.t('user.welcome', { name: 'Antigravity' })).toBe('欢迎回来，Antigravity！');
        // Note: t.user.welcome is a primitive string, so t.user.welcome({params}) is not supported.
        // Use t('user.welcome', {params}) instead.
    });
    it('should support fallback for missing nested keys', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
        const i18n = createI18n({
            translations: {
                auth: {
                    login: ['登录', 'Login']
                }
            },
            langOrder: ['zh-CN', 'en-US'],
            locale: 'zh-CN'
        });
        expect(i18n.t('auth.missing')).toBe('auth.missing');
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Missing path: "auth.missing"'));
        consoleSpy.mockRestore();
    });
});
