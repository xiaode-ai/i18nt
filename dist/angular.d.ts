/**
 * i18nt — Angular 适配层
 * 提供 Service 与 Pipe 支持
 */
import { PipeTransform, InjectionToken } from '@angular/core';
import type { I18nConfig, I18nInstance, TranslationDict } from './types.js';
export declare const I18N_CONFIG: InjectionToken<I18nConfig<TranslationDict>>;
export declare const I18N_INSTANCE: InjectionToken<I18nInstance<TranslationDict>>;
export declare class I18nService<T extends TranslationDict = TranslationDict> {
    private _instance;
    private platformId;
    /**
     * 使用 Angular Signal 包装语言状态
     * 确保在语言切换时触发全站变更检测
     */
    readonly locale: import("@angular/core").WritableSignal<string>;
    readonly isRTL: import("@angular/core").WritableSignal<boolean>;
    /** 代理翻译对象 */
    readonly t: I18nInstance<T>['t'];
    constructor();
    setLocale(lang: string): void;
    get availableLocales(): string[];
}
/**
 * 翻译 Pipe，用于模板
 * @example {{ 'buttons.save' | t }}
 */
export declare class TranslatePipe implements PipeTransform {
    private i18n;
    transform(path: string, params?: Record<string, any>): string;
}
/**
 * Angular 提供者辅助函数
 */
export declare function provideI18n<T extends TranslationDict>(input: I18nConfig<T> | I18nInstance<T>): any[];
