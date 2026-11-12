import fs from 'fs';
import path from 'path';

/**
 * 将路径统一转换为 POSIX 正斜杠格式
 */
function toPosix(p) {
    return p.replace(/\\/g, '/');
}

/**
 * 统计代码行中除去字符串字面量与单行注释后的圆括号数量
 */
export function countCodeParens(lineText, ext = '') {
    const strPattern = ext === '.rs'
        ? /(["`])(?:\\.|(?!\1)[^\\])*\1|'(?:\\(?:x[0-9a-fA-F]{2}|u\{[0-9a-fA-F]+\}|.)|[^'\\])'/g
        : /(["'`])(?:\\.|(?!\1)[^\\])*\1/g;
    const stripped = lineText
        .replace(strPattern, '')
        .replace(/\/\/.*$/, '');
    const openCount = (stripped.match(/\(/g) || []).length;
    const closeCount = (stripped.match(/\)/g) || []).length;
    return { openCount, closeCount };
}

/**
 * 去除 .gitignore 风格行尾未转义空格，并处理前导转义字符
 */
function normalizeIgnoreLine(rawLine) {
    let line = rawLine.replace(/\r$/, '');
    if (line.charCodeAt(0) === 0xfeff) {
        line = line.slice(1);
    }

    // 剥除行尾未转义空格（保留 "\ " 转义空格）
    line = line.replace(/(?<!\\)[ \t]+$/, '');
    return line;
}

/**
 * 反转义常见的 .gitignore 字符（\#, \!, \ ）
 */
function unescapeIgnoreToken(str) {
    return str.replace(/\\([#! ])/g, '$1');
}

/**
 * 将 .gitignore 风格的 glob 模式编译为 RegExp
 */
function globToRegex(globPattern) {
    let regex = '^';
    let i = 0;

    while (i < globPattern.length) {
        const ch = globPattern[i];

        if (ch === '\\' && i + 1 < globPattern.length) {
            regex += escapeRegExp(globPattern[i + 1]);
            i += 2;
            continue;
        }

        if (ch === '*') {
            if (globPattern[i + 1] === '*') {
                const prevIsSlash = i === 0 || globPattern[i - 1] === '/';
                const nextIsSlash = globPattern[i + 2] === '/';
                if (prevIsSlash && nextIsSlash) {
                    // "**/": 匹配零个或多个目录段
                    regex += '(?:.*/)?';
                    i += 3;
                    continue;
                }
                if (i + 2 === globPattern.length && globPattern[i - 1] === '/') {
                    // "/**": 匹配剩余任意子路径
                    regex += '.*';
                    i += 2;
                    continue;
                }
                regex += '.*';
                i += 2;
                continue;
            }
            regex += '[^/]*';
            i += 1;
            continue;
        }

        if (ch === '?') {
            regex += '[^/]';
            i += 1;
            continue;
        }

        if (ch === '[') {
            const closeIdx = globPattern.indexOf(']', i + 1);
            if (closeIdx !== -1) {
                let inner = globPattern.slice(i + 1, closeIdx);
                if (inner.startsWith('!')) {
                    inner = '^' + inner.slice(1);
                }
                regex += `[${inner}]`;
                i = closeIdx + 1;
                continue;
            }
        }

        regex += escapeRegExp(ch);
        i += 1;
    }

    regex += '$';
    return new RegExp(regex);
}

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 解析一条 .gitignore 风格的文件/目录路径规则
 */
function parsePathRule(rawPattern, baseDir) {
    let negated = false;
    let body = rawPattern;

    if (body.startsWith('!')) {
        negated = true;
        body = body.slice(1);
    }

    body = unescapeIgnoreToken(body);
    if (!body) return null;

    const dirOnly = body.endsWith('/');
    if (dirOnly) {
        body = body.replace(/\/+$/, '');
    }
    if (!body) return null;

    const anchored = body.startsWith('/') || body.includes('/');
    if (body.startsWith('/')) {
        body = body.slice(1);
    }
    if (!body) return null;

    const matcher = globToRegex(body);

    // 若存在否定规则且其可能位于当前目录下，禁止对父目录提前剪枝
    const leadingPrefix = body.split('/')[0];

    return {
        kind: 'path',
        baseDir: path.resolve(baseDir),
        raw: rawPattern,
        negated,
        dirOnly,
        anchored,
        pattern: body,
        leadingPrefix,
        matcher,
    };
}

/**
 * 解析行内规则文本（支持 line: / regex: / call: 及 /pattern/flags）
 */
function parseInlineExpr(expr) {
    const trimmed = expr.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('regex:')) {
        const body = trimmed.slice('regex:'.length).trim();
        const slashMatch = body.match(/^\/(.+)\/([gimsuy]*)$/);
        const pattern = slashMatch ? slashMatch[1] : body;
        const flags = slashMatch ? slashMatch[2].replace(/[gy]/g, '') : '';
        try {
            const re = new RegExp(pattern, flags);
            return {
                mode: 'regex',
                regex: re,
                trackMultiline: false,
            };
        } catch {
            return {
                mode: 'literal',
                literal: body,
                trackMultiline: false,
            };
        }
    }

    if (trimmed.startsWith('call:')) {
        const body = trimmed.slice('call:'.length).trim();
        if (!body) return null;
        const hasParen = body.includes('(');
        const callRe = hasParen
            ? null
            : new RegExp(`(?:^|[^a-zA-Z0-9_])${escapeRegExp(body)}\\s*\\(`);
        return {
            mode: 'call',
            literal: body,
            regex: callRe,
            trackMultiline: true,
        };
    }

    const literalBody = trimmed.startsWith('line:')
        ? trimmed.slice('line:'.length).trim()
        : trimmed;
    if (!literalBody) return null;

    // 支持 line:/pattern/flags 写法
    if (trimmed.startsWith('line:')) {
        const slashMatch = literalBody.match(/^\/(.+)\/([gimsuy]*)$/);
        if (slashMatch) {
            try {
                const re = new RegExp(slashMatch[1], slashMatch[2].replace(/[gy]/g, ''));
                return {
                    mode: 'regex',
                    regex: re,
                    trackMultiline: slashMatch[1].includes('\\('),
                };
            } catch {
                // 解析失败回退字面量匹配
            }
        }
    }

    return {
        mode: 'literal',
        literal: literalBody,
        trackMultiline: literalBody.includes('('),
    };
}

/**
 * 解析单条行内模式规则（支持全局 line:/regex:/call: 与文件作用域 fileGlob :: inlineRule）
 */
function parseLineRule(rawLine, baseDir) {
    let negated = false;
    let body = rawLine;
    if (body.startsWith('!')) {
        negated = true;
        body = body.slice(1).trimStart();
    }

    // 1. 全局行内规则：line:... / regex:... / call:...
    if (/^(?:line|regex|call):/.test(body)) {
        const expr = parseInlineExpr(body);
        if (!expr) return null;
        return {
            kind: 'line',
            baseDir: path.resolve(baseDir),
            raw: rawLine,
            negated,
            fileRule: null,
            expr,
        };
    }

    // 2. 文件作用域行内规则：<fileGlob> :: <inlineRule>
    const sepIdx = body.indexOf(' :: ');
    if (sepIdx !== -1) {
        const filePart = body.slice(0, sepIdx).trim();
        const exprPart = body.slice(sepIdx + 4).trim();
        if (!filePart || !exprPart) return null;

        const fileRule = parsePathRule(filePart, baseDir);
        const expr = parseInlineExpr(exprPart);
        if (!fileRule || !expr) return null;

        return {
            kind: 'line',
            baseDir: path.resolve(baseDir),
            raw: rawLine,
            negated,
            fileRule,
            expr,
        };
    }

    return null;
}

/**
 * 解析整个 .i18ntignore 文件内容
 */
export function parseIgnoreFileContent(content, baseDir) {
    const fileRules = [];
    const lineRules = [];
    const lines = content.split('\n');

    for (const rawLine of lines) {
        const normalized = normalizeIgnoreLine(rawLine);
        const trimmed = normalized.trim();

        if (!trimmed) continue;
        if (trimmed.startsWith('#')) continue;

        const lineRule = parseLineRule(normalized, baseDir);
        if (lineRule) {
            lineRules.push(lineRule);
            continue;
        }

        const pathRule = parsePathRule(normalized, baseDir);
        if (pathRule) {
            fileRules.push(pathRule);
        }
    }

    return { fileRules, lineRules };
}

/**
 * 判断一条路径规则是否命中指定相对路径（及其父目录链）
 */
function matchSinglePathRule(rule, relPathPosix, isDir) {
    if (!relPathPosix) return false;
    const segments = relPathPosix.split('/').filter(Boolean);
    if (segments.length === 0) return false;

    const matchTarget = (candidatePath) => {
        if (rule.anchored) {
            return rule.matcher.test(candidatePath);
        }
        const baseName = candidatePath.split('/').pop();
        return rule.matcher.test(baseName);
    };

    if (rule.dirOnly) {
        // 目录自身匹配
        if (isDir && matchTarget(relPathPosix)) {
            return true;
        }
        // 任意祖先目录匹配则子项同受控制
        let acc = '';
        const limit = isDir ? segments.length - 1 : segments.length - 1;
        for (let i = 0; i < limit; i++) {
            acc = acc ? `${acc}/${segments[i]}` : segments[i];
            if (matchTarget(acc)) return true;
        }
        return false;
    }

    // 非 dirOnly 规则：匹配自身路径，或匹配其任一祖先目录名
    if (matchTarget(relPathPosix)) {
        return true;
    }

    let acc = '';
    for (let i = 0; i < segments.length - 1; i++) {
        acc = acc ? `${acc}/${segments[i]}` : segments[i];
        if (matchTarget(acc)) return true;
    }

    return false;
}

/**
 * 计算文件相对于规则基准目录的 POSIX 路径；不在基准目录下返回 null
 */
function getRelativePosix(targetPath, baseDir) {
    const absTarget = path.resolve(targetPath);
    const absBase = path.resolve(baseDir);
    const rel = path.relative(absBase, absTarget);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
        return null;
    }
    return toPosix(rel);
}

/**
 * 检查一条行内表达式是否匹配单行文本
 */
function matchInlineExpr(expr, lineText) {
    if (expr.mode === 'regex') {
        return expr.regex.test(lineText);
    }
    if (expr.mode === 'call') {
        if (expr.regex) return expr.regex.test(lineText);
        return lineText.includes(expr.literal);
    }
    return lineText.includes(expr.literal);
}

/**
 * 自动发现并加载适用当前扫描路径集合的 .i18ntignore 上下文
 */
export function loadIgnoreContext(dirPaths, options = {}) {
    const ignoreFiles = [];
    const seenFiles = new Set();

    const addIgnoreFile = (filePath, baseDir) => {
        const absFile = path.resolve(filePath);
        if (seenFiles.has(absFile) || !fs.existsSync(absFile)) return;
        const stats = fs.statSync(absFile);
        if (!stats.isFile()) return;
        seenFiles.add(absFile);
        ignoreFiles.push({ filePath: absFile, baseDir: path.resolve(baseDir) });
    };

    const explicitIgnoreFile = options.ignoreFile || options['ignore-file'];
    if (explicitIgnoreFile) {
        const explicitFile = path.resolve(explicitIgnoreFile);
        const baseDir = options.rootDir ? path.resolve(options.rootDir) : path.dirname(explicitFile);
        addIgnoreFile(explicitFile, baseDir);
    } else {
        const cwd = path.resolve(options.rootDir || process.cwd());
        addIgnoreFile(path.join(cwd, '.i18ntignore'), cwd);

        const paths = Array.isArray(dirPaths)
            ? dirPaths
            : `${dirPaths}`.split(',').map((s) => s.trim()).filter(Boolean);

        for (const p of paths) {
            const absScan = path.resolve(p);
            if (!fs.existsSync(absScan)) continue;

            // 从扫描目录向上查找到 cwd（若扫描路径在 cwd 之外，则仅检查扫描目录自身及子层）
            const startDir = fs.statSync(absScan).isDirectory() ? absScan : path.dirname(absScan);
            const relFromCwd = path.relative(cwd, startDir);
            const isInsideCwd = !relFromCwd.startsWith('..') && !path.isAbsolute(relFromCwd);

            if (isInsideCwd) {
                const chain = [];
                let curr = startDir;
                while (true) {
                    chain.unshift(curr);
                    if (curr === cwd) break;
                    const parent = path.dirname(curr);
                    if (parent === curr) break;
                    curr = parent;
                }
                for (const dir of chain) {
                    addIgnoreFile(path.join(dir, '.i18ntignore'), dir);
                }
            } else {
                addIgnoreFile(path.join(startDir, '.i18ntignore'), startDir);
            }
        }
    }

    const fileRules = [];
    const lineRules = [];

    for (const item of ignoreFiles) {
        const content = fs.readFileSync(item.filePath, 'utf8');
        const parsed = parseIgnoreFileContent(content, item.baseDir);
        fileRules.push(...parsed.fileRules);
        lineRules.push(...parsed.lineRules);
    }

    const hasNegationFileRule = fileRules.some((r) => r.negated);

    function evaluatePath(targetPath, isDir) {
        if (fileRules.length === 0) return false;
        let ignored = false;
        for (const rule of fileRules) {
            const relPosix = getRelativePosix(targetPath, rule.baseDir);
            if (!relPosix) continue;
            if (matchSinglePathRule(rule, relPosix, isDir)) {
                ignored = !rule.negated;
            }
        }
        return ignored;
    }

    return {
        hasRules: fileRules.length > 0 || lineRules.length > 0,
        ignoreFiles: ignoreFiles.map((f) => f.filePath),
        fileRules,
        lineRules,

        /**
         * 判断指定目录是否可以直接剪枝跳过（存在否定白名单规则时保守不剪枝）
         */
        canPruneDir(dirPath) {
            if (fileRules.length === 0 || hasNegationFileRule) return false;
            return evaluatePath(dirPath, true);
        },

        /**
         * 判断指定文件是否被 .i18ntignore 排除
         */
        isFileIgnored(filePath) {
            return evaluatePath(filePath, false);
        },

        /**
         * 判断文件内单行是否命中行内忽略规则，返回 { ignored, trackMultiline }
         */
        matchLine(filePath, lineText) {
            if (lineRules.length === 0) {
                return { ignored: false, trackMultiline: false };
            }

            let ignored = false;
            let trackMultiline = false;

            for (const rule of lineRules) {
                if (rule.fileRule) {
                    const relPosix = getRelativePosix(filePath, rule.baseDir);
                    if (!relPosix || !matchSinglePathRule(rule.fileRule, relPosix, false)) {
                        continue;
                    }
                }
                if (matchInlineExpr(rule.expr, lineText)) {
                    ignored = !rule.negated;
                    trackMultiline = !rule.negated && rule.expr.trackMultiline;
                }
            }

            return { ignored, trackMultiline };
        },

        /**
         * 预计算单个文件中被行内规则（含跨多行调用）及块标记忽略的所有 1-based 行号集合
         */
        computeIgnoredLineNumbers(filePath, lines) {
            const ignoredSet = new Set();
            if (lineRules.length === 0) return ignoredSet;

            const ext = path.extname(filePath).toLowerCase();
            let parenDepth = 0;
            lines.forEach((lineText, idx) => {
                const lineNum = idx + 1;
                if (parenDepth > 0) {
                    ignoredSet.add(lineNum);
                    const { openCount, closeCount } = countCodeParens(lineText, ext);
                    parenDepth = Math.max(0, parenDepth + openCount - closeCount);
                    return;
                }

                const match = this.matchLine(filePath, lineText);
                if (match.ignored) {
                    ignoredSet.add(lineNum);
                    if (match.trackMultiline) {
                        const { openCount, closeCount } = countCodeParens(lineText, ext);
                        if (openCount > closeCount) {
                            parenDepth = openCount - closeCount;
                        }
                    }
                }
            });

            return ignoredSet;
        },
    };
}
