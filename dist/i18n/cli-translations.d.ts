/**
 * i18nt CLI 翻译字典
 */
export declare const LANG_ORDER: string[];
export declare const MAIN_LANG = "zh-CN";
export declare const TRANSLATIONS: {
    cli: {
        title: string[];
        usage: string[];
        options: string[];
        examples: string[];
        help: {
            export: string[];
            import: string[];
            input: string[];
            output: string[];
            json: string[];
            lang: string[];
            watch: string[];
            help_opt: string[];
        };
        errors: {
            no_file: string[];
            no_lang_order: string[];
            no_translations: string[];
            skip_lang: string[];
            parse_fail: string[];
            no_json_param: string[];
            path_not_exist: string[];
            no_file_watch: string[];
            non_standard_format: string[];
            unknown_cmd: string[];
        };
        info: {
            dict_order: string[];
            export_lang: string[];
            exported: string[];
            import_dir: string[];
            no_json_files: string[];
            sync_done: string[];
            watching: string[];
            watch_tip: string[];
            change_detected: string[];
        };
    };
};
