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

    const results = {}; // { key: { defaultValue, meta } }
    const reserved = ['apply', 'call', 'bind', 'n', 'd', 'relative', 'formatNumber', 'formatDate', 'formatRelative', 'locale', 'setLocale', 'isRTL', 'onChange', 'loadNamespace', 'addTranslations', 'missingKeys', 'availableLocales', 'exportState', 'importState', 'validate', 'prune', 'isDouble', 'toString', 'valueOf', 'toJSON'];

    function getMetadata(node) {
        const fullText = sourceFile.getFullText();
        const leading = ts.getLeadingCommentRanges(fullText, node.pos) || [];
        const trailing = ts.getTrailingCommentRanges(fullText, node.end) || [];
        const commentRanges = [...leading, ...trailing];
        if (commentRanges.length === 0) return {};
        
        const meta = {};
        for (const range of commentRanges) {
            const comment = fullText.substring(range.pos, range.end);
            // 匹配 @i18nt-desc: 描述内容
            const descMatch = comment.match(/@i18nt-desc\s*[:：]\s*(.*)/);
            if (descMatch) meta.desc = descMatch[1].trim();
            
            // 匹配 @i18nt-meta: key="val"
            const metaMatch = comment.match(/@i18nt-meta\s*[:：]\s*(.*)/);
            if (metaMatch) {
                const pairs = metaMatch[1].match(/(\w+)="([^"]*)"/g);
                if (pairs) {
                    pairs.forEach(p => {
                        const [k, v] = p.split('=');
                        meta[k.trim()] = v.replace(/"/g, '');
                    });
                }
            }
        }
        return meta;
    }

    function visit(node) {
        // 1. 匹配 t('key', 'default')
        if (ts.isCallExpression(node)) {
            const expression = node.expression;
            if ((ts.isIdentifier(expression) && expression.text === 't') ||
                (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.name) && expression.name.text === 't')) {
                const args = node.arguments;
                if (args.length > 0 && ts.isStringLiteral(args[0])) {
                    const key = args[0].text;
                    let defaultValue = '';
                    if (args.length > 1 && ts.isStringLiteral(args[1])) {
                        defaultValue = args[1].text;
                    }
                    
                    // 向上查找 ExpressionStatement 获取注释
                    let parent = node.parent;
                    while (parent && !ts.isExpressionStatement(parent) && !ts.isVariableDeclaration(parent) && !ts.isPropertyAssignment(parent)) {
                        parent = parent.parent;
                    }
                    const meta = parent ? getMetadata(parent) : {};

                    if (!results[key] || defaultValue || Object.keys(meta).length > 0) {
                        results[key] = { defaultValue: defaultValue || (results[key]?.defaultValue || ''), meta: { ...(results[key]?.meta || {}), ...meta } };
                    }
                }
            }
        }

        // 2. 匹配 t.a.b.c
        if (ts.isPropertyAccessExpression(node)) {
            // 只处理最顶层的 PropertyAccess (即不是另一个 PropertyAccess 的 expression)
            if (!ts.isPropertyAccessExpression(node.parent)) {
                let current = node;
                const parts = [];
                let isValid = false;

                while (ts.isPropertyAccessExpression(current)) {
                    parts.unshift(current.name.text);
                    if (ts.isIdentifier(current.expression) && current.expression.text === 't') {
                        isValid = true;
                        break;
                    }
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
                        let parent = node.parent;
                        while (parent && !ts.isExpressionStatement(parent) && !ts.isVariableDeclaration(parent) && !ts.isPropertyAssignment(parent)) {
                            parent = parent.parent;
                        }
                        const meta = parent ? getMetadata(parent) : {};
                        
                        if (!results[keyPath]) results[keyPath] = { defaultValue: '', meta: {} };
                        results[keyPath].meta = { ...results[keyPath].meta, ...meta };
                    }
                }
            }
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return results;
}

/**
 * 备选方案：通过正则表达式提取 Key（用于非 TS/JS 项目）
 */
export function extractKeysFromRegex(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const results = {};
    
    // 1. 匹配 t('key') 或 t('key', 'default')
    const callRegex = /\bt\s*\(\s*(['"`])(.*?)\1\s*(?:,\s*(['"`])(.*?)\3)?\s*\)/g;
    // 2. 匹配 t 'key' 或 t 'key', 'default' (支持无括号调用)
    const spaceRegex = /\bt\s+(['"`])(.*?)\1(?:\s*[,\s]\s*(['"`])(.*?)\3)?/g;
    // 3. 匹配 t.key.path (仅限点语法)
    const propRegex = /\bt\.([a-zA-Z0-9_.]+)/g;
    
    const addResult = (key, defaultValue) => {
        if (key && !['apply', 'call', 'bind'].includes(key)) {
            results[key] = { defaultValue: defaultValue || '', meta: { extractedBy: 'regex' } };
        }
    };

    let match;
    while ((match = callRegex.exec(content)) !== null) addResult(match[2], match[4]);
    while ((match = spaceRegex.exec(content)) !== null) addResult(match[2], match[4]);
    while ((match = propRegex.exec(content)) !== null) addResult(match[1], '');
    
    return results;
}

/**
 * 递归扫描目录
 */
export function extractFromDirectory(dirPath, extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.ps1', '.py', '.go', '.sh', '.c', '.cpp', '.rs', '.rb', '.php', '.java', '.kt', '.cs', '.lua', '.scala', '.ex', '.pl', '.m', '.hs']) {
    const allResults = {};
    const tsExtensions = ['.ts', '.tsx', '.js', '.jsx', '.vue'];
    
    function walk(curr) {
        const items = fs.readdirSync(curr);
        for (const item of items) {
            if (['node_modules', '.git', 'dist', '.i18nt', 'vendor', 'bin', 'obj'].includes(item)) continue;
            const fullPath = path.join(curr, item);
            const stats = fs.statSync(fullPath);
            
            if (stats.isDirectory()) {
                walk(fullPath);
            } else {
                const ext = path.extname(item);
                if (tsExtensions.includes(ext)) {
                    const fileResults = extractKeysFromSource(fullPath);
                    Object.assign(allResults, fileResults);
                } else if (extensions.includes(ext)) {
                    const fileResults = extractKeysFromRegex(fullPath);
                    Object.assign(allResults, fileResults);
                }
            }
        }
    }

    walk(path.resolve(dirPath));
    return allResults;
}
