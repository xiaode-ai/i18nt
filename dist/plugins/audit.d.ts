/**
 * Audit Plugin
 * 记录翻译 Key 的使用频率及缺失情况，用于性能分析和字典瘦身
 */
export declare function auditPlugin(options?: {
    onReport?: (report: AuditReport) => void;
}): {
    name: string;
    onInit(instance: any): void;
    onLocaleChange(locale: string): void;
    onMissingKey(key: string, locale: string): void;
    /**
     * 获取当前审计报告
     */
    getReport(): AuditReport;
    /**
     * 重置统计信息
     */
    reset(): void;
};
export interface AuditReport {
    hits: Record<string, number>;
    missing: string[];
    locales: string[];
    timestamp: number;
}
