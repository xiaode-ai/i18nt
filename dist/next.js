/**
 * Next.js (App Router) 深度集成助手
 */
import React from 'react';
import { cache } from 'react';
import { createI18n } from './core.js';
import { useI18n } from './react.js';
// 预加载依赖（在 Next.js 环境下有效）
let NextLink;
let NextNavigation;
try {
    NextLink = require('next/link').default || require('next/link');
    NextNavigation = require('next/navigation');
}
catch (e) {
    // 非 Next.js 环境，忽略
}
/**
 * 全局共享配置
 */
let globalConfig = null;
export function setI18nConfig(config) {
    globalConfig = config;
}
/**
 * [RSC] 服务端获取 i18n 实例
 */
export const getI18nServer = cache((config, locale) => {
    const finalConfig = config || globalConfig;
    if (!finalConfig) {
        throw new Error('[i18nt] i18nConfig must be provided or set via setI18nConfig');
    }
    return createI18n({
        preParse: true,
        ...finalConfig,
        locale: locale || finalConfig.locale,
    });
});
/**
 * 创建 Next.js 路由中间件助手
 */
export function createI18nMiddleware(config) {
    const { locales, defaultLocale, cookieKey = 'NEXT_LOCALE', detector, domains, prefixStrategy = 'always' } = config;
    return (request) => {
        const pathname = request.nextUrl.pathname;
        const hostname = request.headers.get('host');
        if (pathname.startsWith('/_next') || pathname.includes('.') || pathname.startsWith('/api/'))
            return null;
        const pathnameHasLocale = locales.some((locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`);
        if (pathnameHasLocale)
            return null;
        // 1. 优先级探测
        let locale;
        if (domains && hostname) {
            const d = domains.find(d => d.domain === hostname || hostname.endsWith(`.${d.domain}`));
            if (d)
                locale = d.defaultLocale;
        }
        if (!locale)
            locale = detector?.(request);
        if (!locale)
            locale = request.cookies.get(cookieKey)?.value;
        if (!locale)
            locale = locales.find(l => request.headers.get('accept-language')?.startsWith(l));
        const finalLocale = (locale && locales.includes(locale)) ? locale : defaultLocale;
        // 2. 根据策略决定是否重定向
        if (prefixStrategy === 'as-needed' && finalLocale === defaultLocale)
            return null;
        if (prefixStrategy === 'never')
            return null;
        const url = new URL(`/${finalLocale}${pathname}`, request.url);
        return Response.redirect(url);
    };
}
/**
 * [Client/Server] 创建本地化导航工具
 */
export function createNavigation(config) {
    const { locales, defaultLocale, prefixStrategy = 'always', basePath = '' } = config;
    const getLocalizedHref = (href, locale) => {
        if (!href.startsWith('/') || href.startsWith('//'))
            return href;
        const pureHref = basePath && href.startsWith(basePath) ? href.substring(basePath.length) : href;
        const targetLocale = locale || defaultLocale;
        const shouldPrefix = prefixStrategy === 'always' || (prefixStrategy === 'as-needed' && targetLocale !== defaultLocale);
        if (!shouldPrefix)
            return `${basePath}${pureHref}`;
        const hasLocale = locales.some(l => pureHref.startsWith(`/${l}/`) || pureHref === `/${l}`);
        if (hasLocale)
            return href;
        const localized = `/${targetLocale}${pureHref === '/' ? '' : pureHref}`;
        return `${basePath}${localized}`;
    };
    return {
        Link: function I18nLink({ href, locale, ...props }) {
            const { locale: currentLocale } = (typeof window !== 'undefined') ? useI18n() : { locale: undefined };
            const localizedHref = typeof href === 'string' ? getLocalizedHref(href, locale || currentLocale) : href;
            return React.createElement(NextLink, { ...props, href: localizedHref });
        },
        useRouter: function useI18nRouter() {
            const router = NextNavigation.useRouter();
            const pathname = NextNavigation.usePathname();
            const segment = pathname.split('/')[1];
            const currentLocale = locales.includes(segment) ? segment : undefined;
            return {
                ...router,
                push: (href, options) => router.push(getLocalizedHref(href, currentLocale), options),
                replace: (href, options) => router.replace(getLocalizedHref(href, currentLocale), options),
            };
        },
        usePathname: function useI18nPathname() {
            const pathname = NextNavigation.usePathname();
            const segment = pathname.split('/')[1];
            return locales.includes(segment) ? (pathname.replace(`/${segment}`, '') || '/') : pathname;
        },
        redirect: (href, locale, type) => NextNavigation.redirect(getLocalizedHref(href, locale), type),
        /**
         * 语言切换器组件助手
         */
        LocaleSwitcher: function LocaleSwitcher({ children }) {
            const { locale: current, setLocale } = useI18n();
            const router = NextNavigation.useRouter();
            const pathname = NextNavigation.usePathname();
            const handleSwitch = (newLocale) => {
                const segment = pathname.split('/')[1];
                const newPath = locales.includes(segment) ? pathname.replace(`/${segment}`, `/${newLocale}`) : `/${newLocale}${pathname}`;
                setLocale(newLocale);
                router.push(newPath);
            };
            return children({ locales, current, switch: handleSwitch });
        },
        getMetadata: ({ pathname, baseUrl = '' }) => {
            const languages = {};
            locales.forEach(l => { languages[l] = `${baseUrl}${getLocalizedHref(pathname, l)}`; });
            return { alternates: { canonical: `${baseUrl}${pathname}`, languages } };
        },
        getStaticParams: () => locales.map(locale => ({ locale }))
    };
}
export { I18nProvider as I18nClientProvider, useI18n } from './react.js';
