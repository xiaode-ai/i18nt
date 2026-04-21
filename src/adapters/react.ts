import * as React from 'react';
import type { I18nInstance } from '../types';

/**
 * i18nt React 上下文
 */
const I18nContext = React.createContext<I18nInstance | null>(null);

/**
 * i18nt React 提供者
 */
export function I18nProvider({ instance, children }: { instance: I18nInstance, children: any }) {
  return React.createElement(I18nContext.Provider, { value: instance }, children);
}

/**
 * i18nt React 钩子
 * 自动订阅语言切换并触发组件重绘
 */
export function useI18n<T extends I18nInstance = I18nInstance>() {
  const instance = React.useContext(I18nContext) as T;
  if (!instance) {
    throw new Error('[i18nt] useI18n must be used within I18nProvider');
  }

  // 优先使用 React 18 的 useSyncExternalStore 保证并发模式下的安全性
  const useSyncExternalStore = (React as any).useSyncExternalStore;

  if (useSyncExternalStore) {
    useSyncExternalStore(
      (onStoreChange: () => void) => instance.onChange(onStoreChange),
      () => instance.locale,
      () => instance.locale
    );
  } else {
    // 兼容 React 16/17
    const [, setTick] = React.useState(0);
    React.useEffect(() => {
      return instance.onChange(() => setTick(t => t + 1));
    }, [instance]);
  }

  return instance;
}
