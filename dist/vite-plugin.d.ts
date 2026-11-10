interface I18ntVitePluginOptions {
    /** 是否开启预编译（将字符串转换为 AST 数组） */
    preCompile?: boolean;
    /**
     * 是否开启生产环境字典剪枝。
     * 自动扫描源码中使用的 t.xxx 或 t('xxx')，剔除字典中未使用的 Key。
     */
    prune?: boolean;
    /**
     * 剪枝白名单。
     * 即使源码中没扫描到，也会保留这些 Key（支持通配符或前缀）。
     */
    safelist?: string[];
    /**
     * 静态替换语种。如果提供，插件会尝试在构建时将 t.key 替换为静态内容。
     * 注意：这通常用于 SSG 或多语种独立构建场景。
     */
    staticLocale?: string;
    /**
     * 分包阈值（字节）。如果字典文件超过此大小，尝试按顶级 Key 拆分。
     * 默认 100KB。
     */
    splitThreshold?: number;
    /** 翻译字典的基准目录 */
    include?: string | RegExp;
    /** 排除的文件 */
    exclude?: string | RegExp;
}
/**
 * i18nt Vite 插件：提供预编译、字典剪枝、静态宏替换等工业级优化
 */
export declare function i18ntVitePlugin(options?: I18ntVitePluginOptions): {
    name: string;
    /**
     * 初始化：如果开启了静态替换，尝试预加载字典
     */
    configResolved(): Promise<void>;
    /**
     * 第一阶段：扫描源码，提取已使用的 Key (用于 Pruning)
     * 同时执行静态替换 (Macro)
     */
    transform(code: string, id: string): {
        code: string;
        map: null;
    } | null;
    resolveStaticKey(dict: any, path: string): any;
    /**
     * 第二阶段：处理字典文件，执行预编译和剪枝
     */
    generateBundle(_options: any, bundle: any): Promise<void>;
    compileDict(obj: any): void;
    pruneDict(obj: any, keys: Set<string>, currentPath?: string): void;
};
export {};
