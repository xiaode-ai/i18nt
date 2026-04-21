import { parseICU } from './icu.js';

interface I18ntVitePluginOptions {
  /** 是否开启预编译（将字符串转换为 AST 数组） */
  preCompile?: boolean;
  /** 
   * 静态替换语种。如果提供，插件会尝试在构建时将 t.key 替换为静态内容。
   * 注意：这通常用于 SSG 或多语种独立构建场景。
   */
  staticLocale?: string;
  /** 翻译字典的基准目录 */
  include?: string | RegExp;
}

export function i18ntVitePlugin(options: I18ntVitePluginOptions = {}) {
  const { preCompile = true, staticLocale, include = /\.json$/ } = options;

  return {
    name: 'vite-plugin-i18nt',

    transform(code: string, id: string) {
      // 1. 处理字典文件：预编译为 AST
      if (preCompile && (typeof include === 'string' ? id.includes(include) : include.test(id))) {
        try {
          const dict = JSON.parse(code);
          if (dict.translations && typeof dict.translations === 'object') {
            const compile = (obj: any) => {
              for (const key in obj) {
                if (typeof obj[key] === 'string') {
                  obj[key] = parseICU(obj[key]);
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                  compile(obj[key]);
                }
              }
            };
            compile(dict.translations);
            return {
              code: `export default ${JSON.stringify(dict)}`,
              map: null
            };
          }
        } catch (e) {
          // 如果不是标准的 i18nt 字典格式，跳过
        }
      }

      // 2. 静态替换 (Macro): 如果指定了 staticLocale
      if (staticLocale) {
        // 这是一个极简实现的 Macro，实际场景可能需要更复杂的正则或 AST 解析
        // 这里匹配 t.xxx.yyy 形式的访问
        const tRegex = /t\.([a-zA-Z0-9_.]+)/g;
        return code.replace(tRegex, (match, path) => {
          // 这里需要能够访问到字典数据，实际实现中通常需要先加载字典
          // 为了简单起见，这里仅作为 Macro 概念的演示占位
          // 真正的生产级 Macro 会结合插件状态中的字典数据进行替换
          return match;
        });
      }

      return null;
    }
  };
}
