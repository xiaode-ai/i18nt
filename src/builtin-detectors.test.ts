import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createI18n } from './core.js';
import { browserDetector, queryDetector, localStorageDetector, cookieDetector } from './detectors.js';

describe('Built-in Detectors', () => {
    const translations = { hello: ['你好', 'Hello'] };
    const langOrder = ['zh-CN', 'en-US'];

    beforeEach(() => {
        const mockNavigator = { languages: ['en-US'], language: 'en-US' };
        const mockLocation = { search: '', pathname: '/' };
        const mockLocalStorage = {
            getItem: typeof vi !== 'undefined' ? vi.fn() : (key: string) => null,
            setItem: typeof vi !== 'undefined' ? vi.fn() : () => {}
        };

        if (typeof vi !== 'undefined' && vi.stubGlobal) {
            vi.stubGlobal('navigator', mockNavigator);
            vi.stubGlobal('location', mockLocation);
            vi.stubGlobal('window', { location: mockLocation, localStorage: mockLocalStorage });
            vi.stubGlobal('document', { cookie: '' });
        } else {
            (globalThis as any).navigator = mockNavigator;
            (globalThis as any).location = mockLocation;
            (globalThis as any).window = { location: mockLocation, localStorage: mockLocalStorage };
            (globalThis as any).document = { cookie: '' };
        }
    });

    afterEach(() => {
        if (typeof vi === 'undefined') {
            delete (globalThis as any).navigator;
            delete (globalThis as any).location;
            delete (globalThis as any).window;
            delete (globalThis as any).document;
        }
    });

    it('browserDetector should detect language from navigator', () => {
        expect(browserDetector.lookup()).toBe('en-US');
    });

    it('queryDetector should detect language from URL params', () => {
        const mockLoc = { search: '?lng=zh-CN', pathname: '/' };
        if (typeof vi !== 'undefined' && vi.stubGlobal) {
            vi.stubGlobal('window', { location: mockLoc });
        } else {
            (globalThis as any).window = { location: mockLoc };
        }
        expect(queryDetector.lookup({ lookupQuerystring: 'lng' })).toBe('zh-CN');
    });

    it('localStorageDetector should detect language from localStorage', () => {
        const mockGetItem = typeof vi !== 'undefined' ? vi.fn().mockReturnValue('zh-CN') : () => 'zh-CN';
        if (typeof vi !== 'undefined' && vi.stubGlobal) {
            vi.stubGlobal('window', { localStorage: { getItem: mockGetItem } });
        } else {
            (globalThis as any).window = { localStorage: { getItem: mockGetItem } };
        }
        expect(localStorageDetector.lookup({ lookupLocalStorage: 'lng' })).toBe('zh-CN');
    });

    it('createI18n should integrate detectors', () => {
        const mockLoc = { search: '?lng=en-US', pathname: '/' };
        if (typeof vi !== 'undefined' && vi.stubGlobal) {
            vi.stubGlobal('window', { location: mockLoc });
        } else {
            (globalThis as any).window = { location: mockLoc };
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
            translations: { test: "Hello <bold>{name}</bold>!" } as const,
            langOrder: ['en-US'],
            locale: 'en-US'
        });
        const result = i18n.t.test({ name: 'World', bold: (c: string) => `[${c}]` });
        expect(result).toBe("Hello [World]!");
    });
});
