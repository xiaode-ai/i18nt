import { parseICU } from './icu.js';

interface I18ntVitePluginOptions {
  /** 是否开启预编译（将字符串转换为 AST 数组） */
  preCompile?: boolean;
  /** 
   * 是否开启生产环境字典剪枝。
   * 自动扫描源码中使用的 t.xxx 或 t('xxx')，剔除字典中未使用的 Key。
   */
  prune?: boolean;
  /** 
   * 静态替换语种。如果提供，插件会尝试在构建时将 t.key 替换为静态内容。
   * 注意：这通常用于 SSG 或多语种独立构建场景。
   */
  staticLocale?: string;
  /** 翻译字典的基准目录 */
  include?: string | RegExp;
  /** 排除的文件 */
  exclude?: string | RegExp;
}

/**
 * i18nt Vite 插件：提供预编译、字典剪枝、静态宏替换等工业级优化
 */
export function i18ntVitePlugin(options: I18ntVitePluginOptions = {}) {
  const { 
    preCompile = true, 
    prune = false, 
    staticLocale, 
    include = /\.json$/,
    exclude = /node_modules/
  } = options;

  // 记录项目中所有发现的 Key
  const usedKeys = new Set<string>();

  return {
    name: 'vite-plugin-i18nt',

    /**
     * 第一阶段：扫描源码，提取已使用的 Key (用于 Pruning)
     */
    transform(code: string, id: string) {
      if (exclude instanceof RegExp ? exclude.test(id) : id.includes('node_modules')) return null;

      if (prune) {
        // 匹配 t.a.b.c 或 t('a.b.c') 或 t("a.b.c")
        const keyRegex = /t(?:\.([a-zA-Z0-9_.]+)|(?:\(['"]([^'"]+)['"]\)))/g;
        let match;
        while ((match = keyRegex.exec(code)) !== null) {
          const key = match[1] || match[2];
          if (key) usedKeys.add(key);
        }
      }

      return null;
    },

    /**
     * 第二阶段：处理字典文件，执行预编译和剪枝
     */
    async generateBundle(_options: any, bundle: any) {
      if (!preCompile && !prune) return;

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

            chunk.source = JSON.stringify(dict);
          } catch (e) {
            // Ignore non-json or malformed assets
          }
        }
      }
    },

    // 递归编译字典
    compileDict(obj: any) {
        for (const key in obj) {
            if (typeof obj[key] === 'string' && (obj[key].includes('{') || obj[key].includes('<'))) {
                obj[key] = parseICU(obj[key]);
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                this.compileDict(obj[key]);
            }
        }
    },

    // 递归剪枝字典
    pruneDict(obj: any, keys: Set<string>, currentPath = '') {
        for (const key in obj) {
            const path = currentPath ? `${currentPath}.${key}` : key;
            // 如果是翻译项（字符串或数组或复数对象）
            const isTranslation = typeof obj[key] === 'string' || Array.isArray(obj[key]) || ('other' in obj[key]);
            
            if (isTranslation) {
                // 如果 Key 没被用到，删除它
                if (!keys.has(path)) {
                    delete obj[key];
                }
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                this.pruneDict(obj[key], keys, path);
                // 如果子树变空，也删除它
                if (Object.keys(obj[key]).length === 0) {
                    delete obj[key];
                }
            }
        }
    }
  };
}
