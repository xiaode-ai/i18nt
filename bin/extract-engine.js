import ts from 'typescript';
import fs from 'fs';
import path from 'path';

/**
 * 核心 AST 提取引擎
 */
export function extractKeysFromSource(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true
    );

    const results = {}; // { key: defaultValue }
    const reserved = ['apply', 'call', 'bind', 'n', 'd', 'relative', 'formatNumber', 'formatDate', 'formatRelative', 'locale', 'setLocale', 'isRTL', 'onChange', 'loadNamespace', 'addTranslations', 'missingKeys', 'availableLocales', 'exportState', 'importState', 'validate', 'prune', 'isDouble', 'toString', 'valueOf', 'toJSON'];

    function visit(node) {
        // 1. 匹配 t('key', 'default')
        if (ts.isCallExpression(node)) {
            const expression = node.expression;
            // 匹配 t(...)
            if (ts.isIdentifier(expression) && expression.text === 't') {
                const args = node.arguments;
                if (args.length > 0 && ts.isStringLiteral(args[0])) {
                    const key = args[0].text;
                    let defaultValue = '';
                    if (args.length > 1 && ts.isStringLiteral(args[1])) {
                        defaultValue = args[1].text;
                    }
                    if (!results[key] || defaultValue) {
                        results[key] = defaultValue;
                    }
                }
            }
            // 匹配 i18n.t(...)
            else if (ts.isPropertyAccessExpression(expression) && 
                     ts.isIdentifier(expression.name) && expression.name.text === 't') {
                const args = node.arguments;
                if (args.length > 0 && ts.isStringLiteral(args[0])) {
                    const key = args[0].text;
                    let defaultValue = '';
                    if (args.length > 1 && ts.isStringLiteral(args[1])) {
                        defaultValue = args[1].text;
                    }
                    if (!results[key] || defaultValue) {
                        results[key] = defaultValue;
                    }
                }
            }
        }

        // 2. 匹配 t.a.b.c
        if (ts.isPropertyAccessExpression(node)) {
            let current = node;
            const parts = [];
            let isValid = false;

            while (ts.isPropertyAccessExpression(current)) {
                parts.unshift(current.name.text);
                if (ts.isIdentifier(current.expression) && current.expression.text === 't') {
                    isValid = true;
                    break;
                }
                // 处理 i18n.t.a.b
                if (ts.isPropertyAccessExpression(current.expression) && 
                    ts.isIdentifier(current.expression.name) && current.expression.name.text === 't') {
                    isValid = true;
                    break;
                }
                current = current.expression;
            }

            if (isValid) {
                const firstPart = parts[0];
                if (!reserved.includes(firstPart)) {
                    const keyPath = parts.join('.');
                    if (!results[keyPath]) results[keyPath] = '';
                }
            }
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return results;
}

/**
 * 递归扫描目录
 */
export function extractFromDirectory(dirPath, extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue']) {
    const allResults = {};
    
    function walk(curr) {
        const items = fs.readdirSync(curr);
        for (const item of items) {
            if (['node_modules', '.git', 'dist', '.i18nt'].includes(item)) continue;
            const fullPath = path.join(curr, item);
            const stats = fs.statSync(fullPath);
            
            if (stats.isDirectory()) {
                walk(fullPath);
            } else if (extensions.includes(path.extname(item))) {
                const fileResults = extractKeysFromSource(fullPath);
                Object.assign(allResults, fileResults);
            }
        }
    }

    walk(path.resolve(dirPath));
    return allResults;
}
