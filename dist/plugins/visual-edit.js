/**
 * Visual Edit Plugin v2.0
 * 为翻译结果添加元数据，支持专业的 Shadow DOM 悬浮编辑面板
 */
export function visualEditPlugin(options = {}) {
    let isEnabled = options.enabled ?? false;
    let ui = null;
    return {
        name: 'visual-edit',
        onInit(instance) {
            // 1. 注入后处理器，包裹元数据
            instance.config.postProcessors.push((val, key) => {
                if (!isEnabled || typeof val !== 'string' || !key)
                    return val;
                // 使用零宽字符包裹 [i18nt:key]value[/i18nt]
                return `\u200B[i18nt:${key}]\u200B${val}\u200B[/i18nt]\u200B`;
            });
            // 2. 浏览器环境下初始化 UI
            if (typeof window !== 'undefined' && typeof document !== 'undefined') {
                ui = new VisualEditUI(options.onEdit);
                ui.setInstance(instance); // 注入实例用于预览
                window.i18ntVisualEdit = {
                    toggle: (val) => {
                        isEnabled = val !== undefined ? val : !isEnabled;
                        console.log(`[i18nt] Visual Edit: ${isEnabled ? 'ON' : 'OFF'}`);
                        instance.setLocale(instance.locale); // 触发刷新
                        if (!isEnabled)
                            ui?.hide();
                    },
                    showOverlay: () => {
                        ui?.ensureInjected();
                    }
                };
                // 绑定全局事件
                this.bindEvents(ui);
            }
        },
        bindEvents(ui) {
            document.addEventListener('mouseover', (e) => {
                if (!isEnabled)
                    return;
                const target = e.target;
                if (this.hasI18nMark(target)) {
                    target.style.outline = '2px dashed #3b82f6';
                    target.style.cursor = 'help';
                }
            });
            document.addEventListener('mouseout', (e) => {
                const target = e.target;
                target.style.outline = '';
                target.style.cursor = '';
            });
            document.addEventListener('click', (e) => {
                if (!isEnabled)
                    return;
                const target = e.target;
                const mark = this.getI18nMark(target);
                if (mark) {
                    e.preventDefault();
                    e.stopPropagation();
                    ui.show(mark.key, mark.value);
                }
            }, true);
        },
        hasI18nMark(el) {
            return (el.innerText || '').includes('\u200B[i18nt:');
        },
        getI18nMark(el) {
            const content = el.innerText || '';
            const match = content.match(/\u200B\[i18nt:(.+?)\]\u200B([\s\S]*?)\u200B\[\/i18nt\]\u200B/);
            if (match)
                return { key: match[1], value: match[2] };
            return null;
        }
    };
}
/**
 * 内部 UI 管理类
 */
class VisualEditUI {
    constructor(onEdit) {
        this.onEdit = onEdit;
        this.container = null;
        this.shadow = null;
        this.currentKey = '';
        this.i18nInstance = null;
    }
    setInstance(instance) {
        this.i18nInstance = instance;
    }
    ensureInjected() {
        if (this.container)
            return;
        this.container = document.createElement('div');
        this.container.id = 'i18nt-visual-edit-root';
        this.container.style.cssText = 'position:fixed; z-index:2147483647; top:0; left:0; width:100%; height:100%; pointer-events:none; display:none; font-family: system-ui, -apple-system, sans-serif;';
        document.body.appendChild(this.container);
        this.shadow = this.container.attachShadow({ mode: 'open' });
        this.shadow.innerHTML = `
            <style>
                .overlay {
                    position: absolute; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.4); pointer-events: auto;
                    display: flex; align-items: center; justify-content: center;
                }
                .modal {
                    background: white; width: 500px; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
                    padding: 24px; pointer-events: auto; animation: slideIn 0.2s ease-out;
                    max-height: 90vh; overflow-y: auto;
                }
                @keyframes slideIn { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
                .title { font-weight: 600; color: #111827; font-size: 16px; }
                .key-badge { background: #f3f4f6; color: #4b5563; font-size: 12px; padding: 2px 8px; border-radius: 4px; font-family: monospace; }
                .label { font-size: 13px; color: #6b7280; margin-bottom: 6px; display: block; font-weight: 500; }
                textarea { 
                    width: 100%; height: 80px; border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; font-size: 14px;
                    resize: vertical; outline: none; transition: border-color 0.2s; box-sizing: border-box; margin-bottom: 16px;
                }
                textarea:focus { border-color: #3b82f6; }
                .preview-box { background: #f9fafb; border: 1px dashed #e5e7eb; border-radius: 8px; padding: 12px; font-size: 14px; color: #374151; margin-bottom: 16px; min-height: 40px; }
                .vars-grid { display: grid; grid-template-columns: 100px 1fr; gap: 8px; margin-bottom: 16px; align-items: center; }
                .var-input { border: 1px solid #d1d5db; border-radius: 4px; padding: 4px 8px; font-size: 13px; outline: none; }
                .footer { display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px; border-top: 1px solid #f3f4f6; pt: 16px; }
                button { cursor: pointer; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500; transition: all 0.2s; border: none; }
                .btn-cancel { background: #f3f4f6; color: #374151; }
                .btn-cancel:hover { background: #e5e7eb; }
                .btn-save { background: #3b82f6; color: white; }
                .btn-save:hover { background: #2563eb; }
                .btn-save:disabled { background: #93c5fd; cursor: not-allowed; }
            </style>
            <div class="overlay" id="overlay">
                <div class="modal">
                    <div class="header">
                        <div class="title">Edit Translation</div>
                        <div class="key-badge" id="key-name"></div>
                    </div>
                    
                    <label class="label">Source (ICU Format)</label>
                    <textarea id="edit-area" spellcheck="false"></textarea>
                    
                    <div id="vars-container" style="display:none">
                        <label class="label">Variables Test</label>
                        <div class="vars-grid" id="vars-grid"></div>
                    </div>

                    <label class="label">Live Preview</label>
                    <div class="preview-box" id="preview-box"></div>

                    <div class="footer">
                        <button class="btn-cancel" id="btn-cancel">Cancel</button>
                        <button class="btn-save" id="btn-save">Save Changes</button>
                    </div>
                </div>
            </div>
        `;
        const areaEl = this.shadow.getElementById('edit-area');
        areaEl.addEventListener('input', () => this.updatePreview());
        this.shadow.getElementById('overlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget)
                this.hide();
        });
        this.shadow.getElementById('btn-cancel')?.addEventListener('click', () => this.hide());
        this.shadow.getElementById('btn-save')?.addEventListener('click', () => this.handleSave());
    }
    show(key, value) {
        this.ensureInjected();
        this.currentKey = key;
        const keyEl = this.shadow?.getElementById('key-name');
        const areaEl = this.shadow?.getElementById('edit-area');
        if (keyEl)
            keyEl.textContent = key;
        if (areaEl)
            areaEl.value = value;
        if (this.container)
            this.container.style.display = 'block';
        this.updatePreview();
        areaEl?.focus();
    }
    updatePreview() {
        if (!this.shadow || !this.i18nInstance)
            return;
        const areaEl = this.shadow.getElementById('edit-area');
        const previewEl = this.shadow.getElementById('preview-box');
        const varsContainer = this.shadow.getElementById('vars-container');
        const varsGrid = this.shadow.getElementById('vars-grid');
        const value = areaEl.value;
        // 提取变量
        const vars = this.extractVars(value);
        if (vars.length > 0 && varsContainer && varsGrid) {
            varsContainer.style.display = 'block';
            // 只有当变量列表变化时才重新生成输入框，避免丢失当前输入内容
            const currentVars = Array.from(varsGrid.querySelectorAll('.var-name')).map(el => el.textContent);
            if (JSON.stringify(currentVars) !== JSON.stringify(vars)) {
                varsGrid.innerHTML = '';
                vars.forEach(v => {
                    const label = document.createElement('div');
                    label.className = 'var-name';
                    label.style.fontSize = '12px';
                    label.style.color = '#6b7280';
                    label.textContent = v;
                    const input = document.createElement('input');
                    input.className = 'var-input';
                    input.dataset.var = v;
                    input.value = '3'; // 默认测试值
                    input.addEventListener('input', () => this.updatePreview());
                    varsGrid.appendChild(label);
                    varsGrid.appendChild(input);
                });
            }
        }
        else if (varsContainer) {
            varsContainer.style.display = 'none';
        }
        // 构造测试参数
        const params = {};
        varsGrid?.querySelectorAll('input').forEach((input) => {
            params[input.dataset.var] = input.value;
        });
        // 渲染预览 (绕过插件，直接调用核心)
        try {
            const locale = this.i18nInstance.locale;
            const rendered = this.i18nInstance.render(value, params, locale);
            if (previewEl)
                previewEl.textContent = rendered;
        }
        catch (e) {
            if (previewEl)
                previewEl.textContent = `⚠️ ICU Error: ${e?.message || e}`;
        }
    }
    extractVars(icu) {
        const vars = new Set();
        // 匹配 {var} 或 {var, type, ...}
        const regex = /\{([a-zA-Z0-9_]+)/g;
        let match;
        while ((match = regex.exec(icu)) !== null) {
            if (match[1] !== '#')
                vars.add(match[1]);
        }
        return Array.from(vars);
    }
    hide() {
        if (this.container)
            this.container.style.display = 'none';
    }
    async handleSave() {
        const areaEl = this.shadow?.getElementById('edit-area');
        const saveBtn = this.shadow?.getElementById('btn-save');
        const value = areaEl.value;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        try {
            await this.onEdit?.(this.currentKey, value, 'current');
            this.hide();
        }
        catch (e) {
            alert(`Failed to save: ${e?.message || e}`);
        }
        finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
        }
    }
}
