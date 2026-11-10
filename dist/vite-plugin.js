import { parseICU } from './icu.js';
/**
 * i18nt Vite 插件：提供预编译、字典剪枝、静态宏替换等工业级优化
 */
export function i18ntVitePlugin(options = {}) {
    const { preCompile = true, prune = false, safelist = [], splitThreshold = 102400, // 100KB
    staticLocale, include = /\.json$/, exclude = /node_modules/ } = options;
    // 记录项目中所有发现的 Key
    const usedKeys = new Set(safelist);
    let staticDict = null;
    return {
        name: 'vite-plugin-i18nt',
        /**
         * 初始化：如果开启了静态替换，尝试预加载字典
         */
        async configResolved() {
            if (staticLocale) {
                // 注意：这里需要用户配合提供正确的 include 路径或预先存在的字典
                // 简单实现：在 transform 阶段按需加载，或者在此处尝试扫描
            }
        },
        /**
         * 第一阶段：扫描源码，提取已使用的 Key (用于 Pruning)
         * 同时执行静态替换 (Macro)
         */
        transform(code, id) {
            if (exclude instanceof RegExp ? exclude.test(id) : id.includes('node_modules'))
                return null;
            // 仅处理 TS/JS/Vue/Svelte 等源码文件
            if (!/\.(js|ts|jsx|tsx|vue|svelte)$/.test(id))
                return null;
            let newCode = code;
            const keyRegex = /(?:t|i18n\.t)(?:\.([a-zA-Z0-9_.]+)|(?:\(['"]([^'"]+)['"]\))|(?:\['([^']+)'\])|(?:\["([^"]+)"\]))/g;
            if (prune || staticLocale) {
                let match;
                while ((match = keyRegex.exec(code)) !== null) {
                    const key = match[1] || match[2] || match[3] || match[4];
                    if (key) {
                        if (prune) {
                            usedKeys.add(key);
                            // 同时保留所有父级路径
                            const parts = key.split('.');
                            for (let i = 1; i < parts.length; i++) {
                                usedKeys.add(parts.slice(0, i).join('.'));
                            }
                        }
                    }
                }
                // 静态替换逻辑 (暂仅支持简单字符串替换，不带变量)
                // 实际应用中，通常需要先 resolve 字典内容，此处演示逻辑
                if (staticLocale && staticDict) {
                    newCode = code.replace(keyRegex, (match, ...groups) => {
                        const key = groups.find(g => g !== undefined);
                        const val = key ? this.resolveStaticKey(staticDict, key) : null;
                        if (typeof val === 'string' && !val.includes('{')) {
                            return JSON.stringify(val);
                        }
                        return match;
                    });
                }
            }
            return newCode !== code ? { code: newCode, map: null } : null;
        },
        resolveStaticKey(dict, path) {
            const keys = path.split('.');
            let val = dict;
            for (const k of keys) {
                val = val?.[k];
                if (val === undefined)
                    return undefined;
            }
            return val;
        },
        /**
         * 第二阶段：处理字典文件，执行预编译和剪枝
         */
        async generateBundle(_options, bundle) {
            if (!preCompile && !prune && !splitThreshold)
                return;
            for (const fileName in bundle) {
                const chunk = bundle[fileName];
                if (chunk.type === 'asset' && (typeof include === 'string' ? fileName.includes(include) : include.test(fileName))) {
                    try {
                        const content = chunk.source.toString();
                        const dict = JSON.parse(content);
                        // 执行剪枝 (Pruning)
                        if (prune && usedKeys.size > 0) {
                            this.pruneDict(dict, usedKeys);
                        }
                        // 执行预解析 (Pre-parsing)
                        if (preCompile) {
                            this.compileDict(dict);
                        }
                        // 执行分包 (Splitting)
                        if (chunk.source.length > splitThreshold) {
                            const baseName = fileName.replace(/\.json$/, '');
                            for (const key in dict) {
                                // 仅对对象类型的顶级 Key 进行分包
                                if (typeof dict[key] === 'object' && dict[key] !== null && !Array.isArray(dict[key]) && !('other' in dict[key])) {
                                    const nsFileName = `${baseName}.${key}.json`;
                                    bundle[nsFileName] = {
                                        type: 'asset',
                                        fileName: nsFileName,
                                        source: JSON.stringify(dict[key])
                                    };
                                    // 标记该 Key 为按需加载（可选，目前通过运行时 detect）
                                    delete dict[key];
                                }
                            }
                        }
                        chunk.source = JSON.stringify(dict);
                    }
                    catch (e) {
                        // Ignore non-json or malformed assets
                    }
                }
            }
        },
        // 递归编译字典
        compileDict(obj) {
            if (!obj || typeof obj !== 'object')
                return;
            for (const key in obj) {
                const val = obj[key];
                if (typeof val === 'string') {
                    if (val.includes('{') || val.includes('<')) {
                        obj[key] = parseICU(val);
                    }
                }
                else if (Array.isArray(val)) {
                    // 如果数组里是 AST 节点，跳过（防止重复编译）
                    const isAST = val.some(i => typeof i === 'object' && i !== null && 'type' in i);
                    if (!isAST) {
                        for (let i = 0; i < val.length; i++) {
                            if (typeof val[i] === 'string' && (val[i].includes('{') || val[i].includes('<'))) {
                                val[i] = parseICU(val[i]);
                            }
                            else if (typeof val[i] === 'object' && val[i] !== null) {
                                this.compileDict(val[i]);
                            }
                        }
                    }
                }
                else if (typeof val === 'object' && val !== null) {
                    // 如果是复数规则对象，编译其内部的所有字符串
                    if ('other' in val || 'one' in val) {
                        for (const k in val) {
                            if (typeof val[k] === 'string' && (val[k].includes('{') || val[k].includes('<'))) {
                                val[k] = parseICU(val[k]);
                            }
                        }
                    }
                    else {
                        this.compileDict(val);
                    }
                }
            }
        },
        // 递归剪枝字典
        pruneDict(obj, keys, currentPath = '') {
            for (const key in obj) {
                const path = currentPath ? `${currentPath}.${key}` : key;
                // 检查当前路径是否在已用列表中，或者其任何子路径在已用列表中
                const isPathUsed = keys.has(path);
                const isSubPathUsed = Array.from(keys).some(k => k.startsWith(`${path}.`));
                if (!isPathUsed && !isSubPathUsed) {
                    delete obj[key];
                    continue;
                }
                if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key]) && !('other' in obj[key])) {
                    this.pruneDict(obj[key], keys, path);
                    // 如果子树变空且路径本身没被直接用到，也删除它
                    if (Object.keys(obj[key]).length === 0 && !isPathUsed) {
                        delete obj[key];
                    }
                }
            }
        }
    };
}
