/**
 * i18nt — Next.js App Router 适配层
 * 支持 Server Components (RSC) 与 Client Components
 */

import { cache } from 'react';
import { createI18n } from './core.js';
import type { I18nConfig, TranslationDict } from './types.js';

/**
 * [RSC] 服务端获取 i18n 实例
 * 利用 React cache 确保在同一个请求周期内是单例
 */
export const getI18nServer = cache(<T extends TranslationDict>(
  config: I18nConfig<T>,
  locale?: string
) => {
  // 如果提供了 locale（例如从 URL 参数中提取），则使用它
  // 否则可以由外部传入从 cookies() 或 headers() 获取的值
  return createI18n({
    ...config,
    locale: locale || config.locale,
  });
});

/**
 * [Client] 导出原有的 Provider 以供客户端组件使用
 */
export { I18nProvider as I18nClientProvider, useI18n } from './react.js';

/**
 * 助手工具：从 Next.js Cookie 中解析语言
 * 注意：此函数需在服务端调用
 */
export function getLocaleFromCookie(cookieStore: any, key: string = 'NEXT_LOCALE'): string | undefined {
  try {
    return cookieStore.get(key)?.value;
  } catch {
    return undefined;
  }
}
