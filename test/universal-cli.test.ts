import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadTranslationsData } from '../bin/cli-utils.js';
import { extractFromDirectory } from '../bin/extract-engine.js';
import { syncKeysToTranslations } from '../bin/cli-extract.js';

const TEST_DIR = path.resolve('./test/temp-universal-cli');

describe('Universal CLI Support (JSON + Regex)', () => {
    beforeEach(() => {
        if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
        fs.mkdirSync(TEST_DIR, { recursive: true });
        fs.mkdirSync(path.join(TEST_DIR, 'i18n'), { recursive: true });
        fs.mkdirSync(path.join(TEST_DIR, 'src'), { recursive: true });
    });

    afterEach(() => {
        if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
    });

    it('should load translations from JSON files', () => {
        const zhJson = { hello: '你好' };
        const enJson = { hello: 'Hello' };
        fs.writeFileSync(path.join(TEST_DIR, 'i18n/zh-CN.json'), JSON.stringify(zhJson));
        fs.writeFileSync(path.join(TEST_DIR, 'i18n/en-US.json'), JSON.stringify(enJson));

        const data = loadTranslationsData(path.join(TEST_DIR, 'i18n')) as any;
        expect(data).not.toBeNull();
        expect(data.globalLangSet).toContain('zh-CN');
        expect(data.globalLangSet).toContain('en-US');
        
        expect(data.allTranslations['zh-CN']).toBeDefined();
        expect(data.allTranslations['en-US']).toBeDefined();
    });

    it('should extract keys from .ps1 files using regex', () => {
        const ps1Content = `
            Write-Host $(t 'greet.welcome' 'Welcome to our CLI')
            $msg = t('errors.not_found')
            $desc = t.app.description
        `;
        fs.writeFileSync(path.join(TEST_DIR, 'src/main.ps1'), ps1Content);

        const keys = extractFromDirectory(TEST_DIR, ['.ps1']) as any;
        expect(keys['greet.welcome']).toBeDefined();
        expect(keys['greet.welcome'].defaultValue).toBe('Welcome to our CLI');
        expect(keys['errors.not_found']).toBeDefined();
        expect(keys['app.description']).toBeDefined();
    });

    it('should sync extracted keys back to JSON files', () => {
        const zhJson = { hello: '你好' };
        const zhPath = path.join(TEST_DIR, 'i18n/zh-CN.json');
        fs.mkdirSync(path.dirname(zhPath), { recursive: true });
        fs.writeFileSync(zhPath, JSON.stringify(zhJson, null, 4));

        const extracted = {
            'new.key': { defaultValue: 'New Key', meta: {} },
            'nested.key': { defaultValue: 'Nested Value', meta: {} }
        };

        syncKeysToTranslations(zhPath, extracted);

        const updated = JSON.parse(fs.readFileSync(zhPath, 'utf8')) as any;
        expect(updated.new.key).toBe('New Key');
        expect(updated.nested.key).toBe('Nested Value');
    });
});
