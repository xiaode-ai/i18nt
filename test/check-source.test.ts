import { describe, test, expect } from 'bun:test';
import { extractKeysFromSource, scanSourceKeyUsage, scanHardcodedUIStrings } from '../bin/extract-engine.js';
import fs from 'fs';
import path from 'path';

describe('i18nt AST 提取与源码扫描增强测试', () => {
    test('应当能从带 TypeAssertion 或 AsExpression 的调用中提取 key', () => {
        const tmpFile = path.resolve(import.meta.dir, 'temp_ast_test.tsx');
        const code = `
            import React from 'react';
            const t = (k: any) => k;
            export function Test() {
                return (
                    <div>
                        <span>{t('myKey' as any)}</span>
                        <span>{t(('nestedKey') as TranslationKey)}</span>
                        <span>{t.deep.nested.key}</span>
                    </div>
                );
            }
        `;
        fs.writeFileSync(tmpFile, code, 'utf8');

        try {
            const extracted = extractKeysFromSource(tmpFile);
            expect(extracted['myKey']).toBeDefined();
            expect(extracted['nestedKey']).toBeDefined();
            expect(extracted['deep.nested.key']).toBeDefined();
        } finally {
            if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
        }
    });

    test('scanSourceKeyUsage 应当精准捕获未在字典中定义的 key', () => {
        const tmpDir = path.resolve(import.meta.dir, 'temp_source_dir');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
        const tmpFile = path.join(tmpDir, 'demo.tsx');
        const code = `
            const t = (k: string) => k;
            t('definedKey');
            t('missingKey');
            const label = 'missingKey2' as TranslationKey;
        `;
        fs.writeFileSync(tmpFile, code, 'utf8');

        try {
            const validKeys = new Set(['definedKey']);
            const invalid = scanSourceKeyUsage(tmpDir, validKeys);
            expect(invalid.length).toBe(2);
            expect(invalid.map(x => x.key)).toContain('missingKey');
            expect(invalid.map(x => x.key)).toContain('missingKey2');
        } finally {
            if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
            if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir);
        }
    });

    test('scanHardcodedUIStrings 应当扫描 UI 硬编码中文且忽略带有 i18n-ignore 的行', () => {
        const tmpDir = path.resolve(import.meta.dir, 'temp_ui_dir');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
        const tmpFile = path.join(tmpDir, 'ui_demo.tsx');
        const code = `
            export function Component() {
                return (
                    <div>
                        <button title="硬编码按钮提示">点击我</button>
                        <button title="忽略的提示">忽略的文本</button> {/* i18n-ignore */}
                    </div>
                );
            }
        `;
        fs.writeFileSync(tmpFile, code, 'utf8');

        try {
            const issues = scanHardcodedUIStrings(tmpDir);
            expect(issues.length).toBe(2);
            expect(issues.map(x => x.text)).toContain('硬编码按钮提示');
            expect(issues.map(x => x.text)).toContain('点击我');
            expect(issues.map(x => x.text)).not.toContain('忽略的提示');
            expect(issues.map(x => x.text)).not.toContain('忽略的文本');
        } finally {
            if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
            if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir);
        }
    });

    test('scanSourceKeyUsage 应当支持 Rust .rs 文件中的宏 t!("key") 扫描', () => {
        const tmpDir = path.resolve(import.meta.dir, 'temp_rs_dir');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
        const tmpFile = path.join(tmpDir, 'tray.rs');
        const code = `
            fn setup_menu() {
                let open = t!("open_window");
                let missing = t!("rust_missing_key");
                // let comment = t!("ignored_key");
            }
        `;
        fs.writeFileSync(tmpFile, code, 'utf8');

        try {
            const validKeys = new Set(['open_window']);
            const invalid = scanSourceKeyUsage(tmpDir, validKeys);
            expect(invalid.length).toBe(1);
            expect(invalid[0].key).toBe('rust_missing_key');
            expect(invalid[0].type).toBe('rust_macro');
        } finally {
            if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
            if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir);
        }
    });

    test('scanHardcodedUIStrings 应当能精准检测出 ts、rs、ps1 中单独写入的未国际化中文', () => {
        const tmpDir = path.resolve(import.meta.dir, 'temp_multi_lang_dir');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
        
        const tsFile = path.join(tmpDir, 'service.ts');
        fs.writeFileSync(tsFile, `
            export const title = "未翻译的业务标题";
            console.log("开发调试信息"); // 日志自动忽略
            export const ignored = "显式忽略的中文"; // i18n-ignore
        `, 'utf8');

        const rsFile = path.join(tmpDir, 'ops.rs');
        fs.writeFileSync(rsFile, `
            pub fn get_label() -> &'static str {
                let msg = "未翻译的Rust标签";
                println!("日志信息");
                msg
            }
        `, 'utf8');

        try {
            const issues = scanHardcodedUIStrings(tmpDir, { exts: ['.ts', '.rs', '.ps1'] });
            expect(issues.length).toBe(2);
            expect(issues.map(x => x.text)).toContain('未翻译的业务标题');
            expect(issues.map(x => x.text)).toContain('未翻译的Rust标签');
            expect(issues.map(x => x.text)).not.toContain('开发调试信息');
            expect(issues.map(x => x.text)).not.toContain('显式忽略的中文');
        } finally {
            if (fs.existsSync(tsFile)) fs.unlinkSync(tsFile);
            if (fs.existsSync(rsFile)) fs.unlinkSync(rsFile);
            if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir);
        }
    });
});
