import { describe, test, expect } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
    scanHardcodedUIStrings,
    scanSourceKeyUsage,
    extractFromDirectory,
} from '../bin/extract-engine.js';

function createTempProject(files: Record<string, string>) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18nt-ignore-'));
    for (const [rel, content] of Object.entries(files)) {
        const full = path.join(tmpDir, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content, 'utf8');
    }
    return tmpDir;
}

function cleanupTempProject(dir: string) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

describe('.i18ntignore 规则与多模式扫描集成测试', () => {
    test('支持 .gitignore 风格的注释、目录、通配符与 ! 否定白名单规则', () => {
        const tmpDir = createTempProject({
            '.i18ntignore': [
                '# 注释行应被跳过',
                '',
                'src/generated/**',
                '*.gen.rs',
                'service/',
                '!service/public_err.rs',
                '/root_only.ts',
                '\\#hash_file.ts',
            ].join('\n'),
            'root_only.ts': 'export const a = "根目录文件应被忽略";',
            'nested/root_only.ts': 'export const b = "子目录同名文件不应被锚定规则忽略";',
            '#hash_file.ts': 'export const c = "转义井号文件应被忽略";',
            'src/generated/a.ts': 'export const d = "生成目录文件应被忽略";',
            'src/app.gen.rs': 'let s = "通配生成文件应被忽略";',
            'service/internal.rs': 'let s = "目录内普通文件应被忽略";',
            'service/public_err.rs': 'return Err("否定白名单恢复的文件应被检出".to_string());',
            'src/main.ts': 'export const e = "正常业务硬编码应被检出";',
        });

        try {
            const issues = scanHardcodedUIStrings(tmpDir, { rootDir: tmpDir });
            const texts = issues.map((i) => i.text);
            expect(texts).toEqual([
                '子目录同名文件不应被锚定规则忽略',
                '否定白名单恢复的文件应被检出',
                '正常业务硬编码应被检出',
            ]);
        } finally {
            cleanupTempProject(tmpDir);
        }
    });

    test('支持全局 line:/regex:/call: 行内模式及跨多行函数调用追踪（含字符串括号保护）', () => {
        const tmpDir = createTempProject({
            '.i18ntignore': [
                'line:log_service_debug(',
                'call:log_if_err',
                'regex:/obf_str!\\(/',
                'line:"纯单行匹配"',
            ].join('\n'),
            'service.rs': [
                'pub fn run() -> Result<(), String> {',
                '    log_service_debug("内部诊断 :) 状态");',
                '    log_service_debug(&format!(',
                '        "跨多行内部诊断 ({})",',
                '        123',
                '    ));',
                '    crate::utils::log_if_err(',
                '        std::fs::remove_file("a"),',
                '        "多行 log_if_err 日志描述",',
                '    );',
                '    let sec = obf_str!("安全混淆串");',
                '    let single = "纯单行匹配";',
                '    if true {',
                '        return Err("真实未翻译错误".to_string());',
                '    }',
                '    Ok(())',
                '}',
            ].join('\n'),
        });

        try {
            const issues = scanHardcodedUIStrings(tmpDir, { rootDir: tmpDir });
            expect(issues.length).toBe(1);
            expect(issues[0].text).toBe('真实未翻译错误');
        } finally {
            cleanupTempProject(tmpDir);
        }
    });

    test('支持 <fileGlob> :: <inlineRule> 文件作用域行内模式与 ! 否定覆盖', () => {
        const tmpDir = createTempProject({
            '.i18ntignore': [
                'ops/*.rs :: line:OneDrive',
                'ops/ops_delete.rs :: regex:拒绝访问|另一个程序正在使用',
                'ops/ops_delete.rs :: line:目标路径',
                '!ops/ops_delete.rs :: line:目标路径不存在',
                'other.rs :: 特定字面量',
            ].join('\n'),
            'ops/library.rs': [
                'let p = user.join("OneDrive").join("文档");',
                'return Err("库模块真实报错".to_string());',
            ].join('\n'),
            'ops/ops_delete.rs': [
                'if err.contains("拒绝访问") || err.contains("另一个程序正在使用") {',
                '    return Err("目标路径不存在".to_string());',
                '}',
            ].join('\n'),
            'other.rs': [
                'let p = user.join("OneDrive").join("文档");',
                'let x = "特定字面量";',
            ].join('\n'),
        });

        try {
            const issues = scanHardcodedUIStrings(tmpDir, { rootDir: tmpDir });
            const items = issues.map((i) => ({
                file: path.relative(tmpDir, i.file).replace(/\\/g, '/'),
                text: i.text,
            }));

            expect(items).toEqual([
                { file: 'ops/library.rs', text: '库模块真实报错' },
                { file: 'ops/ops_delete.rs', text: '目标路径不存在' },
                { file: 'other.rs', text: '文档' },
            ]);
        } finally {
            cleanupTempProject(tmpDir);
        }
    });

    test('.i18ntignore 同时作用于 scanSourceKeyUsage 与 extractFromDirectory', () => {
        const tmpDir = createTempProject({
            '.i18ntignore': [
                'ignored_dir/',
                'main.ts :: line:t("ignoredInlineKey")',
            ].join('\n'),
            'ignored_dir/skip.ts': 't("ignoredFileKey");',
            'main.ts': [
                't("validKey");',
                't("ignoredInlineKey");',
                't("missingKey");',
            ].join('\n'),
        });

        try {
            const validKeys = new Set(['validKey']);
            const invalid = scanSourceKeyUsage(tmpDir, validKeys, { rootDir: tmpDir });
            expect(invalid.map((x) => x.key)).toEqual(['missingKey']);

            const extracted = extractFromDirectory(tmpDir, undefined, { rootDir: tmpDir });
            expect(Object.keys(extracted)).toContain('validKey');
            expect(Object.keys(extracted)).toContain('missingKey');
            expect(Object.keys(extracted)).not.toContain('ignoredFileKey');
        } finally {
            cleanupTempProject(tmpDir);
        }
    });
});
