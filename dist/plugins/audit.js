/**
 * Audit Plugin
 * 记录翻译 Key 的使用频率及缺失情况，用于性能分析和字典瘦身
 */
export function auditPlugin(options = {}) {
    const stats = {
        hits: new Map(),
        missing: new Set(),
        locales: new Set()
    };
    return {
        name: 'audit',
        onInit(instance) {
            // 记录已加载的语言
            stats.locales.add(instance.locale);
            // 注入后处理器记录命中
            instance.config.postProcessors.push((val, key) => {
                if (key) {
                    stats.hits.set(key, (stats.hits.get(key) || 0) + 1);
                }
                return val;
            });
        },
        onLocaleChange(locale) {
            stats.locales.add(locale);
        },
        onMissingKey(key, locale) {
            stats.missing.add(`${locale}:${key}`);
        },
        /**
         * 获取当前审计报告
         */
        getReport() {
            return {
                hits: Object.fromEntries(stats.hits),
                missing: Array.from(stats.missing),
                locales: Array.from(stats.locales),
                timestamp: Date.now()
            };
        },
        /**
         * 重置统计信息
         */
        reset() {
            stats.hits.clear();
            stats.missing.clear();
        }
    };
}
