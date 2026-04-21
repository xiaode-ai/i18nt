/**
 * Audit Plugin
 * 记录翻译 Key 的使用频率及缺失情况，用于性能分析和字典瘦身
 */
export function auditPlugin(options: { 
    onReport?: (report: AuditReport) => void;
} = {}) {
    const stats = {
        hits: new Map<string, number>(),
        missing: new Set<string>(),
        locales: new Set<string>()
    };

    return {
        name: 'audit',
        onInit(instance: any) {
            // 记录已加载的语言
            stats.locales.add(instance.locale);

            // 注入后处理器记录命中
            instance.config.postProcessors.push((val: any, key?: string) => {
                if (key) {
                    stats.hits.set(key, (stats.hits.get(key) || 0) + 1);
                }
                return val;
            });
        },
        onLocaleChange(locale: string) {
            stats.locales.add(locale);
        },
        onMissingKey(key: string, locale: string) {
            stats.missing.add(`${locale}:${key}`);
        },
        /**
         * 获取当前审计报告
         */
        getReport(): AuditReport {
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

export interface AuditReport {
    hits: Record<string, number>;
    missing: string[];
    locales: string[];
    timestamp: number;
}
