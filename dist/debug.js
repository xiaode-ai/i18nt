/**
 * 调试插件：提供可视化调试能力
 */
export const debugPlugin = () => {
    let instance;
    let visualHintsActive = false;
    return {
        name: 'debug-plugin',
        onInit(i18n) {
            instance = i18n;
            // 默认在控制台输出
            console.log(`[i18nt-debug] Initialized with locale: ${i18n.locale}`);
        },
        onLocaleChange(locale) {
            console.log(`[i18nt-debug] Locale changed to: ${locale}`);
            if (visualHintsActive) {
                updateVisualHints();
            }
        },
        onMissingKey(key, locale) {
            console.warn(`[i18nt-debug] Missing key: "${key}" for locale: "${locale}"`);
        }
    };
};
/**
 * 调试工具包：暴露给 window 对象以便在控制台或 UI 中调用
 */
export const i18ntDebug = {
    /**
     * 开启/关闭视觉高亮（在 UI 上直接显示 Key 路径）
     */
    toggleVisualHints(active) {
        const state = active !== undefined ? active : !window.__I18NT_VISUAL_HINTS__;
        window.__I18NT_VISUAL_HINTS__ = state;
        document.body.classList.toggle('i18nt-visual-hints', state);
        console.log(`[i18nt-debug] Visual hints: ${state ? 'ON' : 'OFF'}`);
        if (state) {
            const style = document.createElement('style');
            style.id = 'i18nt-debug-style';
            style.textContent = `
            .i18nt-visual-hints [data-i18nt-key] {
                outline: 1px dashed #ff4757 !important;
                position: relative;
                cursor: help;
            }
            .i18nt-visual-hints [data-i18nt-key]::after {
                content: attr(data-i18nt-key);
                position: absolute;
                top: -14px;
                left: 0;
                background: #ff4757;
                color: white;
                font-size: 10px;
                padding: 0 4px;
                border-radius: 2px;
                white-space: nowrap;
                z-index: 10000;
                display: none;
            }
            .i18nt-visual-hints [data-i18nt-key]:hover::after {
                display: block;
            }
        `;
            document.head.appendChild(style);
        }
        else {
            document.getElementById('i18nt-debug-style')?.remove();
        }
    },
    /**
     * 显示浮动调试面板
     */
    showOverlay() {
        if (document.getElementById('i18nt-debug-overlay'))
            return;
        const overlay = document.createElement('div');
        overlay.id = 'i18nt-debug-overlay';
        overlay.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; z-index: 99999;
        background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px);
        border: 1px solid #ddd; border-radius: 12px; padding: 16px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.15); width: 280px;
        font-family: system-ui, -apple-system, sans-serif; font-size: 13px;
    `;
        overlay.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <b style="color:#2f3542">i18nt Debugger</b>
            <button onclick="this.parentElement.parentElement.remove()" style="border:none; background:none; cursor:pointer; font-size:16px;">×</button>
        </div>
        <div style="margin-bottom:12px;">
            <label style="display:block; margin-bottom:4px; color:#57606f">Current Locale:</label>
            <select id="i18nt-locale-select" style="width:100%; padding:6px; border-radius:4px; border:1px solid #ccc;"></select>
        </div>
        <div style="display:flex; gap:8px; margin-bottom:12px;">
            <button id="i18nt-toggle-hints" style="flex:1; padding:8px; border:none; background:#70a1ff; color:white; border-radius:6px; cursor:pointer;">Toggle Keys</button>
            <button id="i18nt-clear-cache" style="flex:1; padding:8px; border:none; background:#ff4757; color:white; border-radius:6px; cursor:pointer;">Clear Cache</button>
        </div>
        <div style="font-size:11px; color:#a4b0be; border-top:1px solid #eee; pt:8px;">
            Missing Keys: <span id="i18nt-missing-count" style="color:#ff6b81">0</span>
        </div>
    `;
        document.body.appendChild(overlay);
        // 绑定逻辑
        const i18n = window.i18n; // 假设实例被挂载到了 window
        if (i18n) {
            const select = document.getElementById('i18nt-locale-select');
            i18n.availableLocales.forEach((l) => {
                const opt = document.createElement('option');
                opt.value = l;
                opt.textContent = l;
                opt.selected = i18n.locale === l;
                select.appendChild(opt);
            });
            select.onchange = (e) => i18n.setLocale(e.target.value);
            const updateCount = () => {
                const count = document.getElementById('i18nt-missing-count');
                if (count)
                    count.textContent = i18n.missingKeys.size.toString();
            };
            setInterval(updateCount, 1000);
        }
        document.getElementById('i18nt-toggle-hints').onclick = () => this.toggleVisualHints();
        document.getElementById('i18nt-clear-cache').onclick = () => {
            localStorage.removeItem('i18nt-locale');
            location.reload();
        };
    }
};
function updateVisualHints() {
    // 实际的视觉标记需要框架适配层（如 React/Vue）在渲染时注入 data-i18nt-key
}
