/**
 * i18nt CLI 翻译字典 (JS 版本，供 CLI 直接使用)
 */

export const LANG_ORDER = ['zh-CN', 'en-US'];

export const MAIN_LANG = 'zh-CN';

export const TRANSLATIONS = {
  cli: {
    title: [
      '🚀 i18nt CLI — 国际化翻译模板导出/导入工具',
      '🚀 i18nt CLI — i18n Translation Template Export/Import Tool'
    ],
    // UI 界面
    ui_title: ['i18nt 管理界面', 'i18nt Management UI'],
    ui_refresh: ['刷新', 'Refresh'],
    ui_save_all: ['保存全部', 'Save All'],
    ui_visible_langs: ['显示语言:', 'Visible Languages:'],
    ui_key_path: ['字段路径', 'Key Path'],
    ui_actions: ['操作', 'Actions'],
    ui_ai_magic: ['AI 翻译', 'AI Magic'],
    ui_loading: ['正在加载...', 'Loading...'],
    ui_save_success: ['保存成功！', 'Saved successfully!'],
    ui_source_missing: ['该字段缺少主语言内容！', 'Source language missing for this key!'],
    usage: ['用法:', 'Usage:'],
    options: ['选项:', 'Options:'],
    examples: ['🌟 示例场景:', '🌟 Examples:'],
    help: {
      export: ['导出选项', 'Export options'],
      import: ['导入选项', 'Import options'],
      check: ['校验翻译字典格式是否符合标准', 'Check if the translation dictionary format is standard'],
      fix: ['自动修复翻译字典中的格式问题与缺失项', 'Automatically fix format issues and missing items in the translation dictionary'],
      translate: ['[NEW] 利用 AI 自动补全缺失的翻译项', '[NEW] Automatically complete missing translations using AI'],
      extract: ['[NEW] 扫描源码并提取翻译 Key 到字典', '[NEW] Scan source code and extract translation keys to dictionary'],
      init: ['[NEW] 初始化项目：创建标准字典文件与配置文件', '[NEW] Initialize project: create standard dictionary and config files'],
      input: ['指定翻译字典 (.ts) 的文件路径', 'Specify the path to the translation dictionary (.ts) file'],
      output: ['[Export] 指定生成的 JSON 文件存放目录 (默认: ./.i18nt/locales/)', '[Export] Specify the output directory for JSON files (default: ./.i18nt/locales/)'],
      json: ['[Import] 指定需要导入的 JSON 文件路径或目录', '[Import] Specify the JSON file or directory path to import'],
      lang: ['[Export] 指定语言。支持: <code>, <code>,<code> 或 "all"', '[Export] Specify language(s). Supports: <code>, <code>,<code> or "all"'],
      watch: ['[Export] 开启监听模式，TS 变化时自动更新 JSON', '[Export] Enable watch mode, automatically update JSON when TS changes'],
      help_opt: ['显示帮助信息', 'Show help information']
    },
    errors: {
      no_file: ['❌ 找不到翻译字典文件。', '❌ Translation dictionary file not found.'],
      no_lang_order: ['❌ 未能识别 LANG_ORDER。', '❌ Failed to recognize LANG_ORDER.'],
      no_translations: ['❌ 未能识别 TRANSLATIONS 对象。', '❌ Failed to recognize TRANSLATIONS object.'],
      skip_lang: [
        '⚠️  跳过 {file}: 目标 TS 中 LANG_ORDER 未包含 "{lang}"',
        '⚠️  Skipping {file}: LANG_ORDER in target TS does not include "{lang}"'
      ],
      parse_fail: ['❌ 解析 {file} 失败: {message}', '❌ Failed to parse {file}: {message}'],
      no_json_param: ['❌ 请使用 --json 参数指定 JSON 文件或目录路径。', '❌ Please use the --json parameter to specify a JSON file or directory path.'],
      path_not_exist: ['❌ 路径不存在: {path}', '❌ Path does not exist: {path}'],
      no_file_watch: ['❌ 找不到翻译字典文件，无法启动监听。', '❌ Translation dictionary file not found, cannot start watch mode.'],
      non_standard_format: ['❌ 非标准字典格式：检测到语言嵌套 (如 en: { ... })，建议使用标准数组格式 (key: [zh, en])。', '❌ Non-standard dictionary format: Language nesting detected (e.g., en: { ... }), standard array format (key: [zh, en]) is recommended.'],
      ai_error: ['❌ AI 翻译失败: {message}', '❌ AI Translation failed: {message}'],
      no_api_key: ['❌ 缺少 API Key。请设置 I18NT_AI_API_KEY 环境变量。', '❌ Missing API Key. Please set I18NT_AI_API_KEY environment variable.'],
      unknown_cmd: [
        '❌ 未知命令: {command}。请运行 npx i18nt --help 查看帮助。',
        '❌ Unknown command: {command}. Please run npx i18nt --help for help.'
      ],
      duplicate_key: [
        '❌ [ {path} ] 发现重复的 Key: "{key}"',
        '❌ [ {path} ] Duplicate key found: "{key}"'
      ],
      conflict_module: [
        '❌ 模块名冲突: "{module}" 同时存在于:\n    1. {path1}\n    2. {path2}',
        '❌ Module name conflict: "{module}" exists in both:\n    1. {path1}\n    2. {path2}'
      ],
      conflict_path: [
        '❌ 路径冲突: "{path}" 在不同文件中被定义为不同的类型 (Namespace vs Leaf)',
        '❌ Path conflict: "{path}" defined as different types across files (Namespace vs Leaf)'
      ]
    },
    info: {
      dict_order: ['ℹ️  字典语言顺序: [{langs}]', 'ℹ️  Dictionary language order: [{langs}]'],
      export_lang: ['ℹ️  本次导出语言: [{langs}]', 'ℹ️  Exported languages: [{langs}]'],
      exported: ['✅ 已导出: {file} ({count} 根级/命名空间)', '✅ Exported: {file} ({count} root/namespaces)'],
      import_dir: ['ℹ️  正在从目录导入: {path}', 'ℹ️  Importing from directory: {path}'],
      no_json_files: ['ℹ️  目录下没有发现 .json 文件。', 'ℹ️  No .json files found in the directory.'],
      sync_done: ['✅ [{lang}] 同步完成: {updated} 更新, {added} 新增', '✅ [{lang}] Sync complete: {updated} updated, {added} added'],
      watching: ['👀 正在监听: {path}', '👀 Watching: {path}'],
      watch_tip: ['💡 提示：修改并保存 TS 文件后，关联的 JSON 将自动更新。按 Ctrl+C 停止。', '💡 Tip: Save changes to the TS file to automatically update the JSON. Press Ctrl+C to stop.'],
      change_detected: ['⚡ 检测到变更，已完成同步 {time}', '⚡ Change detected, sync completed at {time}'],
      checking: ['正在校验: {file}', 'Checking: {file}'],
      check_ok: ['字典格式校验通过！', 'Dictionary format check passed!'],
      no_main_lang_check: ['未检测到 MAIN_LANG，将使用默认回退。', 'MAIN_LANG not detected, will use default fallback.'],
      missing_langs: ['缺少 {count} 个语言的翻译项 (按索引匹配)。', 'Missing {count} language translations (index-based).'],
      missing_tags: ['缺少以下语言的显式标记: {langs}', 'Missing explicit tags for: {langs}'],
      fixing: ['正在修复: {file}', 'Fixing: {file}'],
      fixed_count: ['✅ 修复完成: 已修正 {count} 个翻译项', '✅ Fix complete: Corrected {count} translation items'],
      no_fix_needed: ['ℹ️  未发现需要修复的问题。', 'ℹ️  No issues found that need fixing.'],
      sorted: ['✅ 字典已完成按字母顺序重排', '✅ Dictionary keys sorted alphabetically'],
      conflict_fix: [
        '🔧 自动重命名冲突 Key: "{old}" -> "{new}" (由于路径 "{path}" 存在类型冲突)',
        '🔧 Auto-renamed conflicting key: "{old}" -> "{new}" (due to type conflict at "{path}")'
      ],
      extract_start: ['🔍 正在扫描源码: {path}', '🔍 Scanning source code: {path}'],
      extract_done: ['✅ 扫描完成: 发现 {count} 个 Key', '✅ Scan complete: Found {count} keys'],
      extract_sync: ['✅ 同步完成: 向 {file} 新增了 {count} 个 Key', '✅ Sync complete: Added {count} keys to {file}'],
      ai_translating: ['🤖 正在调用 AI 翻译 {count} 个项...', '🤖 Calling AI to translate {count} items...'],
      ai_done: ['✅ AI 翻译完成！', '✅ AI Translation complete!'],
      doctor_start: ['🏥 正在运行 i18nt doctor 诊断...', '🏥 Running i18nt doctor...'],
      pruning: ['正在清理: {file}', 'Pruning: {file}'],
      prune_start: ['🧹 正在扫描源码: {path}', '🧹 Scanning source code: {path}'],
      prune_done: ['✅ 清理完成: 移除了 {count} 个无用翻译项', '✅ Prune complete: Removed {count} unused translation items'],
      prune_nothing: ['ℹ️  没有发现无用的翻译项。', 'ℹ️  No unused translation items found.'],
      init_start: ['🚀 正在初始化 i18nt 项目...', '🚀 Initializing i18nt project...'],
      init_success: ['✅ 初始化完成！已创建 {files}', '✅ Initialization complete! Created {files}'],
      init_fail: ['❌ 初始化失败: {message}', '❌ Initialization failed: {message}'],
      tms_sync_start: ['🚀 正在同步到 {provider}...', '🚀 Syncing to {provider}...'],
      tms_sync_start: ['🚀 正在同步到 {provider}...', '🚀 Syncing to {provider}...']
    },
    // 向导相关翻译
    wizard: {
      welcome: [
        '🌟 欢迎使用 i18nt — 智能国际化框架',
        '🌟 Welcome to i18nt — The Intelligent I18n Framework'
      ],
      question: ['请选择要执行的操作:', 'What would you like to do?'],
      // 主菜单分组标题
      group_config: ['── 配置 ──', '── Config ──'],
      group_translate: ['── 翻译 ──', '── Translation ──'],
      group_tools: ['── 工具 ──', '── Tools ──'],
      // 主菜单项
      menu_setup: ['⚙️  配置 AI 服务', '⚙️  Setup AI Provider'],
      menu_setup_hint: ['设置 API Key 和供应商', 'Configure API key and provider'],
      menu_extract: ['🔍 提取翻译项', '🔍 Extract Keys'],
      menu_extract_hint: ['扫描源码中的 t() 调用', 'Scan source code for t() calls'],
      menu_translate: ['🤖 AI 自动翻译', '🤖 AI Translate'],
      menu_translate_hint: ['自动填充缺失的翻译内容', 'Auto-fill missing translations'],
      menu_check: ['🕵️  校验与修复', '🕵️  Check & Fix'],
      menu_check_hint: ['验证并修复字典文件格式', 'Validate and repair dictionary'],
      menu_export: ['📦 导出语言包', '📦 Export Languages'],
      menu_export_hint: ['导出 JSON/多格式语言包', 'Export JSON/multi-format bundles'],
      menu_ui: ['🌐 可视化界面', '🌐 Management UI'],
      menu_ui_hint: ['在浏览器中管理翻译', 'Manage translations in browser'],
      menu_prune: ['🧹 清理无效字段', '🧹 Prune Invalid Fields'],
      menu_prune_hint: ['移除代码中不再使用的翻译 Key', 'Remove unused translation keys'],
      menu_lang: ['🌐 切换语言 / Switch Language', '🌐 Switch Language / 切换语言'],
      menu_exit: ['❌ 退出', '❌ Exit'],
      // 状态标签
      status_configured: ['✅ 已配置', '✅ Configured'],
      status_not_configured: ['⚠️  未配置', '⚠️  Not configured'],
      status_ai: ['AI 服务: {provider} ({model})', 'AI Provider: {provider} ({model})'],
      status_ai_none: ['AI 服务: 未配置', 'AI Provider: Not configured'],
      // 循环提示
      done_prompt: ['操作完成。', 'Operation complete.'],
      press_enter: ['按 Enter 返回主菜单...', 'Press Enter to return to main menu...'],
      bye: ['👋 再见！', '👋 Bye!'],
      invalid: ['⚠️  无效的选择。', '⚠️  Invalid choice.'],
      // 确认
      confirm_prune: ['确定要清理无效字段吗？', 'Confirm prune invalid fields?'],
      cancelled: ['已取消。', 'Cancelled.']
    },
    // 配置向导翻译
    config: {
      title: ['🚀 AI 服务配置向导', '🚀 AI Setup Wizard'],
      select_provider: ['请选择 AI 供应商:', 'Select your AI Provider:'],
      enter_host: ['请输入 API Host:', 'Enter API Host:'],
      enter_host_hint: ['例如: api.proxy.com', 'e.g., api.proxy.com'],
      enter_path: ['请输入 API Path:', 'Enter API Path:'],
      enter_model: ['请输入模型名称:', 'Enter Model Name:'],
      enter_model_hint: ['例如: gpt-4o, deepseek-chat, gemini-2.5-flash', 'e.g., gpt-4o, deepseek-chat, gemini-2.5-flash'],
      model_required: ['❌ 模型名称不能为空！', '❌ Model name is required!'],
      enter_key: ['请输入 API Key:', 'Enter API Key:'],
      key_required: ['❌ API Key 不能为空！', '❌ API Key is required!'],
      // 配置预览
      preview_title: ['📋 配置预览:', '📋 Configuration Preview:'],
      preview_provider: ['供应商', 'Provider'],
      preview_host: ['API Host', 'API Host'],
      preview_path: ['API Path', 'API Path'],
      preview_model: ['模型', 'Model'],
      preview_key: ['API Key', 'API Key'],
      confirm_save: ['确认保存此配置？', 'Confirm and save this configuration?'],
      saved: ['✨ 配置已保存到 .i18ntrc！', '✨ Configuration saved to .i18ntrc!'],
      saved_hint: ['现在可以运行 "i18nt translate" 来开始翻译。', 'You can now run "i18nt translate" to start translating.'],
      cancelled: ['❌ 配置已取消。', '❌ Configuration cancelled.'],
      // 已有配置
      existing_found: ['检测到已有配置:', 'Existing configuration found:'],
      overwrite_confirm: ['是否要覆盖现有配置？', 'Do you want to overwrite the existing configuration?'],
      keeping_existing: ['保留现有配置。', 'Keeping existing configuration.'],
      // 连接测试
      test_connection: ['是否要测试 API 连接？', 'Would you like to test the API connection?'],
      testing: ['🔄 正在测试连接...', '🔄 Testing connection...'],
      test_ok: ['✅ 连接成功！API 响应正常。', '✅ Connection successful! API responding normally.'],
      test_fail: ['❌ 连接失败: {message}', '❌ Connection failed: {message}'],
      test_skip: ['跳过连接测试。', 'Skipping connection test.']
    }
  }
};
