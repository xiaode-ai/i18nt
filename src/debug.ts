import type { I18nPlugin, TranslationDict } from './types';

/**
 * i18nt 调试插件
 * 提供缺失 Key 追踪和控制台工具
 */
export function debugPlugin(): I18nPlugin {
  return {
    name: 'debug',
    onInit(instance) {
      if (typeof window !== 'undefined') {
        (window as any).i18ntDebug = {
          instance,
          getMissingKeys: () => Array.from(instance.missingKeys),
          clearMissingKeys: () => instance.missingKeys.clear(),
          // 辅助函数：导出当前所有缺失的 Key 为 JSON
          exportMissingKeys: () => {
             const keys = Array.from(instance.missingKeys);
             console.log(JSON.stringify(keys, null, 2));
             return keys;
          },
          /** 切换视觉辅助模式（显示 Key 路径） */
          toggleVisualHints: (enabled?: boolean) => {
             (instance as any).debug = enabled ?? !(instance as any).debug;
             console.log(`[i18nt] Visual hints ${(instance as any).debug ? 'enabled' : 'disabled'}.`);
          },
          /** 显示可视化调试悬浮窗 */
          showOverlay: () => {
            if (typeof document === 'undefined') return;
            let el = document.getElementById('i18nt-overlay');
            if (!el) {
              el = document.createElement('div');
              el.id = 'i18nt-overlay';
              Object.assign(el.style, {
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                background: '#1a1a1a',
                color: '#00ff00',
                padding: '12px',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                fontSize: '12px',
                zIndex: '9999',
                fontFamily: 'monospace',
                border: '1px solid #333'
              });
              document.body.appendChild(el);
            }
            const update = () => {
              el!.innerHTML = `
                <div style="margin-bottom:8px;border-bottom:1px solid #333;padding-bottom:4px"><b>i18nt Diagnostics</b></div>
                <div>Locale: <span style="color:#fff">${instance.locale}</span></div>
                <div>Missing: <span style="color:${instance.missingKeys.size > 0 ? '#ff4444' : '#fff'}">${instance.missingKeys.size}</span></div>
                <div style="margin-top:8px">
                  <button onclick="i18ntDebug.toggleVisualHints()" style="background:#333;color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer">Toggle Visual Hints</button>
                </div>
              `;
            };
            update();
            instance.onChange(update);
            console.log('[i18nt] Debug overlay shown.');
          }
        };
        console.log('[i18nt] Debug plugin initialized. Access global `i18ntDebug` for tools.');
      }
    }
  };
}
