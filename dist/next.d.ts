/**
 * Next.js (App Router) 深度集成助手
 */
import React from 'react';
import type { I18nConfig, TranslationDict, I18nInstance } from './types.js';
export declare function setI18nConfig<T extends TranslationDict>(config: I18nConfig<T>): void;
/**
 * [RSC] 服务端获取 i18n 实例
 */
export declare const getI18nServer: <T extends TranslationDict>(config?: I18nConfig<T>, locale?: string) => I18nInstance<T>;
export type PrefixStrategy = 'always' | 'as-needed' | 'never';
/**
 * 创建 Next.js 路由中间件助手
 */
export declare function createI18nMiddleware(config: {
    locales: string[];
    defaultLocale: string;
    cookieKey?: string;
    prefixStrategy?: PrefixStrategy;
    detector?: (request: any) => string | undefined;
    domains?: Array<{
        domain: string;
        defaultLocale: string;
        locales?: string[];
    }>;
}): (request: any) => Response | null;
/**
 * [Client/Server] 创建本地化导航工具
 */
export declare function createNavigation(config: {
    locales: readonly string[];
    defaultLocale: string;
    prefixStrategy?: PrefixStrategy;
    basePath?: string;
}): {
    Link: ({ href, locale, ...props }: any) => React.CElement<any, React.Component<any, any, any>>;
    useRouter: () => any;
    usePathname: () => any;
    redirect: (href: string, locale?: string, type?: any) => any;
    /**
     * 语言切换器组件助手
     */
    LocaleSwitcher: ({ children }: {
        children: (params: {
            locales: readonly string[];
            current: string;
            switch: (l: string) => void;
        }) => React.ReactElement;
    }) => React.ReactElement<unknown, string | React.JSXElementConstructor<any>>;
    getMetadata: ({ pathname, baseUrl }: {
        pathname: string;
        baseUrl?: string;
    }) => {
        alternates: {
            canonical: string;
            languages: Record<string, string>;
        };
    };
    getStaticParams: () => {
        locale: string;
    }[];
};
export { I18nProvider as I18nClientProvider, useI18n } from './react.js';
