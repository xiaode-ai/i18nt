import { describe, it, expect } from 'vitest';
import { createI18n } from './core.js';
import { headerDetector } from './plugins.js';
describe('headerDetector', () => {
    const translations = { hello: ['你好', 'Hello'] };
    const langOrder = ['zh-CN', 'en-US'];
    it('should detect language from headers object', async () => {
        const i18n = createI18n({
            translations,
            langOrder,
            locale: 'zh-CN', // Initial
            plugins: [
                headerDetector({ 'accept-language': 'en-US,en;q=0.9' })
            ]
        });
        expect(i18n.locale).toBe('en-US');
    });
    it('should detect language from headers with get method (Next.js style)', async () => {
        const mockHeaders = {
            get: (name) => name === 'accept-language' ? 'en-US,en;q=0.9' : null
        };
        const i18n = createI18n({
            translations,
            langOrder,
            locale: 'zh-CN',
            plugins: [
                headerDetector(mockHeaders)
            ]
        });
        expect(i18n.locale).toBe('en-US');
    });
    it('should handle prefix matching (zh-HK -> zh-CN)', async () => {
        const i18n = createI18n({
            translations,
            langOrder,
            locale: 'en-US',
            plugins: [
                headerDetector({ 'accept-language': 'zh-HK' })
            ]
        });
        expect(i18n.locale).toBe('zh-CN'); // Starts with 'zh'
    });
});
