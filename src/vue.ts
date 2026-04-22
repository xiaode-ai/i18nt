/**
 * i18nt — Vue 3 适配层
 * 提供 Composition API 支持
 */

import { inject, reactive, computed, type App } from 'vue';
import { createI18n } from './core.js';
import type { I18nConfig, I18nInstance, TranslationDict } from './types.js';

const I18N_SYMBOL = Symbol('i18nt');

/** Vue 适配器返回的对象 */
export interface VueI18n<T extends TranslationDict = TranslationDict> {
  /** 翻译代理对象 */
  t: I18nInstance<T>['t'];
  /** 当前语言 */
  locale: string;
  /** 切换语言 */
  setLocale: I18nInstance<T>['setLocale'];
  /** 所有可用语言 */
  availableLocales: string[];
  /** 是否为 RTL */
  isRTL: boolean;
  loadNamespace: I18nInstance<T>['loadNamespace'];
  addTranslations: I18nInstance<T>['addTranslations'];
}

/**
 * 创建 Vue 插件
 * @param input 可以是配置对象，也可以是已存在的 i18n 实例
 */
export function createI18nPlugin<T extends TranslationDict>(input: I18nConfig<T> | I18nInstance<T>) {
  const instance = ('t' in input) ? input : createI18n(input);
  
  // 使用 reactive 包装实例中需要响应式的部分
  const state = reactive({
    locale: instance.locale,
    isRTL: instance.isRTL,
    tick: 0
  });

  // 订阅变更
  instance.onChange(() => {
    state.locale = instance.locale;
    state.isRTL = instance.isRTL;
    state.tick++;
  });

  return {
    install(app: App) {
      const i18n: VueI18n<T> = {
        // 使用 computed 确保 t 代理在 tick 变化时能触发 Vue 追踪
        t: new Proxy({}, {
          get(_, prop) {
            // 访问一下 state.tick 建立依赖
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            state.tick; 
            return (instance.t as any)[prop];
          },
          apply(_, thisArg, argArray) {
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            state.tick;
            return (instance.t as any).apply(thisArg, argArray);
          }
        }) as any,
        get locale() { return state.locale; },
        get isRTL() { return state.isRTL; },
        availableLocales: instance.availableLocales,
        setLocale: instance.setLocale.bind(instance),
        loadNamespace: instance.loadNamespace.bind(instance),
        addTranslations: instance.addTranslations.bind(instance),
      };

      app.provide(I18N_SYMBOL, i18n);
      // 支持 Options API 访问 $t (可选)
      app.config.globalProperties.$t = i18n.t;
      app.config.globalProperties.$i18n = i18n;
    }
  };
}

/**
 * 在组件中使用 i18n
 */
export function useI18n<T extends TranslationDict = TranslationDict>(): VueI18n<T> {
  const i18n = inject<VueI18n<T>>(I18N_SYMBOL);
  if (!i18n) {
    throw new Error('[i18nt] useI18n must be used after app.use(i18nPlugin)');
  }
  return i18n;
}
