import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createI18n } from './core.js';
import { browserDetector, queryDetector, localStorageDetector, serverDetector } from './detectors.js';
describe('Built-in Detectors', () => {
    const translations = { hello: ['你好', 'Hello'] };
    const langOrder = ['zh-CN', 'en-US'];
    let originalNavigator;
    let originalLocation;
    let originalWindow;
    let originalDocument;
    let originalProcess;
    let dtfSpy;
    beforeEach(() => {
        const mockNavigator = { languages: ['en-US'], language: 'en-US' };
        const mockLocation = { search: '', pathname: '/' };
        const mockLocalStorage = {
            getItem: vi.fn(),
            setItem: vi.fn()
        };
        // 备份原对象
        originalNavigator = globalThis.navigator;
        originalLocation = globalThis.location;
        originalWindow = globalThis.window;
        originalDocument = globalThis.document;
        originalProcess = globalThis.process;
        if (typeof vi !== 'undefined' && vi.stubGlobal) {
            vi.stubGlobal('navigator', mockNavigator);
            vi.stubGlobal('location', mockLocation);
            vi.stubGlobal('window', { location: mockLocation, localStorage: mockLocalStorage });
            vi.stubGlobal('document', {
                cookie: '',
                createElement: globalThis.document?.createElement || (() => ({})),
                defaultView: globalThis.window
            });
            vi.stubGlobal('process', { ...globalThis.process, env: { ...globalThis.process?.env, LANG: 'en-US' } });
        }
        else {
            // 手动模拟 (兼容 Bun 等环境)
            try {
                globalThis.navigator = mockNavigator;
                globalThis.location = mockLocation;
                globalThis.window = { location: mockLocation, localStorage: mockLocalStorage };
                globalThis.document = {
                    cookie: '',
                    createElement: globalThis.document?.createElement || (() => ({})),
                    defaultView: globalThis.window
                };
                globalThis.process = { ...globalThis.process, env: { ...globalThis.process?.env, LANG: 'en-US' } };
            }
            catch (e) {
                // 如果直接赋值失败（如只读属性），尝试使用 Object.defineProperty
                const mockObj = (name, val) => {
                    try {
                        Object.defineProperty(globalThis, name, { value: val, configurable: true, writable: true });
                    }
                    catch (err) { /* ignore */ }
                };
                mockObj('navigator', mockNavigator);
                mockObj('location', mockLocation);
                mockObj('window', { location: mockLocation, localStorage: mockLocalStorage });
                mockObj('document', { cookie: '', createElement: () => ({}) });
            }
        }
        dtfSpy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function () {
            return {
                resolvedOptions: () => ({ locale: 'en-US' })
            };
        });
    });
    afterEach(() => {
        vi.restoreAllMocks();
        if (dtfSpy)
            dtfSpy.mockRestore();
        if (typeof vi !== 'undefined' && vi.unstubAllGlobals) {
            vi.unstubAllGlobals();
        }
        else {
            // 手动还原
            const restoreObj = (name, val) => {
                try {
                    if (val === undefined)
                        delete globalThis[name];
                    else
                        Object.defineProperty(globalThis, name, { value: val, configurable: true, writable: true });
                }
                catch (e) { /* ignore */ }
            };
            restoreObj('navigator', originalNavigator);
            restoreObj('location', originalLocation);
            restoreObj('window', originalWindow);
            restoreObj('document', originalDocument);
            restoreObj('process', originalProcess);
        }
    });
    it('browserDetector should detect language from navigator', () => {
        expect(browserDetector.lookup()).toBe('en-US');
    });
    it('queryDetector should detect language from URL params', () => {
        const mockLoc = { search: '?lng=zh-CN', pathname: '/' };
        if (typeof vi !== 'undefined' && vi.stubGlobal) {
            vi.stubGlobal('window', { location: mockLoc });
        }
        else {
            globalThis.window = { location: mockLoc };
        }
        expect(queryDetector.lookup({ lookupQuerystring: 'lng' })).toBe('zh-CN');
    });
    it('localStorageDetector should detect language from localStorage', () => {
        const mockGetItem = typeof vi !== 'undefined' ? vi.fn().mockReturnValue('zh-CN') : () => 'zh-CN';
        if (typeof vi !== 'undefined' && vi.stubGlobal) {
            vi.stubGlobal('window', { localStorage: { getItem: mockGetItem } });
        }
        else {
            globalThis.window = { localStorage: { getItem: mockGetItem } };
        }
        expect(localStorageDetector.lookup({ lookupLocalStorage: 'lng' })).toBe('zh-CN');
    });
    it('serverDetector should detect language from Intl or process.env', () => {
        // Test Intl
        expect(serverDetector.lookup()).toBe('en-US');
        // Test process.env (by making Intl.DateTimeFormat throw)
        vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function () {
            throw new Error('Intl not supported');
        });
        expect(serverDetector.lookup()).toBe('en-US'); // from process.env.LANG
    });
    it('createI18n should integrate detectors', () => {
        const mockLoc = { search: '?lng=en-US', pathname: '/' };
        if (typeof vi !== 'undefined' && vi.stubGlobal) {
            vi.stubGlobal('window', { location: mockLoc });
        }
        else {
            globalThis.window = { location: mockLoc };
        }
        const i18n = createI18n({
            translations,
            langOrder,
            locale: '', // Trigger detection
            detection: {
                order: ['querystring'],
                lookupQuerystring: 'lng'
            }
        });
        expect(i18n.locale).toBe('en-US');
    });
});
describe('ICU Parser Enhancement', () => {
    it('should handle complex escaping with single quotes', () => {
        const i18n = createI18n({
            translations: { test: "This is '{'escaped'}' and ''quote''." },
            langOrder: ['en-US'],
            locale: 'en-US'
        });
        expect(String(i18n.t.test)).toBe("This is {escaped} and 'quote'.");
    });
    it('should handle nested tags with variables', () => {
        const i18n = createI18n({
            translations: { test: "Hello <bold>{name}</bold>!" },
            langOrder: ['en-US'],
            locale: 'en-US'
        });
        const result = i18n.t.test({ name: 'World', bold: (c) => `[${c}]` });
        expect(result).toBe("Hello [World]!");
    });
});
