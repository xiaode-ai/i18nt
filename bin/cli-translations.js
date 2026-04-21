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
      doctor_start: ['🏥 正在运行 i18nt doctor 诊断...', '🏥 Running i18nt doctor...']
    }
  }
};

