/**
 * i18nt CLI 翻译字典
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
            input: ['指定翻译字典 (.ts) 的文件路径或目录 (支持逗号分隔多个路径)', 'Specify the path to the translation dictionary (.ts) file or directory (supports comma-separated multiple paths)'],
            output: ['[Export] 指定生成的 JSON 文件存放目录 (默认: ./locales/)', '[Export] Specify the output directory for JSON files (default: ./locales/)'],
            json: ['[Import] 指定需要导入的 JSON 文件路径或目录', '[Import] Specify the JSON file or directory path to import'],
            lang: ['[Export] 指定语言。支持: <code>, <code>,<code> 或 "all"', '[Export] Specify language(s). Supports: <code>, <code>,<code> or "all"'],
            watch: ['[Export] 开启监听模式，目录或文件变化时自动更新 JSON', '[Export] Enable watch mode, automatically update JSON when files in directory change'],
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
            unknown_cmd: [
                '❌ 未知命令: {command}。请运行 npx i18nt --help 查看帮助。',
                '❌ Unknown command: {command}. Please run npx i18nt --help for help.'
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
            change_detected: ['⚡ 检测到变更，已完成同步 {time}', '⚡ Change detected, sync completed at {time}']
        }
    }
};
