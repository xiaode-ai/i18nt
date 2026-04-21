import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createI18n } from './core.js';
import { browserDetector, queryDetector, localStorageDetector, cookieDetector } from './detectors.js';

describe('Built-in Detectors', () => {
    const translations = { hello: ['你好', 'Hello'] };
    const langOrder = ['zh-CN', 'en-US'];

    beforeEach(() => {
        vi.stubGlobal('navigator', { languages: ['en-US'], language: 'en-US' });
        vi.stubGlobal('location', { search: '', pathname: '/' });
        vi.stubGlobal('window', { 
            location: { search: '', pathname: '/' },
            localStorage: {
                getItem: vi.fn(),
                setItem: vi.fn()
            }
        });
        vi.stubGlobal('document', { cookie: '' });
    });

    it('browserDetector should detect language from navigator', () => {
        expect(browserDetector.lookup()).toBe('en-US');
    });

    it('queryDetector should detect language from URL params', () => {
        vi.stubGlobal('window', { 
            location: { search: '?lng=zh-CN', pathname: '/' }
        });
        expect(queryDetector.lookup({ lookupQuerystring: 'lng' })).toBe('zh-CN');
    });

    it('localStorageDetector should detect language from localStorage', () => {
        const mockGetItem = vi.fn().mockReturnValue('zh-CN');
        vi.stubGlobal('window', { 
            localStorage: { getItem: mockGetItem }
        });
        expect(localStorageDetector.lookup({ lookupLocalStorage: 'lng' })).toBe('zh-CN');
        expect(mockGetItem).toHaveBeenCalledWith('lng');
    });

    it('createI18n should integrate detectors', () => {
        // Mocking queryDetector to return 'en-US'
        vi.stubGlobal('window', { 
            location: { search: '?lng=en-US', pathname: '/' }
        });
        
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
