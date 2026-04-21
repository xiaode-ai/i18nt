import { cache } from 'react';
import { createI18n } from './core.js';
import type { I18nConfig, TranslationDict, I18nInstance } from './types.js';

/**
 * [RSC] 服务端获取 i18n 实例
 * 利用 React cache 确保请求周期内单例，且与并发请求隔离
 */
export const getI18nServer = cache(<T extends TranslationDict>(
  config: I18nConfig<T>,
  locale?: string
): I18nInstance<T> => {
  return createI18n({
    ...config,
    locale: locale || config.locale,
  });
});

/**
 * 助手：从请求头 Accept-Language 解析语言
 */
export function getLocaleFromHeaders(headers: any, availableLocales: string[]): string | undefined {
  const acceptLang = headers.get('accept-language');
  if (!acceptLang) return undefined;
  
  // 简单解析首选语言 q 值 (例如: zh-CN,zh;q=0.9,en;q=0.8)
  const preferred = acceptLang.split(',')[0].split(';')[0].trim();
  return availableLocales.find(l => preferred.startsWith(l)) || 
         availableLocales.find(l => l.startsWith(preferred.split('-')[0]));
}

/**
 * 助手：从 Cookie 解析语言
 */
export function getLocaleFromCookie(cookieStore: any, key: string = 'NEXT_LOCALE'): string | undefined {
  try {
    return cookieStore.get(key)?.value;
  } catch {
    return undefined;
  }
}

/**
 * 创建 Next.js 路由中间件助手
 */
export function createI18nMiddleware(config: {
  locales: string[];
  defaultLocale: string;
  cookieKey?: string;
  detector?: (request: any) => string | undefined;
}) {
  const { locales, defaultLocale, cookieKey = 'NEXT_LOCALE', detector } = config;

  return (request: any) => {
    const pathname = request.nextUrl.pathname;
    const pathnameHasLocale = locales.some(
      (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
    );

    if (pathnameHasLocale) return null;

    // 优先顺序：自定义探测器 -> Cookie -> Accept-Language -> 默认
    let locale = detector?.(request);
    if (!locale) locale = request.cookies.get(cookieKey)?.value;
    if (!locale) locale = getLocaleFromHeaders(request.headers, locales);
    
    const redirectLocale = (locale && locales.includes(locale)) ? locale : defaultLocale;

    // 重定向到 /locale/path
    const url = new URL(`/${redirectLocale}${pathname}`, request.url);
    return Response.redirect(url);
  };
}

/**
 * [Client] 导出原有的 Provider 以供客户端组件使用
 */
export { I18nProvider as I18nClientProvider, useI18n } from './react.js';
