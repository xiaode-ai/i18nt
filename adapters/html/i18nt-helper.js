(function() {
  const i18nt = {
    data: {},
    
    init: function(translations) {
      this.data = translations || {};
      this.render();
    },

    /**
     * 根据路径获取值：get("auth.login")
     */
    get: function(path) {
      return path.split('.').reduce((obj, key) => obj && obj[key], this.data);
    },

    /**
     * 扫描 DOM 并渲染
     */
    render: function(container) {
      const root = container || document;
      
      // 1. 翻译文本内容
      root.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const val = this.get(key);
        if (val) el.textContent = val;
      });

      // 2. 翻译占位符 (placeholder)
      root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const val = this.get(key);
        if (val) el.setAttribute('placeholder', val);
      });

      // 3. 翻译标题 (title)
      root.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        const val = this.get(key);
        if (val) el.setAttribute('title', val);
      });
    }
  };

  // 暴露给全局
  window.i18nt = i18nt;

  // 自动处理 (如果数据已在全局定义)
  document.addEventListener('DOMContentLoaded', () => {
    if (window.I18N_DATA) {
        i18nt.init(window.I18N_DATA);
    }
  });
})();
