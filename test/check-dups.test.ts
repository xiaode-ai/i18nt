import { describe, test, expect } from 'bun:test';
import { checkTranslations } from '../bin/cli-commands.js';
import { createI18n } from '../dist/index.js';
import { TRANSLATIONS, LANG_ORDER } from '../bin/cli-translations.js';
import fs from 'fs';
import path from 'path';

describe('i18nt 重复翻译值检测 (Duplicate Translation Values Check)', () => {
    const i18n = createI18n({
        translations: TRANSLATIONS,
        langOrder: LANG_ORDER,
        locale: 'zh-CN',
        devWarnings: false,
    });

    test('默认执行 check 时应当自动扫描并警告重复键组', () => {
        const tmpFile = path.resolve(import.meta.dir, 'temp_dups_test.ts');
        const code = `
            export const LANG_ORDER = ['zh-CN', 'en'] as const;
            export const TRANSLATIONS = {
                save: ['保存', 'Save'],
                saveChanges: ['保存', 'Save'],
                cancel: ['取消', 'Cancel'],
                close: ['关闭', 'Close'],
                empty1: ['', ''],
                empty2: ['', ''],
            };
        `;
        fs.writeFileSync(tmpFile, code, 'utf8');

        const warnings: string[] = [];
        const origWarn = console.warn;
        console.warn = (...args: any[]) => {
            warnings.push(args.join(' '));
        };

        try {
            const ok = checkTranslations(tmpFile, i18n, { src: 'none-existing-src-dir-123' });
            expect(ok).toBe(true);

            const warnOutput = warnings.join('\n');
            expect(warnOutput).toContain('重复翻译值');
            expect(warnOutput).toContain('save');
            expect(warnOutput).toContain('saveChanges');
            expect(warnOutput).not.toContain('empty1');
            expect(warnOutput).not.toContain('empty2');
        } finally {
            console.warn = origWarn;
            if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
        }
    });

    test('当无重复值时应当输出未发现重复翻译内容', () => {
        const tmpFile = path.resolve(import.meta.dir, 'temp_no_dups_test.ts');
        const code = `
            export const LANG_ORDER = ['zh-CN', 'en'] as const;
            export const TRANSLATIONS = {
                save: ['保存', 'Save'],
                cancel: ['取消', 'Cancel'],
                close: ['关闭', 'Close'],
            };
        `;
        fs.writeFileSync(tmpFile, code, 'utf8');

        const logs: string[] = [];
        const origLog = console.log;
        console.log = (...args: any[]) => {
            logs.push(args.join(' '));
        };

        try {
            const ok = checkTranslations(tmpFile, i18n, { src: 'none-existing-src-dir-123' });
            expect(ok).toBe(true);

            const logOutput = logs.join('\n');
            expect(logOutput).toContain('未发现重复翻译内容');
        } finally {
            console.log = origLog;
            if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
        }
    });

    test('指定 --no-dups 时应当跳过重复值扫描', () => {
        const tmpFile = path.resolve(import.meta.dir, 'temp_skip_dups_test.ts');
        const code = `
            export const LANG_ORDER = ['zh-CN', 'en'] as const;
            export const TRANSLATIONS = {
                save: ['保存', 'Save'],
                saveChanges: ['保存', 'Save'],
            };
        `;
        fs.writeFileSync(tmpFile, code, 'utf8');

        const warnings: string[] = [];
        const origWarn = console.warn;
        console.warn = (...args: any[]) => {
            warnings.push(args.join(' '));
        };

        try {
            const ok = checkTranslations(tmpFile, i18n, { 'no-dups': true, src: 'none-existing-src-dir-123' });
            expect(ok).toBe(true);

            const warnOutput = warnings.join('\n');
            expect(warnOutput).not.toContain('重复翻译值');
        } finally {
            console.warn = origWarn;
            if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
        }
    });
});
