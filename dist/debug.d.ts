import type { I18nPlugin } from './types.js';
/**
 * 调试插件：提供可视化调试能力
 */
export declare const debugPlugin: () => I18nPlugin;
/**
 * 调试工具包：暴露给 window 对象以便在控制台或 UI 中调用
 */
export declare const i18ntDebug: {
    /**
     * 开启/关闭视觉高亮（在 UI 上直接显示 Key 路径）
     */
    toggleVisualHints(active?: boolean): void;
    /**
     * 显示浮动调试面板
     */
    showOverlay(): void;
};
