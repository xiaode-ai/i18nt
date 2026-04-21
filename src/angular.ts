/**
 * i18nt — Angular 适配层
 * 提供 Service 与 Pipe 支持
 */

import { Injectable, Pipe, PipeTransform, signal, computed, inject, InjectionToken, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createI18n } from './core.js';
import type { I18nConfig, I18nInstance, TranslationDict } from './types.js';

export const I18N_CONFIG = new InjectionToken<I18nConfig>('I18N_CONFIG');
export const I18N_INSTANCE = new InjectionToken<I18nInstance>('I18N_INSTANCE');

@Injectable({ providedIn: 'root' })
export class I18nService<T extends TranslationDict = TranslationDict> {
  private _instance: I18nInstance<T>;
  private platformId = inject(PLATFORM_ID);

  /** 
   * 使用 Angular Signal 包装语言状态
   * 确保在语言切换时触发全站变更检测
   */
  readonly locale = signal<string>('');
  readonly isRTL = signal<boolean>(false);

  /** 代理翻译对象 */
  readonly t: I18nInstance<T>['t'];

  constructor() {
    // 优先尝试从注入令牌获取实例，否则创建新实例
    const config = inject(I18N_CONFIG, { optional: true });
    const externalInstance = inject(I18N_INSTANCE, { optional: true });

    if (externalInstance) {
      this._instance = externalInstance as I18nInstance<T>;
    } else if (config) {
      this._instance = createI18n(config) as I18nInstance<T>;
    } else {
      throw new Error('[i18nt] I18nService requires I18N_CONFIG or I18N_INSTANCE to be provided');
    }

    // 初始化状态
    this.locale.set(this._instance.locale);
    this.isRTL.set(this._instance.isRTL);
    this.t = this._instance.t;

    // 订阅变更
    this._instance.onChange((newLocale) => {
      this.locale.set(newLocale);
      this.isRTL.set(this._instance.isRTL);
    });
  }

  setLocale(lang: string) {
    this._instance.setLocale(lang);
  }

  get availableLocales() {
    return this._instance.availableLocales;
  }
}

/**
 * 翻译 Pipe，用于模板
 * @example {{ 'buttons.save' | t }}
 */
@Pipe({
  name: 't',
  pure: false, // 设置为非纯 Pipe 以响应语言切换
  standalone: true
})
export class TranslatePipe implements PipeTransform {
  private i18n = inject(I18nService);

  transform(path: string, params?: Record<string, any>): string {
    // 访问一下 signal 确保模板能够追踪变更
    this.i18n.locale();
    return this.i18n.t(path as any, params);
  }
}

/**
 * Angular 提供者辅助函数
 */
export function provideI18n<T extends TranslationDict>(input: I18nConfig<T> | I18nInstance<T>) {
  const providers: any[] = [I18nService];
  if ('t' in input) {
    providers.push({ provide: I18N_INSTANCE, useValue: input });
  } else {
    providers.push({ provide: I18N_CONFIG, useValue: input });
  }
  return providers;
}
