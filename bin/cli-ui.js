import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { translateWithAI } from './cli-ai.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function startUI(port = 1818, i18n) {
  const server = http.createServer(async (req, res) => {
    // 允许跨域
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://localhost:${port}`);
    
    // 1. 静态页面
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const html = getHtmlContent(i18n);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    // 2. API: 获取所有语言文件
    if (url.pathname === '/api/locales' && req.method === 'GET') {
      const localeDir = path.resolve(process.cwd(), '.i18nt/locales');
      if (!fs.existsSync(localeDir)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([]));
        return;
      }
      const files = fs.readdirSync(localeDir).filter(f => f.endsWith('.json'));
      const data = files.map(f => {
        const content = JSON.parse(fs.readFileSync(path.join(localeDir, f), 'utf8'));
        return { filename: f, ...content };
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }

    // 3. API: 保存语言文件
    if (url.pathname === '/api/save' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        const { filename, content } = JSON.parse(body);
        const filePath = path.resolve(process.cwd(), '.i18nt/locales', filename);
        fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      });
      return;
    }

    // 4. API: AI 翻译
    if (url.pathname === '/api/translate' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        const { text, from, to } = JSON.parse(body);
        try {
          const result = await translateWithAI(text, from, to);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ translation: result }));
        } catch (e) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(port, () => {
    console.log(`\n🚀 i18nt UI is running at: http://localhost:${port}`);
    console.log(`Press Ctrl+C to stop.\n`);
  });
}

function getHtmlContent(i18n) {
  const t = (key) => i18n.t(`cli.${key}`);

  return `
<!DOCTYPE html>
<html>
<head>
    <title>${t('ui_title')}</title>
    <meta charset="utf-8">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
</head>
<body class="bg-gray-50">
    <div id="app" class="max-w-6xl mx-auto p-8">
        <header class="flex justify-between items-center mb-8">
            <div>
                <h1 class="text-3xl font-bold text-gray-800">${t('ui_title')}</h1>
                <div v-if="locales.length > 0" class="mt-4 flex items-center gap-4 bg-white p-2 px-4 rounded-lg border border-gray-200 text-sm">
                    <span class="text-gray-500 font-medium">${t('ui_visible_langs')}</span>
                    <label v-for="l in locales" :key="l.language" class="flex items-center gap-2 cursor-pointer hover:text-blue-600 transition">
                        <input type="checkbox" v-model="visibleLangs" :value="l.language" class="rounded text-blue-600 focus:ring-blue-500">
                        {{ l.language }}
                    </label>
                </div>
            </div>
            <div class="space-x-4">
                <button @click="loadLocales" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">${t('ui_refresh')}</button>
                <button @click="saveAll" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition">${t('ui_save_all')}</button>
            </div>
        </header>

        <div v-if="loading" class="text-center py-20 text-gray-500">${t('ui_loading')}</div>
        
        <div v-else class="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
            <table class="w-full text-left border-collapse">
                <thead class="bg-gray-100 text-gray-600 text-sm uppercase">
                    <tr>
                        <th class="p-4 border-b">${t('ui_key_path')}</th>
                        <th v-for="l in displayedLocales" :key="l.language" class="p-4 border-b">{{ l.language }}</th>
                        <th class="p-4 border-b w-24">${t('ui_actions')}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="key in allKeys" :key="key" class="hover:bg-gray-50 transition border-b">
                        <td class="p-4 font-mono text-xs text-gray-500">{{ key }}</td>
                        <td v-for="l in displayedLocales" :key="l.language" class="p-4">
                            <textarea 
                                :value="getValueByPath(l.translations, key)" 
                                @input="e => setValueByPath(l.translations, key, e.target.value)"
                                class="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                rows="2"
                            ></textarea>
                        </td>
                        <td class="p-4 text-center">
                            <button @click="translateKey(key)" class="text-blue-600 hover:underline text-sm">${t('ui_ai_magic')}</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <script>
        const { createApp, ref, computed, watch } = Vue;
        createApp({
            setup() {
                const locales = ref([]);
                const visibleLangs = ref([]);
                const loading = ref(true);

                const loadLocales = async () => {
                    loading.value = true;
                    const res = await fetch('/api/locales');
                    const data = await res.json();
                    
                    // 排序：主语言 (zh-CN) 置顶
                    locales.value = data.sort((a, b) => {
                        if (a.language === 'zh-CN') return -1;
                        if (b.language === 'zh-CN') return 1;
                        return 0;
                    });

                    if (visibleLangs.value.length === 0 && data.length > 0) {
                        // 默认选中主语言和第一个副语言
                        visibleLangs.value = locales.value.slice(0, 2).map(l => l.language);
                    }
                    loading.value = false;
                };

                const displayedLocales = computed(() => {
                    return locales.value.filter(l => visibleLangs.value.includes(l.language));
                });

                const allKeys = computed(() => {
                    const keys = new Set();
                    locales.value.forEach(l => {
                        const flatten = (obj, prefix = '') => {
                            if (typeof obj !== 'object' || obj === null) return;
                            for (const k in obj) {
                                const p = prefix ? prefix + '.' + k : k;
                                if (typeof obj[k] === 'object' && obj[k] !== null && !Object.prototype.hasOwnProperty.call(obj[k], 'other')) {
                                    flatten(obj[k], p);
                                } else {
                                    keys.add(p);
                                }
                            }
                        };
                        flatten(l.translations);
                    });
                    return Array.from(keys).sort();
                });

                const getValueByPath = (obj, path) => {
                    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
                };

                const setValueByPath = (obj, path, value) => {
                    const parts = path.split('.');
                    const last = parts.pop();
                    const target = parts.reduce((acc, part) => {
                        if (!acc[part]) acc[part] = {};
                        return acc[part];
                    }, obj);
                    target[last] = value;
                };

                const translateKey = async (key) => {
                    // 显式寻找 zh-CN 作为翻译源
                    const mainLang = locales.value.find(l => l.language === 'zh-CN') || locales.value[0];
                    const sourceText = getValueByPath(mainLang.translations, key);
                    if (!sourceText) return alert('${t('ui_source_missing')}');

                    for (const target of displayedLocales.value) {
                        if (target.language === mainLang.language) continue;
                        if (getValueByPath(target.translations, key)) continue; 

                        const res = await fetch('/api/translate', {
                            method: 'POST',
                            body: JSON.stringify({ text: sourceText, from: mainLang.language, to: target.language })
                        });
                        const data = await res.json();
                        if (data.translation) setValueByPath(target.translations, key, data.translation);
                    }
                };

                const saveAll = async () => {
                    for (const l of locales.value) {
                        await fetch('/api/save', {
                            method: 'POST',
                            body: JSON.stringify({ filename: l.filename, content: { language: l.language, translations: l.translations } })
                        });
                    }
                    alert('${t('ui_save_success')}');
                };

                loadLocales();

                return { locales, visibleLangs, displayedLocales, loading, allKeys, loadLocales, translateKey, saveAll, getValueByPath, setValueByPath };
            }
        }).mount('#app');
    </script>
</body>
</html>
  `;
}
