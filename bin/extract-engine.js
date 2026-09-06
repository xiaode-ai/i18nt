import ts from 'typescript';
import fs from 'fs';
import path from 'path';

/**
 * 辅助：提取 AST 节点中的字符串字面量值（支持类型断言、括号等）
 */
export function extractStringValue(node) {
    if (!node) return null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        return node.text;
    }
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
        return extractStringValue(node.expression);
    }
    if (ts.isParenthesizedExpression(node)) {
        return extractStringValue(node.expression);
    }
    return null;
}

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
        // 1. 匹配 t('key', 'default')，支持 t('key' as TranslationKey)
        if (ts.isCallExpression(node)) {
            const expression = node.expression;
            if ((ts.isIdentifier(expression) && expression.text === 't') ||
                (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.name) && expression.name.text === 't')) {
                const args = node.arguments;
                const key = args.length > 0 ? extractStringValue(args[0]) : null;
                if (key) {
                    let defaultValue = '';
                    if (args.length > 1) {
                        const def = extractStringValue(args[1]);
                        if (def) defaultValue = def;
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
 * 扫描源码目录中 t('key')、Rust t!("key") 和 key as TranslationKey 的键使用情况，找出未在字典中定义的键
 */
export function scanSourceKeyUsage(dirPaths, validKeySet) {
    const invalidUsages = [];
    const jsTsExts = ['.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs', '.vue'];
    const otherExts = ['.rs', '.ps1', '.py', '.go', '.sh', '.bash', '.zsh', '.c', '.cpp', '.h', '.hpp', '.cs', '.java', '.kt', '.rb', '.php', '.lua', '.scala', '.html', '.htm', '.cmd', '.bat', '.nsh'];
    const paths = Array.isArray(dirPaths) ? dirPaths : `${dirPaths}`.split(',').map(s => s.trim()).filter(Boolean);

    function walk(curr) {
        if (!fs.existsSync(curr)) return;
        const items = fs.readdirSync(curr);
        for (const item of items) {
            if (['node_modules', '.git', 'dist', '.i18nt', 'vendor', 'bin', 'obj', 'target', 'release', 'coverage', '.cache'].includes(item)) continue;
            const fullPath = path.join(curr, item);
            const stats = fs.statSync(fullPath);
            if (stats.isDirectory()) {
                walk(fullPath);
            } else {
                const ext = path.extname(item).toLowerCase();
                if (jsTsExts.includes(ext)) {
                    checkJsTsFile(fullPath);
                } else if (otherExts.includes(ext)) {
                    checkOtherFile(fullPath);
                }
            }
        }
    }

    function checkJsTsFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        // 1. AST 解析精准检查 t("key")
        try {
            const sourceFile = ts.createSourceFile(
                filePath,
                content,
                ts.ScriptTarget.Latest,
                true
            );

            function visitNode(node) {
                if (ts.isCallExpression(node)) {
                    const expr = node.expression;
                    if ((ts.isIdentifier(expr) && expr.text === 't') ||
                        (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.name) && expr.name.text === 't')) {
                        const args = node.arguments;
                        const key = args.length > 0 ? extractStringValue(args[0]) : null;
                        if (key && !validKeySet.has(key)) {
                            const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                            invalidUsages.push({
                                file: filePath,
                                line: line + 1,
                                col: character + 1,
                                key,
                                type: 'call'
                            });
                        }
                    }
                }
                ts.forEachChild(node, visitNode);
            }

            visitNode(sourceFile);
        } catch (e) {
            // AST 容错
        }

        // 2. 正则检查 "key" as TranslationKey
        lines.forEach((lineText, idx) => {
            const lineNum = idx + 1;
            const asMatch = lineText.match(/["']([^"']+)["']\s+as\s+TranslationKey/);
            if (asMatch) {
                const key = asMatch[1];
                if (!validKeySet.has(key)) {
                    invalidUsages.push({
                        file: filePath,
                        line: lineNum,
                        key,
                        type: 'type_assertion'
                    });
                }
            }
        });
    }

    function checkOtherFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        // 匹配 t!("key") 或 t("key") 或 t 'key' 或 $t("key")
        const regex = /\b(?:\$t|t!?)\s*(?:\(\s*|\s+)(['"`])([^'"`\n]+)\1/g;

        lines.forEach((lineText, idx) => {
            const lineNum = idx + 1;
            const trimmed = lineText.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('::') || trimmed.startsWith('rem ') || trimmed.startsWith('REM ')) return;
            if (lineText.includes('i18n-ignore')) return;

            let match;
            while ((match = regex.exec(lineText)) !== null) {
                const key = match[2];
                if (key && !['apply', 'call', 'bind'].includes(key) && !validKeySet.has(key)) {
                    invalidUsages.push({
                        file: filePath,
                        line: lineNum,
                        key,
                        type: path.extname(filePath) === '.rs' ? 'rust_macro' : 'regex_call'
                    });
                }
            }
        });
    }

    paths.forEach(p => walk(path.resolve(p)));
    return invalidUsages;
}

/**
 * 扫描源码中未国际化的硬编码中文（JSX 文本、UI 属性、TS/RS 等代码中的中文字符串字面量）
 */
export function scanHardcodedUIStrings(dirPaths, options = {}) {
    const hardcodedIssues = [];
    const uiAttrs = ['title', 'placeholder', 'aria-label', 'alt', 'tooltip', 'label'];
    const exts = options.exts || ['.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs', '.vue', '.html', '.htm'];
    const paths = Array.isArray(dirPaths) ? dirPaths : `${dirPaths}`.split(',').map(s => s.trim()).filter(Boolean);

    function containsChinese(str) {
        return /[\u4e00-\u9fa5]/.test(str);
    }

    function isIgnoredLine(line) {
        return line.includes('i18n-ignore') || line.includes('eslint-disable') || line.includes('@ts-ignore');
    }

    function isLoggingOrErrorLine(line) {
        const trimmed = line.trim();
        return (
            trimmed.startsWith('console.') ||
            trimmed.startsWith('debugLog(') ||
            trimmed.startsWith('tracing::') ||
            trimmed.startsWith('info!(') ||
            trimmed.startsWith('warn!(') ||
            trimmed.startsWith('error!(') ||
            trimmed.startsWith('debug!(') ||
            trimmed.startsWith('trace!(') ||
            trimmed.startsWith('println!(') ||
            trimmed.startsWith('eprintln!(') ||
            trimmed.startsWith('panic!(') ||
            trimmed.startsWith('bail!(') ||
            trimmed.startsWith('anyhow!(') ||
            trimmed.startsWith('Write-Host ') ||
            trimmed.startsWith('logging.') ||
            line.includes('Err(format!') ||
            line.includes('Err(') ||
            line.includes('new Error(') ||
            line.includes('throw new ')
        );
    }

    function isDictionaryOrTestFile(filePath) {
        const norm = filePath.replace(/\\/g, '/');
        return (
            norm.includes('/i18n/') ||
            norm.includes('/tests/') ||
            norm.includes('.test.') ||
            norm.includes('.spec.') ||
            norm.includes('poster_manifest.') ||
            norm.includes('cli-translations.') ||
            norm.includes('/scripts/') ||
            norm.includes('/sample_generators/')
        );
    }

    function walk(curr) {
        if (!fs.existsSync(curr)) return;
        const items = fs.readdirSync(curr);
        for (const item of items) {
            if (['node_modules', '.git', 'dist', '.i18nt', 'vendor', 'bin', 'obj', 'target', 'release', 'coverage', '.cache'].includes(item)) continue;
            const fullPath = path.join(curr, item);
            const stats = fs.statSync(fullPath);
            if (stats.isDirectory()) {
                walk(fullPath);
            } else if (exts.includes(path.extname(item).toLowerCase())) {
                if (!isDictionaryOrTestFile(fullPath)) {
                    checkFile(fullPath);
                }
            }
        }
    }

    function checkFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const ext = path.extname(filePath).toLowerCase();

        lines.forEach((lineText, idx) => {
            const lineNum = idx + 1;
            const trimmed = lineText.trim();

            if (!trimmed || isIgnoredLine(lineText) || isLoggingOrErrorLine(lineText)) return;
            if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('#') || trimmed.startsWith('<!--') || trimmed.startsWith('::') || trimmed.startsWith('REM ') || trimmed.startsWith('rem ')) return;

            // 剥除行尾单行注释
            let codePart = lineText;
            if (codePart.includes('//')) codePart = codePart.split('//')[0];
            if (codePart.includes('/*') && codePart.includes('*/')) {
                codePart = codePart.replace(/\/\*.*?\*\//g, '');
            }
            if (!containsChinese(codePart)) return;

            // 1. 扫描 UI 属性 (JSX/HTML)
            if (['.tsx', '.jsx', '.html', '.htm', '.vue'].includes(ext)) {
                for (const attr of uiAttrs) {
                    const attrRegex = new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, 'g');
                    let match;
                    while ((match = attrRegex.exec(codePart)) !== null) {
                        const text = match[1];
                        if (containsChinese(text)) {
                            hardcodedIssues.push({
                                file: filePath,
                                line: lineNum,
                                text,
                                type: `UI 属性 (${attr})`
                            });
                        }
                    }
                }

                // 2. 扫描 JSX/HTML 文本标签内容 >中文<
                const jsxRegex = />([^<{}>]*[\u4e00-\u9fa5][^<{}>]*)</g;
                let jsxMatch;
                while ((jsxMatch = jsxRegex.exec(codePart)) !== null) {
                    const text = jsxMatch[1].trim();
                    if (text && containsChinese(text)) {
                        hardcodedIssues.push({
                            file: filePath,
                            line: lineNum,
                            text,
                            type: 'JSX/HTML 文本'
                        });
                    }
                }
            }

            // 3. 扫描代码中的中文字符串字面量（如 const a = "中文" 或 let s = "中文";）
            // 排除已经被 t("...") / t!("...") / $t("...") 包裹的字符串
            const strRegex = /(?:^|[^a-zA-Z0-9_$!])(["'`])((?:\\.|(?!\1)[^\\])*[\u4e00-\u9fa5]+(?:\\.|(?!\1)[^\\])*)\1/g;
            let strMatch;
            while ((strMatch = strRegex.exec(codePart)) !== null) {
                const text = strMatch[2].trim();
                const matchStart = strMatch.index;

                // 检查匹配前缀是否是 t( 或 t!( 或 $t(
                const prefix = codePart.substring(Math.max(0, matchStart - 10), matchStart + 1);
                if (/\b(?:t!?|\$t)\s*\(\s*$/.test(prefix)) {
                    continue; // 已经是 t("...") 调用
                }

                // 如果是 JSX 属性已经处理过的，避免重复记录
                if (['.tsx', '.jsx', '.html', '.htm', '.vue'].includes(ext) && uiAttrs.some(attr => codePart.includes(`${attr}=`))) {
                    continue;
                }

                if (text && containsChinese(text)) {
                    hardcodedIssues.push({
                        file: filePath,
                        line: lineNum,
                        text,
                        type: `代码字符串字面量 (${ext})`
                    });
                }
            }
        });
    }

    paths.forEach(p => walk(path.resolve(p)));
    return hardcodedIssues;
}

/**
 * 备选方案：通过正则表达式提取 Key（用于非 TS/JS 项目，如 Rust、Python、Go 等）
 */
export function extractKeysFromRegex(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const results = {};
    
    // 1. 匹配 t('key') 或 t('key', 'default') 或 Rust 宏 t!("key")
    const callRegex = /\bt!?\s*\(\s*(['"`])(.*?)\1\s*(?:,\s*(['"`])(.*?)\3)?\s*\)/g;
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
        if (!fs.existsSync(curr)) return;
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

