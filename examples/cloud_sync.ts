import { createI18n } from '../src';
import { TRANSLATIONS, LANG_ORDER } from './translations';

const i18n = createI18n({
  translations: TRANSLATIONS,
  langOrder: LANG_ORDER,
  locale: 'zh-CN'
});

/**
 * 模拟从云端数据库拉取最新翻译片段 (热更新)
 * 无需重新打包代码，即可实时修改应用内的文案
 */
async function syncFromCloud() {
  console.log('[Cloud] 正在从云数据库同步最新文案...');
  
  // 模拟 API 返回的字典片段 (比如云端修改了 login 按钮文案)
  const cloudPatch = {
    common: {
      login: '立即登入 (云端)'
    }
  };

  // 使用 extraDicts 进行深度合并
  i18n.setLocale('zh-CN', { extraDicts: [cloudPatch] });
  
  console.log('[Cloud] 同步完成，新文案已生效:', i18n.t.common.login);
}

syncFromCloud();
