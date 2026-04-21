/**
 * i18nt — 语言探测器
 */

import type { LanguageDetector, DetectionOptions } from './types.js';

/**
 * 浏览器探测器：通过 navigator.languages 获取语言
 */
export const browserDetector: LanguageDetector = {
  name: 'navigator',
  lookup() {
    if (typeof navigator !== 'undefined') {
      return (navigator.languages && navigator.languages[0]) || (navigator as any).userLanguage || navigator.language;
    }
    return undefined;
  },
};

/**
 * 路径探测器：从 URL 路径获取语言（例如 /en/home -> en）
 */
export const pathDetector: LanguageDetector = {
  name: 'path',
  lookup() {
    if (typeof window !== 'undefined') {
      const parts = window.location.pathname.split('/');
      return parts[1]; // 假设语言代码在第一个路径片段
    }
    return undefined;
  }
};

/**
 * 查询参数探测器：从 URL 参数获取语言（例如 ?lng=zh）
 */
export const queryDetector: LanguageDetector = {
  name: 'querystring',
  lookup(options: DetectionOptions) {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get(options.lookupQuerystring || 'lng');
    }
    return undefined;
  },
};

/**
 * Cookie 探测器
 */
export const cookieDetector: LanguageDetector = {
  name: 'cookie',
  lookup(options: DetectionOptions) {
    if (typeof document !== 'undefined') {
      const name = (options.lookupCookie || 'i18next') + '=';
      const decodedCookie = decodeURIComponent(document.cookie);
      const ca = decodedCookie.split(';');
      for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1);
        if (c.indexOf(name) === 0) return c.substring(name.length, c.length);
      }
    }
    return undefined;
  },
  cacheUserLanguage(lng, options: DetectionOptions) {
    if (typeof document !== 'undefined') {
      const days = 365;
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      const expires = '; expires=' + date.toUTCString();
      const cookieOptions = options.cookieOptions || {};
      const domain = cookieOptions.domain ? `; domain=${cookieOptions.domain}` : '';
      const path = `; path=${cookieOptions.path || '/'}`;
      const secure = cookieOptions.secure ? '; Secure' : '';
      const sameSite = cookieOptions.sameSite ? `; SameSite=${cookieOptions.sameSite}` : '';
      document.cookie = (options.lookupCookie || 'i18next') + '=' + lng + expires + domain + path + secure + sameSite;
    }
  },
};

/**
 * LocalStorage 探测器
 */
export const localStorageDetector: LanguageDetector = {
  name: 'localStorage',
  lookup(options: DetectionOptions) {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(options.lookupLocalStorage || 'i18nextLng');
    }
    return undefined;
  },
  cacheUserLanguage(lng, options: DetectionOptions) {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(options.lookupLocalStorage || 'i18nextLng', lng);
    }
  },
};

export const BUILTIN_DETECTORS = [
  browserDetector,
  pathDetector,
  queryDetector,
  cookieDetector,
  localStorageDetector,
];
