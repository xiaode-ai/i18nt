import { inject, ref } from 'vue';
const I18N_KEY = Symbol.for('i18nt');
/**
 * i18nt Vue 插件
 */
export function createI18nPlugin(instance) {
    return {
        install(app) {
            app.provide(I18N_KEY, instance);
            app.config.globalProperties.$i18n = instance;
        }
    };
}
/**
 * i18nt Vue 组合式 API
 * 返回响应式的语言状态
 */
export function useI18n() {
    const instance = inject(I18N_KEY);
    if (!instance) {
        throw new Error('[i18nt] useI18n must be used after app.use(i18nPlugin)');
    }
    const locale = ref(instance.locale);
    instance.onChange((newLocale) => {
        locale.value = newLocale;
    });
    return {
        instance,
        locale,
        // 保持 t 的 Proxy 特性
        t: instance.t
    };
}
