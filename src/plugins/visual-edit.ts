/**
 * Visual Edit Plugin
 * 为翻译结果添加元数据，支持点击即编辑
 */
export function visualEditPlugin(options: { 
    enabled?: boolean;
    onEdit?: (key: string, value: string, locale: string) => void;
} = {}) {
    let isEnabled = options.enabled ?? false;

    return {
        name: 'visual-edit',
        onInit(instance: any) {
            // 注入后处理器
            instance.config.postProcessors.push((val: any, key?: string) => {
                if (!isEnabled || typeof val !== 'string' || !key) return val;
                // 使用特殊标记包裹，供前端脚本识别
                return `\u200B[i18nt:${key}]\u200B${val}\u200B[/i18nt]\u200B`;
            });

            // 暴露切换方法到全局 (仅限浏览器)
            if (typeof window !== 'undefined') {
                (window as any).i18ntVisualEdit = {
                    toggle: (val: boolean) => {
                        isEnabled = val !== undefined ? val : !isEnabled;
                        console.log(`[i18nt] Visual Edit: ${isEnabled ? 'ON' : 'OFF'}`);
                        // 强制实例刷新 (如果可能)
                        instance.setLocale(instance.locale);
                    },
                    showOverlay: () => {
                        this.injectOverlay();
                    }
                };
            }
        },

        injectOverlay() {
            if (typeof document === 'undefined') return;
            const style = document.createElement('style');
            style.textContent = `
                .i18nt-highlight { 
                    outline: 2px dashed #3b82f6 !important; 
                    cursor: help !important;
                    position: relative;
                }
                .i18nt-badge {
                    position: absolute;
                    top: -20px;
                    left: 0;
                    background: #3b82f6;
                    color: white;
                    font-size: 10px;
                    padding: 2px 4px;
                    border-radius: 4px;
                    z-index: 10000;
                    white-space: nowrap;
                }
            `;
            document.head.appendChild(style);

            document.addEventListener('mouseover', (e) => {
                if (!isEnabled) return;
                const target = e.target as HTMLElement;
                const content = target.innerText || '';
                const match = content.match(/\u200B\[i18nt:(.+?)\]\u200B/);
                if (match) {
                    target.classList.add('i18nt-highlight');
                }
            });

            document.addEventListener('mouseout', (e) => {
                const target = e.target as HTMLElement;
                target.classList.remove('i18nt-highlight');
            });

            document.addEventListener('click', (e) => {
                if (!isEnabled) return;
                const target = e.target as HTMLElement;
                const content = target.innerText || '';
                const match = content.match(/\u200B\[i18nt:(.+?)\]\u200B([\s\S]*?)\u200B\[\/i18nt\]\u200B/);
                if (match) {
                    e.preventDefault();
                    e.stopPropagation();
                    const key = match[1];
                    const value = match[2];
                    const newValue = window.prompt(`Edit Translation [${key}]:`, value);
                    if (newValue !== null && newValue !== value) {
                        options.onEdit?.(key, newValue, 'current');
                    }
                }
            }, true);
        }
    };
}
