export const LANG_ORDER = ['zh-CN', 'en-US', 'ja-JP'];
export const MAIN_LANG = 'zh-CN';

export const TRANSLATIONS = {
  // 1. 基础文本
  basic: {
    title: ['全面的翻译测试', 'Comprehensive Translation Test', '包括的な翻訳テスト'],
    description: ['这是一个用于验证 AI 翻译能力的测试文件。', 'This is a test file for verifying AI translation capabilities.', 'これはAI翻訳能力を検証するためのテストファイルです。'],
  },
  // 2. ICU 变量插值
  interpolation: {
    welcome: ['欢迎回来, {name}！', 'Welcome back, {name}!', 'おかえりなさい、{name}！'],
    status: ['当前状态是：{status}', 'Current status is: {status}', '現在のステータス：{status}'],
  },
  // 3. 复杂的 ICU 复数形式 (Plurals)
  icu: {
    items: ['{count, plural, =0 {没有项目} one {有 1 个项目} other {有 # 个项目}}', '{count, plural, =0 {No items} one {1 item} other {# items}}', '{count, plural, =0 {項目はありません} one {1 つの項目があります} other {# つの項目があります}}'],
    apples: ['{count, plural, one {1 颗苹果} other {# 颗苹果}}', '{count, plural, one {1 apple} other {# apples}}', '{count, plural, one {リンゴ 1 個} other {リンゴ # 個}}'],
  },
  // 4. 深层嵌套命名空间
  nested: {
    level1: {
      level2: {
        action: ['确认删除', 'Confirm deletion', '削除を確認'],
      }
    }
  }
};
