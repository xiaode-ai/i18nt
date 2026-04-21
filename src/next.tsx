import { cache } from 'react';
import { createI18n } from './core.js';
import type { I18nConfig, TranslationDict, I18nInstance } from './types.js';

/**
 * 全局共享配置（可选），用于简化 getI18nServer 调用
 */
let globalConfig: I18nConfig<any> | null = null;

export function setI18nConfig<T extends TranslationDict>(config: I18nConfig<T>) {
  globalConfig = config;
}

/**
 * [RSC] 服务端获取 i18n 实例
 * 利用 React cache 确保请求周期内单例，且与并发请求隔离
 */
export const getI18nServer = cache(<T extends TranslationDict>(
  config?: I18nConfig<T>,
  locale?: string
): I18nInstance<T> => {
  const finalConfig = config || globalConfig;
  if (!finalConfig) {
    throw new Error('[i18nt] i18nConfig must be provided or set via setI18nConfig');
  }
  const i18n = createI18n({
    ...finalConfig,
    locale: locale || finalConfig.locale,
  });
  return i18n;
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
    
    // 忽略静态资源
    if (
      pathname.startsWith('/_next') || 
      pathname.includes('.') || 
      pathname.startsWith('/api/')
    ) return null;

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

/**
 * [Client/Server] 创建本地化导航工具
 * 提供自动处理语言前缀的 Link, useRouter, usePathname, redirect
 */
export function createNavigation(config: { locales: readonly string[]; defaultLocale: string }) {
  const { locales } = config;

  /**
   * 格式化本地化路径
   */
  const getLocalizedHref = (href: string, locale?: string) => {
    if (!href.startsWith('/') || href.startsWith('//')) return href;
    
    // 检查是否已经包含了有效的语言前缀
    const hasLocale = locales.some(l => href.startsWith(`/${l}/`) || href === `/${l}`);
    if (hasLocale) return href;

    return locale ? `/${locale}${href === '/' ? '' : href}` : href;
  };

  return {
    /**
     * 本地化 Link 组件
     */
    Link: function I18nLink({ href, locale, ...props }: any) {
      // 在客户端使用 useI18n 获取当前语言
      // @ts-ignore
      const { useI18n } = require('./react.js');
      const { locale: currentLocale } = (typeof window !== 'undefined') ? useI18n() : { locale: undefined };
      const targetLocale = locale || currentLocale;
      const localizedHref = typeof href === 'string' ? getLocalizedHref(href, targetLocale) : href;
      
      // @ts-ignore
      const NextLink = require('next/link').default || require('next/link');
      const React = require('react');
      return React.createElement(NextLink, { ...props, href: localizedHref });
    },

    /**
     * 本地化 useRouter
     */
    useRouter: function useI18nRouter() {
      const { useRouter, usePathname } = require('next/navigation');
      const router = useRouter();
      const pathname = usePathname();
      
      const segment = pathname.split('/')[1];
      const currentLocale = locales.includes(segment) ? segment : undefined;

      return {
        ...router,
        push: (href: string, options?: any) => router.push(getLocalizedHref(href, currentLocale), options),
        replace: (href: string, options?: any) => router.replace(getLocalizedHref(href, currentLocale), options),
        prefetch: (href: string, options?: any) => router.prefetch(getLocalizedHref(href, currentLocale), options),
      };
    },

    /**
     * 获取无语言前缀的 Pathname
     */
    usePathname: function useI18nPathname() {
      const { usePathname } = require('next/navigation');
      const pathname = usePathname();
      const segment = pathname.split('/')[1];
      if (locales.includes(segment)) {
        const stripped = pathname.replace(`/${segment}`, '');
        return stripped || '/';
      }
      return pathname;
    },

    /**
     * 本地化 redirect
     */
    redirect: function i18nRedirect(href: string, locale?: string, type?: any) {
      const { redirect } = require('next/navigation');
      return redirect(getLocalizedHref(href, locale), type);
    },
    
    /**
     * 生成 SEO 元数据 (Alternates)
     */
    getMetadata: function getI18nMetadata({ pathname, baseUrl = '' }: { pathname: string; baseUrl?: string }) {
      const languages: Record<string, string> = {};
      locales.forEach(l => {
        languages[l] = `${baseUrl}${getLocalizedHref(pathname, l)}`;
      });
      return {
        alternates: {
          canonical: `${baseUrl}${pathname}`,
          languages
        }
      };
    },

    /**
     * 为 generateStaticParams 生成参数
     */
    getStaticParams: function getI18nStaticParams() {
      return locales.map(locale => ({ locale }));
    }
  };
}
