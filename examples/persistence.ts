import { createI18n } from '../src';
import { TRANSLATIONS, LANG_ORDER } from './translations';

// 模拟本地持久化缓存方案
const CACHE_KEY = 'i18n_cache_en';

// 1. 尝试从缓存读取
const getCachedTranslations = () => {
  const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(CACHE_KEY) : null;
  return cached ? JSON.parse(cached) : null;
};

// 2. 初始化 i18n
const i18n = createI18n({
  translations: getCachedTranslations() || TRANSLATIONS,
  langOrder: LANG_ORDER,
  locale: 'en-US'
});

// 3. 异步更新缓存 (后台静默执行)
const updateCache = (newDict: any) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(CACHE_KEY, JSON.stringify(newDict));
  }
};

console.log('[Persistence] i18n 初始化完成，优先使用缓存数据');
