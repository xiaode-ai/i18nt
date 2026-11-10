import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * i18nt — React Native 适配层
 * 适配移动端 RTL 与原生状态同步
 */
import { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { useI18n as useReactI18n, I18nProvider as ReactI18nProvider } from './react.js';
/**
 * React Native 专用 Provider
 * 自动处理 I18nManager 的 RTL 同步
 */
export function I18nNativeProvider({ config, children, }) {
    // 当语言切换且方向变化时，RN 通常需要重启或手动处理布局
    // 这里我们至少确保核心实例的状态与原生对齐
    return (_jsxs(ReactI18nProvider, { config: config, children: [_jsx(RTLSync, {}), children] }));
}
/**
 * RTL 状态同步组件（内部使用）
 */
function RTLSync() {
    const { isRTL } = useReactI18n();
    useEffect(() => {
        if (I18nManager.isRTL !== isRTL) {
            // 在 RN 中，强制切换 RTL 通常需要重启应用才能完全生效
            // 此处同步状态供开发者根据业务逻辑处理（如使用 RNRestart）
            I18nManager.allowRTL(isRTL);
            I18nManager.forceRTL(isRTL);
        }
    }, [isRTL]);
    return null;
}
export { useReactI18n as useI18n };
