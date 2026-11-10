/**
 * Visual Edit Plugin v2.0
 * 为翻译结果添加元数据，支持专业的 Shadow DOM 悬浮编辑面板
 */
export declare function visualEditPlugin(options?: {
    enabled?: boolean;
    onEdit?: (key: string, value: string, locale: string) => Promise<void> | void;
}): {
    name: string;
    onInit(instance: any): void;
    bindEvents(ui: VisualEditUI): void;
    hasI18nMark(el: HTMLElement): boolean;
    getI18nMark(el: HTMLElement): {
        key: string;
        value: string;
    } | null;
};
/**
 * 内部 UI 管理类
 */
declare class VisualEditUI {
    private onEdit?;
    private container;
    private shadow;
    private currentKey;
    private i18nInstance;
    constructor(onEdit?: ((key: string, value: string, locale: string) => Promise<void> | void) | undefined);
    setInstance(instance: any): void;
    ensureInjected(): void;
    show(key: string, value: string): void;
    private updatePreview;
    private extractVars;
    hide(): void;
    handleSave(): Promise<void>;
}
export {};
